/* ============================================================
   Printable cash-register (caisse) statement.

   A single document shape built on <PrintDocument> that prints the
   movements of the caisse — deposits, withdrawals, or both — as a tidy
   accounting statement: a summary strip, the dated movements table, and
   the net result spelled out in words. The company masthead, logo and
   legal footer come free from <PrintDocument>.
   ============================================================ */

import { useI18n } from '../../i18n/I18nProvider';
import { amountInWords } from '../../lib/amountInWords';
import { formatDate, formatMoney } from '../../lib/format';
import type { CashKind, CashTransaction } from '../../lib/types';
import {
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
  TotalCell,
} from './PrintDocument';

export type CashPrintKind = 'all' | CashKind;

export interface CashPrintScope {
  /** Which movements the document covers. */
  kind: CashPrintKind;
  /** Pre-filtered, already-sorted rows to print. */
  rows: CashTransaction[];
  /** Human period label, e.g. "Aujourd'hui" or "du 01/01 au 31/01". */
  periodLabel: string;
  /** Current cash balance in hand, for the summary strip. */
  balance: number;
}

export function CashPrintDialog({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: CashPrintScope | null;
}) {
  const { t, lang } = useI18n();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  if (!scope) return null;

  const { kind, rows, periodLabel, balance } = scope;

  const deposits = rows.filter((r) => r.kind === 'deposit').reduce((a, r) => a + r.amount, 0);
  const withdrawals = rows.filter((r) => r.kind === 'withdraw').reduce((a, r) => a + r.amount, 0);
  const net = deposits - withdrawals;

  /* The document's own title names which slice of the caisse it prints. */
  const title =
    kind === 'deposit'
      ? `${t('cashStatement')} — ${t('printDeposits')}`
      : kind === 'withdraw'
        ? `${t('cashStatement')} — ${t('printWithdrawals')}`
        : t('cashStatement');

  const period =
    rows.length > 0
      ? (() => {
          const dates = rows.map((r) => r.date).sort();
          return `${formatDate(dates[0], lang)} → ${formatDate(dates[dates.length - 1], lang)}`;
        })()
      : periodLabel;

  /* The figure the statement settles on, for the words line. */
  const resultValue = kind === 'deposit' ? deposits : kind === 'withdraw' ? withdrawals : net;

  return (
    <PrintPreview
      open={open}
      onClose={onClose}
      heading={title}
      subheading={`${periodLabel} · ${rows.length} ${t('transactions').toLowerCase()}`}
    >
      <PrintDocument
        title={title}
        reference={periodLabel}
        meta={[
          { label: t('transactionsCount'), value: String(rows.length), strong: true },
          { label: t('period'), value: period },
        ]}
      >
        {/* ---------- summary strip ---------- */}
        <PrintSection title={t('financialSummary')}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <TotalCell label={t('totalDeposits')} value={fm(deposits)} color="#047857" />
            <TotalCell label={t('totalWithdrawals')} value={fm(withdrawals)} color="#be123c" />
            <TotalCell
              label={t('netFlow')}
              value={`${net >= 0 ? '+' : '−'}${fm(Math.abs(net))}`}
              color={net >= 0 ? '#047857' : '#be123c'}
            />
            <TotalCell label={t('cashInHand')} value={fm(balance)} color="#172952" />
          </div>
        </PrintSection>

        {/* ---------- movements table ---------- */}
        <PrintSection title={t('transactions')}>
          <table>
            <thead>
              <tr>
                <th className="text-center" style={{ width: '6%' }}>
                  #
                </th>
                <th className="text-start" style={{ width: '20%' }}>
                  {t('date')}
                </th>
                <th className="text-start" style={{ width: '14%' }}>
                  {t('movementType')}
                </th>
                <th className="text-start">{t('description')}</th>
                <th className="text-start" style={{ width: '14%' }}>
                  {t('by')}
                </th>
                <th className="text-end" style={{ width: '16%' }}>
                  {t('amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isIn = r.kind === 'deposit';
                return (
                  <tr key={r.id}>
                    <td className="text-center tabular-nums text-ink-500">{i + 1}</td>
                    <td className="text-start tabular-nums">
                      {formatDate(r.date, lang)} · {r.time}
                    </td>
                    <td className="text-start font-bold" style={{ color: isIn ? '#047857' : '#be123c' }}>
                      {t(isIn ? 'deposit' : 'withdraw')}
                    </td>
                    <td className="text-start">{r.description || '—'}</td>
                    <td className="text-start">{r.createdBy || '—'}</td>
                    <td
                      className="text-end font-bold tabular-nums"
                      style={{ color: isIn ? '#047857' : '#be123c' }}
                    >
                      {isIn ? '+' : '−'}
                      {fm(r.amount)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    {t('noDataInPeriod')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              {kind === 'all' ? (
                <tr>
                  <td colSpan={5} className="text-start">
                    {t('netFlow')}
                  </td>
                  <td className="text-end tabular-nums">
                    {net >= 0 ? '+' : '−'}
                    {fm(Math.abs(net))}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} className="text-start">
                    {kind === 'deposit' ? t('totalDeposits') : t('totalWithdrawals')}
                  </td>
                  <td className="text-end tabular-nums">
                    {fm(kind === 'deposit' ? deposits : withdrawals)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </PrintSection>

        {/* ---------- result in words ---------- */}
        {rows.length > 0 && (
          <PrintSection>
            <div className="tp-box rounded-[2px] px-4 py-2">
              <span className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
                {t('amountInWords')}{' '}
              </span>
              <span className="text-[10.5px] font-bold italic">
                {amountInWords(Math.abs(resultValue), lang, cur)}
              </span>
            </div>
          </PrintSection>
        )}

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}
