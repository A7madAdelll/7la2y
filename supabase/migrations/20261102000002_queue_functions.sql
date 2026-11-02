-- Phase 1: queue logic. Every state change is one function = one transaction, with row locks.
-- Errors are raised as stable keys (message = 'bad_code', ...) that the app maps to Arabic text.
-- All SECURITY DEFINER functions pin search_path = '' and fully qualify names.
-- Locks are FOR NO KEY UPDATE, never FOR UPDATE: inserting a row that references a shop, barber
-- or entry takes a KEY SHARE lock on it, which FOR UPDATE would block (and deadlock on).

------------------------------------------------------------------------------
-- Internal helpers (schema private: not reachable through the Supabase API)
------------------------------------------------------------------------------

create function private.fail(p_key text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_key;
end $$;

create function private.is_member(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
  )
$$;

create function private.is_owner(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

create function private.require_member(p_shop_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_member(p_shop_id) then
    perform private.fail('forbidden');
  end if;
end $$;

-- Egyptian mobile normalisation: Arabic-Indic / Persian digits, spaces, dashes, +20 / 0020 prefixes.
create function private.normalize_phone(p_raw text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d ~ '^0020' then '0' || substr(d, 5)
    when d ~ '^20' and length(d) = 12 then '0' || substr(d, 3)
    else d
  end
  from (
    select regexp_replace(
      translate(coalesce(p_raw, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
      '[^0-9]', '', 'g') as d
  ) s
$$;

-- Rotating presence code: HMAC(secret, 5-minute window) -> 4 digits. Nothing to store or clean up.
create function private.presence_code(p_secret bytea, p_window bigint) returns text
language sql immutable set search_path = '' as $$
  select lpad(
    (('x' || substr(encode(extensions.hmac(int8send(p_window), p_secret, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint % 10000)::text,
    4, '0')
$$;

create function private.presence_window(p_at timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select floor(extract(epoch from p_at) / 300)::bigint
$$;

-- Accepts the current and the previous window so a code read just before rotation still works.
create function private.presence_code_valid(p_shop_id uuid, p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_secrets s
    where s.shop_id = p_shop_id
      and btrim(coalesce(p_code, '')) in (
        private.presence_code(s.presence_secret, private.presence_window(now())),
        private.presence_code(s.presence_secret, private.presence_window(now()) - 1))
  )
$$;

-- Waiting entries that will be served before this one.
-- "anyone" entries compete with everything; a specific barber's entry only with that barber and "anyone".
create function private.entries_ahead(p_entry_id uuid)
returns table (ahead integer, ahead_minutes integer)
language sql stable security definer set search_path = '' as $$
  select count(w.id)::integer, coalesce(sum(w.total_minutes), 0)::integer
  from public.queue_entries e
  left join public.queue_entries w
    on  w.shop_id = e.shop_id
    and w.status = 'waiting'
    and w.position < e.position
    and (e.requested_barber_id is null
         or w.requested_barber_id is null
         or w.requested_barber_id = e.requested_barber_id)
  where e.id = p_entry_id
$$;

-- Rough wait estimate: minutes of the people ahead, shared across the barbers who can take them.
create function private.estimate_wait(p_entry_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select ceil(a.ahead_minutes::numeric / greatest(
           case when e.requested_barber_id is not null then 1
                else (select count(*) from public.barbers b
                      where b.shop_id = e.shop_id and b.active and b.on_duty)
           end, 1))::integer
  from public.queue_entries e, private.entries_ahead(e.id) a
  where e.id = p_entry_id
$$;

-- Outbox: one "near turn" alert per opted-in entry once 2 or fewer people are ahead.
-- unique (entry_id, kind) makes this safe to call any number of times.
create function private.enqueue_near_turn_alerts(p_shop_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.message_log (shop_id, entry_id, kind, phone)
  select e.shop_id, e.id, 'near_turn', c.phone
  from public.queue_entries e
  join public.customers c on c.id = e.customer_id
  cross join lateral private.entries_ahead(e.id) a
  where e.shop_id = p_shop_id
    and e.status = 'waiting'
    and e.wants_alert
    and a.ahead <= 2
  order by e.id  -- fixed lock order: concurrent callers cannot deadlock on the unique key
  on conflict (entry_id, kind) do nothing
$$;

-- Shared insert for customer joins and staff walk-ins. Caller has already authorised.
create function private.insert_entry(
  p_shop_id     uuid,
  p_customer_id uuid,
  p_name        text,
  p_barber_id   uuid,
  p_service_ids uuid[],
  p_source      text,
  p_wants_alert boolean,
  p_token_hash  bytea
) returns public.queue_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_shop    public.shops;
  v_entry   public.queue_entries;
  v_found   integer;
  v_minutes integer;
  v_day     date;
  v_ahead   integer;
  v_constraint text;
begin
  -- Locking the shop row serialises joins per shop: ticket numbers and positions never collide.
  select * into v_shop from public.shops where id = p_shop_id for no key update;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    perform private.fail('service_required');
  end if;
  if cardinality(p_service_ids) > 10 then
    perform private.fail('too_many_services');
  end if;

  select count(*), coalesce(sum(s.minutes), 0) into v_found, v_minutes
  from public.services s
  where s.shop_id = p_shop_id and s.active and s.id = any (p_service_ids);
  if v_found <> (select count(distinct x) from unnest(p_service_ids) x) then
    perform private.fail('invalid_service');
  end if;
  if not exists (select 1 from public.services s
                 where s.shop_id = p_shop_id and s.id = any (p_service_ids)
                   and s.kind in ('main', 'package')) then
    perform private.fail('main_service_required');
  end if;

  if p_barber_id is not null and not exists (
    select 1 from public.barbers b
    where b.id = p_barber_id and b.shop_id = p_shop_id and b.active and b.on_duty) then
    perform private.fail('invalid_barber');
  end if;

  v_day := (now() at time zone v_shop.timezone)::date;
  update public.shops
     set ticket_seq = case when ticket_day = v_day then ticket_seq + 1 else 1 end,
         ticket_day = v_day
   where id = p_shop_id
  returning * into v_shop;

  begin
    insert into public.queue_entries (
      shop_id, customer_id, customer_name, requested_barber_id, source,
      ticket_day, ticket_no, position, total_minutes, wants_alert, access_token_hash)
    values (
      p_shop_id, p_customer_id, btrim(p_name), p_barber_id, p_source,
      v_day, v_shop.ticket_seq,
      coalesce((select max(position) from public.queue_entries
                where shop_id = p_shop_id and status = 'waiting'), 0) + 1024,
      v_minutes, coalesce(p_wants_alert, false), p_token_hash)
    returning * into v_entry;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'queue_entries_one_active_per_customer' then
      perform private.fail('already_in_queue');
    end if;
    raise;  -- any other clash is a bug: surface it, do not disguise it
  end;

  insert into public.queue_entry_services (shop_id, entry_id, service_id, name, price_egp, minutes)
  select p_shop_id, v_entry.id, s.id, s.name, s.price_egp, s.minutes
  from public.services s
  where s.shop_id = p_shop_id and s.id = any (p_service_ids);

  -- Already close to the front: an alert would be wasted money, the customer is in the shop.
  if v_entry.wants_alert then
    select a.ahead into v_ahead from private.entries_ahead(v_entry.id) a;
    if v_ahead <= 2 then
      update public.queue_entries set wants_alert = false where id = v_entry.id
      returning * into v_entry;
    end if;
  end if;

  return v_entry;
end $$;

-- Default catalog (docs/services-catalog.md). Prices left null: the owner sets them.
create function private.seed_default_services(p_shop_id uuid, p_kinds text[]) returns void
language sql security definer set search_path = '' as $$
  insert into public.services (shop_id, name, category, kind, minutes, sort)
  select p_shop_id, c.name, c.category, c.kind, c.minutes, c.sort
  from (values
    ('قصة شعر',              'men',   'main',    20,  1),
    ('حلاقة زيرو',            'men',   'main',    15,  2),
    ('حلاقة دقن',             'men',   'main',    10,  3),
    ('قصة + دقن',             'men',   'main',    30,  4),
    ('تحديد دقن',             'men',   'main',    10,  5),
    ('غسيل شعر',              'men',   'extra',   10, 10),
    ('فوطة سخنة',             'men',   'extra',   10, 11),
    ('ماسك وش',               'men',   'extra',   15, 12),
    ('تنظيف بشرة',            'men',   'extra',   25, 13),
    ('مساج رأس',              'men',   'extra',   10, 14),
    ('استشوار / تصفيف',       'men',   'extra',   10, 15),
    ('شمع أنف وودن',          'men',   'extra',    5, 16),
    ('صبغة شعر',              'men',   'extra',   40, 17),
    ('كيراتين / بروتين',      'men',   'extra',   60, 18),
    ('مانيكير',               'men',   'extra',   20, 19),
    ('باديكير',               'men',   'extra',   25, 20),
    ('ماسك ضوافر',            'men',   'extra',   15, 21),
    ('باكج عريس',             'men',   'package', 90, 30),
    ('قصة أطفال',             'kids',  'main',    15, 40),
    ('أول قصة',               'kids',  'main',    20, 41),
    ('قصة + تحديد',           'kids',  'main',    20, 42),
    ('قص شعر',                'women', 'main',    30, 50),
    ('سشوار',                 'women', 'main',    30, 51),
    ('تسريحة',                'women', 'main',    45, 52),
    ('صبغة',                  'women', 'main',    90, 53),
    ('هايلايت / لحمة',        'women', 'main',   120, 54),
    ('كيراتين / بروتين',      'women', 'main',   120, 55),
    ('مانيكير',               'women', 'extra',   30, 60),
    ('باديكير',               'women', 'extra',   40, 61),
    ('ماسك ضوافر / تركيب أظافر', 'women', 'extra', 60, 62),
    ('تحديد حواجب',           'women', 'extra',   15, 63),
    ('إزالة شعر (ويكس)',      'women', 'extra',   30, 64),
    ('ماسك وش',               'women', 'extra',   20, 65),
    ('تنظيف بشرة',            'women', 'extra',   45, 66),
    ('ميك أب',                'women', 'extra',   60, 67),
    ('باكج عروسة',            'women', 'package',240, 70)
  ) as c (name, category, kind, minutes, sort)
  where c.category = any (p_kinds)
$$;

------------------------------------------------------------------------------
-- Owner / staff API (role: authenticated, membership checked inside)
------------------------------------------------------------------------------

create function public.create_shop(p_slug text, p_name text, p_kinds text[] default '{men}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    perform private.fail('forbidden');
  end if;
  begin
    insert into public.shops (slug, name, kinds)
    values (lower(btrim(p_slug)), btrim(p_name), coalesce(p_kinds, '{men}'))
    returning id into v_id;
  exception
    when unique_violation then perform private.fail('slug_taken');
    when check_violation then perform private.fail('invalid_shop');
  end;
  insert into public.shop_secrets (shop_id) values (v_id);
  insert into public.shop_members (shop_id, user_id, role) values (v_id, auth.uid(), 'owner');
  perform private.seed_default_services(v_id, coalesce(p_kinds, '{men}'));
  return v_id;
end $$;

create function public.staff_presence_code(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_window bigint := private.presence_window(now());
begin
  perform private.require_member(p_shop_id);
  return (
    select jsonb_build_object(
      'code', private.presence_code(s.presence_secret, v_window),
      'expires_at', to_timestamp((v_window + 1) * 300))
    from public.shop_secrets s where s.shop_id = p_shop_id);
end $$;

create function public.set_queue_open(p_shop_id uuid, p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_member(p_shop_id);
  update public.shops set queue_open = coalesce(p_open, false) where id = p_shop_id;
end $$;

create function public.set_barber_on_duty(p_barber_id uuid, p_on_duty boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid;
begin
  select shop_id into v_shop_id from public.barbers where id = p_barber_id;
  if not found then
    perform private.fail('forbidden');
  end if;
  perform private.require_member(v_shop_id);
  update public.barbers set on_duty = coalesce(p_on_duty, false) where id = p_barber_id;
end $$;

create function public.staff_add_walk_in(
  p_shop_id uuid, p_name text, p_barber_id uuid, p_service_ids uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_member(p_shop_id);
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    perform private.fail('invalid_name');
  end if;
  return (private.insert_entry(p_shop_id, null, p_name, p_barber_id, p_service_ids,
                               'walk_in', false, null)).id;
end $$;

-- "Next" for one barber. p_expected_current is the entry the screen shows in the chair (or null).
-- If it no longer matches (double tap, second cashier already pressed), nothing changes: returns 'stale'.
create function public.queue_next(p_barber_id uuid, p_expected_current uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_barber  public.barbers;
  v_current public.queue_entries;
  v_next    public.queue_entries;
begin
  -- Lock the barber: all "next" presses for this barber run one after another.
  select * into v_barber from public.barbers where id = p_barber_id for no key update;
  if not found then
    perform private.fail('forbidden');
  end if;
  perform private.require_member(v_barber.shop_id);

  select * into v_current from public.queue_entries
  where served_by_barber_id = p_barber_id and status = 'serving'
  for no key update;

  if v_current.id is distinct from p_expected_current then
    return jsonb_build_object('result', 'stale', 'current_entry_id', v_current.id);
  end if;

  if v_current.id is not null then
    update public.queue_entries set status = 'done', finished_at = now()
    where id = v_current.id;
  end if;

  -- skip locked: two barbers pressing at once never take the same "anyone" customer.
  select * into v_next from public.queue_entries
  where shop_id = v_barber.shop_id
    and status = 'waiting'
    and (requested_barber_id = p_barber_id or requested_barber_id is null)
  order by position
  limit 1
  for no key update skip locked;

  if v_next.id is not null then
    update public.queue_entries
       set status = 'serving', served_by_barber_id = p_barber_id, called_at = now()
     where id = v_next.id;
  end if;

  perform private.enqueue_near_turn_alerts(v_barber.shop_id);

  return jsonb_build_object(
    'result', 'ok',
    'finished_entry_id', v_current.id,
    'current_entry_id', v_next.id);
end $$;

create function public.queue_no_show(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id for no key update;
  if not found then
    perform private.fail('forbidden');
  end if;
  perform private.require_member(v_entry.shop_id);
  if v_entry.status not in ('waiting', 'serving') then
    perform private.fail('not_active');
  end if;
  update public.queue_entries set status = 'no_show', finished_at = now() where id = p_entry_id;
  perform private.enqueue_near_turn_alerts(v_entry.shop_id);
end $$;

create function public.queue_cancel(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id for no key update;
  if not found then
    perform private.fail('forbidden');
  end if;
  perform private.require_member(v_entry.shop_id);
  if v_entry.status <> 'waiting' then
    perform private.fail('not_waiting');
  end if;
  update public.queue_entries set status = 'cancelled', finished_at = now() where id = p_entry_id;
  perform private.enqueue_near_turn_alerts(v_entry.shop_id);
end $$;

-- Move a waiting entry to just before another waiting entry (p_before_entry_id null = to the end).
create function public.queue_reorder(p_entry_id uuid, p_before_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_entry  public.queue_entries;
  v_before public.queue_entries;
  v_prev   bigint;
  v_pos    bigint;
begin
  select * into v_entry from public.queue_entries where id = p_entry_id;
  if not found then
    perform private.fail('forbidden');
  end if;
  perform private.require_member(v_entry.shop_id);
  -- Same lock as joins: ordering changes and new joins never interleave.
  perform 1 from public.shops where id = v_entry.shop_id for no key update;
  select * into v_entry from public.queue_entries where id = p_entry_id for no key update;
  if v_entry.status <> 'waiting' then
    perform private.fail('not_waiting');
  end if;

  for i in 1..2 loop
    if p_before_entry_id is null then
      select coalesce(max(position), 0) + 1024 into v_pos
      from public.queue_entries
      where shop_id = v_entry.shop_id and status = 'waiting' and id <> p_entry_id;
      exit;
    end if;

    select * into v_before from public.queue_entries
    where id = p_before_entry_id and shop_id = v_entry.shop_id and status = 'waiting';
    if not found or v_before.id = p_entry_id then
      perform private.fail('invalid_target');
    end if;

    select coalesce(max(position), 0) into v_prev
    from public.queue_entries
    where shop_id = v_entry.shop_id and status = 'waiting'
      and position < v_before.position and id <> p_entry_id;

    if v_before.position - v_prev >= 2 then
      v_pos := v_prev + (v_before.position - v_prev) / 2;
      exit;
    end if;

    -- No gap left: renumber the waiting list once, then retry.
    update public.queue_entries q
       set position = r.rn * 1024
      from (select id, row_number() over (order by position) as rn
            from public.queue_entries
            where shop_id = v_entry.shop_id and status = 'waiting') r
     where q.id = r.id;
  end loop;

  update public.queue_entries set position = v_pos where id = p_entry_id;
  perform private.enqueue_near_turn_alerts(v_entry.shop_id);
end $$;

------------------------------------------------------------------------------
-- Customer API (role: anon). Customers never touch tables directly.
------------------------------------------------------------------------------

create function public.shop_public(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'kinds', s.kinds,
    'queue_open', s.queue_open,
    'waiting_count', (select count(*) from public.queue_entries q
                      where q.shop_id = s.id and q.status = 'waiting'),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.sort, b.name)
      from public.barbers b where b.shop_id = s.id and b.active and b.on_duty), '[]'),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name, 'category', v.category, 'kind', v.kind,
               'price_egp', v.price_egp, 'minutes', v.minutes) order by v.sort, v.name)
      from public.services v where v.shop_id = s.id and v.active), '[]'))
  from public.shops s
  where s.slug = lower(btrim(p_slug))
$$;

create function public.join_queue(
  p_slug        text,
  p_code        text,
  p_name        text,
  p_phone       text,
  p_barber_id   uuid,
  p_service_ids uuid[],
  p_wants_alert boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_shop     public.shops;
  v_phone    text := private.normalize_phone(p_phone);
  v_name     text := btrim(coalesce(p_name, ''));
  v_customer uuid;
  v_token    text := encode(extensions.gen_random_bytes(24), 'hex');
  v_entry    public.queue_entries;
begin
  -- Lock the shop first (same lock as insert_entry) so concurrent joins queue up here.
  select * into v_shop from public.shops where slug = lower(btrim(p_slug)) for no key update;
  if not found then
    perform private.fail('shop_not_found');
  end if;
  if not v_shop.queue_open then
    perform private.fail('queue_closed');
  end if;
  if not private.presence_code_valid(v_shop.id, p_code) then
    perform private.fail('bad_code');
  end if;
  if char_length(v_name) not between 1 and 60 then
    perform private.fail('invalid_name');
  end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    perform private.fail('invalid_phone');
  end if;

  insert into public.customers (shop_id, phone, name)
  values (v_shop.id, v_phone, v_name)
  on conflict (shop_id, phone) do update set name = excluded.name
  returning id into v_customer;

  v_entry := private.insert_entry(v_shop.id, v_customer, v_name, p_barber_id, p_service_ids,
                                  'customer', p_wants_alert,
                                  extensions.digest(v_token, 'sha256'));

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'ticket_no', v_entry.ticket_no,
    'token', v_token,
    'wants_alert', v_entry.wants_alert);
end $$;

-- Live status for the customer's page. The token is the only key; unknown token -> null.
create function public.entry_status(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', e.status,
    'ticket_no', e.ticket_no,
    'shop_name', s.name,
    'barber_name', b.name,
    'ahead', case when e.status = 'waiting' then a.ahead end,
    'estimated_minutes', case when e.status = 'waiting' then private.estimate_wait(e.id) end,
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
                   'name', x.name, 'price_egp', x.price_egp, 'minutes', x.minutes)), '[]')
                 from public.queue_entry_services x where x.entry_id = e.id),
    'wants_alert', e.wants_alert)
  from public.queue_entries e
  join public.shops s on s.id = e.shop_id
  left join public.barbers b on b.id = coalesce(e.served_by_barber_id, e.requested_barber_id)
  cross join lateral private.entries_ahead(e.id) a
  where e.access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

create function public.leave_queue(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
begin
  select * into v_entry from public.queue_entries
  where access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
  for no key update;
  if not found or v_entry.status <> 'waiting' then
    return false;
  end if;
  update public.queue_entries set status = 'left', finished_at = now() where id = v_entry.id;
  perform private.enqueue_near_turn_alerts(v_entry.shop_id);
  return true;
end $$;
