/* ============================================================
   Supabase data layer.

   Row shapes are snake_case (see supabase_schema.sql); the rest of the app
   speaks the camelCase domain model in ./types. Every conversion lives here,
   so no screen ever sees a database column name.
   ============================================================ */

import { supabase } from './supabase';
import type {
  Absence,
  Advance,
  AdminUser,
  AppState,
  CarBrand,
  CarModel,
  CashTransaction,
  Company,
  Container,
  ID,
  Invoice,
  InvoiceLine,
  Payment,
  PayrollRun,
  Permissions,
  PrincipalClient,
  Role,
  SecondaryClient,
  Service,
  Warehouse,
  Worker,
} from './types';

/* ---------------- empty state ---------------- */

export const EMPTY_COMPANY: Company = {
  name: '',
  description: '',
  email: '',
  phone: '',
  address: '',
  nif: '',
  nis: '',
  article: '',
  rc: '',
  currency: 'DZD',
};

export const EMPTY_STATE: AppState = {
  admins: [],
  principalClients: [],
  secondaryClients: [],
  containers: [],
  warehouses: [],
  carBrands: [],
  carModels: [],
  services: [],
  invoices: [],
  payments: [],
  cash: [],
  workers: [],
  roles: [],
  advances: [],
  absences: [],
  payrolls: [],
  company: EMPTY_COMPANY,
};

/* ---------------- helpers ---------------- */

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const bool = (v: unknown) => v === true;
/** Postgres `date` comes back as yyyy-MM-dd; timestamptz needs slicing. */
const day = (v: unknown, fallback = '') => (typeof v === 'string' ? v.slice(0, 10) : fallback);

/* ---------------- row → domain ---------------- */

const toRole = (r: Row): Role => ({
  id: str(r.id),
  name: str(r.name),
  system: bool(r.system),
});

const toPrincipal = (r: Row): PrincipalClient => ({
  id: str(r.id),
  firstName: str(r.first_name),
  lastName: str(r.last_name),
  phone: str(r.phone),
  address: str(r.address),
  status: r.status === 'inactive' ? 'inactive' : 'active',
  createdAt: day(r.created_at),
  notes: (r.notes as string) ?? undefined,
});

const toContainer = (r: Row): Container => ({
  id: str(r.id),
  name: str(r.name),
  tcNumber: str(r.tc_number),
  createdAt: day(r.created_at),
  arrivalDate: r.arrival_date ? day(r.arrival_date) : undefined,
  notes: (r.notes as string) ?? undefined,
});

const toWarehouse = (r: Row): Warehouse => ({
  id: str(r.id),
  name: str(r.name),
  address: str(r.address),
  phone: str(r.phone),
  email: str(r.email),
  description: str(r.description),
  createdAt: day(r.created_at),
});

const toCarBrand = (r: Row): CarBrand => ({
  id: str(r.id),
  name: str(r.name),
  createdAt: day(r.created_at),
});

const toCarModel = (r: Row): CarModel => ({
  id: str(r.id),
  brandId: str(r.brand_id),
  name: str(r.name),
  createdAt: day(r.created_at),
});

const toService = (r: Row): Service => ({
  id: str(r.id),
  name: str(r.name),
  amount: num(r.amount),
  tva: num(r.tva),
  description: str(r.description),
  createdAt: day(r.created_at),
});

/** Lines are stored as jsonb; anything malformed degrades to an empty list. */
const toInvoiceLines = (v: unknown): InvoiceLine[] => {
  if (!Array.isArray(v)) return [];
  return v.map((raw) => {
    const l = (raw ?? {}) as Row;
    return {
      serviceId: str(l.serviceId),
      name: str(l.name),
      amount: num(l.amount),
      tva: num(l.tva),
      quantity: num(l.quantity) || 1,
    };
  });
};

const toInvoice = (r: Row): Invoice => ({
  id: str(r.id),
  invoiceNo: num(r.invoice_no),
  secondaryClientId: str(r.secondary_client_id),
  date: day(r.date),
  carPrice: num(r.car_price),
  lines: toInvoiceLines(r.lines),
  notes: (r.notes as string) ?? undefined,
  createdBy: str(r.created_by),
  createdAt: str(r.created_at).slice(0, 16),
});

