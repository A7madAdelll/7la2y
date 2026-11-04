-- Owner-managed menu and optional presence code.
--
-- 1. Owners add, rename and delete their own services, including hospitality (tea, coffee,
--    water: free or paid, 0 minutes so they never lengthen the wait estimate).
-- 2. Shops may switch the rotating presence code off. A one-barber shop working from the
--    barber's phone sees everyone who walks in, and has no TV to show the code on.
--    Rate limits still apply; the code stays ON by default.

alter table public.services drop constraint services_kind_check;
alter table public.services add constraint services_kind_check
  check (kind in ('main', 'extra', 'package', 'hospitality'));
alter table public.services drop constraint services_minutes_check;
alter table public.services add constraint services_minutes_check
  check (minutes between 0 and 600 and (minutes > 0 or kind = 'hospitality'));

-- Delete only works for services never ordered (queue_entry_services keeps history via FK);
-- the app tells the owner to hide those instead.
grant delete on public.services to authenticated;
create policy services_owner_delete on public.services
  for delete to authenticated using (private.is_owner(shop_id));

alter table public.shops add column require_code boolean not null default true;
grant update (require_code) on public.shops to authenticated;

create or replace function public.join_queue(
  p_client_key  text,
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
  v_shop       public.shops;
  v_phone      text := private.normalize_phone(p_phone);
  v_name       text := btrim(coalesce(p_name, ''));
  v_customer   uuid;
  v_token      text := encode(extensions.gen_random_bytes(24), 'hex');
  v_entry      public.queue_entries;
  v_key        text := btrim(coalesce(p_client_key, ''));
  v_code_bucket text;
begin
  if char_length(v_key) not between 1 and 100 then
    perform private.fail('invalid_client');
  end if;
  if not private.rate_limit_hit('join:' || v_key, 30, 600) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  -- Lock the shop first (same lock as insert_entry) so concurrent joins queue up here.
  select * into v_shop from public.shops where slug = lower(btrim(p_slug)) for no key update;
  if not found then
    perform private.fail('shop_not_found');
  end if;
  if not v_shop.queue_open then
    perform private.fail('queue_closed');
  end if;

  -- Shops can switch the presence code off (e.g. one barber who sees everyone who walks in).
  if v_shop.require_code then
    -- Check the guess budget BEFORE checking the code, so a blocked client learns nothing.
    v_code_bucket := 'code:' || v_shop.id || ':' || v_key;
    if private.rate_limit_count(v_code_bucket, 600) >= 10 then
      return jsonb_build_object('error', 'rate_limited');
    end if;
    if not private.presence_code_valid(v_shop.id, p_code) then
      perform private.rate_limit_hit(v_code_bucket, 10, 600);
      return jsonb_build_object('error', 'bad_code');
    end if;
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

create or replace function public.shop_public(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'kinds', s.kinds,
    'queue_open', s.queue_open,
    'require_code', s.require_code,
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

-- The counter needs to know whether to show the code at all.
create or replace function public.counter_state(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member(p_shop_id);
  return (
    with active as (
      select e.*,
             (select coalesce(jsonb_agg(x.name order by x.name), '[]')
              from public.queue_entry_services x where x.entry_id = e.id) as service_names
      from public.queue_entries e
      where e.shop_id = p_shop_id and e.status in ('waiting', 'serving')
    ),
    entry_json as (
      select a.*, jsonb_build_object(
        'id', a.id, 'ticket_no', a.ticket_no, 'customer_name', a.customer_name,
        'services', a.service_names, 'requested_barber_id', a.requested_barber_id,
        'wants_alert', a.wants_alert, 'is_walk_in', a.source = 'walk_in') as j
      from active a
    )
    select jsonb_build_object(
      'shop', (select jsonb_build_object('id', s.id, 'name', s.name, 'queue_open', s.queue_open,
                                         'no_show_minutes', s.no_show_minutes,
                                         'require_code', s.require_code)
               from public.shops s where s.id = p_shop_id),
      'presence', public.staff_presence_code(p_shop_id),
      'barbers', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', b.id, 'name', b.name, 'on_duty', b.on_duty,
                 'serving', (select ej.j || jsonb_build_object('called_at', ej.called_at)
                             from entry_json ej
                             where ej.status = 'serving' and ej.served_by_barber_id = b.id))
               order by b.sort, b.name)
        from public.barbers b where b.shop_id = p_shop_id and b.active), '[]'),
      'waiting', coalesce((
        select jsonb_agg(ej.j order by ej.position) from entry_json ej where ej.status = 'waiting'), '[]'),
      'default_service_id', (
        select v.id from public.services v
        where v.shop_id = p_shop_id and v.active and v.kind = 'main'
        order by v.sort, v.name limit 1))
  );
end $$;

revoke execute on function public.counter_state(uuid) from public;
grant execute on function public.counter_state(uuid) to authenticated;
revoke execute on function public.join_queue(text, text, text, text, text, uuid, uuid[], boolean)
  from public, anon, authenticated;
grant execute on function public.join_queue(text, text, text, text, text, uuid, uuid[], boolean) to service_role;
revoke execute on function public.shop_public(text) from public;
grant execute on function public.shop_public(text) to anon, authenticated;
