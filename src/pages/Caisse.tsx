import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Calendar,
  CreditCard,
  Plus,
  Printer,
  Receipt,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { cashBalance, fullName } from '../lib/selectors';
import {
  addDays,
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatVersementRef,
  inRange,
  nowTime,
  todayISO,
} from '../lib/format';
import type { CashKind, CashTransaction, Payment } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  StaggerItem,
  StaggerList,
  Textarea,
  cx,
} from '../components/ui/primitives';
import { DropdownMenu, Modal, Tabs, useConfirm, useToast } from '../components/ui/overlays';
import { DataPoint, PageHeader, StatCard } from '../components/shared';
import {
  PaymentReceiptDialog,
  PaymentsPrintDialog,
  type PaymentsPrintScope,
} from '../components/print/PaymentPrints';
import { CashPrintDialog, type CashPrintKind } from '../components/print/CashPrints';

type Period = 'today' | 'lastWeek' | 'lastMonth' | 'custom';

export function Caisse() {
  const { t, lang } = useI18n();
  const { state, can, addCash, deleteCash } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const today = todayISO();
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState(addDays(today, -7));
  const [to, setTo] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState('transactions');

  const range = useMemo(() => {
    if (period === 'today') return { from: today, to: today };
    if (period === 'lastWeek') return { from: addDays(today, -6), to: today };
    if (period === 'lastMonth') return { from: addDays(today, -29), to: today };
    return { from: from <= to ? from : to, to: from <= to ? to : from };
  }, [period, from, to, today]);

  /* ---------- period slices ---------- */
  const cashRows = useMemo(
    () =>
      state.cash
        .filter((c) => inRange(c.date, range.from, range.to))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [state.cash, range],
  );

  const paymentRows = useMemo(
    () =>
      state.payments
        .filter((p) => inRange(p.date, range.from, range.to))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [state.payments, range],
  );

  const periodTotals = useMemo(() => {
    const deposits = cashRows.filter((c) => c.kind === 'deposit').reduce((a, c) => a + c.amount, 0);
    const withdrawals = cashRows
      .filter((c) => c.kind === 'withdraw')
      .reduce((a, c) => a + c.amount, 0);
    const collected = paymentRows.reduce((a, p) => a + p.amount, 0);
    return { deposits, withdrawals, net: deposits - withdrawals, collected };
  }, [cashRows, paymentRows]);

  const balance = useMemo(() => cashBalance(state), [state]);

  const periodLabel =
    period === 'today'
      ? t('today')
      : `${t('from')} ${formatDate(range.from, lang)} ${t('to').toLowerCase()} ${formatDate(range.to, lang)}`;

  /* ---------- actions ---------- */
  const handleDelete = async (tx: CashTransaction) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">
            {tx.kind === 'deposit' ? '+' : '−'}
            {fm(tx.amount)}
          </p>
          <p className="mt-1">
            {formatDate(tx.date, lang)} · {tx.time}
          </p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteCash(tx.id);
    toast.success(t('transactionDeleted'));
  };

  /* ---------- tabs ---------- */
  const tabs = [
    ...(can('caisse', 'viewHistory')
      ? [
          {
            key: 'transactions',
            label: t('transactions'),
            icon: <Receipt size={15} />,
            badge: cashRows.length,
          },
        ]
      : []),
    ...(can('caisse', 'viewContainerPayments')
      ? [
          {
            key: 'payments',
            label: t('containerPaymentsList'),
            icon: <CreditCard size={15} />,
            badge: paymentRows.length,
          },
        ]
      : []),
  ];
  const activeTab = tabs.some((x) => x.key === tab) ? tab : (tabs[0]?.key ?? '');

  return (
    <div>
      <PageHeader
        icon={<Wallet size={24} />}
        title={t('caisse')}
        subtitle={t('caisseSubtitle')}
        actions={
          can('caisse', 'createTransaction') && (
            <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
              {t('newTransaction')}
            </Button>
          )
        }
      />

      {/* ---------- summary ---------- */}
      <StaggerList className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('cashInHand')}
            value={balance}
            format={fms}
            icon={<Wallet size={20} />}
            tone={balance >= 0 ? 'brand' : 'rose'}
            hint={t('cashBalance')}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalDeposits')}
            value={periodTotals.deposits}
            format={fms}
            icon={<ArrowDownLeft size={20} />}
            tone="emerald"
            hint={`${t('inPeriod')} · ${periodLabel}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalWithdrawals')}
            value={periodTotals.withdrawals}
            format={fms}
            icon={<ArrowUpRight size={20} />}
            tone="rose"
            hint={`${t('inPeriod')} · ${periodLabel}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('netFlow')}
            value={periodTotals.net}
            format={fms}
            icon={<TrendingUp size={20} />}
            tone={periodTotals.net >= 0 ? 'ocean' : 'amber'}
            hint={`${t('payments')}: ${fms(periodTotals.collected)}`}
          />
        </StaggerItem>
      </StaggerList>

      {/* ---------- period filter ---------- */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <span className="flex items-center gap-2 text-[13px] font-bold text-ink-700">
            <Calendar size={15} className="text-brand-600" />
            {t('period')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(['today', 'lastWeek', 'lastMonth', 'custom'] as Period[]).map((p) => {
              const on = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPeriod(p)}
                  className={cx(
                    'relative cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors duration-200',
                    on
                      ? 'border-transparent bg-grad-brand text-white shadow-float'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
                  )}
                >
                  {t(p === 'custom' ? 'customPeriod' : p)}
                </button>
              );
            })}
          </div>
          <span className="text-2xs font-semibold text-ink-400 lg:ms-auto">{periodLabel}</span>
        </div>

        <AnimatePresence initial={false}>
          {period === 'custom' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 grid gap-3 border-t border-ink-100 pt-3 sm:grid-cols-2">
                <Input
                  label={t('startDate')}
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <Input
                  label={t('endDate')}
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 sm:grid-cols-4">
          <DataPoint label={t('cashInHand')} value={fm(balance)} icon={<Wallet size={11} />} />
          <DataPoint
            label={t('totalDeposits')}
            value={fm(periodTotals.deposits)}
            icon={<ArrowDownLeft size={11} />}
          />
          <DataPoint
            label={t('totalWithdrawals')}
            value={fm(periodTotals.withdrawals)}
            icon={<ArrowUpRight size={11} />}
          />
          <DataPoint
            label={t('netFlow')}
            value={fm(periodTotals.net)}
            icon={<TrendingUp size={11} />}
          />
        </div>
      </Card>

      {/* ---------- views ---------- */}
      {tabs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={28} />}
            title={t('permissionRequired')}
            hint={t('accessDeniedHint')}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200/70 bg-grad-brand-soft p-3.5">
            <Tabs tabs={tabs} active={activeTab} onChange={setTab} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'transactions' && (
                <TransactionsTable
                  rows={cashRows}
                  periodLabel={periodLabel}
                  balance={balance}
                  onDelete={can('caisse', 'deleteTransaction') ? handleDelete : undefined}
                />
              )}
              {activeTab === 'payments' && <ContainerPaymentsTable rows={paymentRows} />}
            </motion.div>
          </AnimatePresence>
        </Card>
      )}

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          addCash(data);
          setFormOpen(false);
          toast.success(t('transactionCreated'));
        }}
      />
    </div>
  );
}

