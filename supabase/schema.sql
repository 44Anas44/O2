-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It creates all tables, secures them so each account only ever sees its own
-- data (row level security), and turns on realtime so the desktop app and the
-- phone app stay in sync automatically.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default '',
  price numeric not null default 0,
  duration_min integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default '',
  purchase_price numeric not null default 0,
  sale_price numeric not null default 0,
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  unit text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('produit', 'service')),
  item_id uuid not null,
  item_name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  unit_cost numeric not null default 0,
  total numeric not null default 0,
  profit numeric not null default 0,
  date date not null,
  time text not null default '',
  client text not null default '',
  appointment_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  category text not null default 'Autre',
  day_of_month integer not null default 1,
  start_month text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  date date not null,
  category text not null default 'Autre',
  source text not null default 'manuelle' check (source in ('manuelle', 'stock', 'fixe')),
  recurring_id uuid references recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  time text not null default '',
  client text not null default '',
  phone text not null default '',
  service_id uuid not null,
  service_name text not null,
  duration_min integer not null default 0,
  status text not null default 'prévu' check (status in ('prévu', 'honoré', 'annulé')),
  note text not null default '',
  sale_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — every account only ever sees / edits its own rows
-- ---------------------------------------------------------------------------

alter table services enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table recurring_expenses enable row level security;
alter table appointments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['services', 'products', 'sales', 'expenses', 'recurring_expenses', 'appointments']
  loop
    execute format('drop policy if exists "owner_select" on %I', t);
    execute format('drop policy if exists "owner_insert" on %I', t);
    execute format('drop policy if exists "owner_update" on %I', t);
    execute format('drop policy if exists "owner_delete" on %I', t);
    execute format('create policy "owner_select" on %I for select using (auth.uid() = user_id)', t);
    execute format('create policy "owner_insert" on %I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_delete" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — lets the desktop and mobile apps see each other's changes live
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table services;
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table recurring_expenses;
alter publication supabase_realtime add table appointments;

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------

create index if not exists sales_user_date_idx on sales (user_id, date);
create index if not exists expenses_user_date_idx on expenses (user_id, date);
create index if not exists appointments_user_date_idx on appointments (user_id, date);
