-- Installation COMPLÈTE d'un nouveau projet Supabase (schema + rôles + paramètres + ventes multi-articles + TVA/lots), en une seule exécution.
-- Pour un projet déjà en service, utilisez plutôt les migrations séparées.

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


-- ===== migration_roles_receipts.sql =====
-- =============================================================================
-- Migration « utilisateurs, rôles et reçus »
--
-- À exécuter UNE FOIS dans Supabase : SQL Editor → New query → coller → Run.
-- À lancer APRÈS schema.sql. Le script est ré-exécutable sans danger.
--
-- Ce qu'il fait :
--   1. Crée les tables `profiles` (équipe + rôle) et `invitations`.
--   2. Transforme chaque compte existant en administrateur de son propre
--      centre (les données actuelles restent donc visibles, rien n'est perdu).
--   3. Ajoute un numéro de reçu séquentiel sur les ventes + « créé par ».
--   4. Remplace les règles de sécurité (RLS) « un compte = ses données » par
--      « une équipe = les données du centre », avec des droits par rôle.
--
-- Rôles :
--   admin         : tout, y compris la gestion de l'équipe.
--   gestionnaire  : tout sauf la gestion de l'équipe.
--   reception     : ventes, rendez-vous, consultation des produits/services.
--                   Pas d'accès aux dépenses, ni aux rapports financiers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables équipe
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Propriétaire du centre : c'est son id qui est stocké dans `user_id` de
  -- toutes les tables de données (services, produits, ventes, ...).
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'reception'
    check (role in ('admin', 'gestionnaire', 'reception')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('admin', 'gestionnaire', 'reception')),
  created_at timestamptz not null default now()
);

create unique index if not exists invitations_email_idx on invitations (lower(email));
create index if not exists profiles_owner_idx on profiles (owner_id);

-- ---------------------------------------------------------------------------
-- 2. Fonctions utilitaires (security definer : lisent `profiles` sans boucle RLS)
-- ---------------------------------------------------------------------------

create or replace function app_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from profiles where id = auth.uid() and active
$$;

create or replace function app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active
$$;

-- ---------------------------------------------------------------------------
-- 3. Création automatique du profil à l'inscription
--    - e-mail invité      -> rejoint le centre de l'invitation avec son rôle
--    - aucun administrateur n'existe encore -> administrateur de son propre centre
--    - autre              -> aucun profil = aucun accès
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations%rowtype;
begin
  select * into inv from invitations where lower(email) = lower(new.email) limit 1;

  if found then
    insert into profiles (id, owner_id, email, full_name, role)
    values (new.id, inv.owner_id, new.email, inv.full_name, inv.role);
    delete from invitations where id = inv.id;
  elsif not exists (select 1 from profiles where role = 'admin') then
    insert into profiles (id, owner_id, email, full_name, role)
    values (new.id, new.id, new.email, '', 'admin');
    -- Comptes « en attente » (rattachés à eux-mêmes, non administrateurs, ex. la sauvegarde
    -- conservée par handover_keep_backup.sql) : ils rejoignent le centre du nouvel administrateur.
    update profiles set owner_id = new.id where owner_id = id and role <> 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Comptes déjà existants : chacun devient administrateur de son centre.
insert into profiles (id, owner_id, email, role)
select id, id, coalesce(email, ''), 'admin'
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Colonnes ajoutées : numéro de reçu, auteur de la vente / du rendez-vous
-- ---------------------------------------------------------------------------

alter table sales add column if not exists created_by uuid default auth.uid();
alter table sales add column if not exists created_by_name text not null default '';
alter table appointments add column if not exists created_by uuid default auth.uid();
alter table appointments add column if not exists created_by_name text not null default '';

alter table sales add column if not exists receipt_no bigint;
create sequence if not exists sales_receipt_seq;

-- Numérote les ventes existantes dans l'ordre chronologique.
with numbered as (
  select id, row_number() over (order by created_at, id) as n
  from sales
  where receipt_no is null
)
update sales s
set receipt_no = (select coalesce(max(receipt_no), 0) from sales) + numbered.n
from numbered
where s.id = numbered.id;

select setval('sales_receipt_seq', coalesce((select max(receipt_no) from sales), 0) + 1, false);