/* ============================================================
   Transactions table
   ============================================================ */

function TransactionsTable({
  rows,
  periodLabel,
  balance,
  onDelete,
}: {
  rows: CashTransaction[];
  periodLabel: string;
  balance: number;
  onDelete?: (tx: CashTransaction) => void;
}) {
  const { t, lang } = useI18n();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [printKind, setPrintKind] = useState<CashPrintKind | null>(null);

  const depositCount = rows.filter((r) => r.kind === 'deposit').length;
  const withdrawCount = rows.filter((r) => r.kind === 'withdraw').length;

  const printScope =
    printKind === null
      ? null
      : {
          kind: printKind,
          rows: rows.filter((r) => printKind === 'all' || r.kind === printKind),
          periodLabel,
          balance,
        };

  const printMenu = (
    <>
      <div className="flex justify-end px-5 pb-3">
        <DropdownMenu
          align="end"
          header={t('printTransactions')}
          items={[
            {
              key: 'all',
              label: `${t('allTransactions')} (${rows.length})`,
              icon: <Receipt size={15} />,
              onClick: () => setPrintKind('all'),
            },
            {
              key: 'deposit',
              label: `${t('depositsOnly')} (${depositCount})`,
              icon: <ArrowDownLeft size={15} />,
              onClick: () => setPrintKind('deposit'),
            },
            {
              key: 'withdraw',
              label: `${t('withdrawalsOnly')} (${withdrawCount})`,
              icon: <ArrowUpRight size={15} />,
              onClick: () => setPrintKind('withdraw'),
            },
          ]}
          trigger={
            <Button size="sm" variant="secondary" icon={<Printer size={15} />}>
              {t('printTransactions')}
            </Button>
          }
        />
      </div>
      <CashPrintDialog open={printKind !== null} onClose={() => setPrintKind(null)} scope={printScope} />
    </>
  );

  if (rows.length === 0) {
    return (
      <div>
        {printMenu}
        <EmptyState icon={<Receipt size={28} />} title={t('empty')} hint={t('noDataInPeriod')} />
      </div>
    );
  }

  const total = rows.reduce((a, r) => a + (r.kind === 'deposit' ? r.amount : -r.amount), 0);

  return (
    <div className="overflow-x-auto">
      {printMenu}
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-ink-200/70 bg-ink-50/60 text-2xs uppercase tracking-wide text-ink-500">
            <th className="px-5 py-2.5 text-start font-bold">{t('date')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('transactionType')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('description')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('by')}</th>
            <th className="px-5 py-2.5 text-end font-bold">{t('amount')}</th>
            {onDelete && <th className="px-5 py-2.5 text-end font-bold">{t('actions')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          <AnimatePresence mode="popLayout">
            {rows.map((r) => {
              const isIn = r.kind === 'deposit';
              return (
                <motion.tr
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="transition-colors hover:bg-ink-50/70"
                >
                  <td className="whitespace-nowrap px-5 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                    {formatDate(r.date, lang)} · {r.time}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={cx(
                        'chip',
                        isIn
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
                      )}
                    >
                      {isIn ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                      {t(isIn ? 'deposit' : 'withdraw')}
                    </span>
                  </td>
                  <td className="max-w-[16rem] truncate px-5 py-2.5 text-xs text-ink-500">
                    {r.description || '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-ink-500">{r.createdBy}</td>
                  <td
                    className={cx(
                      'whitespace-nowrap px-5 py-2.5 text-end text-[13px] font-extrabold tabular-nums',
                      isIn ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {isIn ? '+' : '−'}
                    {fm(r.amount)}
                  </td>
                  {onDelete && (
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end">
                        <IconButton
                          label={t('delete')}
                          variant="secondary"
                          onClick={() => onDelete(r)}
                          className="!text-rose-600 hover:!border-rose-300 hover:!bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink-200 bg-ink-50">
            <td colSpan={4} className="px-5 py-2.5 text-[13px] font-bold text-ink-700">
              {t('netFlow')}
            </td>
            <td
              className={cx(
                'px-5 py-2.5 text-end text-sm font-extrabold tabular-nums',
                total >= 0 ? 'text-emerald-700' : 'text-rose-700',
              )}
            >
              {total >= 0 ? '+' : '−'}
              {fm(Math.abs(total))}
            </td>
            {onDelete && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ============================================================
   Container payments list
   ============================================================ */

function ContainerPaymentsTable({ rows: payments }: { rows: Payment[] }) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [printAll, setPrintAll] = useState(false);

  const total = payments.reduce((a, p) => a + p.amount, 0);

  const scope: PaymentsPrintScope = {
    reference: `${t('containerPaymentsList')} · ${payments.length}`,
    counterparty: 'container',
    payments,
  };

  if (payments.length === 0) {
    return (
      <EmptyState icon={<CreditCard size={28} />} title={t('noPayments')} hint={t('noDataInPeriod')} />
    );
  }

  return (
    <div className="overflow-x-auto">
      <PaymentReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
      <PaymentsPrintDialog open={printAll} onClose={() => setPrintAll(false)} scope={scope} />

      <div className="flex justify-end px-5 pb-3">
        <Button
          size="sm"
          variant="secondary"
          icon={<Printer size={15} />}
          onClick={() => setPrintAll(true)}
        >
          {t('printHistory')}
        </Button>
      </div>

      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-ink-200/70 bg-ink-50/60 text-2xs uppercase tracking-wide text-ink-500">
            <th className="px-5 py-2.5 text-start font-bold">{t('versementRefShort')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('date')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('container')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('principalClient')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('description')}</th>
            <th className="px-5 py-2.5 text-start font-bold">{t('by')}</th>
            <th className="px-5 py-2.5 text-end font-bold">{t('amount')}</th>
            <th className="px-5 py-2.5 text-end font-bold">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          <AnimatePresence mode="popLayout">
            {payments.map((p) => {
              const ct = state.containers.find((c) => c.id === p.containerId);
              const pc = state.principalClients.find((c) => c.id === p.principalClientId);
              return (
                <motion.tr
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="transition-colors hover:bg-ink-50/70"
                >
                  <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-extrabold tabular-nums text-brand-700">
                    {formatVersementRef(p.refNo)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                    {formatDate(p.date, lang)} · {p.time}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-grad-ocean text-white">
                        <Boxes size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-ink-900">
                          {ct?.name ?? '—'}
                        </span>
                        <span className="block truncate font-mono text-2xs text-ink-500">
                          {ct?.tcNumber ?? '—'}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-[13px] text-ink-700">
                    {pc ? fullName(pc) : '—'}
                  </td>
                  <td className="max-w-[14rem] truncate px-5 py-2.5 text-xs text-ink-500">
                    {p.description || '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-ink-500">{p.createdBy}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-emerald-600">
                    +{fm(p.amount)}
                  </td>
                  <td className="px-5 py-2.5 text-end">
                    <IconButton
                      label={t('printReceipt')}
                      variant="secondary"
                      onClick={() => setReceipt(p)}
                    >
                      <Printer size={14} />
                    </IconButton>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink-200 bg-ink-50">
            <td colSpan={6} className="px-5 py-2.5 text-[13px] font-bold text-ink-700">
              {t('totalPaid')}
            </td>
            <td className="px-5 py-2.5 text-end text-sm font-extrabold tabular-nums text-emerald-700">
              {fm(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ============================================================
   New transaction dialog
   ============================================================ */

function TransactionForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    kind: CashKind;
    amount: number;
    date: string;
    time: string;
    description?: string;
  }) => void;
}) {
  const { t } = useI18n();
  const cur = t('currency');

  const [kind, setKind] = useState<CashKind>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState(false);

  if (open !== seed) {
    setSeed(open);
    if (open) {
      setKind('deposit');
      setAmount('');
      setDate(todayISO());
      setTime(nowTime());
      setDescription('');
      setErrors({});
    }
  }

  const numeric = Number(amount.replace(/\s/g, ''));

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!amount.trim() || Number.isNaN(numeric) || numeric <= 0) errs.amount = t('invalidNumber');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      kind,
      amount: numeric,
      date,
      time,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newTransaction')}
      subtitle={t('caisseSubtitle')}
      icon={<Wallet size={20} />}
      size="md"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            block
            variant={kind === 'deposit' ? 'success' : 'danger'}
            onClick={submit}
            icon={kind === 'deposit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          >
            {t('create')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* segmented type selector */}
        <div>
          <label className="label">{t('transactionType')}</label>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-ink-200/80 bg-ink-100/70 p-1.5">
            {(['deposit', 'withdraw'] as CashKind[]).map((k) => {
              const on = kind === k;
              const isIn = k === 'deposit';
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKind(k)}
                  className={cx(
                    'relative flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors duration-200',
                    on ? 'text-white' : 'text-ink-500 hover:text-ink-800',
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="cash-kind"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className={cx(
                        'absolute inset-0 rounded-xl shadow-float',
                        isIn ? 'bg-grad-emerald' : 'bg-grad-rose',
                      )}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {isIn ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    {t(isIn ? 'deposit' : 'withdraw')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label={t('amount')}
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          suffix={cur}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label={t('time')}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        <Textarea
          label={`${t('description')} (${t('optional')})`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
    </Modal>
  );
}
