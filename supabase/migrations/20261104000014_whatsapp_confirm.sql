-- "Confirm on WhatsApp" (optional, decided by Ahmad 4 Nov 2026).
--
-- The ticket page asks for a short code; WhatsApp opens with a prefilled message containing it;
-- the customer sends it to our business number. Meta forwards it to our webhook, which calls
-- confirm_whatsapp(from, text). The confirmation counts only if the SENDER number equals the
-- number the customer joined with: WhatsApp itself proves who sent it, so the code does not need
-- to be secret (it only says which ticket). We then reply once, inside the 24 h window the
-- customer opened, with the ticket, the order and the queue link.
--
-- The link needs the ticket token, which we only keep hashed. The ticket page passes it when it
-- asks for a code; it is kept until the reply is sent and then erased.

alter table public.queue_entries add column whatsapp_confirmed_at timestamptz;

create table public.whatsapp_confirmations (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null,
  entry_id      uuid not null unique,
  code          text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  link_token    text,                                  -- erased after the reply is queued
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 minutes',
  confirmed_at  timestamptz,
  foreign key (shop_id, entry_id) references public.queue_entries (shop_id, id) on delete cascade
);
create unique index whatsapp_confirmations_open_code on public.whatsapp_confirmations (code)
  where confirmed_at is null;
alter table public.whatsapp_confirmations enable row level security;
revoke all on public.whatsapp_confirmations from anon, authenticated;

-- Outbox: a second message kind, carrying the link until it is sent.
alter table public.message_log drop constraint message_log_kind_check;
alter table public.message_log add constraint message_log_kind_check check (kind in ('near_turn', 'confirm'));
alter table public.message_log add column payload jsonb;

