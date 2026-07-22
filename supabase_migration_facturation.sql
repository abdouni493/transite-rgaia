-- ============================================================
-- Migration — run once against an existing TransitPro database.
--
--   1. Company gains an electronic stamp ("cachet"), printed on documents.
--   2. Entrepôts (warehouses) — a new interface, one row per storage site.
--   3. Car catalog: brands ("Renault") and models ("Clio 5"), reusable.
--   4. Secondary clients point at an entrepôt.
--   5. Services — the billable catalog (amount HT + TVA %).
--   6. Invoices — sequential number 0001, lines snapshotted as jsonb.
--
-- Re-run it after pulling: it also grants the "invoices.edit" action that
-- the Modifier button on the Facturation screen checks for.
--
-- Every step is guarded, so the file is safe to re-run.
-- ============================================================

begin;

/* ---------- 1. electronic stamp ---------- */

alter table public.company
  add column if not exists stamp text;

/* ---------- 2. entrepôts ---------- */

create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null default '',
  phone       text not null default '',
  email       text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now()
);

/* ---------- 3. car catalog ---------- */

create table if not exists public.car_brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.car_models (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.car_brands (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists car_models_brand_idx on public.car_models (brand_id);

-- The unique above only fires when the table is created for the first time.
-- The seed below resolves conflicts against it, so make sure it is really
-- there even if the table was put in place by hand.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'car_models_brand_id_name_key'
  ) then
    alter table public.car_models
      add constraint car_models_brand_id_name_key unique (brand_id, name);
  end if;
end $$;

-- Seed the catalog from what the secondary clients already carry, so the new
-- pickers open with the makes and models the office has been typing by hand.
insert into public.car_brands (name)
select distinct btrim(car_brand)
  from public.secondary_clients
 where btrim(coalesce(car_brand, '')) <> ''
on conflict (name) do nothing;

insert into public.car_models (brand_id, name)
select distinct b.id, btrim(s.car_name)
  from public.secondary_clients s
  join public.car_brands b on b.name = btrim(s.car_brand)
 where btrim(coalesce(s.car_name, '')) <> ''
on conflict (brand_id, name) do nothing;

/* ---------- 4. secondary clients → entrepôt ---------- */
-- Nullable on purpose: cars recorded before entrepôts existed have none, and
-- the screen shows them as "—" until someone edits them.

alter table public.secondary_clients
  add column if not exists warehouse_id uuid references public.warehouses (id) on delete set null;

create index if not exists secondary_clients_warehouse_idx
  on public.secondary_clients (warehouse_id);

/* ---------- 5. services ---------- */

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(14,2) not null default 0 check (amount >= 0),
  tva         numeric(6,2)  not null default 0 check (tva >= 0 and tva <= 100),
  description text not null default '',
  created_at  timestamptz not null default now()
);

/* ---------- 6. invoices ---------- */

create sequence if not exists public.invoice_no_seq start 1;

create table if not exists public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  invoice_no           integer not null default nextval('public.invoice_no_seq'),
  secondary_client_id  uuid not null references public.secondary_clients (id) on delete cascade,
  date                 date not null default current_date,
  -- the car price at the moment of invoicing; reprints must not drift
  car_price            numeric(14,2) not null default 0,
  -- [{ serviceId, name, amount, tva, quantity }, ...]
  lines                jsonb not null default '[]'::jsonb,
  notes                text,
  created_by           text not null default '',
  created_at           timestamptz not null default now()
);

create unique index if not exists invoices_invoice_no_idx on public.invoices (invoice_no);
create index if not exists invoices_client_idx on public.invoices (secondary_client_id);
create index if not exists invoices_date_idx   on public.invoices (date desc);

-- Existing rows (if the table pre-dates this file) are numbered in date order.
with ordered as (
  select id, row_number() over (order by date, created_at, id) as n
    from public.invoices
   where invoice_no is null
)
update public.invoices i
   set invoice_no = ordered.n
  from ordered
 where i.id = ordered.id;

select setval(
  'public.invoice_no_seq',
  greatest(1, coalesce((select max(invoice_no) from public.invoices), 0))
);

/* ---------- 7. permission catalog ---------- */

insert into public.app_pages (key, label_fr, label_ar, icon, sort) values
  ('warehouses', 'Entrepôts',   'المستودعات', 'Warehouse',   5),
  ('services',   'Services',    'الخدمات',    'Wrench',      8),
  ('invoices',   'Facturation', 'الفوترة',    'ReceiptText', 9)
on conflict (key) do update
  set label_fr = excluded.label_fr,
      label_ar = excluded.label_ar,
      icon     = excluded.icon,
      sort     = excluded.sort;

