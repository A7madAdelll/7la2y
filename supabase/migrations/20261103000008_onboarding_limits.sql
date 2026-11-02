-- Onboarding guard: an account can own at most 3 shops (stops scripted shop spam;
-- real chains can be raised by the admin later).
create or replace function public.create_shop(p_slug text, p_name text, p_kinds text[] default '{men}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    perform private.fail('forbidden');
  end if;
  if (select count(*) from public.shop_members where user_id = auth.uid() and role = 'owner') >= 3 then
    perform private.fail('too_many_shops');
  end if;
  begin
    insert into public.shops (slug, name, kinds)
    values (lower(btrim(p_slug)), btrim(p_name), coalesce(p_kinds, '{men}'))
    returning id into v_id;
  exception
    when unique_violation then perform private.fail('slug_taken');
    when check_violation then perform private.fail('invalid_shop');
  end;
  insert into public.shop_secrets (shop_id) values (v_id);
  insert into public.shop_members (shop_id, user_id, role) values (v_id, auth.uid(), 'owner');
  perform private.seed_default_services(v_id, coalesce(p_kinds, '{men}'));
  return v_id;
end $$;

revoke execute on function public.create_shop(text, text, text[]) from public, anon;
grant execute on function public.create_shop(text, text, text[]) to authenticated;
