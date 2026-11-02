-- WhatsApp outbox worker support. The sender (Next.js cron route, service_role) claims rows,
-- sends via Meta, then reports back. One alert per entry is still guaranteed by
-- message_log unique (entry_id, kind).

-- Claim up to p_limit messages to send now. Rows stuck in "sending" for 5+ minutes (crashed
-- worker) are retried, up to 5 attempts. Stale alerts are closed instead of sent: the customer
-- is no longer waiting, or the alert is older than 30 minutes (e.g. WhatsApp was not set up yet).
create function public.claim_messages(p_limit integer default 20)
returns table (id uuid, phone text, shop_name text, ticket_no integer, attempts smallint)
language plpgsql security definer set search_path = '' as $$
begin
  update public.message_log m
     set status = 'failed', last_error = 'stale', updated_at = now()
    from public.queue_entries e
   where e.id = m.entry_id
     and m.status in ('pending', 'sending')
     and (e.status <> 'waiting' or m.created_at < now() - interval '30 minutes');

  update public.message_log m
     set status = 'failed', last_error = coalesce(m.last_error, 'too_many_attempts'), updated_at = now()
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
    returning m.id, m.phone, m.shop_id, m.entry_id, m.attempts
  )
  select c.id, c.phone, s.name, e.ticket_no, c.attempts
  from claimed c
  join public.shops s on s.id = c.shop_id
  join public.queue_entries e on e.id = c.entry_id;
end $$;

-- Result of one send attempt. A transient failure goes back to pending (retried next run).
create function public.complete_message(
  p_id uuid, p_ok boolean, p_provider_message_id text, p_error text, p_retry boolean default false)
returns void
language sql security definer set search_path = '' as $$
  update public.message_log
     set status = case when p_ok then 'sent' when p_retry then 'pending' else 'failed' end,
         provider_message_id = case when p_ok then p_provider_message_id else provider_message_id end,
         last_error = case when p_ok then null else left(p_error, 500) end,
         updated_at = now()
   where id = p_id and status = 'sending'
$$;

-- Delivery receipts from Meta's webhook. Only moves forward (sent -> delivered -> read),
-- so out-of-order webhooks cannot move a message backwards.
create function public.record_message_status(p_provider_message_id text, p_status text, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.message_log m
     set status = p_status, last_error = coalesce(left(p_error, 500), m.last_error), updated_at = now()
   where m.provider_message_id = p_provider_message_id
     and p_status in ('delivered', 'read', 'failed')
     and (case p_status when 'delivered' then 1 when 'read' then 2 when 'failed' then 3 end)
       > (case m.status when 'sent' then 0 when 'delivered' then 1 when 'read' then 2 else 9 end)
$$;

-- Alerts sent per shop per month (cost tracking and future usage pricing).
create function public.alerts_per_month(p_shop_id uuid)
returns table (month date, sent bigint, failed bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_owner(p_shop_id) then
    perform private.fail('forbidden');
  end if;
  return query
  select date_trunc('month', m.created_at at time zone 'Africa/Cairo')::date,
         count(*) filter (where m.status in ('sent', 'delivered', 'read')),
         count(*) filter (where m.status = 'failed' and m.last_error is distinct from 'stale')
  from public.message_log m where m.shop_id = p_shop_id
  group by 1 order by 1 desc;
end $$;

revoke execute on function public.claim_messages(integer), public.complete_message(uuid, boolean, text, text, boolean),
  public.record_message_status(text, text, text), public.alerts_per_month(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_messages(integer), public.complete_message(uuid, boolean, text, text, boolean),
  public.record_message_status(text, text, text) to service_role;
grant execute on function public.alerts_per_month(uuid) to authenticated;
