/* ============================================================
   Alert engine — scans the whole dataset for things that need
   attention. Consumed by the Dashboard.
   ============================================================ */

import type { AppState, PageKey } from './types';
import {
  cashBalance,
  containerFill,
  containerMoney,
  fullName,
  principalMoney,
} from './selectors';
import type { TranslationKey } from '../i18n/translations';

export type Severity = 'high' | 'medium' | 'low';

export interface AppAlert {
  id: string;
  severity: Severity;
  messageKey: TranslationKey;
  vars: Record<string, string | number>;
  /** Where clicking the alert should take the user. */
  target: PageKey;
}

const LOW_CASH_THRESHOLD = 500_000;

export function buildAlerts(
  s: AppState,
  fmtMoney: (n: number) => string,
): AppAlert[] {
  const out: AppAlert[] = [];

  /* --- containers with outstanding balance --- */
  for (const c of s.containers) {
    const m = containerMoney(s, c.id);
    if (m.rest > 0 && m.total > 0) {
      out.push({
        id: `ct-rest-${c.id}`,
        severity: m.paid === 0 ? 'high' : m.rest > m.total * 0.5 ? 'medium' : 'low',
        messageKey: 'alertUnpaidContainer',
        vars: { name: c.name, amount: fmtMoney(m.rest) },
        target: 'paymentTracking',
      });
    }
    const fill = containerFill(s, c.id);
    if (fill.count === 0) {
      out.push({
        id: `ct-empty-${c.id}`,
        severity: 'low',
        messageKey: 'alertContainerEmpty',
        vars: { name: c.name },
        target: 'containers',
      });
    } else if (fill.isFull) {
      out.push({
        id: `ct-full-${c.id}`,
        severity: 'low',
        messageKey: 'alertContainerFull',
        vars: { name: c.name, count: fill.count },
        target: 'containers',
      });
    }
  }

  /* --- clients with large debt --- */
  for (const p of s.principalClients) {
    const m = principalMoney(s, p.id);
    if (m.rest > 1_000_000) {
      out.push({
        id: `pc-debt-${p.id}`,
        severity: m.rest > 5_000_000 ? 'high' : 'medium',
        messageKey: 'alertClientDebt',
        vars: { name: fullName(p), amount: fmtMoney(m.rest) },
        target: 'principalClients',
      });
    }
  }

  /* --- customs pipeline --- */
  const seized = s.secondaryClients.filter((c) => c.customsStatus === 'saisie').length;
  if (seized > 0) {
    out.push({
      id: 'customs-seized',
      severity: 'high',
      messageKey: 'alertStuckCustoms',
      vars: { count: seized },
      target: 'customs',
    });
  }

  const notArrived = s.secondaryClients.filter((c) => c.customsStatus === 'non_arrive').length;
  if (notArrived > 0) {
    out.push({
      id: 'customs-not-arrived',
      severity: 'low',
      messageKey: 'alertNotArrived',
      vars: { count: notArrived },
      target: 'customs',
    });
  }

  /* --- cash --- */
  const balance = cashBalance(s);
  if (balance < LOW_CASH_THRESHOLD) {
    out.push({
      id: 'cash-low',
      severity: balance < 0 ? 'high' : 'medium',
      messageKey: 'alertLowCash',
      vars: { amount: fmtMoney(balance) },
      target: 'caisse',
    });
  }

  /* --- workers --- */
  const advCount = s.advances.filter((a) => !a.settled).length;
  if (advCount > 0) {
    out.push({
      id: 'wk-advances',
      severity: 'medium',
      messageKey: 'alertPendingAdvances',
      vars: { count: advCount },
      target: 'workers',
    });
  }

  const absCount = s.absences.filter((a) => !a.settled).length;
  if (absCount > 0) {
    out.push({
      id: 'wk-absences',
      severity: 'low',
      messageKey: 'alertPendingAbsences',
      vars: { count: absCount },
      target: 'workers',
    });
  }

  /* --- inactive clients --- */
  const inactive = s.principalClients.filter((p) => p.status === 'inactive').length;
  if (inactive > 0) {
    out.push({
      id: 'pc-inactive',
      severity: 'low',
      messageKey: 'alertInactiveClients',
      vars: { count: inactive },
      target: 'principalClients',
    });
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
