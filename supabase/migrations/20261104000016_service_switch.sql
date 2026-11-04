-- Manual billing (Ahmad, 4 Nov 2026): the platform admin sends the invoice by hand and turns a
-- shop's service on or off. Off = nobody can join its queue (customers or cashier walk-ins);
-- people already waiting are still served, and the owner can still log in.

alter table public.shops add column suspended_at timestamptz; -- null = service on
-- No column grant to authenticated: owners cannot switch their own service back on.

-- A trigger covers every way into the queue (join_queue, walk-ins, anything added later).
create function private.block_suspended_shop() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.shops s where s.id = new.shop_id and s.suspended_at is not null) then
    perform private.fail('service_suspended');
  end if;
  return new;
end $$;

create trigger queue_entries_block_suspended before insert on public.queue_entries
  for each row execute function private.block_suspended_shop();

create function public.admin_set_service(p_shop_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  update public.shops set suspended_at = case when p_enabled then null else now() end
  where id = p_shop_id;
  if not found then
    perform private.fail('shop_not_found');
  end if;
end $$;

drop function public.admin_shops();
create function public.admin_shops()
returns table (
  id uuid, name text, slug text, created_at timestamptz, owner_email text,
  sub_status text, sub_plan text, paid_until date,
  visits_this_month bigint, alerts_this_month bigint, haircuts_this_month bigint,
  service_on boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select s.id, s.name, s.slug, s.created_at,
         (select u.email::text from public.shop_members m join auth.users u on u.id = m.user_id
          where m.shop_id = s.id and m.role = 'owner' order by m.created_at limit 1),
         sub.status, sub.plan, sub.period_end,
         (select count(*) from public.queue_entries e
          where e.shop_id = s.id and e.joined_at >= date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'),
         (select count(*) from public.message_log m
          where m.shop_id = s.id and m.status in ('sent', 'delivered', 'read')
            and m.created_at >= date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'),
         (select count(*) from public.queue_entries e
          where e.shop_id = s.id and e.status = 'done'
            and e.finished_at >= date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'),
         s.suspended_at is null
  from public.shops s
  left join lateral (
    select x.status, x.plan, x.period_end from public.subscriptions x
    where x.shop_id = s.id order by x.period_end desc, x.created_at desc limit 1) sub on true
  order by s.created_at desc;
end $$;

revoke execute on function private.block_suspended_shop() from public, anon, authenticated;
revoke execute on function public.admin_set_service(uuid, boolean), public.admin_shops()
  from public, anon, authenticated;
grant execute on function public.admin_set_service(uuid, boolean), public.admin_shops() to authenticated;