alter table sales alter column receipt_no set default nextval('sales_receipt_seq');
alter table sales alter column receipt_no set not null;
create unique index if not exists sales_receipt_no_idx on sales (receipt_no);

grant usage, select on sequence sales_receipt_seq to authenticated;
grant select, insert, update, delete on profiles to authenticated;
grant select, insert, update, delete on invitations to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS — profils et invitations
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table invitations enable row level security;

drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "profiles_delete" on profiles;

-- Chacun lit son propre profil (même désactivé, pour afficher le message) ;
-- l'admin lit toute son équipe.
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or (owner_id = app_owner_id() and app_role() = 'admin'));

-- L'admin modifie / retire les autres membres. Il ne peut pas se modifier
-- lui-même ni toucher au compte propriétaire (évite de se verrouiller dehors).
create policy "profiles_update" on profiles for update
  using (owner_id = app_owner_id() and app_role() = 'admin' and id <> auth.uid() and id <> owner_id)
  with check (owner_id = app_owner_id());

create policy "profiles_delete" on profiles for delete
  using (owner_id = app_owner_id() and app_role() = 'admin' and id <> auth.uid() and id <> owner_id);

drop policy if exists "invitations_all" on invitations;
create policy "invitations_all" on invitations for all
  using (owner_id = app_owner_id() and app_role() = 'admin')
  with check (owner_id = app_owner_id() and app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 6. RLS — tables de données, par rôle
--    `user_id` = id du propriétaire du centre (pas de la personne connectée).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  -- table | rôles autorisés en lecture | écriture (insert) | modification | suppression
  spec text[][] := array[
    ['services',           'admin,gestionnaire,reception', 'admin,gestionnaire',           'admin,gestionnaire',           'admin,gestionnaire'],
    ['products',           'admin,gestionnaire,reception', 'admin,gestionnaire',           'admin,gestionnaire,reception', 'admin,gestionnaire'],
    ['sales',              'admin,gestionnaire,reception', 'admin,gestionnaire,reception', 'admin,gestionnaire,reception', 'admin,gestionnaire'],
    ['appointments',       'admin,gestionnaire,reception', 'admin,gestionnaire,reception', 'admin,gestionnaire,reception', 'admin,gestionnaire'],
    ['expenses',           'admin,gestionnaire',           'admin,gestionnaire',           'admin,gestionnaire',           'admin,gestionnaire'],
    ['recurring_expenses', 'admin,gestionnaire',           'admin,gestionnaire',           'admin,gestionnaire',           'admin,gestionnaire']
  ];
  i int;
begin
  for i in 1 .. array_length(spec, 1) loop
    t := spec[i][1];

    -- anciennes règles « un compte = ses données »
    execute format('drop policy if exists "owner_select" on %I', t);
    execute format('drop policy if exists "owner_insert" on %I', t);
    execute format('drop policy if exists "owner_update" on %I', t);
    execute format('drop policy if exists "owner_delete" on %I', t);
    -- règles de cette migration (ré-exécution)
    execute format('drop policy if exists "team_select" on %I', t);
    execute format('drop policy if exists "team_insert" on %I', t);
    execute format('drop policy if exists "team_update" on %I', t);
    execute format('drop policy if exists "team_delete" on %I', t);

    execute format(
      'create policy "team_select" on %I for select using (user_id = app_owner_id() and app_role() = any (string_to_array(%L, '','')))',
      t, spec[i][2]);
    execute format(
      'create policy "team_insert" on %I for insert with check (user_id = app_owner_id() and app_role() = any (string_to_array(%L, '','')))',
      t, spec[i][3]);
    execute format(
      'create policy "team_update" on %I for update using (user_id = app_owner_id() and app_role() = any (string_to_array(%L, '',''))) with check (user_id = app_owner_id())',
      t, spec[i][4]);
    execute format(
      'create policy "team_delete" on %I for delete using (user_id = app_owner_id() and app_role() = any (string_to_array(%L, '','')))',
      t, spec[i][5]);
  end loop;
end $$;

-- Note : la réception peut modifier la table `products` car la déclaration
-- d'une vente décrémente le stock. L'interface lui masque l'édition des produits
-- et les prix d'achat.


-- ===== migration_settings.sql =====
-- =============================================================================
-- Paramètres du centre modifiables dans l'application (menu « Paramètres »)
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après migration_roles_receipts.sql.
-- Ré-exécutable sans danger.
--   - Tous les membres de l'équipe LISENT les paramètres (nécessaire aux PDF).
--   - Seul l'administrateur peut les MODIFIER.
-- =============================================================================

create table if not exists center_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  tagline text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  tax_id text not null default '',
  receipt_footer text not null default '',
  appointment_notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table center_settings enable row level security;

drop policy if exists "settings_select" on center_settings;
drop policy if exists "settings_insert" on center_settings;
drop policy if exists "settings_update" on center_settings;

create policy "settings_select" on center_settings for select
  using (owner_id = app_owner_id());

create policy "settings_insert" on center_settings for insert
  with check (owner_id = app_owner_id() and app_role() = 'admin');

create policy "settings_update" on center_settings for update
  using (owner_id = app_owner_id() and app_role() = 'admin')
  with check (owner_id = app_owner_id() and app_role() = 'admin');

grant select, insert, update on center_settings to authenticated;


-- ===== migration_multi_items.sql =====
-- =============================================================================
-- Migration « vente à plusieurs articles » (UN reçu pour N produits / services)
-- + logo modifiable dans Paramètres.
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après les migrations
-- précédentes (schema, roles_receipts, settings). Ré-exécutable sans danger.
--
-- Ce qu'elle fait :
--   1. Crée la table `receipts` (un reçu = un numéro, un client, une date) ;
--      les lignes de vente (`sales`) y sont rattachées par `receipt_id`.
--   2. Reprend l'historique : chaque ancienne vente devient un reçu d'une ligne,
--      avec le MÊME numéro de reçu (rien ne change pour les anciens reçus).
--   3. Ajoute la fonction create_sale() : enregistre le reçu, toutes les lignes,
--      les rendez-vous et la baisse de stock en UNE SEULE opération « tout ou rien »,
--      avec les prix lus dans la base (le prix ne peut pas être falsifié).
--   4. Ajoute le logo modifiable dans Paramètres (colonne center_settings.logo_data).
--   5. Durcit les droits : la réception ne modifie plus directement les produits
--      ni ne crée de ventes à la main ; tout passe par create_sale().
--
-- IMPORTANT : mettez à jour l'application sur TOUS les ordinateurs après cette
-- migration (l'ancienne version ne sait plus enregistrer une vente).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table des reçus
-- ---------------------------------------------------------------------------

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_no bigint not null,
  client text not null default '',
  phone text not null default '',
  date date not null,
  time text not null default '',
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists receipts_no_idx on receipts (receipt_no);
create index if not exists receipts_user_date_idx on receipts (user_id, date);

alter table sales add column if not exists receipt_id uuid references receipts(id) on delete cascade;
create index if not exists sales_receipt_idx on sales (receipt_id);

-- ---------------------------------------------------------------------------
-- 2. Reprise de l'historique : 1 ancienne vente = 1 reçu (même id, même numéro)
-- ---------------------------------------------------------------------------

insert into receipts (id, user_id, receipt_no, client, phone, date, time, created_by, created_by_name, created_at)
select s.id, s.user_id, s.receipt_no, s.client, coalesce(a.phone, ''), s.date, s.time,
       s.created_by, coalesce(s.created_by_name, ''), s.created_at
from sales s
left join appointments a on a.id = s.appointment_id
where s.receipt_id is null
on conflict (id) do nothing;

update sales set receipt_id = id where receipt_id is null;

-- Le compteur de numéros appartient désormais aux reçus, et ne recule jamais.
create sequence if not exists sales_receipt_seq;
select setval(
  'sales_receipt_seq',
  greatest(
    (select coalesce(max(receipt_no), 0) from receipts) + 1,
    (select last_value + case when is_called then 1 else 0 end from sales_receipt_seq)
  ),
  false
);
alter table receipts alter column receipt_no set default nextval('sales_receipt_seq');

-- sales.receipt_no devient une simple copie du numéro du reçu (plus unique).
drop index if exists sales_receipt_no_idx;
alter table sales alter column receipt_no drop default;
alter table sales alter column receipt_no drop not null;

-- Un reçu sans plus aucune ligne (ex. rendez-vous supprimé) disparaît.
create or replace function cleanup_empty_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.receipt_id is not null then
    delete from receipts
    where id = old.receipt_id
      and not exists (select 1 from sales where receipt_id = old.receipt_id);
  end if;
  return null;
end;
$$;

drop trigger if exists sales_cleanup_receipt on sales;
create trigger sales_cleanup_receipt
  after delete on sales
  for each row execute function cleanup_empty_receipt();

-- ---------------------------------------------------------------------------
-- 3. Sécurité de la table receipts (création uniquement via create_sale)
-- ---------------------------------------------------------------------------

alter table receipts enable row level security;
drop policy if exists "receipts_select" on receipts;
drop policy if exists "receipts_delete" on receipts;

create policy "receipts_select" on receipts for select
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire', 'reception'));

create policy "receipts_delete" on receipts for delete
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire'));

grant select, delete on receipts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receipts'
  ) then
    alter publication supabase_realtime add table receipts;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Droits durcis : plus de modification directe du stock / création directe
--    de ventes par la réception. (La création passe par create_sale ci-dessous.)
-- ---------------------------------------------------------------------------

drop policy if exists "team_update" on products;
create policy "team_update" on products for update
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire'))
  with check (user_id = app_owner_id());

drop policy if exists "team_insert" on sales;
drop policy if exists "team_update" on sales;
create policy "team_update" on sales for update
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire'))
  with check (user_id = app_owner_id());

drop policy if exists "team_insert" on appointments;

-- ---------------------------------------------------------------------------
-- 5. create_sale : enregistre un reçu complet en une seule opération
--
--    p_lines : tableau JSON, par exemple
--      [ {"kind":"produit","item_id":"…","quantity":2},
--        {"kind":"service","item_id":"…","date":"2026-10-20","time":"09:30","note":""} ]
--    p_date  : date du reçu (jour d'encaissement)
--    p_today : « aujourd'hui » côté appareil (décide prévu / honoré d'un rendez-vous)
--    Retourne {receipt, sales, appointments}.
-- ---------------------------------------------------------------------------

create or replace function create_sale(
  p_client text,
  p_phone text,
  p_date date,
  p_time text,
  p_today date,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := app_owner_id();
  v_role text := app_role();
  v_name text;
  v_client text := coalesce(nullif(btrim(p_client), ''), 'Comptoir');
  v_phone text := coalesce(btrim(p_phone), '');
  v_time text := coalesce(p_time, '');
  v_receipt receipts%rowtype;
  v_line jsonb;
  v_prod products%rowtype;
  v_serv services%rowtype;
  v_sale sales%rowtype;
  v_appt appointments%rowtype;
  v_qty numeric;
  v_ldate date;
  v_ltime text;
  v_sales jsonb := '[]'::jsonb;
  v_appts jsonb := '[]'::jsonb;
begin
  if v_owner is null or v_role is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_date is null or p_today is null then
    raise exception 'Date manquante';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La vente est vide';
  end if;

  select coalesce(nullif(full_name, ''), email) into v_name from profiles where id = auth.uid();
  v_name := coalesce(v_name, '');

  insert into receipts (user_id, receipt_no, client, phone, date, time, created_by_name)
  values (v_owner, nextval('sales_receipt_seq'), v_client, v_phone, p_date, v_time, v_name)
  returning * into v_receipt;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if v_line->>'kind' = 'produit' then
      v_qty := greatest(1, coalesce((v_line->>'quantity')::numeric, 1));

      -- Verrou de ligne : deux ventes simultanées du même produit se suivent.
      select * into v_prod from products
      where id = (v_line->>'item_id')::uuid and user_id = v_owner
      for update;
      if not found then
        raise exception 'Produit introuvable';
      end if;

      insert into sales (user_id, kind, item_id, item_name, quantity, unit_price, unit_cost,
                         total, profit, date, time, client, receipt_id, receipt_no, created_by_name)
      values (v_owner, 'produit', v_prod.id, v_prod.name, v_qty, v_prod.sale_price, v_prod.purchase_price,
              v_prod.sale_price * v_qty, (v_prod.sale_price - v_prod.purchase_price) * v_qty,
              p_date, v_time, v_client, v_receipt.id, v_receipt.receipt_no, v_name)
      returning * into v_sale;

      update products set stock = greatest(0, stock - v_qty) where id = v_prod.id;
      v_sales := v_sales || to_jsonb(v_sale);

    elsif v_line->>'kind' = 'service' then
      select * into v_serv from services
      where id = (v_line->>'item_id')::uuid and user_id = v_owner and active;
      if not found then
        raise exception 'Service introuvable ou désactivé';
      end if;

      v_ldate := (v_line->>'date')::date;
      v_ltime := coalesce(v_line->>'time', '');
      if v_ldate is null then
        raise exception 'Date de rendez-vous manquante';
      end if;

      -- Comme avant : pour un service, date/heure de la vente = celles du rendez-vous.
      insert into sales (user_id, kind, item_id, item_name, quantity, unit_price, unit_cost,
                         total, profit, date, time, client, receipt_id, receipt_no, created_by_name)
      values (v_owner, 'service', v_serv.id, v_serv.name, 1, v_serv.price, 0,
              v_serv.price, v_serv.price,
              v_ldate, v_ltime, v_client, v_receipt.id, v_receipt.receipt_no, v_name)
      returning * into v_sale;

      insert into appointments (user_id, date, time, client, phone, service_id, service_name,
                                duration_min, status, note, sale_id, created_by_name)
      values (v_owner, v_ldate, v_ltime, v_client, v_phone, v_serv.id, v_serv.name,
              v_serv.duration_min,
              case when v_ldate < p_today then 'honoré' else 'prévu' end,
              coalesce(v_line->>'note', ''), v_sale.id, v_name)
      returning * into v_appt;

      update sales set appointment_id = v_appt.id where id = v_sale.id returning * into v_sale;
      v_sales := v_sales || to_jsonb(v_sale);
      v_appts := v_appts || to_jsonb(v_appt);

    else
      raise exception 'Type de ligne inconnu';
    end if;
  end loop;

  return jsonb_build_object('receipt', to_jsonb(v_receipt), 'sales', v_sales, 'appointments', v_appts);
end;
$$;

revoke all on function create_sale(text, text, date, text, date, jsonb) from public, anon;
grant execute on function create_sale(text, text, date, text, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Logo du centre, importé depuis Paramètres (image PNG en data URL ;
--    vide = logo par défaut de la marque). Utilisé dans l'application et les PDF.
-- ---------------------------------------------------------------------------

alter table center_settings add column if not exists logo_data text not null default '';


-- ===== migration_vat_bulk.sql =====
-- =============================================================================
-- Migration « TVA sur les produits » + « vente par lot » (remises, acheteurs).
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après migration_multi_items.sql.
-- Ré-exécutable sans danger.
--
-- Ce qu'elle fait :
--   1. Produits : colonne `vat` (TVA 19 % applicable). Si elle est activée, le prix
--      de vente saisi est un prix HT et le client paie HT × 1,19.
--   2. Lignes de vente : `discount_pct` (remise en %) et `vat_amount` (TVA incluse).
--      Le profit exclut la TVA collectée (elle est reversée à l'État).
--   3. Table `buyers` (acheteurs : nom et/ou société) + reçus liés à un acheteur,
--      marqués « vente par lot » (`is_bulk`).
--   4. create_sale() est remplacée : calcule TVA et remises CÔTÉ BASE, impose un
--      acheteur pour une vente par lot, et réserve les remises aux rôles
--      Administrateur et Gestionnaire.
--
-- Anciennes données : aucun prix ne change (vat = faux, remise = 0).
-- Mettez l'application à jour sur tous les ordinateurs après cette migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TVA sur les produits
-- ---------------------------------------------------------------------------

alter table products add column if not exists vat boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Remises et TVA sur les lignes de vente
-- ---------------------------------------------------------------------------

alter table sales add column if not exists discount_pct numeric not null default 0;
alter table sales add column if not exists vat_amount numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 3. Acheteurs (clients de ventes par lot)
-- ---------------------------------------------------------------------------

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  company text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  constraint buyers_name_or_company check (btrim(name) <> '' or btrim(company) <> '')
);

create index if not exists buyers_user_idx on buyers (user_id);

alter table buyers enable row level security;
drop policy if exists "team_select" on buyers;
drop policy if exists "team_insert" on buyers;
drop policy if exists "team_update" on buyers;
drop policy if exists "team_delete" on buyers;

create policy "team_select" on buyers for select
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire', 'reception'));
create policy "team_insert" on buyers for insert
  with check (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire', 'reception'));
create policy "team_update" on buyers for update
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire', 'reception'))
  with check (user_id = app_owner_id());
create policy "team_delete" on buyers for delete
  using (user_id = app_owner_id() and app_role() in ('admin', 'gestionnaire'));

grant select, insert, update, delete on buyers to authenticated;

alter table receipts add column if not exists company text not null default '';
alter table receipts add column if not exists buyer_id uuid references buyers(id) on delete set null;
alter table receipts add column if not exists is_bulk boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buyers'
  ) then
    alter publication supabase_realtime add table buyers;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. create_sale : TVA, remises, acheteur (remplace la version précédente)
--
--    p_lines : [ {"kind":"produit","item_id":"…","quantity":2,"discount_pct":10},
--                {"kind":"service","item_id":"…","date":"…","time":"…","note":""} ]
--    p_bulk  : vente par lot (produits uniquement, acheteur obligatoire, remises permises)
--    Retourne {receipt, sales, appointments}.
-- ---------------------------------------------------------------------------

-- Numéro provisoire (négatif) pendant la création ; le VRAI numéro n'est attribué qu'une fois
-- toute la vente réussie : une vente refusée ne laisse donc aucun « trou » dans la numérotation.
create sequence if not exists receipt_tmp_seq;
grant usage, select on sequence receipt_tmp_seq to authenticated;

do $$
declare
  r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'create_sale' loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

create function create_sale(
  p_client text,
  p_phone text,
  p_date date,
  p_time text,
  p_today date,
  p_lines jsonb,
  p_buyer_id uuid default null,
  p_bulk boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_vat constant numeric := 0.19;
  v_owner uuid := app_owner_id();
  v_role text := app_role();
  v_name text;
  v_client text := coalesce(nullif(btrim(p_client), ''), 'Comptoir');
  v_phone text := coalesce(btrim(p_phone), '');
  v_company text := '';
  v_buyer buyers%rowtype;
  v_time text := coalesce(p_time, '');
  v_receipt receipts%rowtype;
  v_no bigint;
  v_line jsonb;
  v_prod products%rowtype;
  v_serv services%rowtype;
  v_sale sales%rowtype;
  v_appt appointments%rowtype;
  v_qty numeric;
  v_rate numeric;
  v_unit numeric;
  v_disc numeric;
  v_total numeric;
  v_vat_amt numeric;
  v_ldate date;
  v_ltime text;
  v_sales jsonb := '[]'::jsonb;
  v_appts jsonb := '[]'::jsonb;
begin
  if v_owner is null or v_role is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_date is null or p_today is null then
    raise exception 'Date manquante';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La vente est vide';
  end if;

  if p_bulk then
    if p_buyer_id is null then
      raise exception 'Une vente par lot nécessite un acheteur';
    end if;
    select * into v_buyer from buyers where id = p_buyer_id and user_id = v_owner;
    if not found then
      raise exception 'Acheteur introuvable';
    end if;
    -- L'identité de l'acheteur est copiée sur le reçu (elle ne changera plus).
    v_client := coalesce(nullif(btrim(v_buyer.name), ''), btrim(v_buyer.company));
    v_company := btrim(v_buyer.company);
    v_phone := coalesce(nullif(btrim(v_buyer.phone), ''), v_phone);
  end if;

  select coalesce(nullif(full_name, ''), email) into v_name from profiles where id = auth.uid();
  v_name := coalesce(v_name, '');

  insert into receipts (user_id, receipt_no, client, company, phone, date, time, created_by_name, buyer_id, is_bulk)
  values (v_owner, -nextval('receipt_tmp_seq'), v_client, v_company, v_phone, p_date, v_time, v_name,
          case when p_bulk then p_buyer_id else null end, coalesce(p_bulk, false))
  returning * into v_receipt;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if v_line->>'kind' = 'produit' then
      v_qty := greatest(1, coalesce((v_line->>'quantity')::numeric, 1));
      v_disc := coalesce((v_line->>'discount_pct')::numeric, 0);
      if v_disc < 0 or v_disc > 100 then
        raise exception 'Remise invalide';
      end if;
      if v_disc > 0 and not coalesce(p_bulk, false) then
        raise exception 'Les remises sont réservées à la vente par lot';
      end if;
      if v_disc > 0 and v_role not in ('admin', 'gestionnaire') then
        raise exception 'Remise non autorisée pour votre rôle' using errcode = '42501';
      end if;

      -- Verrou de ligne : deux ventes simultanées du même produit se suivent.
      select * into v_prod from products
      where id = (v_line->>'item_id')::uuid and user_id = v_owner
      for update;
      if not found then
        raise exception 'Produit introuvable';
      end if;

      -- Prix saisi = HT quand la TVA est activée ; le client paie HT x 1,19.
      v_rate := case when v_prod.vat then c_vat else 0 end;
      v_unit := round(v_prod.sale_price * (1 + v_rate), 3);
      v_total := round(v_unit * v_qty * (1 - v_disc / 100), 3);
      v_vat_amt := case when v_rate > 0 then round(v_total - v_total / (1 + v_rate), 3) else 0 end;

      insert into sales (user_id, kind, item_id, item_name, quantity, unit_price, unit_cost,
                         total, profit, date, time, client, receipt_id, receipt_no, created_by_name,
                         discount_pct, vat_amount)
      values (v_owner, 'produit', v_prod.id, v_prod.name, v_qty, v_unit, v_prod.purchase_price,
              v_total, v_total - v_vat_amt - v_prod.purchase_price * v_qty,
              p_date, v_time, v_client, v_receipt.id, v_receipt.receipt_no, v_name,
              v_disc, v_vat_amt)
      returning * into v_sale;

      update products set stock = greatest(0, stock - v_qty) where id = v_prod.id;
      v_sales := v_sales || to_jsonb(v_sale);

    elsif v_line->>'kind' = 'service' then
      if coalesce(p_bulk, false) then
        raise exception 'Une vente par lot ne contient que des produits';
      end if;

      select * into v_serv from services
      where id = (v_line->>'item_id')::uuid and user_id = v_owner and active;
      if not found then
        raise exception 'Service introuvable ou désactivé';
      end if;

      v_ldate := (v_line->>'date')::date;
      v_ltime := coalesce(v_line->>'time', '');
      if v_ldate is null then
        raise exception 'Date de rendez-vous manquante';
      end if;

      insert into sales (user_id, kind, item_id, item_name, quantity, unit_price, unit_cost,
                         total, profit, date, time, client, receipt_id, receipt_no, created_by_name)
      values (v_owner, 'service', v_serv.id, v_serv.name, 1, v_serv.price, 0,
              v_serv.price, v_serv.price,
              v_ldate, v_ltime, v_client, v_receipt.id, v_receipt.receipt_no, v_name)
      returning * into v_sale;

      insert into appointments (user_id, date, time, client, phone, service_id, service_name,
                                duration_min, status, note, sale_id, created_by_name)
      values (v_owner, v_ldate, v_ltime, v_client, v_phone, v_serv.id, v_serv.name,
              v_serv.duration_min,
              case when v_ldate < p_today then 'honoré' else 'prévu' end,
              coalesce(v_line->>'note', ''), v_sale.id, v_name)
      returning * into v_appt;

      update sales set appointment_id = v_appt.id where id = v_sale.id returning * into v_sale;
      v_sales := v_sales || to_jsonb(v_sale);
      v_appts := v_appts || to_jsonb(v_appt);

    else
      raise exception 'Type de ligne inconnu';
    end if;
  end loop;

  -- Tout a réussi : on attribue maintenant le vrai numéro de reçu.
  v_no := nextval('sales_receipt_seq');
  update receipts set receipt_no = v_no where id = v_receipt.id returning * into v_receipt;
  update sales set receipt_no = v_no where receipt_id = v_receipt.id;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into v_sales
  from sales s where s.receipt_id = v_receipt.id;

  return jsonb_build_object('receipt', to_jsonb(v_receipt), 'sales', v_sales, 'appointments', v_appts);
end;
$$;

revoke all on function create_sale(text, text, date, text, date, jsonb, uuid, boolean) from public, anon;
grant execute on function create_sale(text, text, date, text, date, jsonb, uuid, boolean) to authenticated;
