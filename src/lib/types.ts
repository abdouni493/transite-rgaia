/* ============================================================
   TransitPro — Domain model
   ============================================================ */

export type ID = string;
export type ISODate = string; // yyyy-MM-dd
export type ISODateTime = string; // yyyy-MM-ddTHH:mm

/* ---------- Statuses ---------- */

/** Customs / clearance pipeline status of a secondary client's car. */
export const CUSTOMS_STATUSES = [
  'non_arrive',
  'arrive',
  'saisie',
  'liquide',
  'sortie',
  'remis_client',
] as const;
export type CustomsStatus = (typeof CUSTOMS_STATUSES)[number];

/** Financial status, derived from payments vs total. */
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Principal client account state. */
export const CLIENT_STATUSES = ['active', 'inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/* ---------- Core entities ---------- */

export interface PrincipalClient {
  id: ID;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  status: ClientStatus;
  createdAt: ISODate;
  notes?: string;
}

export interface Car {
  name: string; // model, e.g. "Clio 5"
  brand: string; // e.g. "Renault"
  chassisNumber: string;
}

export interface SecondaryClient {
  id: ID;
  /** Sequential "numéro de déclaration" — the business-facing id, shown as 0001. */
  declarationNo: number;
  firstName: string;
  lastName: string;
  address: string;
  principalClientId: ID;
  containerId: ID;
  /** Warehouse the car is stored in. Optional: rows created before entrepôts existed have none. */
  warehouseId?: ID;
  car: Car;
  price: number; // agreed price for this car (DZD)
  customsStatus: CustomsStatus;
  createdAt: ISODate;
  phone?: string;
}

/* ---------- Warehouses ---------- */

export interface Warehouse {
  id: ID;
  name: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  createdAt: ISODate;
}

/* ---------- Car catalog ---------- */

/** Reference list of makes ("Renault"), reusable across secondary clients. */
export interface CarBrand {
  id: ID;
  name: string;
  createdAt: ISODate;
}

/** Reference list of models ("Clio 5"), each belonging to one brand. */
export interface CarModel {
  id: ID;
  brandId: ID;
  name: string;
  createdAt: ISODate;
}

export interface Container {
  id: ID;
  name: string; // human label, e.g. "CNT-2026-014"
  tcNumber: string; // TC number, e.g. "MSKU 483920-1"
  createdAt: ISODate;
  arrivalDate?: ISODate;
  notes?: string;
}

export const MAX_CARS_PER_CONTAINER = 5;

/* ---------- Money ---------- */

export interface Payment {
  id: ID;
  /** Sequential "référence versement" — shown as 00001. */
  refNo: number;
  containerId: ID;
  principalClientId: ID;
  amount: number;
  date: ISODate;
  time: string; // HH:mm
  description?: string;
  createdBy: string; // user name
  createdAt: ISODateTime;
}

/* ---------- Services & invoicing ---------- */

/** A billable line the company sells — "Dédouanement", "Manutention"… */
export interface Service {
  id: ID;
  name: string;
  /** Unit price, excluding tax (HT). */
  amount: number;
  /** VAT rate in percent, e.g. 19. */
  tva: number;
  description: string;
  createdAt: ISODate;
}

/**
 * One line of an invoice. Name / amount / TVA are snapshotted at creation so a
 * reprint years later shows what was actually billed, even if the service has
 * been edited or deleted since.
 */
export interface InvoiceLine {
  serviceId: ID;
  name: string;
  amount: number; // unit price HT
  tva: number; // percent
  quantity: number;
}

export interface Invoice {
  id: ID;
  /** Sequential invoice number — shown as 0001. */
  invoiceNo: number;
  secondaryClientId: ID;
  date: ISODate;
  /** The car's agreed price, snapshotted — it carries no VAT. */
  carPrice: number;
  lines: InvoiceLine[];
  notes?: string;
  createdBy: string;
  createdAt: ISODateTime;
}

export type CashKind = 'deposit' | 'withdraw';

export interface CashTransaction {
  id: ID;
  kind: CashKind;
  amount: number;
  date: ISODate;
  time: string;
  description?: string;
  createdBy: string;
  createdAt: ISODateTime;
}

/* ---------- Workers ---------- */

export interface Role {
  id: ID;
  name: string;
  system?: boolean;
}

export type SalaryMode = 'monthly' | 'daily';

export interface WorkerSalary {
  enabled: boolean;
  mode: SalaryMode;
  amount: number; // per month or per day
}

export interface WorkerAccount {
  enabled: boolean;
  email: string;
  username: string;
  password: string;
}

export interface Worker {
  id: ID;
  fullName: string;
  birthday: ISODate;
  idCardNumber?: string;
  phone: string;
  roleId: ID;
  startDate: ISODate;
  salary: WorkerSalary;
  account: WorkerAccount;
  permissions: Permissions;
  active: boolean;
  createdAt: ISODate;
  avatarColor: string;
}

export interface Advance {
  id: ID; // "Acompte"
  workerId: ID;
  date: ISODate;
  amount: number;
  description?: string;
  settled: boolean; // deducted from a payroll run already
  createdAt: ISODateTime;
}

export interface Absence {
  id: ID;
  workerId: ID;
  date: ISODate;
  cost: number; // deduction amount
  description?: string;
  settled: boolean;
  createdAt: ISODateTime;
}

export interface PayrollRun {
  id: ID;
  workerId: ID;
  periodLabel: string; // "2026-06" or "2026-06-01 → 2026-06-15"
  periodStart: ISODate;
  periodEnd: ISODate;
  baseAmount: number;
  advancesDeducted: number;
  absencesDeducted: number;
  netAmount: number; // editable manually
  date: ISODate;
  description?: string;
  advanceIds: ID[];
  absenceIds: ID[];
  createdAt: ISODateTime;
}

/* ---------- Permissions ---------- */

export const PAGE_KEYS = [
  'dashboard',
  'principalClients',
  'secondaryClients',
  'containers',
  'warehouses',
  'customs',
  'paymentTracking',
  'services',
  'invoices',
  'caisse',
  'workers',
  'reports',
  'settings',
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/** Per-page granted action keys. Empty array = page visible, read-only. */
export type Permissions = Partial<Record<PageKey, string[]>>;

export interface ActionDef {
  key: string;
  /** true = sensitive (payments / deletions) — highlighted in the permission UI */
  sensitive?: boolean;
}

export interface PageDef {
  key: PageKey;
  actions: ActionDef[];
}

/** Canonical map of every page and every button action it exposes. */
export const PAGE_ACTIONS: PageDef[] = [
  { key: 'dashboard', actions: [{ key: 'viewStats' }, { key: 'viewAlerts' }] },
  {
    key: 'principalClients',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
      { key: 'viewPayments', sensitive: true },
      { key: 'addPayment', sensitive: true },
      { key: 'viewHistory' },
    ],
  },
  {
    key: 'secondaryClients',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
      { key: 'createContainerInline' },
      { key: 'createWarehouseInline' },
      { key: 'createCarInline' },
    ],
  },
  {
    key: 'containers',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
      { key: 'viewPaymentHistory', sensitive: true },
      { key: 'viewRestPerClient', sensitive: true },
    ],
  },
  {
    key: 'warehouses',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
    ],
  },
  {
    key: 'customs',
    actions: [{ key: 'view' }, { key: 'changeStatus', sensitive: true }, { key: 'print' }],
  },
  {
    key: 'paymentTracking',
    actions: [
      { key: 'addPayment', sensitive: true },
      { key: 'viewHistory', sensitive: true },
      { key: 'editPayment', sensitive: true },
      { key: 'deletePayment', sensitive: true },
      { key: 'print' },
    ],
  },
  {
    key: 'services',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
    ],
  },
  {
    key: 'invoices',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
      { key: 'print' },
    ],
  },
  {
    key: 'caisse',
    actions: [
      { key: 'createTransaction', sensitive: true },
      { key: 'viewHistory', sensitive: true },
      { key: 'deleteTransaction', sensitive: true },
      { key: 'viewContainerPayments', sensitive: true },
    ],
  },
  {
    key: 'workers',
    actions: [
      { key: 'create' },
      { key: 'view' },
      { key: 'edit' },
      { key: 'delete', sensitive: true },
      { key: 'permissions', sensitive: true },
      { key: 'advances', sensitive: true },
      { key: 'absences' },
      { key: 'payroll', sensitive: true },
      { key: 'manageRoles' },
    ],
  },
  { key: 'reports', actions: [{ key: 'generate' }, { key: 'drillDown' }, { key: 'print' }] },
  {
    key: 'settings',
    actions: [
      { key: 'company' },
      { key: 'account' },
      { key: 'backup', sensitive: true },
      { key: 'restore', sensitive: true },
    ],
  },
];

/* ---------- Company / auth ---------- */

export interface Company {
  logo?: string; // data URL
  /** Electronic stamp ("cachet"), printed in the signature block. Data URL. */
  stamp?: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  nif: string;
  nis: string;
  article: string;
  rc: string;
  currency: string;
}

export interface AdminUser {
  id: ID;
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'admin';
  createdAt: ISODate;
}

/** The signed-in principal — either the admin, or a worker with an account. */
export interface Session {
  kind: 'admin' | 'worker';
  id: ID;
  name: string;
  username: string;
  email: string;
  roleName: string;
  permissions: Permissions | 'all';
}

/* ---------- Aggregate state ---------- */

export interface AppState {
  admins: AdminUser[];
  principalClients: PrincipalClient[];
  secondaryClients: SecondaryClient[];
  containers: Container[];
  warehouses: Warehouse[];
  carBrands: CarBrand[];
  carModels: CarModel[];
  services: Service[];
  invoices: Invoice[];
  payments: Payment[];
  cash: CashTransaction[];
  workers: Worker[];
  roles: Role[];
  advances: Advance[];
  absences: Absence[];
  payrolls: PayrollRun[];
  company: Company;
}
