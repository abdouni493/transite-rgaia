-- ============================================================================
--  TransitPro — full database schema for Supabase (PostgreSQL)
--  Project: https://wbsekdrvehqcnmaymikp.supabase.co
--
--  HOW TO INSTALL
--  --------------
--  1. Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--  2. Authentication → Providers → Email: turn OFF "Confirm email"
--     (the app signs users in immediately after creating their account).
--  3. Open the app → login page → "Créer un compte administrateur".
--     That first account is stored in auth.users and mirrored into public.profiles
--     with role = 'admin' and full access.
--  4. Employees are created from the "Employés" screen. When the account toggle
--     is on, the app creates an auth.users row for them too, so they can sign in
--     with the e-mail/username + password you set.
--
--  PERMISSION MODEL
--  ----------------
--  * app_pages   — one row per screen (sidebar entry) of the application.
--  * app_actions — one row per button action of each screen.
--  * workers.permissions — jsonb: { "<page_key>": ["<action_key>", ...] }.
--      - a page key present    => the worker sees that entry in the sidebar
--      - the action keys listed => the only buttons that render for them
--      - a page key absent     => the screen is hidden AND unreachable
--    An admin (profiles.role = 'admin') bypasses this and sees everything.
--    A freshly created worker gets '{}' — no sidebar entries at all until an
--    admin grants them from the "Permissions" button on the worker card.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================================
--  0. Clean slate (safe to re-run)
-- ============================================================================

drop table if exists public.payroll_runs   cascade;
drop table if exists public.absences       cascade;
drop table if exists public.advances       cascade;
drop table if exists public.cash_transactions cascade;
drop table if exists public.payments       cascade;
drop table if exists public.secondary_clients cascade;
drop table if exists public.containers     cascade;
drop table if exists public.principal_clients cascade;
drop table if exists public.workers        cascade;
drop table if exists public.roles          cascade;
drop table if exists public.app_actions    cascade;
drop table if exists public.app_pages      cascade;
drop table if exists public.company        cascade;
drop table if exists public.profiles       cascade;

drop type if exists public.customs_status  cascade;
drop type if exists public.client_status   cascade;
drop type if exists public.cash_kind       cascade;
drop type if exists public.salary_mode     cascade;
drop type if exists public.account_role    cascade;

-- ============================================================================
--  1. Enumerated types
-- ============================================================================

create type public.customs_status as enum (
  'non_arrive', 'arrive', 'saisie', 'liquide', 'sortie', 'remis_client'
);
create type public.client_status as enum ('active', 'inactive');
create type public.cash_kind     as enum ('deposit', 'withdraw');
create type public.salary_mode   as enum ('monthly', 'daily');
create type public.account_role  as enum ('admin', 'worker');

-- ============================================================================
--  2. Identity — profiles mirror auth.users
-- ============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  username    text        unique,
  email       text        not null,
  role        public.account_role not null default 'worker',
  -- set for role = 'worker'; links the login to the employee record
  worker_id   uuid,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index profiles_username_idx  on public.profiles (lower(username));
create index profiles_email_idx     on public.profiles (lower(email));
create index profiles_worker_id_idx on public.profiles (worker_id);

-- ============================================================================
--  3. Company settings — exactly one row, id = 1
-- ============================================================================

create table public.company (
  id          smallint primary key default 1 check (id = 1),
  logo        text,                       -- data: URL
  name        text not null default 'TransitPro',
  description text not null default '',
  email       text not null default '',
  phone       text not null default '',
  address     text not null default '',
  nif         text not null default '',
  nis         text not null default '',
  article     text not null default '',
  rc          text not null default '',
  currency    text not null default 'DZD',
  updated_at  timestamptz not null default now()
);

insert into public.company (id) values (1) on conflict (id) do nothing;

-- ============================================================================
--  4. Application catalog — every interface and every button action
--     These two tables are the source of truth behind the Permissions dialog.
-- ============================================================================

create table public.app_pages (
  key       text primary key,
  label_fr  text not null,
  label_ar  text not null,
  icon      text not null default '',
  sort      smallint not null default 0
);

create table public.app_actions (
  id        uuid primary key default gen_random_uuid(),
  page_key  text not null references public.app_pages (key) on delete cascade,
  key       text not null,
  label_fr  text not null,
  label_ar  text not null,
  -- money movements and deletions: highlighted in red in the permission UI
  sensitive boolean not null default false,
  sort      smallint not null default 0,
  unique (page_key, key)
);