const toSecondary = (r: Row): SecondaryClient => ({
  id: str(r.id),
  declarationNo: num(r.declaration_no),
  firstName: str(r.first_name),
  lastName: str(r.last_name),
  address: str(r.address),
  phone: (r.phone as string) ?? undefined,
  principalClientId: str(r.principal_client_id),
  containerId: str(r.container_id),
  warehouseId: (r.warehouse_id as string) ?? undefined,
  car: {
    brand: str(r.car_brand),
    name: str(r.car_name),
    chassisNumber: str(r.chassis_number),
  },
  price: num(r.price),
  customsStatus: (str(r.customs_status, 'non_arrive') as SecondaryClient['customsStatus']),
  createdAt: day(r.created_at),
});

const toPayment = (r: Row): Payment => ({
  id: str(r.id),
  refNo: num(r.ref_no),
  containerId: str(r.container_id),
  principalClientId: str(r.principal_client_id),
  amount: num(r.amount),
  date: day(r.date),
  time: str(r.time, '00:00'),
  description: (r.description as string) ?? undefined,
  createdBy: str(r.created_by),
  createdAt: `${day(r.date)}T${str(r.time, '00:00')}`,
});

const toCash = (r: Row): CashTransaction => ({
  id: str(r.id),
  kind: r.kind === 'withdraw' ? 'withdraw' : 'deposit',
  amount: num(r.amount),
  date: day(r.date),
  time: str(r.time, '00:00'),
  description: (r.description as string) ?? undefined,
  createdBy: str(r.created_by),
  createdAt: `${day(r.date)}T${str(r.time, '00:00')}`,
});

const toWorker = (r: Row): Worker => ({
  id: str(r.id),
  fullName: str(r.full_name),
  birthday: day(r.birthday),
  idCardNumber: (r.id_card_number as string) ?? undefined,
  phone: str(r.phone),
  roleId: str(r.role_id),
  startDate: day(r.start_date),
  salary: {
    enabled: bool(r.salary_enabled),
    mode: r.salary_mode === 'daily' ? 'daily' : 'monthly',
    amount: num(r.salary_amount),
  },
  account: {
    enabled: bool(r.account_enabled),
    email: str(r.account_email),
    username: str(r.account_username),
    // Passwords live in auth.users only — never mirrored into our tables.
    password: '',
  },
  permissions: (r.permissions as Permissions) ?? {},
  active: r.active === undefined ? true : bool(r.active),
  createdAt: day(r.created_at),
  avatarColor: str(r.avatar_color, 'from-brand-900 to-ocean-400'),
});

const toAdvance = (r: Row): Advance => ({
  id: str(r.id),
  workerId: str(r.worker_id),
  date: day(r.date),
  amount: num(r.amount),
  description: (r.description as string) ?? undefined,
  settled: bool(r.settled),
  createdAt: str(r.created_at).slice(0, 16),
});

const toAbsence = (r: Row): Absence => ({
  id: str(r.id),
  workerId: str(r.worker_id),
  date: day(r.date),
  cost: num(r.cost),
  description: (r.description as string) ?? undefined,
  settled: bool(r.settled),
  createdAt: str(r.created_at).slice(0, 16),
});

const toPayroll = (r: Row): PayrollRun => ({
  id: str(r.id),
  workerId: str(r.worker_id),
  periodLabel: str(r.period_label),
  periodStart: day(r.period_start),
  periodEnd: day(r.period_end),
  baseAmount: num(r.base_amount),
  advancesDeducted: num(r.advances_deducted),
  absencesDeducted: num(r.absences_deducted),
  netAmount: num(r.net_amount),
  date: day(r.date),
  description: (r.description as string) ?? undefined,
  advanceIds: (r.advance_ids as ID[]) ?? [],
  absenceIds: (r.absence_ids as ID[]) ?? [],
  createdAt: str(r.created_at).slice(0, 16),
});

