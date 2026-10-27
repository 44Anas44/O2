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
