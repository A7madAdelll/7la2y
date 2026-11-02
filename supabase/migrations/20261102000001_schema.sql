-- Phase 1: core schema. Invariants live here, not in the app.
-- Composite FKs (shop_id, id) make cross-shop references impossible:
-- an entry can only point at a barber/service/customer of its own shop.

create extension if not exists pgcrypto with schema extensions;

-- Internal helpers live in a schema the Supabase API does not expose.
create schema if not exists private;

create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  kinds       text[] not null default '{men}'
              check (cardinality(kinds) >= 1 and kinds <@ array['men','women','kids']),
  timezone    text not null default 'Africa/Cairo',
  queue_open  boolean not null default false,
  -- Daily ticket counter ("رقم 12"); reset when the shop's local date changes.
  ticket_day  date,
  ticket_seq  integer not null default 0 check (ticket_seq >= 0),
  created_at  timestamptz not null default now()
);

-- Kept apart from shops so no row-level grant on shops can ever expose it.
create table public.shop_secrets (
  shop_id          uuid primary key references public.shops (id) on delete cascade,
  presence_secret  bytea not null default extensions.gen_random_bytes(32)
);

create table public.shop_members (
  shop_id     uuid not null references public.shops (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'cashier')),
  created_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_id_idx on public.shop_members (user_id);

create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.barbers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  active      boolean not null default true,   -- works at this shop at all
  on_duty     boolean not null default true,   -- working today
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (shop_id, id)
);
create index barbers_shop_id_idx on public.barbers (shop_id);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  category    text not null check (category in ('men', 'women', 'kids')),
  kind        text not null check (kind in ('main', 'extra', 'package')),
  price_egp   numeric(10, 2) check (price_egp >= 0),  -- null until the owner sets it
  minutes     smallint not null check (minutes between 1 and 600),
  active      boolean not null default true,
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (shop_id, id)
);
create index services_shop_id_idx on public.services (shop_id);

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  phone       text not null check (phone ~ '^01[0125][0-9]{8}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (shop_id, phone),
  unique (shop_id, id)
);

create table public.queue_entries (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references public.shops (id) on delete cascade,
  customer_id          uuid,                 -- null for walk-ins added by staff
  customer_name        text not null check (char_length(btrim(customer_name)) between 1 and 60),
  requested_barber_id  uuid,                 -- null = "anyone"
  served_by_barber_id  uuid,
  status               text not null default 'waiting'
                       check (status in ('waiting', 'serving', 'done', 'no_show', 'left', 'cancelled')),
  source               text not null check (source in ('customer', 'walk_in')),
  ticket_day           date not null,
  ticket_no            integer not null check (ticket_no > 0),
  position             bigint not null,      -- gapped ordering (steps of 1024) so reorder touches one row
  total_minutes        integer not null default 0 check (total_minutes >= 0),
  wants_alert          boolean not null default false,
  access_token_hash    bytea unique,         -- sha256 of the customer's secret link token
  joined_at            timestamptz not null default now(),
  called_at            timestamptz,
  finished_at          timestamptz,
  unique (shop_id, id),
  unique (shop_id, ticket_day, ticket_no),
  foreign key (shop_id, customer_id) references public.customers (shop_id, id) on delete set null (customer_id),
  foreign key (shop_id, requested_barber_id) references public.barbers (shop_id, id),
  foreign key (shop_id, served_by_barber_id) references public.barbers (shop_id, id),
  check (status <> 'serving' or served_by_barber_id is not null),
  check (not wants_alert or customer_id is not null)
);
-- One active entry per customer per shop.
create unique index queue_entries_one_active_per_customer
  on public.queue_entries (shop_id, customer_id)
  where status in ('waiting', 'serving') and customer_id is not null;
-- A barber serves one customer at a time.
create unique index queue_entries_one_serving_per_barber
  on public.queue_entries (served_by_barber_id)
  where status = 'serving';
create index queue_entries_waiting_idx
  on public.queue_entries (shop_id, position)
  where status = 'waiting';
create index queue_entries_customer_id_idx on public.queue_entries (customer_id);
create index queue_entries_requested_barber_idx on public.queue_entries (requested_barber_id);
create index queue_entries_served_by_barber_idx on public.queue_entries (served_by_barber_id);

-- Services chosen for an entry. Price and minutes are copied at join time so
-- later price changes do not rewrite history.
create table public.queue_entry_services (
  shop_id     uuid not null,
  entry_id    uuid not null,
  service_id  uuid not null,
  name        text not null,
  price_egp   numeric(10, 2),
  minutes     smallint not null,
  primary key (entry_id, service_id),
  foreign key (shop_id, entry_id) references public.queue_entries (shop_id, id) on delete cascade,
  foreign key (shop_id, service_id) references public.services (shop_id, id)
);
create index queue_entry_services_service_id_idx on public.queue_entry_services (service_id);
create index queue_entry_services_shop_entry_idx on public.queue_entry_services (shop_id, entry_id);

-- WhatsApp outbox. unique (entry_id, kind) is the "never more than one alert" guarantee.
create table public.message_log (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references public.shops (id) on delete cascade,
  entry_id             uuid not null,
  kind                 text not null check (kind in ('near_turn')),
  phone                text not null check (phone ~ '^01[0125][0-9]{8}$'),
  status               text not null default 'pending'
                       check (status in ('pending', 'sending', 'sent', 'delivered', 'read', 'failed')),
  attempts             smallint not null default 0,
  provider_message_id  text unique,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (entry_id, kind),
  foreign key (shop_id, entry_id) references public.queue_entries (shop_id, id) on delete cascade
);
create index message_log_pending_idx on public.message_log (created_at) where status = 'pending';
create index message_log_shop_created_idx on public.message_log (shop_id, created_at);

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  plan            text not null,
  status          text not null check (status in ('trial', 'active', 'past_due', 'cancelled')),
  period_start    date not null,
  period_end      date not null check (period_end >= period_start),
  amount_egp      numeric(10, 2) check (amount_egp >= 0),
  payment_method  text check (payment_method in ('instapay', 'vodafone_cash', 'cash', 'other')),
  note            text,
  recorded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index subscriptions_shop_id_idx on public.subscriptions (shop_id);
create index subscriptions_recorded_by_idx on public.subscriptions (recorded_by);

-- Status machine. Terminal states never change; skipping straight to done is not allowed.
create function private.check_entry_transition() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if not (
       (old.status = 'waiting' and new.status in ('serving', 'no_show', 'left', 'cancelled'))
    or (old.status = 'serving' and new.status in ('done', 'no_show'))
  ) then
    raise exception using errcode = 'P0001',
      message = 'invalid_transition',
      detail = format('%s -> %s', old.status, new.status);
  end if;
  return new;
end $$;

create trigger queue_entries_transition
  before update of status on public.queue_entries
  for each row execute function private.check_entry_transition();
