/* ============================================================
   Printable payment documents.

   Two shapes, both built on <PrintDocument>:
     • PaymentReceiptDialog — one payment, one receipt.
     • PaymentsPrintDialog  — a whole history table (per container,
       per principal client, or the caisse feed).
   ============================================================ */

import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { containerMoney, fullName, principalMoney } from '../../lib/selectors';
import { formatDate, formatMoney } from '../../lib/format';
import type { Payment } from '../../lib/types';
import {
  InfoCell,
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
  TotalCell,
} from './PrintDocument';

/* ============================================================
   Single payment → receipt
   ============================================================ */

export function PaymentReceiptDialog({
  payment,
  onClose,
}: {
  payment: Payment | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  const data = useMemo(() => {
    if (!payment) return null;
    const container = state.containers.find((c) => c.id === payment.containerId);
    const client = state.principalClients.find((c) => c.id === payment.principalClientId);
    return { container, client, money: containerMoney(state, payment.containerId) };
  }, [state, payment]);

  if (!payment || !data) return null;

  const ref = payment.id.slice(-8).toUpperCase();

  return (
    <PrintPreview
      open={!!payment}
      onClose={onClose}
      heading={t('paymentReceiptSingle')}
      subheading={`${formatDate(payment.date, lang)} · ${fm(payment.amount)}`}
    >
      <PrintDocument
        title={t('paymentReceiptSingle')}
        reference={`${t('receiptNo')} ${ref}`}
      >
        {/* who / what / when */}
        <PrintSection>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('date')} value={`${formatDate(payment.date, lang)} · ${payment.time}`} />
            <InfoCell
              label={t('principalClient')}
              value={data.client ? fullName(data.client) : '—'}
            />
            <InfoCell label={t('container')} value={data.container?.name ?? '—'} />
            <InfoCell label={t('tcNumber')} value={data.container?.tcNumber ?? '—'} mono />
            <InfoCell label={t('phone')} value={data.client?.phone ?? '—'} />
            <InfoCell label={t('recordedBy')} value={payment.createdBy} />
            <InfoCell label={t('documentRef')} value={ref} mono />
            <InfoCell label={t('description')} value={payment.description || '—'} />
          </div>
        </PrintSection>

        {/* the amount — the point of the document */}
        <PrintSection>
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded px-5 py-4"
            style={{
              backgroundColor: '#172952',
              color: '#ffffff',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em]">
              {t('amountReceived')}
            </span>
            <span className="text-[24px] font-extrabold tabular-nums">{fm(payment.amount)}</span>
          </div>
        </PrintSection>

        {/* container standing after this payment */}
        <PrintSection title={t('situationAfter')}>
          <div className="grid grid-cols-3 gap-3">
            <TotalCell label={t('totalAmount')} value={fm(data.money.total)} />
            <TotalCell label={t('totalPaid')} value={fm(data.money.paid)} color="#047857" />
            <TotalCell
              label={t('totalRest')}
              value={fm(data.money.rest)}
              color={data.money.rest > 0 ? '#be123c' : '#047857'}
            />
          </div>
        </PrintSection>

        <p className="text-[10px] font-medium italic text-ink-500">{t('thankYouNote')}</p>

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}

/* ============================================================
   Payment history → table document
   ============================================================ */

export interface PaymentsPrintScope {
  /** "Conteneur CNT-2026-014 · MSKU 483920-1" — printed under the banner. */
  reference: string;
  /** Optional key/value strip above the table. */
  facts?: { label: string; value: string; mono?: boolean }[];
  /** Which column to show next to the date: the container or the client. */
  counterparty: 'client' | 'container';
  payments: Payment[];
  money?: { total: number; paid: number; rest: number };
}

export function PaymentsPrintDialog({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: PaymentsPrintScope | null;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  if (!scope) return null;

  const total = scope.payments.reduce((a, p) => a + p.amount, 0);

  return (
    <PrintPreview
      open={open}
      onClose={onClose}
      heading={t('paymentHistory')}
      subheading={scope.reference}
    >
      <PrintDocument title={t('paymentReceipt')} reference={scope.reference}>
        {scope.facts && scope.facts.length > 0 && (
          <PrintSection>
            <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
              {scope.facts.map((f) => (
                <InfoCell key={f.label} label={f.label} value={f.value} mono={f.mono} />
              ))}
            </div>
          </PrintSection>
        )}

        <PrintSection title={t('paymentHistory')}>
          <table>
            <thead>
              <tr>
                <th className="text-start" style={{ width: '5%' }}>
                  #
                </th>
                <th className="text-start">{t('date')}</th>
                <th className="text-start">
                  {scope.counterparty === 'client' ? t('principalClient') : t('container')}
                </th>
                <th className="text-start">{t('description')}</th>
                <th className="text-start">{t('by')}</th>
                <th className="text-end">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {scope.payments.map((p, i) => {
                const other =
                  scope.counterparty === 'client'
                    ? (() => {
                        const c = state.principalClients.find((x) => x.id === p.principalClientId);
                        return c ? fullName(c) : '—';
                      })()
                    : (state.containers.find((x) => x.id === p.containerId)?.name ?? '—');
                return (
                  <tr key={p.id}>
                    <td className="text-start tabular-nums">{i + 1}</td>
                    <td className="text-start tabular-nums">
                      {formatDate(p.date, lang)} · {p.time}
                    </td>
                    <td className="text-start font-bold">{other}</td>
                    <td className="text-start">{p.description || '—'}</td>
                    <td className="text-start">{p.createdBy}</td>
                    <td className="text-end font-bold tabular-nums">{fm(p.amount)}</td>
                  </tr>
                );
              })}
              {scope.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    {t('noContainerPayments')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-start">
                  {t('totalPaid')}
                </td>
                <td className="text-end tabular-nums">{fm(total)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        {scope.money && (
          <PrintSection>
            <div className="grid grid-cols-3 gap-3">
              <TotalCell label={t('totalAmount')} value={fm(scope.money.total)} />
              <TotalCell label={t('totalPaid')} value={fm(scope.money.paid)} color="#047857" />
              <TotalCell
                label={t('totalRest')}
                value={fm(scope.money.rest)}
                color={scope.money.rest > 0 ? '#be123c' : '#047857'}
              />
            </div>
          </PrintSection>
        )}

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}

/** Convenience: history scope for one principal client. */
export function usePrincipalScope(principalId: string | null): PaymentsPrintScope | null {
  const { t } = useI18n();
  const { state } = useStore();
  return useMemo(() => {
    if (!principalId) return null;
    const client = state.principalClients.find((c) => c.id === principalId);
    if (!client) return null;
    const payments = state.payments
      .filter((p) => p.principalClientId === principalId)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const m = principalMoney(state, principalId);
    return {
      reference: `${t('principalClient')}: ${fullName(client)}`,
      counterparty: 'container',
      facts: [
        { label: t('principalClient'), value: fullName(client) },
        { label: t('phone'), value: client.phone },
        { label: t('address'), value: client.address },
        { label: t('payments'), value: String(payments.length) },
      ],
      payments,
      money: { total: m.total, paid: m.paid, rest: m.rest },
    };
  }, [state, principalId, t]);
}
