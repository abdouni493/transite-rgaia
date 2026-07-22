/* ============================================================
   Derived data. Every money figure in the app is computed here
   so totals can never drift between screens.
   ============================================================ */

import { MAX_CARS_PER_CONTAINER } from './types';
import type {
  AppState,
  Container,
  CustomsStatus,
  ID,
  Payment,
  PaymentStatus,
  PrincipalClient,
  SecondaryClient,
} from './types';

export interface Money {
  total: number;
  paid: number;
  rest: number;
  /** 0–100 */
  progress: number;
  status: PaymentStatus;
}

export function money(total: number, paid: number): Money {
  const rest = total - paid;
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : paid > 0 ? 100 : 0;
  const status: PaymentStatus = paid <= 0 ? 'unpaid' : rest <= 0 ? 'paid' : 'partial';
  return { total, paid, rest, progress, status };
}

const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);

/* ---------------- Sequential business numbers ---------------- */

/**
 * Both the declaration number and the versement reference are handed out from
 * the local mirror: max + 1, starting at 1. The database carries the same
 * sequence as a fallback default and rejects duplicates, so a collision
 * surfaces as a toast + resync rather than two rows sharing a number.
 */
const nextSeq = (nums: number[]) => nums.reduce((m, n) => Math.max(m, n || 0), 0) + 1;

export function nextDeclarationNo(s: AppState): number {
  return nextSeq(s.secondaryClients.map((c) => c.declarationNo));
}

export function nextVersementRef(s: AppState): number {
  return nextSeq(s.payments.map((p) => p.refNo));
}

/* ---------------- Container ---------------- */

export function carsOfContainer(s: AppState, containerId: ID): SecondaryClient[] {
  return s.secondaryClients.filter((c) => c.containerId === containerId);
}