-- Ticket page: "confirm on WhatsApp". Returns the code to put in the prefilled message.
create function public.request_whatsapp_confirm(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.queue_entries;
  v_conf  public.whatsapp_confirmations;
  v_code  text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I: easy to read
begin
  select * into v_entry from public.queue_entries
  where access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');
  if not found or v_entry.status not in ('waiting', 'serving') or v_entry.customer_id is null then
    perform private.fail('not_active');
  end if;
  if v_entry.whatsapp_confirmed_at is not null then
    return jsonb_build_object('already', true);
  end if;

  select * into v_conf from public.whatsapp_confirmations where entry_id = v_entry.id;
  if found and v_conf.expires_at > now() then
    update public.whatsapp_confirmations set link_token = p_token where id = v_conf.id;
    return jsonb_build_object('code', v_conf.code);
  end if;

  for i in 1..10 loop
    v_code := (select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
               from generate_series(1, 6));
    begin
      insert into public.whatsapp_confirmations (shop_id, entry_id, code, link_token)
      values (v_entry.shop_id, v_entry.id, v_code, p_token)
      on conflict (entry_id) do update
        set code = excluded.code, link_token = excluded.link_token,
            created_at = now(), expires_at = now() + interval '30 minutes', confirmed_at = null;
      return jsonb_build_object('code', v_code);
    exception when unique_violation then
      null; -- code already open for another ticket: try another
    end;
  end loop;
  perform private.fail('unknown');
end $$;

-- Webhook: an incoming WhatsApp text. p_from is Meta's international number ("2010...").
create function public.confirm_whatsapp(p_from text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code  text := (regexp_match(upper(coalesce(p_text, '')), '([A-HJ-NP-Z2-9]{6})'))[1];
  v_phone text := private.normalize_phone('+' || coalesce(p_from, ''));
  v_conf  public.whatsapp_confirmations;
  v_entry public.queue_entries;
  v_cust  public.customers;
begin
  if v_code is null then
    return jsonb_build_object('result', 'no_code');
  end if;
  select * into v_conf from public.whatsapp_confirmations
  where code = v_code and confirmed_at is null and expires_at > now()
  for no key update;
  if not found then
    return jsonb_build_object('result', 'unknown_code');
  end if;
  select * into v_entry from public.queue_entries where id = v_conf.entry_id for no key update;
  select * into v_cust from public.customers where id = v_entry.customer_id;
  if v_cust.phone is distinct from v_phone then
    return jsonb_build_object('result', 'phone_mismatch'); -- someone else's code: ignored
  end if;
  if v_entry.status not in ('waiting', 'serving') then
    return jsonb_build_object('result', 'not_active');
  end if;

  update public.whatsapp_confirmations set confirmed_at = now(), link_token = null where id = v_conf.id;
  update public.queue_entries set whatsapp_confirmed_at = now() where id = v_entry.id;
  insert into public.message_log (shop_id, entry_id, kind, phone, payload)
  values (v_entry.shop_id, v_entry.id, 'confirm', v_phone, jsonb_build_object('token', v_conf.link_token))
  on conflict (entry_id, kind) do nothing;
  return jsonb_build_object('result', 'ok');
end $$;

-- Worker claim: now also returns the kind, payload and the order (for the confirm reply).
drop function public.claim_messages(integer);
create function public.claim_messages(p_limit integer default 20)
returns table (id uuid, kind text, phone text, shop_name text, ticket_no integer, attempts smallint,
               payload jsonb, services text[])
language plpgsql security definer set search_path = '' as $$
begin
  -- Stale: customer no longer in the queue, or older than 30 minutes. Payloads are erased.
  update public.message_log m
     set status = 'failed', last_error = 'stale', payload = null, updated_at = now()
    from public.queue_entries e
   where e.id = m.entry_id
     and m.status in ('pending', 'sending')
     and (e.status not in ('waiting', 'serving')
          or (m.kind = 'near_turn' and e.status <> 'waiting')
          or m.created_at < now() - interval '30 minutes');

  update public.message_log m
     set status = 'failed', last_error = coalesce(m.last_error, 'too_many_attempts'), payload = null, updated_at = now()
   where m.status = 'sending' and m.attempts >= 5 and m.updated_at < now() - interval '5 minutes';

  return query
  with picked as (
    select m.id from public.message_log m
    where (m.status = 'pending' or (m.status = 'sending' and m.updated_at < now() - interval '5 minutes'))
      and m.attempts < 5
    order by m.created_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for no key update skip locked
  ), claimed as (
    update public.message_log m
       set status = 'sending', attempts = m.attempts + 1, updated_at = now()
      from picked where m.id = picked.id
    returning m.id, m.kind, m.phone, m.shop_id, m.entry_id, m.attempts, m.payload
  )
  select c.id, c.kind, c.phone, s.name, e.ticket_no, c.attempts, c.payload,
         array(select x.name from public.queue_entry_services x where x.entry_id = e.id order by x.name)
  from claimed c
  join public.shops s on s.id = c.shop_id
  join public.queue_entries e on e.id = c.entry_id;
end $$;

-- Result of a send. The link payload is erased as soon as the message is out (or given up on).
create or replace function public.complete_message(
  p_id uuid, p_ok boolean, p_provider_message_id text, p_error text, p_retry boolean default false)
returns void
language sql security definer set search_path = '' as $$
  update public.message_log
     set status = case when p_ok then 'sent' when p_retry then 'pending' else 'failed' end,
         provider_message_id = case when p_ok then p_provider_message_id else provider_message_id end,
         last_error = case when p_ok then null else left(p_error, 500) end,
         payload = case when p_ok or not p_retry then null else payload end,
         updated_at = now()
   where id = p_id and status = 'sending'
$$;

-- Ticket page shows "confirmed" once the reply is on its way.
create or replace function public.entry_status(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop_id', e.shop_id,
    'status', e.status,
    'ticket_no', e.ticket_no,
    'shop_name', s.name,
    'barber_name', b.name,
    'ahead', case when e.status = 'waiting' then a.ahead end,
    'estimated_minutes', case when e.status = 'waiting' then private.estimate_wait(e.id) end,
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
                   'name', x.name, 'price_egp', x.price_egp, 'minutes', x.minutes)), '[]')
                 from public.queue_entry_services x where x.entry_id = e.id),
    'wants_alert', e.wants_alert,
    -- While in the chair: when they were called and the shop's no-show limit (shown to the customer).
    'called_at', case when e.status = 'serving' then e.called_at end,
    'no_show_minutes', s.no_show_minutes,
    'whatsapp_confirmed', e.whatsapp_confirmed_at is not null)
  from public.queue_entries e
  join public.shops s on s.id = e.shop_id
  left join public.barbers b on b.id = coalesce(e.served_by_barber_id, e.requested_barber_id)
  cross join lateral private.entries_ahead(e.id) a
  where e.access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

revoke execute on function public.request_whatsapp_confirm(text), public.confirm_whatsapp(text, text),
  public.claim_messages(integer), public.complete_message(uuid, boolean, text, text, boolean),
  public.entry_status(text) from public, anon, authenticated;
grant execute on function public.request_whatsapp_confirm(text), public.entry_status(text) to anon, authenticated;
grant execute on function public.confirm_whatsapp(text, text), public.claim_messages(integer),
  public.complete_message(uuid, boolean, text, text, boolean) to service_role;
