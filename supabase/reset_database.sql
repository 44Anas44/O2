-- =============================================================================
-- REMISE À ZÉRO d'un projet Supabase déjà utilisé par cette application.
--
-- !!! DESTRUCTIF ET IRRÉVERSIBLE !!!
--   - supprime TOUTES les tables de l'application et leurs données
--     (services, produits, ventes, reçus, acheteurs, rendez-vous, dépenses, équipe, paramètres) ;
--   - supprime TOUS les comptes utilisateurs du projet.
-- À n'utiliser QUE sur le projet du deuxième client, jamais sur un projet qui
-- contient des données à garder. Exportez d'abord (Table Editor -> Export CSV) au besoin.
--
-- Ordre : 1) ce script  2) full_setup.sql  3) créer l'administrateur (voir SETUP.md).
-- Les autres tables / fonctions étrangères à l'application ne sont pas touchées.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  appointments, sales, receipts, buyers, expenses, recurring_expenses,
  products, services, center_settings, invitations, profiles
cascade;

-- create_sale : toutes ses versions (la signature a changé au fil des migrations).
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

drop function if exists cleanup_empty_receipt();
drop function if exists handle_new_user();
drop function if exists app_owner_id();
drop function if exists app_role();
drop sequence if exists sales_receipt_seq;
drop sequence if exists receipt_tmp_seq;

-- Tous les comptes : le prochain compte créé redeviendra le premier administrateur.
delete from auth.users;
