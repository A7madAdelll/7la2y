-- Platform admin (Ahmad): all shops at a glance and manual payment recording.
-- Admins are rows in public.platform_admins (added by SQL, see docs/setup.md).

create function private.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    perform private.fail('forbidden');
  end if;
end $$;

create function public.admin_shops()
returns table (
  id uuid, name text, slug text, created_at timestamptz, owner_email text,
  sub_status text, sub_plan text, paid_until date,
  visits_this_month bigint, alerts_this_month bigint)
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
            and m.created_at >= date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo')
  from public.shops s
  left join lateral (
    select x.status, x.plan, x.period_end from public.subscriptions x
    where x.shop_id = s.id order by x.period_end desc, x.created_at desc limit 1) sub on true
  order by s.created_at desc;
end $$;

create function public.admin_record_payment(
  p_shop_id uuid, p_plan text, p_amount_egp numeric, p_method text,
  p_period_start date, p_period_end date, p_note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform private.require_platform_admin();
  if not exists (select 1 from public.shops where id = p_shop_id) then
    perform private.fail('shop_not_found');
  end if;
  begin
    insert into public.subscriptions (shop_id, plan, status, period_start, period_end, amount_egp, payment_method, note, recorded_by)
    values (p_shop_id, btrim(p_plan), 'active', p_period_start, p_period_end, p_amount_egp, p_method, left(p_note, 500), auth.uid())
    returning id into v_id;
  exception when check_violation or not_null_violation then
    perform private.fail('invalid_payment');
  end;
  return v_id;
end $$;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

revoke execute on function private.require_platform_admin() from public, anon, authenticated;
revoke execute on function public.admin_shops(), public.admin_record_payment(uuid, text, numeric, text, date, date, text),
  public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.admin_shops(), public.admin_record_payment(uuid, text, numeric, text, date, date, text),
  public.is_platform_admin() to authenticated;
