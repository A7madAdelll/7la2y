-- Counter screen in one call, and a login-free TV link.

-- Everything the counter screen shows, for one shop, for its staff only. Same shape as
-- CounterState in src/lib/queue/types.ts.
create function public.counter_state(p_shop_id uuid) returns jsonb
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
      'shop', (select jsonb_build_object('id', s.id, 'name', s.name, 'queue_open', s.queue_open)
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

-- TV link: a per-shop secret (stored hashed). Owner can rotate it if it leaks.
alter table public.shop_secrets add column tv_token_hash bytea unique;

create function public.rotate_tv_link(p_shop_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null or not private.is_owner(p_shop_id) then
    perform private.fail('forbidden');
  end if;
  update public.shop_secrets set tv_token_hash = extensions.digest(v_token, 'sha256')
  where shop_id = p_shop_id;
  return v_token;
end $$;

-- What the waiting-room TV shows: ticket numbers and the current code. No names, no phones.
create function public.tv_board(p_tv_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop_id', s.id,
    'shop_name', s.name,
    'queue_open', s.queue_open,
    'code', private.presence_code(k.presence_secret, private.presence_window(now())),
    'expires_at', to_timestamp((private.presence_window(now()) + 1) * 300),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', b.name,
               'serving_ticket', (select e.ticket_no from public.queue_entries e
                                  where e.served_by_barber_id = b.id and e.status = 'serving'))
             order by b.sort, b.name)
      from public.barbers b where b.shop_id = s.id and b.active and b.on_duty), '[]'),
    'next', coalesce((
      select jsonb_agg(t.ticket_no order by t.position)
      from (select e.ticket_no, e.position from public.queue_entries e
            where e.shop_id = s.id and e.status = 'waiting' order by e.position limit 5) t), '[]'))
  from public.shop_secrets k
  join public.shops s on s.id = k.shop_id
  where k.tv_token_hash = extensions.digest(coalesce(p_tv_token, ''), 'sha256')
$$;

revoke execute on function public.counter_state(uuid), public.rotate_tv_link(uuid),
  public.tv_board(text) from public, anon, authenticated;
grant execute on function public.counter_state(uuid), public.rotate_tv_link(uuid) to authenticated;
grant execute on function public.tv_board(text) to anon, authenticated;