-- keep the sidebar order of the pages that shifted down
update public.app_pages set sort =  6 where key = 'customs';
update public.app_pages set sort =  7 where key = 'paymentTracking';
update public.app_pages set sort = 10 where key = 'caisse';
update public.app_pages set sort = 11 where key = 'workers';
update public.app_pages set sort = 12 where key = 'reports';
update public.app_pages set sort = 13 where key = 'settings';

insert into public.app_actions (page_key, key, label_fr, label_ar, sensitive, sort) values
  ('warehouses', 'create', 'Créer',     'إنشاء', false, 1),
  ('warehouses', 'view',   'Consulter', 'عرض',   false, 2),
  ('warehouses', 'edit',   'Modifier',  'تعديل', false, 3),
  ('warehouses', 'delete', 'Supprimer', 'حذف',   true,  4),

  ('services', 'create', 'Créer',     'إنشاء', false, 1),
  ('services', 'view',   'Consulter', 'عرض',   false, 2),
  ('services', 'edit',   'Modifier',  'تعديل', false, 3),
  ('services', 'delete', 'Supprimer', 'حذف',   true,  4),

  ('invoices', 'create', 'Créer une facture',  'إنشاء فاتورة', false, 1),
  ('invoices', 'view',   'Consulter',          'عرض',          false, 2),
  ('invoices', 'edit',   'Modifier',           'تعديل',        false, 3),
  ('invoices', 'delete', 'Supprimer',          'حذف',          true,  4),
  ('invoices', 'print',  'Imprimer',           'طباعة',        false, 5),

  ('secondaryClients', 'createWarehouseInline', 'Créer un entrepôt en ligne', 'إنشاء مستودع مباشرة', false, 6),
  ('secondaryClients', 'createCarInline',       'Créer marque / modèle',      'إنشاء علامة أو طراز',  false, 7)
on conflict (page_key, key) do update
  set label_fr  = excluded.label_fr,
      label_ar  = excluded.label_ar,
      sensitive = excluded.sensitive,
      sort      = excluded.sort;

/* ---------- 8. row level security ---------- */

alter table public.warehouses enable row level security;
alter table public.car_brands enable row level security;
alter table public.car_models enable row level security;
alter table public.services   enable row level security;
alter table public.invoices   enable row level security;

drop policy if exists warehouses_read   on public.warehouses;
drop policy if exists warehouses_insert on public.warehouses;
drop policy if exists warehouses_update on public.warehouses;
drop policy if exists warehouses_delete on public.warehouses;

create policy warehouses_read on public.warehouses
  for select to authenticated using (true);
create policy warehouses_insert on public.warehouses
  for insert to authenticated with check (
    public.has_action('warehouses', 'create')
    or public.has_action('secondaryClients', 'createWarehouseInline')
  );
create policy warehouses_update on public.warehouses
  for update to authenticated
  using (public.has_action('warehouses', 'edit'))
  with check (public.has_action('warehouses', 'edit'));
create policy warehouses_delete on public.warehouses
  for delete to authenticated using (public.has_action('warehouses', 'delete'));

-- The car catalog is a shared lookup: anyone who may file a secondary client
-- may extend it, because a make missing from the list blocks the form.
drop policy if exists car_brands_read  on public.car_brands;
drop policy if exists car_brands_write on public.car_brands;
drop policy if exists car_models_read  on public.car_models;
drop policy if exists car_models_write on public.car_models;

create policy car_brands_read on public.car_brands
  for select to authenticated using (true);
create policy car_brands_write on public.car_brands
  for all to authenticated
  using (
    public.has_action('secondaryClients', 'createCarInline')
    or public.has_action('secondaryClients', 'create')
    or public.has_action('secondaryClients', 'edit')
  )
  with check (
    public.has_action('secondaryClients', 'createCarInline')
    or public.has_action('secondaryClients', 'create')
    or public.has_action('secondaryClients', 'edit')
  );

create policy car_models_read on public.car_models
  for select to authenticated using (true);
create policy car_models_write on public.car_models
  for all to authenticated
  using (
    public.has_action('secondaryClients', 'createCarInline')
    or public.has_action('secondaryClients', 'create')
    or public.has_action('secondaryClients', 'edit')
  )
  with check (
    public.has_action('secondaryClients', 'createCarInline')
    or public.has_action('secondaryClients', 'create')
    or public.has_action('secondaryClients', 'edit')
  );

drop policy if exists services_read   on public.services;
drop policy if exists services_insert on public.services;
drop policy if exists services_update on public.services;
drop policy if exists services_delete on public.services;

-- Readable by anyone signed in: the invoicing screen needs the catalog even
-- for an employee who may not manage it.
create policy services_read on public.services
  for select to authenticated using (true);
create policy services_insert on public.services
  for insert to authenticated with check (public.has_action('services', 'create'));
