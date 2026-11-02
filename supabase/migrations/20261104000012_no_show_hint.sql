-- No-show limit, shown to the customer. "Next" seats the customer directly (no separate
-- "arrived" step), so "called" and "in the chair" are the same state: a timer on the counter would
-- flag every normal haircut. Instead the customer's page shows the shop's limit after they are
-- called ("come back within N minutes"), and the cashier keeps the manual "مجاش" button.

alter table public.shops
  add column no_show_minutes smallint not null default 10 check (no_show_minutes between 3 and 60);

-- Owners edit it in settings (owner-only update policy on shops already exists).
grant update (no_show_minutes) on public.shops to authenticated;

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
                                         'no_show_minutes', s.no_show_minutes)
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
    'no_show_minutes', s.no_show_minutes)
  from public.queue_entries e
  join public.shops s on s.id = e.shop_id
  left join public.barbers b on b.id = coalesce(e.served_by_barber_id, e.requested_barber_id)
  cross join lateral private.entries_ahead(e.id) a
  where e.access_token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

revoke execute on function public.counter_state(uuid), public.entry_status(text) from public;
grant execute on function public.counter_state(uuid) to authenticated;
grant execute on function public.entry_status(text) to anon, authenticated;