export function paymentsOfContainer(s: AppState, containerId: ID): Payment[] {
  return s.payments
    .filter((p) => p.containerId === containerId)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export function containerMoney(s: AppState, containerId: ID): Money {
  const total = sum(carsOfContainer(s, containerId), (c) => c.price);
  const paid = sum(
    s.payments.filter((p) => p.containerId === containerId),
    (p) => p.amount,
  );
  return money(total, paid);
}

export function containerFill(s: AppState, containerId: ID) {
  const count = carsOfContainer(s, containerId).length;
  return {
    count,
    max: MAX_CARS_PER_CONTAINER,
    free: Math.max(0, MAX_CARS_PER_CONTAINER - count),
    isFull: count >= MAX_CARS_PER_CONTAINER,
    percent: (count / MAX_CARS_PER_CONTAINER) * 100,
  };
}

/** Distinct principal clients that own at least one car in this container. */
export function principalsOfContainer(s: AppState, containerId: ID): PrincipalClient[] {
  const ids = new Set(carsOfContainer(s, containerId).map((c) => c.principalClientId));
  return s.principalClients.filter((p) => ids.has(p.id));
}

/** Per-principal breakdown inside one container — powers "reste par client". */
export interface ContainerClientLine {
  client: PrincipalClient;
  cars: SecondaryClient[];
  money: Money;
}

export function containerBreakdown(s: AppState, containerId: ID): ContainerClientLine[] {
  return principalsOfContainer(s, containerId)
    .map((client) => {
      const cars = carsOfContainer(s, containerId).filter(
        (c) => c.principalClientId === client.id,
      );
      const total = sum(cars, (c) => c.price);
      const paid = sum(
        s.payments.filter(
          (p) => p.containerId === containerId && p.principalClientId === client.id,
        ),
        (p) => p.amount,
      );
      return { client, cars, money: money(total, paid) };
    })
    .sort((a, b) => b.money.rest - a.money.rest);
}

/* ---------------- Principal client ---------------- */

export function secondariesOfPrincipal(s: AppState, principalId: ID): SecondaryClient[] {
  return s.secondaryClients.filter((c) => c.principalClientId === principalId);
}

export function paymentsOfPrincipal(s: AppState, principalId: ID): Payment[] {
  return s.payments
    .filter((p) => p.principalClientId === principalId)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export function principalMoney(s: AppState, principalId: ID): Money {
  const total = sum(secondariesOfPrincipal(s, principalId), (c) => c.price);
  const paid = sum(
    s.payments.filter((p) => p.principalClientId === principalId),
    (p) => p.amount,
  );
  return money(total, paid);
}

/** Containers this principal has cars in. */
export function containersOfPrincipal(s: AppState, principalId: ID): Container[] {
  const ids = new Set(secondariesOfPrincipal(s, principalId).map((c) => c.containerId));
  return s.containers.filter((c) => ids.has(c.id));
}

/**
 * Transaction story for a principal client: every car assignment and every
 * payment, merged into one chronological feed.
 */
export type TxEvent =
  | { kind: 'car'; date: string; time: string; car: SecondaryClient; container?: Container }
  | { kind: 'payment'; date: string; time: string; payment: Payment; container?: Container };

export function principalTimeline(s: AppState, principalId: ID): TxEvent[] {
  const byId = new Map(s.containers.map((c) => [c.id, c]));
  const cars: TxEvent[] = secondariesOfPrincipal(s, principalId).map((car) => ({
    kind: 'car',
    date: car.createdAt,
    time: '00:00',
    car,
    container: byId.get(car.containerId),
  }));
  const pays: TxEvent[] = paymentsOfPrincipal(s, principalId).map((payment) => ({
    kind: 'payment',
    date: payment.date,
    time: payment.time,
    payment,
    container: byId.get(payment.containerId),
  }));
  return [...cars, ...pays].sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  );
}

/* ---------------- Secondary client ---------------- */

/**
 * A single car's paid share. Payments are recorded per (container, principal),
 * not per car, so we distribute that pool across the principal's cars in the
 * container proportionally to price.
 */
export function carMoney(s: AppState, car: SecondaryClient): Money {
  const siblings = s.secondaryClients.filter(
    (c) => c.containerId === car.containerId && c.principalClientId === car.principalClientId,
  );
  const groupTotal = sum(siblings, (c) => c.price);
  const groupPaid = sum(
    s.payments.filter(
      (p) => p.containerId === car.containerId && p.principalClientId === car.principalClientId,
    ),
    (p) => p.amount,
  );
  const share = groupTotal > 0 ? car.price / groupTotal : 0;
  return money(car.price, Math.min(car.price, groupPaid * share));
}

/* ---------------- Cash ---------------- */

export function cashBalance(s: AppState): number {
  const moves = sum(s.cash, (t) => (t.kind === 'deposit' ? t.amount : -t.amount));
  const collected = sum(s.payments, (p) => p.amount);
  const payroll = sum(s.payrolls, (p) => p.netAmount);
  return moves + collected - payroll;
}

export function cashTotals(s: AppState) {
  const deposits = sum(
    s.cash.filter((t) => t.kind === 'deposit'),
    (t) => t.amount,
  );
  const withdrawals = sum(
    s.cash.filter((t) => t.kind === 'withdraw'),
    (t) => t.amount,
  );
  return { deposits, withdrawals, net: deposits - withdrawals, balance: cashBalance(s) };
}

/* ---------------- Global ---------------- */

export function globalMoney(s: AppState): Money {
  const total = sum(s.secondaryClients, (c) => c.price);
  const paid = sum(s.payments, (p) => p.amount);
  return money(total, paid);
}

export function customsBreakdown(s: AppState): Record<CustomsStatus, number> {
  const out = {
    non_arrive: 0,
    arrive: 0,
    saisie: 0,
    liquide: 0,
    sortie: 0,
    remis_client: 0,
  } as Record<CustomsStatus, number>;
  for (const c of s.secondaryClients) out[c.customsStatus] += 1;
  return out;
}

/* ---------------- Workers ---------------- */

export function pendingAdvances(s: AppState, workerId: ID) {
  return s.advances.filter((a) => a.workerId === workerId && !a.settled);
}

export function pendingAbsences(s: AppState, workerId: ID) {
  return s.absences.filter((a) => a.workerId === workerId && !a.settled);
}

export function payrollsOfWorker(s: AppState, workerId: ID) {
  return s.payrolls
    .filter((p) => p.workerId === workerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function roleName(s: AppState, roleId: ID): string {
  return s.roles.find((r) => r.id === roleId)?.name ?? '—';
}

export function principalName(s: AppState, id: ID): string {
  const p = s.principalClients.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : '—';
}

export function containerLabel(s: AppState, id: ID): string {
  const c = s.containers.find((x) => x.id === id);
  return c ? c.name : '—';
}

export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`;
