-- Usage pricing (Ahmad, 4 Nov 2026): 1 EGP per haircut. A billable haircut = a visit the barber
-- finished ("done"); no-shows, people who left and cancellations are not billed.
-- The price itself lives in the app (src/lib/billing.ts) so it can change without a migration.

drop function public.admin_shops();
create function public.admin_shops()
returns table (
  id uuid, name text, slug text, created_at timestamptz, owner_email text,
  sub_status text, sub_plan text, paid_until date,
  visits_this_month bigint, alerts_this_month bigint, haircuts_this_month bigint)
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
         -- Billable: visits the barber finished ("done"), this month in Cairo time.
         (select count(*) from public.queue_entries e
          where e.shop_id = s.id and e.status = 'done'
            and e.finished_at >= date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo')
  from public.shops s
  left join lateral (
    select x.status, x.plan, x.period_end from public.subscriptions x
    where x.shop_id = s.id order by x.period_end desc, x.created_at desc limit 1) sub on true
  order by s.created_at desc;
end $$;

revoke execute on function public.admin_shops() from public, anon, authenticated;
grant execute on function public.admin_shops() to authenticated;
