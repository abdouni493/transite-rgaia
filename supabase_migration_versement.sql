-- ============================================================
-- Migration — run once against an existing TransitPro database.
--
--   1. Containers now hold 5 vehicles instead of 4.
--   2. Secondary clients carry a "numéro de déclaration" (0001, 0002, …).
--   3. Payments carry a "référence versement" (00001, 00002, …).
--
-- Existing rows are numbered in creation order, so the oldest record
-- becomes 0001 / 00001. Safe to re-run: every step is guarded.
-- ============================================================

begin;

/* ---------- 1. container capacity: 4 → 5 ---------- */

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

/* ---------- 2. declaration numbers ---------- */

create sequence if not exists public.declaration_no_seq start 1;

alter table public.secondary_clients
  add column if not exists declaration_no integer;

-- Backfill in creation order: oldest car gets 0001.
with ordered as (
  select id, row_number() over (order by created_at, id) as n
    from public.secondary_clients
   where declaration_no is null
)
update public.secondary_clients s
   set declaration_no = ordered.n
  from ordered
 where s.id = ordered.id;

select setval(
  'public.declaration_no_seq',
  greatest(1, coalesce((select max(declaration_no) from public.secondary_clients), 0))
);

alter table public.secondary_clients
  alter column declaration_no set default nextval('public.declaration_no_seq'),
  alter column declaration_no set not null;

create unique index if not exists secondary_clients_declaration_no_idx
  on public.secondary_clients (declaration_no);

/* ---------- 3. versement references ---------- */

create sequence if not exists public.versement_ref_seq start 1;

alter table public.payments
  add column if not exists ref_no integer;

with ordered as (
  select id, row_number() over (order by date, time, created_at, id) as n
    from public.payments
   where ref_no is null
)
update public.payments p
   set ref_no = ordered.n
  from ordered
 where p.id = ordered.id;

select setval(
  'public.versement_ref_seq',
  greatest(1, coalesce((select max(ref_no) from public.payments), 0))
);

alter table public.payments
  alter column ref_no set default nextval('public.versement_ref_seq'),
  alter column ref_no set not null;

create unique index if not exists payments_ref_no_idx on public.payments (ref_no);

commit;
