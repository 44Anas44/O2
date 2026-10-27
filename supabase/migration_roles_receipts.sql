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