const toCompany = (r: Row | null): Company =>
  r
    ? {
        logo: (r.logo as string) ?? undefined,
        stamp: (r.stamp as string) ?? undefined,
        name: str(r.name),
        description: str(r.description),
        email: str(r.email),
        phone: str(r.phone),
        address: str(r.address),
        nif: str(r.nif),
        nis: str(r.nis),
        article: str(r.article),
        rc: str(r.rc),
        currency: str(r.currency, 'DZD'),
      }
    : EMPTY_COMPANY;

const toAdmin = (r: Row): AdminUser => ({
  id: str(r.id),
  name: str(r.name),
  username: str(r.username),
  email: str(r.email),
  password: '',
  role: 'admin',
  createdAt: day(r.created_at),
});

/* ---------------- domain → row ---------------- */

export const principalRow = (c: Partial<PrincipalClient>) => ({
  ...(c.firstName !== undefined && { first_name: c.firstName }),
  ...(c.lastName !== undefined && { last_name: c.lastName }),
  ...(c.phone !== undefined && { phone: c.phone }),
  ...(c.address !== undefined && { address: c.address }),
  ...(c.status !== undefined && { status: c.status }),
  ...(c.notes !== undefined && { notes: c.notes ?? null }),
});

export const containerRow = (c: Partial<Container>) => ({
  ...(c.name !== undefined && { name: c.name }),
  ...(c.tcNumber !== undefined && { tc_number: c.tcNumber }),
  ...(c.arrivalDate !== undefined && { arrival_date: c.arrivalDate || null }),
  ...(c.notes !== undefined && { notes: c.notes ?? null }),
});

export const warehouseRow = (w: Partial<Warehouse>) => ({
  ...(w.name !== undefined && { name: w.name }),
  ...(w.address !== undefined && { address: w.address }),
  ...(w.phone !== undefined && { phone: w.phone }),
  ...(w.email !== undefined && { email: w.email }),
  ...(w.description !== undefined && { description: w.description }),
});

export const carBrandRow = (b: Partial<CarBrand>) => ({
  ...(b.name !== undefined && { name: b.name }),
});

export const carModelRow = (m: Partial<CarModel>) => ({
  ...(m.brandId !== undefined && { brand_id: m.brandId }),
  ...(m.name !== undefined && { name: m.name }),
});

export const serviceRow = (s: Partial<Service>) => ({
  ...(s.name !== undefined && { name: s.name }),
  ...(s.amount !== undefined && { amount: s.amount }),
  ...(s.tva !== undefined && { tva: s.tva }),
  ...(s.description !== undefined && { description: s.description }),
});

export const invoiceRow = (i: Partial<Invoice>) => ({
  ...(i.invoiceNo !== undefined && { invoice_no: i.invoiceNo }),
  ...(i.secondaryClientId !== undefined && { secondary_client_id: i.secondaryClientId }),
  ...(i.date !== undefined && { date: i.date }),
  ...(i.carPrice !== undefined && { car_price: i.carPrice }),
  ...(i.lines !== undefined && { lines: i.lines }),
  ...(i.notes !== undefined && { notes: i.notes ?? null }),
  ...(i.createdBy !== undefined && { created_by: i.createdBy }),
});

export const secondaryRow = (c: Partial<SecondaryClient>) => ({
  ...(c.declarationNo !== undefined && { declaration_no: c.declarationNo }),
  ...(c.firstName !== undefined && { first_name: c.firstName }),
  ...(c.lastName !== undefined && { last_name: c.lastName }),
  ...(c.address !== undefined && { address: c.address }),
  ...(c.phone !== undefined && { phone: c.phone ?? null }),
  ...(c.principalClientId !== undefined && { principal_client_id: c.principalClientId }),
  ...(c.containerId !== undefined && { container_id: c.containerId }),
  ...(c.warehouseId !== undefined && { warehouse_id: c.warehouseId || null }),
  ...(c.car !== undefined && {
    car_brand: c.car.brand,
    car_name: c.car.name,
    chassis_number: c.car.chassisNumber,
  }),
  ...(c.price !== undefined && { price: c.price }),
  ...(c.customsStatus !== undefined && { customs_status: c.customsStatus }),
});

