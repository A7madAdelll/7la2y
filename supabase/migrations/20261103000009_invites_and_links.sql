-- Cashier invites, staff list, and the shop link for the TV's QR code.

create table public.shop_invites (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         text not null default 'cashier' check (role in ('cashier')),
  token_hash   bytea not null unique,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz
);
create index shop_invites_shop_id_idx on public.shop_invites (shop_id);
create index shop_invites_created_by_idx on public.shop_invites (created_by);
-- Functions only: RLS on, no grants.
alter table public.shop_invites enable row level security;
revoke all on public.shop_invites from anon, authenticated;

-- Owner invites a cashier by email. Returns the one-time link token (shown once).
create function public.create_invite(p_shop_id uuid, p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null or not private.is_owner(p_shop_id) then
    perform private.fail('forbidden');
  end if;
  if (select count(*) from public.shop_invites where shop_id = p_shop_id and created_at > now() - interval '1 day') >= 20 then
    perform private.fail('rate_limited');
  end if;
  begin
    insert into public.shop_invites (shop_id, email, token_hash, created_by)
    values (p_shop_id, lower(btrim(p_email)), extensions.digest(v_token, 'sha256'), auth.uid());
  exception when check_violation then
    perform private.fail('invalid_email');
  end;
  return v_token;
end $$;

-- The invited person, logged in with the SAME email, accepts. A forwarded link is useless to others.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.shop_invites;
begin
  if auth.uid() is null then
    perform private.fail('forbidden');
  end if;
  select * into v_inv from public.shop_invites
  where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
  for no key update;
  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    perform private.fail('invite_invalid');
  end if;
  if lower(coalesce(auth.email(), '')) <> v_inv.email then
    perform private.fail('invite_email_mismatch');
  end if;
  insert into public.shop_members (shop_id, user_id, role)
  values (v_inv.shop_id, auth.uid(), v_inv.role)
  on conflict (shop_id, user_id) do nothing;
  update public.shop_invites set accepted_at = now() where id = v_inv.id;
  return v_inv.shop_id;
end $$;

-- Owner's view of staff (emails come from auth.users, which the API cannot read directly).
create function public.shop_staff(p_shop_id uuid)
returns table (user_id uuid, email text, role text, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_owner(p_shop_id) then
    perform private.fail('forbidden');
  end if;
  return query
  select m.user_id, u.email::text, m.role, m.user_id = auth.uid()
  from public.shop_members m join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop_id
  order by m.role desc, m.created_at;
end $$;

-- Owner removes a cashier. Owners cannot be removed this way (no shop without an owner).
create function public.remove_cashier(p_shop_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_owner(p_shop_id) then
    perform private.fail('forbidden');
  end if;
  delete from public.shop_members where shop_id = p_shop_id and user_id = p_user_id and role = 'cashier';
end $$;

-- The TV shows the shop's QR code, so it needs the shop link.
create or replace function public.tv_board(p_tv_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop_id', s.id,
    'shop_name', s.name,
    'slug', s.slug,
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

revoke execute on function public.create_invite(uuid, text), public.accept_invite(text),
  public.shop_staff(uuid), public.remove_cashier(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_invite(uuid, text), public.accept_invite(text),
  public.shop_staff(uuid), public.remove_cashier(uuid, uuid) to authenticated;
revoke execute on function public.tv_board(text) from public;
grant execute on function public.tv_board(text) to anon, authenticated;
