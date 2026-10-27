-- =============================================================================
-- LIVRAISON AU CLIENT : vider toutes les données et tous les comptes,
-- en GARDANT uniquement le compte de sauvegarde (Gestionnaire).
--
-- !!! DESTRUCTIF ET IRRÉVERSIBLE !!!
--   - supprime TOUTES les données (ventes, reçus, produits, services, acheteurs,
--     rendez-vous, dépenses, paramètres, invitations) ;
--   - supprime TOUS les comptes, sauf celui indiqué ci-dessous ;
--   - remet la numérotation des reçus à REC-000001.
-- À n'exécuter que sur le projet du client. Exportez avant si quoi que ce soit doit être gardé.
--
-- ÉTAPES
--   1. Remplacez BACKUP_EMAIL ci-dessous par l'e-mail du compte de sauvegarde à conserver
--      (il doit exister et être Gestionnaire). Exécutez ce script (SQL Editor -> Run).
--   2. Le client ouvre l'application et crée son compte (« Première connexion ? ») :
--      il devient automatiquement ADMINISTRATEUR, et le compte de sauvegarde est rattaché
--      à son centre : la sauvegarde mensuelle continue de fonctionner sans rien changer.
--   3. L'administrateur invite ensuite son équipe depuis le menu « Équipe ».
--
-- Remarque : tant que le client n'a pas créé son compte, personne d'autre ne doit le faire
-- (le premier compte créé devient administrateur).
-- =============================================================================

do $$
declare
  backup_email text := 'BACKUP_EMAIL';   -- <- à modifier
  backup_id uuid;
begin
  select id into backup_id from auth.users where lower(email) = lower(backup_email);
  if backup_id is null then
    raise exception 'Compte % introuvable dans Authentication > Users.', backup_email;
  end if;
  if not exists (select 1 from profiles where id = backup_id and role = 'gestionnaire' and active) then
    raise exception 'Le compte % n''est pas un Gestionnaire actif.', backup_email;
  end if;

  -- 1. Le compte de sauvegarde ne dépend plus de l'ancien administrateur :
  --    il devient « en attente » (rattaché à lui-même) jusqu'à l'arrivée du nouvel administrateur.
  update profiles set owner_id = backup_id where id = backup_id;

  -- 2. Données : tout est supprimé.
  delete from invitations;
  delete from appointments;
  delete from sales;
  delete from receipts;
  delete from buyers;
  delete from expenses;
  delete from recurring_expenses;
  delete from products;
  delete from services;
  delete from center_settings;
  alter sequence sales_receipt_seq restart with 1;

  -- 3. Comptes : tous sauf la sauvegarde.
  delete from profiles where id <> backup_id;
  delete from auth.users where id <> backup_id;

  raise notice 'Terminé : seul le compte % est conservé (en attente du nouvel administrateur).', backup_email;
end $$;

-- ---------------------------------------------------------------------------
-- Règle d'inscription mise à jour (remplace la version précédente) :
--   - e-mail invité                       -> rejoint le centre avec le rôle prévu ;
--   - AUCUN administrateur n'existe       -> devient administrateur, et rattache à son centre
--                                            les comptes « en attente » (ex. la sauvegarde) ;
--   - sinon                               -> aucun accès.
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
    -- Comptes en attente (rattachés à eux-mêmes, non administrateurs) : ils rejoignent ce centre.
    update profiles set owner_id = new.id where owner_id = id and role <> 'admin';
  end if;

  return new;
end;
$$;
