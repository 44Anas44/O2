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
