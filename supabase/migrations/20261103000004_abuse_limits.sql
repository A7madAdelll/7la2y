-- Abuse protection for joining.
--
-- 1. join_queue is no longer callable with the public (anon) key. Only our server (service_role)
--    calls it, after the bot check, passing the client's IP as p_client_key. Before this, anyone
--    with the anon key could call it directly and skip the server's protections.
-- 2. Fixed-window rate limits kept in the database:
--      - 30 join attempts per 10 min per client key (generous: Egyptian mobile carriers and shop
--        Wi-Fi put many people behind one IP),
--      - 10 wrong presence codes per 10 min per client key per shop (stops code guessing:
--        ~0.2% chance per window with 2 valid codes out of 10,000).
-- 3. "bad_code" and "rate_limited" are RETURNED as {"error": ...} instead of raised: a raise rolls
--    back the transaction, which would also roll back the attempt counter.

create table private.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);
-- private schema is not exposed by the API and has no grants; RLS on as a second wall.
alter table private.rate_limits enable row level security;

create function private.rate_window(p_window_seconds integer) returns timestamptz
language sql stable set search_path = '' as $$
  select to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
$$;

-- Counts one hit and reports whether the caller is still within p_max for this window.
create function private.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits (bucket, window_start, hits)
  values (p_bucket, private.rate_window(p_window_seconds), 1)
  on conflict (bucket, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup (about 1 call in 200) so the table stays small without a cron job.
  if random() < 0.005 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- Current hits without counting a new one.
create function private.rate_limit_count(p_bucket text, p_window_seconds integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select hits from private.rate_limits
                   where bucket = p_bucket and window_start = private.rate_window(p_window_seconds)), 0)
$$;

drop function public.join_queue(text, text, text, text, uuid, uuid[], boolean);

create function public.join_queue(
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

  -- Check the guess budget BEFORE checking the code, so a blocked client learns nothing.
  v_code_bucket := 'code:' || v_shop.id || ':' || v_key;
  if private.rate_limit_count(v_code_bucket, 600) >= 10 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  if not private.presence_code_valid(v_shop.id, p_code) then
    perform private.rate_limit_hit(v_code_bucket, 10, 600);
    return jsonb_build_object('error', 'bad_code');
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

-- Grants (see 20261102000003_security.sql for the pattern).
revoke execute on function private.rate_window(integer), private.rate_limit_hit(text, integer, integer),
  private.rate_limit_count(text, integer) from public, anon, authenticated;
revoke execute on function public.join_queue(text, text, text, text, text, uuid, uuid[], boolean)
  from public, anon, authenticated;
grant execute on function public.join_queue(text, text, text, text, text, uuid, uuid[], boolean)
  to service_role;
