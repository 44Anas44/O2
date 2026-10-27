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