create policy services_update on public.services
  for update to authenticated
  using (public.has_action('services', 'edit'))
  with check (public.has_action('services', 'edit'));
create policy services_delete on public.services
  for delete to authenticated using (public.has_action('services', 'delete'));

drop policy if exists invoices_read   on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;

create policy invoices_read on public.invoices
  for select to authenticated using (
    public.has_action('invoices', 'view')
    or public.has_action('invoices', 'create')
    or public.has_action('reports', 'generate')
  );
create policy invoices_insert on public.invoices
  for insert to authenticated with check (public.has_action('invoices', 'create'));
-- Editing an issued invoice is its own grant: creating one and revising one
-- afterwards are different responsibilities in an accounts office.
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.has_action('invoices', 'edit'))
  with check (public.has_action('invoices', 'edit'));
create policy invoices_delete on public.invoices
  for delete to authenticated using (public.has_action('invoices', 'delete'));

/* ---------- 9. realtime ---------- */

-- Adding a table twice raises; skip the ones already published so a re-run
-- of this file stays clean.
do $$
declare tbl text;
begin
  foreach tbl in array array['warehouses', 'car_brands', 'car_models', 'services', 'invoices'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

commit;

-- ============================================================
--  Vérification — s'exécute après le commit et n'écrit rien.
--
--  L'éditeur SQL de Supabase n'affiche que le résultat de la dernière
--  requête : c'est ce tableau. Chaque ligne doit être ✅. Une ligne
--  ❌ signifie que ce morceau n'est pas en place — rejouer ce fichier.
--
--  Un export de schéma ne montre ni les politiques RLS, ni les index,
--  ni les lignes du catalogue de permissions : ce rapport, si.
-- ============================================================

with checks (ord, item, ok) as (

  -- colonnes et tables
  select 1, 'colonne  company.stamp', exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'company' and column_name = 'stamp')
  union all select 2, 'colonne  secondary_clients.warehouse_id', exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'secondary_clients'
       and column_name = 'warehouse_id')
  union all select 3, 'table    warehouses', to_regclass('public.warehouses') is not null
  union all select 4, 'table    car_brands', to_regclass('public.car_brands') is not null
  union all select 5, 'table    car_models', to_regclass('public.car_models') is not null
  union all select 6, 'table    services',   to_regclass('public.services')   is not null
  union all select 7, 'table    invoices',   to_regclass('public.invoices')   is not null
  union all select 8, 'séquence invoice_no_seq',
    to_regclass('public.invoice_no_seq') is not null

  -- RLS active sur chaque nouvelle table
  union all select 10, 'RLS      warehouses', coalesce(
    (select relrowsecurity from pg_class where relname = 'warehouses'
      and relnamespace = 'public'::regnamespace), false)
  union all select 11, 'RLS      car_brands', coalesce(
    (select relrowsecurity from pg_class where relname = 'car_brands'
      and relnamespace = 'public'::regnamespace), false)
  union all select 12, 'RLS      car_models', coalesce(
    (select relrowsecurity from pg_class where relname = 'car_models'
      and relnamespace = 'public'::regnamespace), false)
  union all select 13, 'RLS      services', coalesce(
    (select relrowsecurity from pg_class where relname = 'services'
      and relnamespace = 'public'::regnamespace), false)
  union all select 14, 'RLS      invoices', coalesce(
    (select relrowsecurity from pg_class where relname = 'invoices'
      and relnamespace = 'public'::regnamespace), false)

  -- politiques : sans elles, les écrans restent vides
  union all select 20, 'policies warehouses (4)',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'warehouses') >= 4
  union all select 21, 'policies car_brands (2)',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'car_brands') >= 2
  union all select 22, 'policies car_models (2)',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'car_models') >= 2
  union all select 23, 'policies services (4)',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'services') >= 4
  union all select 24, 'policies invoices (4)',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'invoices') >= 4

  -- catalogue de permissions : sans lui, le dialogue Permissions est incomplet
  union all select 30, 'catalogue app_pages (3 nouvelles)',
    (select count(*) from public.app_pages
      where key in ('warehouses', 'services', 'invoices')) = 3
  union all select 31, 'catalogue app_actions (15 nouvelles)',
    (select count(*) from public.app_actions
      where page_key in ('warehouses', 'services', 'invoices')
         or (page_key = 'secondaryClients'
             and key in ('createWarehouseInline', 'createCarInline'))) >= 15
  union all select 32, 'action   invoices.edit', exists (
    select 1 from public.app_actions where page_key = 'invoices' and key = 'edit')

  -- realtime
  union all select 40, 'realtime (5 tables)',
    (select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename in ('warehouses', 'car_brands', 'car_models', 'services', 'invoices')) = 5
)
select
  case when ok then '✅' else '❌ MANQUANT' end as etat,
  item
from checks
order by ok, ord;