create index app_actions_page_idx on public.app_actions (page_key);

-- ---- the 10 interfaces of the application (sidebar order) -------------------

insert into public.app_pages (key, label_fr, label_ar, icon, sort) values
  ('dashboard',        'Tableau de bord',        'لوحة التحكم',        'LayoutDashboard',  1),
  ('principalClients', 'Clients principaux',     'العملاء الرئيسيون',  'Users',            2),
  ('secondaryClients', 'Clients secondaires',    'العملاء الثانويون',  'UsersRound',       3),
  ('containers',       'Conteneurs',             'الحاويات',           'Boxes',            4),
  ('customs',          'Suivi de dédouanement',  'متابعة الجمركة',     'FileSpreadsheet',  5),
  ('paymentTracking',  'Suivi de paiement',      'متابعة الدفع',       'CreditCard',       6),
  ('caisse',           'Caisse',                 'الصندوق',            'Wallet',           7),
  ('workers',          'Employés',               'الموظفون',           'UserCog',          8),
  ('reports',          'Rapports',               'التقارير',           'BarChart3',        9),
  ('settings',         'Paramètres',             'الإعدادات',          'Settings',        10);

-- ---- every button action, per interface ------------------------------------
--      sensitive = true  → payments, deletions, permission edits

insert into public.app_actions (page_key, key, label_fr, label_ar, sensitive, sort) values
  -- Tableau de bord
  ('dashboard', 'viewStats',  'Voir les statistiques', 'عرض الإحصائيات', false, 1),
  ('dashboard', 'viewAlerts', 'Voir les alertes',      'عرض التنبيهات',  false, 2),

  -- Clients principaux
  ('principalClients', 'create',       'Créer',                 'إنشاء',            false, 1),
  ('principalClients', 'view',         'Consulter',             'عرض',              false, 2),
  ('principalClients', 'edit',         'Modifier',              'تعديل',            false, 3),
  ('principalClients', 'delete',       'Supprimer',             'حذف',              true,  4),
  ('principalClients', 'viewPayments', 'Voir les paiements',    'عرض المدفوعات',    true,  5),
  ('principalClients', 'addPayment',   'Ajouter un paiement',   'إضافة دفعة',       true,  6),
  ('principalClients', 'viewHistory',  'Voir l''historique',    'عرض السجل',        false, 7),

  -- Clients secondaires
  ('secondaryClients', 'create',                'Créer',                       'إنشاء',                  false, 1),
  ('secondaryClients', 'view',                  'Consulter',                   'عرض',                    false, 2),
  ('secondaryClients', 'edit',                  'Modifier',                    'تعديل',                  false, 3),
  ('secondaryClients', 'delete',                'Supprimer',                   'حذف',                    true,  4),
  ('secondaryClients', 'createContainerInline', 'Créer un conteneur en ligne', 'إنشاء حاوية مباشرة',     false, 5),

  -- Conteneurs
  ('containers', 'create',             'Créer',                            'إنشاء',                     false, 1),
  ('containers', 'view',               'Consulter',                        'عرض',                       false, 2),
  ('containers', 'edit',               'Modifier',                         'تعديل',                     false, 3),
  ('containers', 'delete',             'Supprimer',                        'حذف',                       true,  4),
  ('containers', 'viewPaymentHistory', 'Voir l''historique des paiements', 'عرض سجل المدفوعات',         true,  5),
  ('containers', 'viewRestPerClient',  'Voir le reste par client',         'عرض المتبقّي لكل عميل',     true,  6),

  -- Suivi de dédouanement
  ('customs', 'view',         'Consulter',        'عرض',            false, 1),
  ('customs', 'changeStatus', 'Changer le statut','تغيير الحالة',   true,  2),

  -- Suivi de paiement
  ('paymentTracking', 'addPayment',    'Ajouter un paiement',    'إضافة دفعة',      true,  1),
  ('paymentTracking', 'viewHistory',   'Voir l''historique',     'عرض السجل',       true,  2),
  ('paymentTracking', 'editPayment',   'Modifier un paiement',   'تعديل دفعة',      true,  3),
  ('paymentTracking', 'deletePayment', 'Supprimer un paiement',  'حذف دفعة',        true,  4),
  ('paymentTracking', 'print',         'Imprimer',               'طباعة',           false, 5),

  -- Caisse
  ('caisse', 'createTransaction',     'Créer une transaction',            'إنشاء معاملة',           true, 1),
  ('caisse', 'viewHistory',           'Voir l''historique',               'عرض السجل',              true, 2),
  ('caisse', 'deleteTransaction',     'Supprimer une transaction',        'حذف معاملة',             true, 3),
  ('caisse', 'viewContainerPayments', 'Voir les paiements des conteneurs','عرض مدفوعات الحاويات',   true, 4),

  -- Employés
  ('workers', 'create',      'Créer',                 'إنشاء',              false, 1),
  ('workers', 'view',        'Consulter',             'عرض',                false, 2),
  ('workers', 'edit',        'Modifier',              'تعديل',              false, 3),
  ('workers', 'delete',      'Supprimer',             'حذف',                true,  4),
  ('workers', 'permissions', 'Gérer les permissions', 'إدارة الصلاحيات',    true,  5),
  ('workers', 'advances',    'Gérer les acomptes',    'إدارة السلف',        true,  6),
  ('workers', 'absences',    'Gérer les absences',    'إدارة الغيابات',     false, 7),
  ('workers', 'payroll',     'Payer le salaire',      'دفع الأجر',          true,  8),
  ('workers', 'manageRoles', 'Gérer les fonctions',   'إدارة الوظائف',      false, 9),

  -- Rapports
  ('reports', 'generate',  'Générer le rapport',          'إنشاء التقرير',       false, 1),
  ('reports', 'drillDown', 'Voir le détail des calculs',  'عرض تفاصيل الحساب',   false, 2),
  ('reports', 'print',     'Imprimer',                    'طباعة',               false, 3),

  -- Paramètres
  ('settings', 'company', 'Modifier l''entreprise',  'تعديل بيانات الشركة', false, 1),
  ('settings', 'account', 'Modifier son compte',     'تعديل الحساب',        false, 2),
  ('settings', 'backup',  'Sauvegarder les données', 'نسخ البيانات',        true,  3),
  ('settings', 'restore', 'Restaurer les données',   'استعادة البيانات',    true,  4);

