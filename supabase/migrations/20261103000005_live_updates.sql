-- Live updates via Supabase Realtime broadcast.
-- Every queue change sends a tiny "changed" ping on the PUBLIC topic shop:<shop id>. The ping
-- carries no customer data; pages then refetch what they are allowed to see (customers: their
-- own entry by token; staff: RLS-scoped tables). One mechanism for customer, counter and TV.

create function private.broadcast_shop_changed(p_shop_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'changed', 'shop:' || p_shop_id, false);
exception when others then
  -- A failed notification must never fail the queue action itself. Pages also refetch on a timer.
  raise warning 'broadcast for shop % failed: %', p_shop_id, sqlerrm;
end $$;

-- Statement-level triggers with transition tables: one ping per shop per statement, not per row.
create function private.queue_entries_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
begin
  for v_shop in select distinct shop_id from changed_rows loop
    perform private.broadcast_shop_changed(v_shop);
  end loop;
  return null;
end $$;

create trigger queue_entries_broadcast_insert
  after insert on public.queue_entries
  referencing new table as changed_rows
  for each statement execute function private.queue_entries_changed();

create trigger queue_entries_broadcast_update
  after update on public.queue_entries
  referencing new table as changed_rows
  for each statement execute function private.queue_entries_changed();

-- Shops and barbers change rarely: row-level triggers with a WHEN filter, so the ticket counter
-- update on every join does NOT send an extra ping. (Transition tables cannot take column lists.)
create function private.shops_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.broadcast_shop_changed(new.id);
  return null;
end $$;

create function private.barbers_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.broadcast_shop_changed(new.shop_id);
  return null;
end $$;

-- Opening/closing the queue and barbers going on/off duty change what pages show too.
create trigger shops_broadcast_update
  after update of queue_open, name on public.shops
  for each row
  when (old.queue_open is distinct from new.queue_open or old.name is distinct from new.name)
  execute function private.shops_changed();

create trigger barbers_broadcast_update
  after update of on_duty, active, name on public.barbers
  for each row
  when (old.on_duty is distinct from new.on_duty or old.active is distinct from new.active
        or old.name is distinct from new.name)
  execute function private.barbers_changed();

-- The customer page needs its shop id to know which topic to listen on.
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
    'wants_alert', e.wants_alert)
  from public.queue_entries e
  join public.shops s on s.id = e.shop_id
  left join public.barbers b on b.id = coalesce(e.served_by_barber_id, e.requested_barber_id)
  cross join lateral private.entries_ahead(e.id) a
  where e.access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

-- Shop links live at the site root (/<slug>), so app paths cannot be shop slugs.
alter table public.shops add constraint shops_slug_not_reserved check (slug not in (
  'demo', 'ui-kit', 'login', 'logout', 'auth', 'admin', 'api', 'counter', 'tv', 't', 'app',
  'settings', 'signup', 'onboarding', 'privacy', 'terms', 'help', 'about', 'static', 'assets',
  'manifest', 'icon', 'apple-icon', 'robots', 'sitemap', 'favicon'));

revoke execute on function private.broadcast_shop_changed(uuid), private.queue_entries_changed(),
  private.shops_changed(), private.barbers_changed() from public, anon, authenticated;
-- create or replace keeps grants, but restate them so this file reads on its own.
revoke execute on function public.entry_status(text) from public;
grant execute on function public.entry_status(text) to anon, authenticated;
