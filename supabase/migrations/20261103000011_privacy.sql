-- Privacy (Egypt PDPL 151/2020): keep personal data only as long as needed, and let a customer
-- erase theirs. Retention default: 90 days without a visit (product decision, lawyer to confirm).

alter table public.customers add column last_seen_at timestamptz not null default now();
-- Alert rows outlive the phone number (monthly counts), so the number becomes optional.
alter table public.message_log alter column phone drop not null;
create index customers_last_seen_idx on public.customers (last_seen_at);
create index message_log_created_idx on public.message_log (created_at);

-- Joining refreshes last_seen_at (join_queue upserts the customer; this keeps it in one place).
create function private.touch_customer() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.last_seen_at := now();
  return new;
end $$;
-- join_queue's upsert always sets name (even to the same value), so "update of name" = a visit.
create trigger customers_touch before update of name on public.customers
  for each row execute function private.touch_customer();

-- Erases one customer's personal data in one shop. Visit rows stay (anonymous) for statistics.
create function private.erase_customer(p_customer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.queue_entries set status = 'left', finished_at = now()
   where customer_id = p_customer_id and status = 'waiting';
  update public.message_log m set phone = null
    from public.queue_entries e
   where e.id = m.entry_id and e.customer_id = p_customer_id;
  update public.queue_entries set customer_name = '—', wants_alert = false
   where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id; -- entries keep rows, customer_id -> null
end $$;

-- "امسح بياناتي" on the ticket page: the token proves it is their entry.
create function public.forget_me(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.queue_entries
  where access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');
  if v_customer is null then
    return false;
  end if;
  perform private.erase_customer(v_customer);
  return true;
end $$;

-- Daily job: erase customers not seen for p_days, and phone numbers on old alert rows.
-- Never touches anyone with an active (waiting/serving) entry.
create function public.purge_personal_data(p_days integer default 90)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_customers integer := 0;
  v_phones integer;
  v_id uuid;
begin
  if p_days is null or p_days < 30 then
    perform private.fail('invalid_retention'); -- guard against wiping recent data by mistake
  end if;
  for v_id in
    select c.id from public.customers c
    where c.last_seen_at < now() - make_interval(days => p_days)
      and not exists (select 1 from public.queue_entries e
                      where e.customer_id = c.id and e.status in ('waiting', 'serving'))
    limit 5000
  loop
    perform private.erase_customer(v_id);
    v_customers := v_customers + 1;
  end loop;
  update public.message_log set phone = null
   where phone is not null and created_at < now() - make_interval(days => p_days);
  get diagnostics v_phones = row_count;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return jsonb_build_object('customers_erased', v_customers, 'alert_phones_cleared', v_phones);
end $$;

revoke execute on function private.touch_customer(), private.erase_customer(uuid) from public, anon, authenticated;
revoke execute on function public.forget_me(text), public.purge_personal_data(integer) from public, anon, authenticated;
grant execute on function public.forget_me(text) to anon, authenticated;
grant execute on function public.purge_personal_data(integer) to service_role;