export const paymentRow = (p: Partial<Payment>) => ({
  ...(p.refNo !== undefined && { ref_no: p.refNo }),
  ...(p.containerId !== undefined && { container_id: p.containerId }),
  ...(p.principalClientId !== undefined && { principal_client_id: p.principalClientId }),
  ...(p.amount !== undefined && { amount: p.amount }),
  ...(p.date !== undefined && { date: p.date }),
  ...(p.time !== undefined && { time: p.time }),
  ...(p.description !== undefined && { description: p.description ?? null }),
  ...(p.createdBy !== undefined && { created_by: p.createdBy }),
});

export const cashRow = (c: Partial<CashTransaction>) => ({
  ...(c.kind !== undefined && { kind: c.kind }),
  ...(c.amount !== undefined && { amount: c.amount }),
  ...(c.date !== undefined && { date: c.date }),
  ...(c.time !== undefined && { time: c.time }),
  ...(c.description !== undefined && { description: c.description ?? null }),
  ...(c.createdBy !== undefined && { created_by: c.createdBy }),
});

export const workerRow = (w: Partial<Worker>) => ({
  ...(w.fullName !== undefined && { full_name: w.fullName }),
  ...(w.birthday !== undefined && { birthday: w.birthday || null }),
  ...(w.idCardNumber !== undefined && { id_card_number: w.idCardNumber ?? null }),
  ...(w.phone !== undefined && { phone: w.phone }),
  ...(w.roleId !== undefined && { role_id: w.roleId || null }),
  ...(w.startDate !== undefined && { start_date: w.startDate }),
  ...(w.salary !== undefined && {
    salary_enabled: w.salary.enabled,
    salary_mode: w.salary.mode,
    salary_amount: w.salary.amount,
  }),
  ...(w.account !== undefined && {
    account_enabled: w.account.enabled,
    account_email: w.account.email || null,
    account_username: w.account.username || null,
  }),
  ...(w.permissions !== undefined && { permissions: w.permissions }),
  ...(w.active !== undefined && { active: w.active }),
  ...(w.avatarColor !== undefined && { avatar_color: w.avatarColor }),
});

export const advanceRow = (a: Partial<Advance>) => ({
  ...(a.workerId !== undefined && { worker_id: a.workerId }),
  ...(a.date !== undefined && { date: a.date }),
  ...(a.amount !== undefined && { amount: a.amount }),
  ...(a.description !== undefined && { description: a.description ?? null }),
  ...(a.settled !== undefined && { settled: a.settled }),
});

export const absenceRow = (a: Partial<Absence>) => ({
  ...(a.workerId !== undefined && { worker_id: a.workerId }),
  ...(a.date !== undefined && { date: a.date }),
  ...(a.cost !== undefined && { cost: a.cost }),
  ...(a.description !== undefined && { description: a.description ?? null }),
  ...(a.settled !== undefined && { settled: a.settled }),
});

export const payrollRow = (p: Partial<PayrollRun>) => ({
  ...(p.workerId !== undefined && { worker_id: p.workerId }),
  ...(p.periodLabel !== undefined && { period_label: p.periodLabel }),
  ...(p.periodStart !== undefined && { period_start: p.periodStart }),
  ...(p.periodEnd !== undefined && { period_end: p.periodEnd }),
  ...(p.baseAmount !== undefined && { base_amount: p.baseAmount }),
  ...(p.advancesDeducted !== undefined && { advances_deducted: p.advancesDeducted }),
  ...(p.absencesDeducted !== undefined && { absences_deducted: p.absencesDeducted }),
  ...(p.netAmount !== undefined && { net_amount: p.netAmount }),
  ...(p.date !== undefined && { date: p.date }),
  ...(p.description !== undefined && { description: p.description ?? null }),
  ...(p.advanceIds !== undefined && { advance_ids: p.advanceIds }),
  ...(p.absenceIds !== undefined && { absence_ids: p.absenceIds }),
});

