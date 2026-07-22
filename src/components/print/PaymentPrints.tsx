/* ============================================================
   Printable payment documents.

   Two shapes, both built on <PrintDocument>:
     • PaymentReceiptDialog — one versement, one receipt. The reference and
       the amount are the document: everything else supports them.
     • PaymentsPrintDialog  — a whole history table (per container,
       per principal client, or the caisse feed).
   ============================================================ */

import { useMemo, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { containerMoney, fullName, principalMoney } from '../../lib/selectors';
import { amountInWords } from '../../lib/amountInWords';
import { formatDate, formatMoney, formatVersementRef } from '../../lib/format';
import type { Payment } from '../../lib/types';
import { cx } from '../ui/primitives';
import {
  HeroAmount,
  InfoCell,
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
  TotalCell,
} from './PrintDocument';

/* ============================================================
   Shared blocks
   ============================================================ */

/**
 * A bordered party panel — "Reçu de" on one side, "Concernant" on the other.
 * Two of them side by side is the shape every commercial receipt uses.
 */
function PartyPanel({
  legend,
  rows,
}: {
  legend: string;
  rows: { label: string; value: ReactNode; mono?: boolean }[];
}) {
  return (
    <div className="tp-panel flex-1 rounded-[2px]">
      <div
        className="px-3 py-1.5"
        style={{
          backgroundColor: '#f6f8fb',
          borderBottom: '1px solid #c6ced9',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-ink-500">
          {legend}
        </p>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-ink-500">
              {r.label}
            </span>
            <span
              className={cx(
                'min-w-0 truncate text-end text-[11px] font-bold',
                r.mono && 'font-mono tracking-tight',
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Total / paid / rest, with the settled-or-not state spelled out. */
function SituationBlock({
  money,
  fm,
}: {
  money: { total: number; paid: number; rest: number };
  fm: (n: number) => string;
}) {
  const { t } = useI18n();
  const settled = money.rest <= 0;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <TotalCell label={t('totalAmount')} value={fm(money.total)} />
      <TotalCell label={t('totalPaid')} value={fm(money.paid)} color="#047857" />
      <TotalCell
        label={t('totalRest')}
        value={fm(money.rest)}
        color={settled ? '#047857' : '#be123c'}
      />
    </div>
  );
}

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
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const data = useMemo(() => {
    if (!payment) return null;
    const container = state.containers.find((c) => c.id === payment.containerId);
    const client = state.principalClients.find((c) => c.id === payment.principalClientId);
    return { container, client, money: containerMoney(state, payment.containerId) };
  }, [state, payment]);

  if (!payment || !data) return null;

  /* The versement reference is the document's identity — same number the
     search box in "Suivi de versement" answers to. */
  const ref = formatVersementRef(payment.refNo);
  const settled = data.money.rest <= 0;

  return (
    <PrintPreview
      open={!!payment}
      onClose={onClose}
      heading={t('paymentReceiptSingle')}
      subheading={`${t('versementRef')} ${ref} · ${formatDate(payment.date, lang)} · ${fm(payment.amount)}`}
    >
      <PrintDocument
        title={t('paymentReceiptSingle')}
        meta={[
          { label: t('versementRef'), value: ref, mono: true, strong: true },
          { label: t('date'), value: `${formatDate(payment.date, lang)} · ${payment.time}` },
        ]}
      >
        {/* ---------- the two parties ---------- */}
        <PrintSection>
          <div className="flex flex-wrap gap-3">
            <PartyPanel
              legend={t('receivedFrom')}
              rows={[
                { label: t('principalClient'), value: data.client ? fullName(data.client) : '—' },
                { label: t('phone'), value: data.client?.phone || '—' },
                { label: t('address'), value: data.client?.address || '—' },
              ]}
            />
            <PartyPanel
              legend={t('concerning')}
              rows={[
                { label: t('container'), value: data.container?.name ?? '—' },
                { label: t('tcNumber'), value: data.container?.tcNumber ?? '—', mono: true },
                {
                  label: t('arrivalDate'),
                  value: data.container?.arrivalDate
                    ? formatDate(data.container.arrivalDate, lang)
                    : '—',
                },
              ]}
            />
          </div>
        </PrintSection>

        {/* ---------- the amount: the point of the document ---------- */}
        <HeroAmount
          label={t('amountReceived')}
          value={fm(payment.amount)}
          words={amountInWords(payment.amount, lang, cur)}
          wordsLabel={t('amountInWords')}
        />

        {/* ---------- how it was recorded ---------- */}
        <PrintSection title={t('paymentInfoSection')}>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2 rounded-[2px] p-3 sm:grid-cols-4">
            <InfoCell label={t('versementRef')} value={ref} mono />
            <InfoCell label={t('date')} value={formatDate(payment.date, lang)} />
            <InfoCell label={t('time')} value={payment.time} />
            <InfoCell label={t('recordedBy')} value={payment.createdBy || '—'} />
            <InfoCell label={t('description')} value={payment.description || '—'} />
          </div>
        </PrintSection>

        {/* ---------- container standing after this payment ---------- */}
        <PrintSection title={t('situationAfter')}>
          <SituationBlock money={data.money} fm={fm} />
          <div
            className="mt-2 rounded-[2px] px-3 py-1.5 text-center text-[9.5px] font-extrabold uppercase tracking-[0.12em]"
            style={{
              backgroundColor: settled ? '#e7f6ef' : '#fdeaef',
              color: settled ? '#047857' : '#be123c',
              border: `1px solid ${settled ? '#a7dcc5' : '#f2b8c6'}`,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            {settled ? t('fullySettled') : t('remainingDue', { amount: fm(data.money.rest) })}
          </div>
        </PrintSection>

        <p className="text-[9.5px] font-medium italic leading-relaxed text-ink-500">
          {t('thankYouNote')}
        </p>

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
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  if (!scope) return null;

  const total = scope.payments.reduce((a, p) => a + p.amount, 0);
  const period =
    scope.payments.length > 0
      ? (() => {
          const dates = scope.payments.map((p) => p.date).sort();
          return `${formatDate(dates[0], lang)} → ${formatDate(dates[dates.length - 1], lang)}`;
        })()
      : '—';

  return (
    <PrintPreview
      open={open}
      onClose={onClose}
      heading={t('paymentHistory')}
      subheading={scope.reference}
    >
      <PrintDocument
        title={t('paymentReceipt')}
        reference={scope.reference}
        meta={[
          { label: t('payments'), value: String(scope.payments.length), strong: true },
          { label: t('period'), value: period },
        ]}
      >
        {scope.facts && scope.facts.length > 0 && (
          <PrintSection title={t('information')}>
            <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2 rounded-[2px] p-3 sm:grid-cols-4">
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
                <th className="text-center" style={{ width: '6%' }}>
                  #
                </th>
                <th className="text-start" style={{ width: '11%' }}>
                  {t('versementRefShort')}
                </th>
                <th className="text-start" style={{ width: '17%' }}>
                  {t('date')}
                </th>
                <th className="text-start">
                  {scope.counterparty === 'client' ? t('principalClient') : t('container')}
                </th>
                <th className="text-start">{t('description')}</th>
                <th className="text-start" style={{ width: '13%' }}>
                  {t('by')}
                </th>
                <th className="text-end" style={{ width: '16%' }}>
                  {t('amount')}
                </th>
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
                    <td className="text-center tabular-nums text-ink-500">{i + 1}</td>
                    <td className="text-start font-mono font-bold tabular-nums">
                      {formatVersementRef(p.refNo)}
                    </td>
                    <td className="text-start tabular-nums">
                      {formatDate(p.date, lang)} · {p.time}
                    </td>
                    <td className="text-start font-bold">{other}</td>
                    <td className="text-start">{p.description || '—'}</td>
                    <td className="text-start">{p.createdBy || '—'}</td>
                    <td className="text-end font-bold tabular-nums">{fm(p.amount)}</td>
                  </tr>
                );
              })}
              {scope.payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">
                    {t('noContainerPayments')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="text-start">
                  {t('totalPaid')}
                </td>
                <td className="text-end tabular-nums">{fm(total)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        {scope.payments.length > 0 && (
          <PrintSection>
            <div className="tp-box rounded-[2px] px-4 py-2">
              <span className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                {t('amountInWords')}{' '}
              </span>
              <span className="text-[10.5px] font-bold italic">
                {amountInWords(total, lang, cur)}
              </span>
            </div>
          </PrintSection>
        )}

        {scope.money && (
          <PrintSection title={t('financialSummary')}>
            <SituationBlock money={scope.money} fm={fm} />
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