-- ============================================================================
--  5. Business tables
-- ============================================================================

-- ---- roles (job titles) ----------------------------------------------------
create table public.roles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  system     boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.roles (name, system) values
  ('Administrateur',      true),
  ('Déclarant en douane', false),
  ('Caissier',            false),
  ('Agent de transit',    false),
  ('Chauffeur',           false);

-- ---- workers ---------------------------------------------------------------
create table public.workers (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  birthday        date,
  id_card_number  text,                    -- optional
  phone           text not null default '',
  role_id         uuid references public.roles (id) on delete set null,
  start_date      date not null default current_date,

  -- payment information
  salary_enabled  boolean not null default false,
  salary_mode     public.salary_mode not null default 'monthly',
  salary_amount   numeric(14,2) not null default 0,

  -- login account (password lives in auth.users, never here)
  account_enabled  boolean not null default false,
  account_email    text,
  account_username text,
  auth_user_id     uuid references auth.users (id) on delete set null,

  -- { "<page_key>": ["<action_key>", ...] } — empty on creation
  permissions   jsonb   not null default '{}'::jsonb,
  active        boolean not null default true,
  avatar_color  text    not null default 'from-brand-900 to-ocean-400',
  created_at    timestamptz not null default now()
);

create index workers_role_idx     on public.workers (role_id);
create index workers_auth_idx     on public.workers (auth_user_id);
create index workers_username_idx on public.workers (lower(account_username));

alter table public.profiles
  add constraint profiles_worker_fk
  foreign key (worker_id) references public.workers (id) on delete cascade;

-- ---- principal clients -----------------------------------------------------
create table public.principal_clients (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null,
  phone      text not null default '',
  address    text not null default '',
  -- not asked at creation: every new client starts active
  status     public.client_status not null default 'active',
  notes      text,
  created_at timestamptz not null default now()
);

create index principal_clients_name_idx on public.principal_clients (last_name, first_name);

-- ---- containers (max 5 cars each — enforced by trigger below) --------------
create table public.containers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tc_number    text not null default '',
  arrival_date date,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---- secondary clients (one person + one car + one container + one price) --
-- Sequential business number printed on every document: 0001, 0002, ...
create sequence public.declaration_no_seq start 1;