export const companyRow = (c: Partial<Company>) => ({
  ...(c.logo !== undefined && { logo: c.logo ?? null }),
  ...(c.stamp !== undefined && { stamp: c.stamp ?? null }),
  ...(c.name !== undefined && { name: c.name }),
  ...(c.description !== undefined && { description: c.description }),
  ...(c.email !== undefined && { email: c.email }),
  ...(c.phone !== undefined && { phone: c.phone }),
  ...(c.address !== undefined && { address: c.address }),
  ...(c.nif !== undefined && { nif: c.nif }),
  ...(c.nis !== undefined && { nis: c.nis }),
  ...(c.article !== undefined && { article: c.article }),
  ...(c.rc !== undefined && { rc: c.rc }),
  ...(c.currency !== undefined && { currency: c.currency }),
});

/* ============================================================
   Bulk load
   ============================================================ */

/**
 * Pulls everything the signed-in user is allowed to read in one round trip.
 *
 * RLS may deny a table outright (an employee without the "payments" actions,
 * for instance). That is a normal outcome, not a failure: the table simply
 * comes back empty and the screens that need it are hidden anyway.
 */
export async function fetchAll(): Promise<AppState> {
  const table = async <T>(name: string, map: (r: Row) => T, order?: string): Promise<T[]> => {
    let q = supabase.from(name).select('*');
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) {
      console.warn(`[db] ${name}: ${error.message}`);
      return [];
    }
    return (data ?? []).map((r) => map(r as Row));
  };

  const [
    profiles,
    roles,
    workers,
    principalClients,
    containers,
    warehouses,
    carBrands,
    carModels,
    services,
    invoices,
    secondaryClients,
    payments,
    cash,
    advances,
    absences,
    payrolls,
    companyRes,
  ] = await Promise.all([
    table('profiles', (r) => r, 'created_at'),
    table('roles', toRole, 'created_at'),
    table('workers', toWorker, 'created_at'),
    table('principal_clients', toPrincipal, 'created_at'),
    table('containers', toContainer, 'created_at'),
    table('warehouses', toWarehouse, 'created_at'),
    table('car_brands', toCarBrand),
    table('car_models', toCarModel),
    table('services', toService, 'created_at'),
    table('invoices', toInvoice, 'date'),
    table('secondary_clients', toSecondary, 'created_at'),
    table('payments', toPayment, 'date'),
    table('cash_transactions', toCash, 'date'),
    table('advances', toAdvance, 'date'),
    table('absences', toAbsence, 'date'),
    table('payroll_runs', toPayroll, 'date'),
    supabase.from('company').select('*').eq('id', 1).maybeSingle(),
  ]);

  return {
    admins: (profiles as Row[]).filter((p) => p.role === 'admin').map(toAdmin),
    roles,
    workers,
    principalClients,
    containers,
    warehouses,
    // the two catalog lists read best alphabetically, not by creation date
    carBrands: carBrands.sort((a, b) => a.name.localeCompare(b.name)),
    carModels: carModels.sort((a, b) => a.name.localeCompare(b.name)),
    services,
    invoices,
    secondaryClients,
    payments,
    cash,
    advances,
    absences,
    payrolls,
    company: toCompany((companyRes.data as Row) ?? null),
  };
}

/* ============================================================
   Fire-and-report writes

   Screens update local state optimistically; if the database rejects the
   write (usually an RLS denial) we surface it through this callback so the
   store can show a toast and reload the truth.
   ============================================================ */

export type DbError = (message: string) => void;

let reportError: DbError = (m) => console.error('[db]', m);
export function setDbErrorHandler(fn: DbError) {
  reportError = fn;
}

export async function run(
  label: string,
  op: PromiseLike<{ error: { message: string } | null }>,
): Promise<boolean> {
  const { error } = await op;
  if (error) {
    reportError(`${label}: ${error.message}`);
    return false;
  }
  return true;
}
