-- TEST ONLY. Emulates the parts of a Supabase database our migrations rely on,
-- so tests can run against plain Postgres (CI service container, local).
-- Never apply this to a real Supabase project: these objects already exist there.

create schema if not exists extensions;
create schema if not exists auth;

-- Roles are cluster-wide and test files run in parallel: tolerate a concurrent create.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    begin
      execute format('create role %I nologin', r);
    exception when duplicate_object or unique_violation then null;
    end;
  end loop;
end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Same contract as Supabase's auth.uid(): the JWT "sub" claim, or null for anon.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default privileges: everything new in public is granted to the API roles.
-- This is why every table needs RLS and every internal function needs an explicit revoke.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Supabase Realtime's realtime.send(payload, event, topic, private). The test version records
-- calls so tests can assert which pings were sent.
create schema if not exists realtime;
create table if not exists realtime.test_messages (
  id bigserial primary key, topic text, event text, payload jsonb, private boolean,
  sent_at timestamptz default clock_timestamp());
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.test_messages (topic, event, payload, private) values (topic, event, payload, private)
$$;
