-- Phase 1: access control.
-- Supabase grants every new table/function in public to anon and authenticated by default,
-- so we revoke everything first, then grant the minimum. RLS is enabled on every table.
-- Rule for future migrations: every new table needs RLS + explicit grants, and every new
-- function needs an explicit revoke/grant (see the end of this file).

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

alter table public.shops                enable row level security;
alter table public.shop_secrets         enable row level security;
alter table public.shop_members         enable row level security;
alter table public.platform_admins      enable row level security;
alter table public.barbers              enable row level security;
alter table public.services             enable row level security;
alter table public.customers            enable row level security;
alter table public.queue_entries        enable row level security;
alter table public.queue_entry_services enable row level security;
alter table public.message_log          enable row level security;
alter table public.subscriptions        enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- Staff read their own shop's data (needed for the counter screen and Realtime).
grant select on public.shops, public.shop_members, public.barbers, public.services,
                public.customers, public.queue_entry_services, public.message_log,
                public.subscriptions
  to authenticated;
-- queue_entries without access_token_hash.
grant select (id, shop_id, customer_id, customer_name, requested_barber_id, served_by_barber_id,
              status, source, ticket_day, ticket_no, position, total_minutes, wants_alert,
              joined_at, called_at, finished_at)
  on public.queue_entries to authenticated;

-- Owners manage shop settings, barbers and services directly (validated by table constraints).
-- Queue tables are never written directly: only through the functions.
grant update (name, kinds, timezone) on public.shops to authenticated;
grant insert (shop_id, name, active, on_duty, sort),
      update (name, active, on_duty, sort)
  on public.barbers to authenticated;
grant insert (shop_id, name, category, kind, price_egp, minutes, active, sort),
      update (name, category, kind, price_egp, minutes, active, sort)
  on public.services to authenticated;

create policy shops_member_select on public.shops
  for select to authenticated using (private.is_member(id));
create policy shops_owner_update on public.shops
  for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));

create policy shop_members_member_select on public.shop_members
  for select to authenticated using (private.is_member(shop_id));

create policy barbers_member_select on public.barbers
  for select to authenticated using (private.is_member(shop_id));
create policy barbers_owner_insert on public.barbers
  for insert to authenticated with check (private.is_owner(shop_id));
create policy barbers_owner_update on public.barbers
  for update to authenticated using (private.is_owner(shop_id)) with check (private.is_owner(shop_id));
-- Cashiers toggle on-duty through public.set_barber_on_duty, not by table update.

create policy services_member_select on public.services
  for select to authenticated using (private.is_member(shop_id));
create policy services_owner_insert on public.services
  for insert to authenticated with check (private.is_owner(shop_id));
create policy services_owner_update on public.services
  for update to authenticated using (private.is_owner(shop_id)) with check (private.is_owner(shop_id));

create policy customers_member_select on public.customers
  for select to authenticated using (private.is_member(shop_id));

create policy queue_entries_member_select on public.queue_entries
  for select to authenticated using (private.is_member(shop_id));

create policy queue_entry_services_member_select on public.queue_entry_services
  for select to authenticated using (private.is_member(shop_id));

create policy message_log_member_select on public.message_log
  for select to authenticated using (private.is_member(shop_id));

create policy subscriptions_owner_select on public.subscriptions
  for select to authenticated using (private.is_owner(shop_id));

-- shop_secrets and platform_admins: RLS on, no grants, no policies => unreachable from the API.

------------------------------------------------------------------------------
-- Functions
------------------------------------------------------------------------------

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- RLS policies run as the caller, so the membership checks must be callable.
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid), private.is_owner(uuid) to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.shop_public(text),
  public.join_queue(text, text, text, text, uuid, uuid[], boolean),
  public.entry_status(text),
  public.leave_queue(text)
to anon, authenticated;

grant execute on function
  public.create_shop(text, text, text[]),
  public.staff_presence_code(uuid),
  public.set_queue_open(uuid, boolean),
  public.set_barber_on_duty(uuid, boolean),
  public.staff_add_walk_in(uuid, text, uuid, uuid[]),
  public.queue_next(uuid, uuid),
  public.queue_no_show(uuid),
  public.queue_cancel(uuid),
  public.queue_reorder(uuid, uuid)
to authenticated;