create table public.secondary_clients (
  id                  uuid primary key default gen_random_uuid(),
  declaration_no      integer not null default nextval('public.declaration_no_seq'),
  first_name          text not null,
  last_name           text not null,
  address             text not null default '',
  phone               text,
  principal_client_id uuid not null references public.principal_clients (id) on delete cascade,
  container_id        uuid not null references public.containers (id) on delete cascade,
  car_brand           text not null default '',
  car_name            text not null default '',
  chassis_number      text not null default '',
  price               numeric(14,2) not null default 0,
  customs_status      public.customs_status not null default 'non_arrive',
  created_at          timestamptz not null default now()
);

create unique index secondary_clients_declaration_no_idx
  on public.secondary_clients (declaration_no);
create index secondary_clients_principal_idx on public.secondary_clients (principal_client_id);
create index secondary_clients_container_idx on public.secondary_clients (container_id);

-- a container never holds more than 5 vehicles
create or replace function public.enforce_container_capacity()
returns trigger language plpgsql as $$
declare n integer;
begin
  select count(*) into n
    from public.secondary_clients
   where container_id = new.container_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if n >= 5 then
    raise exception 'Container % already holds 5 vehicles', new.container_id;
  end if;
  return new;
end $$;

create trigger secondary_clients_capacity
  before insert or update of container_id on public.secondary_clients
  for each row execute function public.enforce_container_capacity();

-- ---- payments: recorded per (container, principal client) ------------------
-- Versement reference printed on every receipt: 00001, 00002, ...
create sequence public.versement_ref_seq start 1;

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  ref_no              integer not null default nextval('public.versement_ref_seq'),
  container_id        uuid not null references public.containers (id) on delete cascade,
  principal_client_id uuid not null references public.principal_clients (id) on delete cascade,
  amount              numeric(14,2) not null check (amount > 0),
  date                date not null default current_date,
  time                text not null default '00:00',
  description         text,
  created_by          text not null default '',
  created_at          timestamptz not null default now()
);

create unique index payments_ref_no_idx on public.payments (ref_no);
create index payments_container_idx on public.payments (container_id);
create index payments_principal_idx on public.payments (principal_client_id);
create index payments_date_idx      on public.payments (date desc);

-- ---- caisse ----------------------------------------------------------------
create table public.cash_transactions (
  id          uuid primary key default gen_random_uuid(),
  kind        public.cash_kind not null,
  amount      numeric(14,2) not null check (amount > 0),
  date        date not null default current_date,
  time        text not null default '00:00',
  description text,
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index cash_transactions_date_idx on public.cash_transactions (date desc);

-- ---- acomptes (advances) ---------------------------------------------------
create table public.advances (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.workers (id) on delete cascade,
  date        date not null default current_date,
  amount      numeric(14,2) not null check (amount > 0),
  description text,
  -- true once a payroll run has deducted it
  settled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index advances_worker_idx on public.advances (worker_id, settled);

-- ---- absences --------------------------------------------------------------
create table public.absences (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references public.workers (id) on delete cascade,
  date        date not null default current_date,
  cost        numeric(14,2) not null check (cost >= 0),
  description text,
  settled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index absences_worker_idx on public.absences (worker_id, settled);

-- ---- payroll runs ----------------------------------------------------------
create table public.payroll_runs (
  id                 uuid primary key default gen_random_uuid(),
  worker_id          uuid not null references public.workers (id) on delete cascade,
  period_label       text not null,
  period_start       date not null,
  period_end         date not null,
  base_amount        numeric(14,2) not null default 0,
  advances_deducted  numeric(14,2) not null default 0,
  absences_deducted  numeric(14,2) not null default 0,
  -- editable by hand before validating
  net_amount         numeric(14,2) not null default 0,
  date               date not null default current_date,
  description        text,
  advance_ids        uuid[] not null default '{}',
  absence_ids        uuid[] not null default '{}',
  created_at         timestamptz not null default now()
);

create index payroll_runs_worker_idx on public.payroll_runs (worker_id, date desc);

-- ============================================================================
--  6. auth.users → profiles, automatically
--     The app passes name / username / role / worker_id as sign-up metadata.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, email, role, worker_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.account_role, 'worker'),
    nullif(new.raw_user_meta_data ->> 'worker_id', '')::uuid
  )
  on conflict (id) do update
    set name      = excluded.name,
        username  = excluded.username,
        email     = excluded.email,
        role      = excluded.role,
        worker_id = excluded.worker_id;

  -- keep the employee row pointing at its login
  if (new.raw_user_meta_data ->> 'worker_id') is not null then
    update public.workers
       set auth_user_id  = new.id,
           account_email = new.email
     where id = (new.raw_user_meta_data ->> 'worker_id')::uuid;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  7. Helper functions
-- ============================================================================

-- Is the caller an administrator? SECURITY DEFINER so RLS on profiles
-- cannot recurse into itself.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin' and active
  );
$$;

-- Sign in with a username instead of an e-mail: the app resolves it first.
-- SECURITY DEFINER + anon grant, returns nothing but the address.
create or replace function public.email_for_identifier(identifier text)
returns text
language sql stable security definer set search_path = public
as $$
  select email
    from public.profiles
   where lower(username) = lower(trim(identifier))
      or lower(email)    = lower(trim(identifier))
   limit 1;
$$;

grant execute on function public.email_for_identifier(text) to anon, authenticated;

-- Permissions of the signed-in user: 'all' for an admin, otherwise the
-- worker's jsonb map. The client uses this to build the sidebar.
create or replace function public.my_permissions()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare p public.profiles; w public.workers;
begin
  select * into p from public.profiles where id = auth.uid();
  if p is null then return '{}'::jsonb; end if;
  if p.role = 'admin' then return '"all"'::jsonb; end if;
  select * into w from public.workers where id = p.worker_id;
  if w is null or not w.active or not w.account_enabled then return '{}'::jsonb; end if;
  return w.permissions;
end $$;

grant execute on function public.my_permissions() to authenticated;

-- Does the caller hold a given button action? Mirrors the client-side check,
-- so the rule survives even if someone calls the API directly.
create or replace function public.has_action(page_key text, action_key text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.is_admin() then true
    else coalesce(
      (public.my_permissions() -> page_key) ? action_key,
      false
    )
  end;
$$;

grant execute on function public.has_action(text, text) to authenticated;

-- ============================================================================
--  8. Row Level Security
--     Signed-in users read the shared business data; writes on the sensitive
--     tables additionally require the matching button action.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.company           enable row level security;
alter table public.app_pages         enable row level security;
alter table public.app_actions       enable row level security;
alter table public.roles             enable row level security;
alter table public.workers           enable row level security;
alter table public.principal_clients enable row level security;
alter table public.containers        enable row level security;
alter table public.secondary_clients enable row level security;
alter table public.payments          enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.advances          enable row level security;
alter table public.absences          enable row level security;
alter table public.payroll_runs      enable row level security;

-- ---- profiles --------------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---- catalog: readable by everyone signed in, editable by admins only ------
create policy app_pages_read on public.app_pages
  for select to authenticated using (true);
create policy app_pages_write on public.app_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy app_actions_read on public.app_actions
  for select to authenticated using (true);
create policy app_actions_write on public.app_actions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- company ---------------------------------------------------------------
create policy company_read on public.company
  for select to authenticated using (true);
create policy company_write on public.company
  for update to authenticated
  using (public.has_action('settings', 'company'))
  with check (public.has_action('settings', 'company'));

-- ---- roles -----------------------------------------------------------------
create policy roles_read on public.roles
  for select to authenticated using (true);
create policy roles_write on public.roles
  for all to authenticated
  using (public.has_action('workers', 'manageRoles'))
  with check (public.has_action('workers', 'manageRoles'));

-- ---- workers ---------------------------------------------------------------
-- everyone signed in may read the roster (needed to render their own profile);
-- creating / editing / deleting is gated on the matching action.
create policy workers_read on public.workers
  for select to authenticated using (true);
create policy workers_insert on public.workers
  for insert to authenticated with check (public.has_action('workers', 'create'));
create policy workers_update on public.workers
  for update to authenticated
  using (public.has_action('workers', 'edit') or public.has_action('workers', 'permissions'))
  with check (public.has_action('workers', 'edit') or public.has_action('workers', 'permissions'));
create policy workers_delete on public.workers
  for delete to authenticated using (public.has_action('workers', 'delete'));

-- ---- principal clients -----------------------------------------------------
create policy principal_read on public.principal_clients
  for select to authenticated using (true);
create policy principal_insert on public.principal_clients
  for insert to authenticated with check (public.has_action('principalClients', 'create'));
create policy principal_update on public.principal_clients
  for update to authenticated
  using (public.has_action('principalClients', 'edit'))
  with check (public.has_action('principalClients', 'edit'));
create policy principal_delete on public.principal_clients
  for delete to authenticated using (public.has_action('principalClients', 'delete'));

-- ---- containers ------------------------------------------------------------
create policy containers_read on public.containers
  for select to authenticated using (true);
create policy containers_insert on public.containers
  for insert to authenticated with check (
    public.has_action('containers', 'create')
    or public.has_action('secondaryClients', 'createContainerInline')
  );
create policy containers_update on public.containers
  for update to authenticated
  using (public.has_action('containers', 'edit'))
  with check (public.has_action('containers', 'edit'));
create policy containers_delete on public.containers
  for delete to authenticated using (public.has_action('containers', 'delete'));

-- ---- secondary clients -----------------------------------------------------
create policy secondary_read on public.secondary_clients
  for select to authenticated using (true);
create policy secondary_insert on public.secondary_clients
  for insert to authenticated with check (public.has_action('secondaryClients', 'create'));
create policy secondary_update on public.secondary_clients
  for update to authenticated
  using (
    public.has_action('secondaryClients', 'edit')
    or public.has_action('customs', 'changeStatus')
  )
  with check (
    public.has_action('secondaryClients', 'edit')
    or public.has_action('customs', 'changeStatus')
  );
create policy secondary_delete on public.secondary_clients
  for delete to authenticated using (public.has_action('secondaryClients', 'delete'));

-- ---- payments — the sensitive one ------------------------------------------
create policy payments_read on public.payments
  for select to authenticated using (
    public.has_action('paymentTracking', 'viewHistory')
    or public.has_action('containers', 'viewPaymentHistory')
    or public.has_action('principalClients', 'viewPayments')
    or public.has_action('caisse', 'viewContainerPayments')
    or public.has_action('dashboard', 'viewStats')
    or public.has_action('reports', 'generate')
  );
create policy payments_insert on public.payments
  for insert to authenticated with check (
    public.has_action('paymentTracking', 'addPayment')
    or public.has_action('principalClients', 'addPayment')
  );
create policy payments_update on public.payments
  for update to authenticated
  using (public.has_action('paymentTracking', 'editPayment'))
  with check (public.has_action('paymentTracking', 'editPayment'));
create policy payments_delete on public.payments
  for delete to authenticated using (public.has_action('paymentTracking', 'deletePayment'));

-- ---- caisse ----------------------------------------------------------------
create policy cash_read on public.cash_transactions
  for select to authenticated using (
    public.has_action('caisse', 'viewHistory')
    or public.has_action('dashboard', 'viewStats')
    or public.has_action('reports', 'generate')
  );
create policy cash_insert on public.cash_transactions
  for insert to authenticated with check (public.has_action('caisse', 'createTransaction'));
create policy cash_update on public.cash_transactions
  for update to authenticated
  using (public.has_action('caisse', 'createTransaction'))
  with check (public.has_action('caisse', 'createTransaction'));
create policy cash_delete on public.cash_transactions
  for delete to authenticated using (public.has_action('caisse', 'deleteTransaction'));

-- ---- advances / absences / payroll -----------------------------------------
create policy advances_read on public.advances
  for select to authenticated using (
    public.has_action('workers', 'advances')
    or public.has_action('workers', 'payroll')
    or public.has_action('workers', 'view')
  );
create policy advances_write on public.advances
  for all to authenticated
  using (public.has_action('workers', 'advances') or public.has_action('workers', 'payroll'))
  with check (public.has_action('workers', 'advances') or public.has_action('workers', 'payroll'));

create policy absences_read on public.absences
  for select to authenticated using (
    public.has_action('workers', 'absences')
    or public.has_action('workers', 'payroll')
    or public.has_action('workers', 'view')
  );
create policy absences_write on public.absences
  for all to authenticated
  using (public.has_action('workers', 'absences') or public.has_action('workers', 'payroll'))
  with check (public.has_action('workers', 'absences') or public.has_action('workers', 'payroll'));

create policy payroll_read on public.payroll_runs
  for select to authenticated using (
    public.has_action('workers', 'payroll') or public.has_action('workers', 'view')
  );
create policy payroll_write on public.payroll_runs
  for all to authenticated
  using (public.has_action('workers', 'payroll'))
  with check (public.has_action('workers', 'payroll'));

-- ============================================================================
--  9. Realtime (optional — the app also refetches after every write)
-- ============================================================================

alter publication supabase_realtime add table
  public.principal_clients,
  public.secondary_clients,
  public.containers,
  public.payments,
  public.cash_transactions,
  public.workers,
  public.roles,
  public.advances,
  public.absences,
  public.payroll_runs,
  public.company;

-- ============================================================================
--  Done.
--  Next: create the first administrator from the application's login page.
-- ============================================================================
