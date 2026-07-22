import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  Boxes,
  Calendar,
  Car,
  CreditCard,
  History,
  Pencil,
  Printer,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  carsOfContainer,
  containerBreakdown,
  containerFill,
  containerMoney,
  fullName,
  paymentsOfContainer,
  principalsOfContainer,
} from '../lib/selectors';
import {
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatDeclarationNo,
  formatNumber,
  formatVersementRef,
  matchesRef,
  norm,
  nowTime,
  todayISO,
} from '../lib/format';
import { MAX_CARS_PER_CONTAINER } from '../lib/types';
import type { Container, Payment, PaymentStatus } from '../lib/types';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  SearchBar,
  StaggerItem,
  StaggerList,
  Textarea,
  cx,
} from '../components/ui/primitives';
import { Modal, useConfirm, useToast } from '../components/ui/overlays';
import {
  DataPoint,
  FilterPills,
  MoneySummary,
  PageHeader,
  PaymentBadge,
  ResultCount,
  StatCard,
} from '../components/shared';
import {
  InfoCell,
  PrintDocument,
  PrintPreview,
  PrintSection,
  PrintSignatures,
  TotalCell,
} from '../components/print/PrintDocument';
import {
  PaymentReceiptDialog,
  PaymentsPrintDialog,
  type PaymentsPrintScope,
} from '../components/print/PaymentPrints';

type Filter = 'all' | PaymentStatus;

interface PayTarget {
  container: Container;
  payment: Payment | null;
}

export function PaymentTracking() {
  const { t, lang } = useI18n();
  const { state, can, addPayment, updatePayment, deletePayment } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [historyFor, setHistoryFor] = useState<Container | null>(null);
  const [printFor, setPrintFor] = useState<Container | null>(null);

  /* ---------- enriched rows ---------- */
  const rows = useMemo(
    () =>
      state.containers.map((container) => ({
        container,
        money: containerMoney(state, container.id),
        cars: containerFill(state, container.id).count,
        principals: principalsOfContainer(state, container.id).length,
        payments: paymentsOfContainer(state, container.id).length,
      })),
    [state],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      unpaid: rows.filter((r) => r.money.status === 'unpaid').length,
      partial: rows.filter((r) => r.money.status === 'partial').length,
      paid: rows.filter((r) => r.money.status === 'paid').length,
    }),
    [rows],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          total: acc.total + r.money.total,
          paid: acc.paid + r.money.paid,
          rest: acc.rest + r.money.rest,
          cars: acc.cars + r.cars,
        }),
        { total: 0, paid: 0, rest: 0, cars: 0 },
      ),
    [rows],
  );

  const visible = useMemo(() => {
    const q = norm(query);
    const raw = query.trim();
    return rows
      .filter((r) => (filter === 'all' ? true : r.money.status === filter))
      /* Typing a versement reference surfaces the container that holds it. */
      .map((r) => ({
        ...r,
        refMatch:
          (raw &&
            paymentsOfContainer(state, r.container.id).find((p) =>
              matchesRef(formatVersementRef(p.refNo), raw),
            )) ||
          null,
      }))
      .filter((r) => {
        if (!q) return true;
        return (
          !!r.refMatch ||
          norm(r.container.name).includes(q) ||
          norm(r.container.tcNumber).includes(q)
        );
      })
      .sort((a, b) => b.money.rest - a.money.rest || a.container.name.localeCompare(b.container.name));
  }, [rows, query, filter, state]);

  /* ---------- actions ---------- */
  const handleDeletePayment = async (p: Payment) => {
    const ok = await confirm({
      title: t('deletePayment'),
      message: (
        <>
          <p className="font-bold text-ink-900">{formatMoney(p.amount, lang, cur)}</p>
          <p className="mt-1">
            {formatDate(p.date, lang)} · {p.time}
          </p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deletePayment(p.id);
    toast.success(t('paymentDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<CreditCard size={24} />}
        title={t('paymentTracking')}
        subtitle={t('paymentTrackingSubtitle')}
        actions={
          <div className="hidden items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3.5 py-2 shadow-card sm:flex">
            <Boxes size={16} className="text-brand-600" />
            <span className="text-[13px] font-bold tabular-nums text-ink-700">
              {counts.all} {t('containers').toLowerCase()}
            </span>
          </div>
        }
      />

      {/* ---------- summary ---------- */}
      <StaggerList className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('totalAmount')}
            value={totals.total}
            format={fms}
            icon={<Wallet size={20} />}
            tone="brand"
            hint={`${totals.cars} ${t('totalCars').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalPaid')}
            value={totals.paid}
            format={fms}
            icon={<CreditCard size={20} />}
            tone="emerald"
            hint={`${state.payments.length} ${t('payments').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalRest')}
            value={totals.rest}
            format={fms}
            icon={<Wallet size={20} />}
            tone={totals.rest > 0 ? 'rose' : 'emerald'}
            hint={`${counts.unpaid + counts.partial} ${t('containers').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('paid')}
            value={counts.paid}
            icon={<Boxes size={20} />}
            tone="violet"
            hint={`${counts.all} ${t('containers').toLowerCase()}`}
          />
        </StaggerItem>
      </StaggerList>

      {/* ---------- toolbar ---------- */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchPaymentPlaceholder')}
            className="lg:max-w-sm lg:flex-1"
          />
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            className="lg:ms-auto"
            options={[
              { value: 'all', label: t('all'), count: counts.all },
              { value: 'unpaid', label: t('unpaid'), count: counts.unpaid, tone: 'rose' },
              { value: 'partial', label: t('partial'), count: counts.partial, tone: 'amber' },
              { value: 'paid', label: t('paid'), count: counts.paid, tone: 'emerald' },
            ]}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <ResultCount n={visible.length} />
          {(query || filter !== 'all') && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {/* ---------- cards ---------- */}
      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<Boxes size={28} />} title={t('noResults')} hint={t('noResultsHint')} />
        </Card>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((r) => (
              <motion.div
                key={r.container.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <ContainerCard
                  container={r.container}
                  money={r.money}
                  cars={r.cars}
                  principals={r.principals}
                  payments={r.payments}
                  refMatch={r.refMatch}
                  onPay={
                    can('paymentTracking', 'addPayment')
                      ? () => setPayTarget({ container: r.container, payment: null })
                      : undefined
                  }
                  onHistory={
                    can('paymentTracking', 'viewHistory')
                      ? () => setHistoryFor(r.container)
                      : undefined
                  }
                  onPrint={can('paymentTracking', 'print') ? () => setPrintFor(r.container) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ---------- dialogs ---------- */}
      <HistoryDialog
        container={historyFor}
        onClose={() => setHistoryFor(null)}
        onEdit={
          can('paymentTracking', 'editPayment')
            ? (p) => setPayTarget({ container: historyFor as Container, payment: p })
            : undefined
        }
        onDelete={can('paymentTracking', 'deletePayment') ? handleDeletePayment : undefined}
      />

      <PaymentDialog
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onSave={(data, editingId) => {
          if (editingId) {
            updatePayment(editingId, data);
            toast.success(t('paymentUpdated'));
          } else {
            const created = addPayment(data);
            toast.success(
              `${t('paymentAdded')} · ${t('versementRef')} ${formatVersementRef(created.refNo)}`,
            );
          }
          setPayTarget(null);
        }}
      />

      <PrintDialog container={printFor} onClose={() => setPrintFor(null)} />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function ContainerCard({
  container,
  money,
  cars,
  principals,
  payments,
  refMatch,
  onPay,
  onHistory,
  onPrint,
}: {
  container: Container;
  money: ReturnType<typeof containerMoney>;
  cars: number;
  principals: number;
  payments: number;
  /** The versement the current search matched, when the query was a reference. */
  refMatch?: Payment | null;
  onPay?: () => void;
  onHistory?: () => void;
  onPrint?: () => void;
}) {
  const { t, lang } = useI18n();

  return (
    <Card className="card-hover flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grad-ocean text-white shadow-float">
          <Boxes size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{container.name}</h3>
          <p className="mt-0.5 truncate font-mono text-xs font-semibold text-ink-500">
            {container.tcNumber}
          </p>
        </div>
        <PaymentBadge status={money.status} />
      </div>

      {/* body */}
      <div className="flex-1 p-4">
        {refMatch && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            {t('refFound', { ref: formatVersementRef(refMatch.refNo) })} ·{' '}
            <span className="tabular-nums">
              {formatDate(refMatch.date, lang)} · {formatMoney(refMatch.amount, lang, t('currency'))}
            </span>
          </p>
        )}

        <div className="mb-3 grid grid-cols-3 gap-2">
          <DataPoint
            label={t('totalCars')}
            value={`${cars}/${MAX_CARS_PER_CONTAINER}`}
            icon={<Car size={11} />}
          />
          <DataPoint label={t('principalClients')} value={principals} icon={<Users size={11} />} />
          <DataPoint label={t('payments')} value={payments} icon={<CreditCard size={11} />} />
        </div>

        <MoneySummary money={money} compact />

        <p className="mt-3 flex items-center gap-1.5 text-2xs font-semibold text-ink-400">
          <Calendar size={11} />
          {t('arrivalDate')}: {formatDate(container.arrivalDate, lang)}
        </p>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-50/60 p-3">
        {onPay && (
          <Button
            size="sm"
            variant="success"
            icon={<CreditCard size={15} />}
            onClick={onPay}
            className="flex-1"
          >
            {t('payment')}
          </Button>
        )}
        {onHistory && (
          <Button size="sm" variant="soft" icon={<History size={15} />} onClick={onHistory} className="flex-1">
            {t('history')}
          </Button>
        )}
        {onPrint && (
          <IconButton label={t('print')} variant="secondary" onClick={onPrint}>
            <Printer size={15} />
          </IconButton>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   Payment dialog — pick the principal client, then record
   ============================================================ */

function PaymentDialog({
  target,
  onClose,
  onSave,
}: {
  target: PayTarget | null;
  onClose: () => void;
  onSave: (
    data: {
      containerId: string;
      principalClientId: string;
      amount: number;
      date: string;
      time: string;
      description?: string;
    },
    editingId?: string,
  ) => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [principalId, setPrincipalId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const lines = useMemo(
    () => (target ? containerBreakdown(state, target.container.id) : []),
    [state, target],
  );

  const key = target ? `${target.container.id}:${target.payment?.id ?? 'new'}` : null;
  if (target && key !== seed) {
    setSeed(key);
    setErrors({});
    if (target.payment) {
      setPrincipalId(target.payment.principalClientId);
      setAmount(String(target.payment.amount));
      setDate(target.payment.date);
      setTime(target.payment.time);
      setDescription(target.payment.description ?? '');
    } else {
      setPrincipalId(lines.find((l) => l.money.rest > 0)?.client.id ?? lines[0]?.client.id ?? '');
      setAmount('');
      setDate(todayISO());
      setTime(nowTime());
      setDescription('');
    }
  }

  if (!target) return null;

  const multiple = lines.length > 1;
  const selected = lines.find((l) => l.client.id === principalId);
  const numeric = Number(amount.replace(/\s/g, ''));
  const editing = target.payment;
  /* When editing, the payment's own amount is already counted in `paid`. */
  const restRef = selected
    ? selected.money.rest + (editing && editing.principalClientId === selected.client.id ? editing.amount : 0)
    : 0;

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!principalId) errs.principal = t('selectPrincipalFirst');
    if (!amount.trim() || Number.isNaN(numeric) || numeric <= 0) errs.amount = t('invalidNumber');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(
      {
        containerId: target.container.id,
        principalClientId: principalId,
        amount: numeric,
        date,
        time,
        description: description.trim() || undefined,
      },
      editing?.id,
    );
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={editing ? t('editPayment') : t('newPayment')}
      subtitle={`${target.container.name} · ${target.container.tcNumber}`}
      icon={<CreditCard size={20} />}
      size="md"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="success" block onClick={submit} icon={<CreditCard size={16} />}>
            {editing ? t('saveChanges') : t('addPayment')}
          </Button>
        </div>
      }
    >
      {lines.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title={t('noResults')} hint={t('noCarsInContainer')} />
      ) : (
        <div className="space-y-4">
          {/* principal client picker */}
          {multiple && (
            <div>
              <label className="label">{t('selectPrincipalForPayment')}</label>
              <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                {t('multiplePrincipalsHint')}
              </p>
              <div className="space-y-2">
                {lines.map((l) => {
                  const on = l.client.id === principalId;
                  return (
                    <button
                      key={l.client.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPrincipalId(l.client.id)}
                      className={cx(
                        'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200',
                        on
                          ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                      )}
                    >
                      <Avatar
                        name={fullName(l.client)}
                        size="sm"
                        gradient="from-violet-500 to-fuchsia-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-extrabold text-ink-900">
                          {fullName(l.client)}
                        </span>
                        <span className="block truncate text-2xs font-semibold text-ink-500">
                          {l.cars.length} {t('carsCount')} · {t('totalAmount')} {fm(l.money.total)} ·{' '}
                          {t('totalPaid')} {fm(l.money.paid)}
                        </span>
                      </span>
                      <span className="shrink-0 text-end">
                        <span className="block text-2xs font-bold uppercase text-ink-400">
                          {t('rest')}
                        </span>
                        <span
                          className={cx(
                            'block text-[13px] font-extrabold tabular-nums',
                            l.money.rest > 0 ? 'text-rose-600' : 'text-emerald-600',
                          )}
                        >
                          {fm(l.money.rest)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.principal && (
                <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.principal}</p>
              )}
            </div>
          )}

          {selected && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
              <DataPoint label={t('principalClient')} value={fullName(selected.client)} />
              <DataPoint label={t('totalAmount')} value={fm(selected.money.total)} />
              <DataPoint label={t('rest')} value={fm(selected.money.rest)} />
            </div>
          )}

          <Input
            label={t('amountPaid')}
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            suffix={cur}
            required
          />
          {selected && numeric > restRef && restRef >= 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              {t('overpaidWarning')} {t('amountExceedsRest', { rest: fm(restRef) })}
            </p>
          )}

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
      )}
    </Modal>
  );
}

/* ============================================================
   History dialog
   ============================================================ */

function HistoryDialog({
  container,
  onClose,
  onEdit,
  onDelete,
}: {
  container: Container | null;
  onClose: () => void;
  onEdit?: (p: Payment) => void;
  onDelete?: (p: Payment) => void;
}) {
  const { t, lang } = useI18n();
  const { state, can } = useStore();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  /* Printing is scoped to this dialog: one receipt, or the whole ledger. */
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [printAll, setPrintAll] = useState(false);
  const canPrint = can('paymentTracking', 'print');

  const data = useMemo(() => {
    if (!container) return null;
    return {
      payments: paymentsOfContainer(state, container.id),
      money: containerMoney(state, container.id),
    };
  }, [state, container]);

  const scope = useMemo<PaymentsPrintScope | null>(() => {
    if (!container || !data) return null;
    return {
      reference: `${container.name} · ${container.tcNumber}`,
      counterparty: 'client',
      facts: [
        { label: t('containerName'), value: container.name },
        { label: t('tcNumber'), value: container.tcNumber, mono: true },
        { label: t('arrivalDate'), value: formatDate(container.arrivalDate, lang) },
        { label: t('payments'), value: String(data.payments.length) },
      ],
      payments: data.payments,
      money: { total: data.money.total, paid: data.money.paid, rest: data.money.rest },
    };
  }, [container, data, t, lang]);

  if (!container || !data) return null;

  return (
    <Modal
      open={!!container}
      onClose={onClose}
      size="xl"
      icon={<History size={20} />}
      title={t('paymentHistory')}
      subtitle={`${container.name} · ${container.tcNumber}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('totalPaid')}:{' '}
            <span className="font-extrabold tabular-nums text-emerald-700">{fm(data.money.paid)}</span>
          </span>
          <div className="flex gap-2">
            {canPrint && data.payments.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer size={15} />}
                onClick={() => setPrintAll(true)}
              >
                {t('printHistory')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      }
    >
      <PaymentReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
      <PaymentsPrintDialog open={printAll} onClose={() => setPrintAll(false)} scope={scope} />

      <MoneySummary money={data.money} className="mb-4" />

      {data.payments.length === 0 ? (
        <EmptyState icon={<CreditCard size={26} />} title={t('noContainerPayments')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200/80">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5 text-start font-bold">{t('versementRefShort')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('date')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('principalClient')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('description')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('by')}</th>
                <th className="px-4 py-2.5 text-end font-bold">{t('amount')}</th>
                {(onEdit || onDelete || canPrint) && (
                  <th className="px-4 py-2.5 text-end font-bold">{t('actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              <AnimatePresence mode="popLayout">
                {data.payments.map((p) => {
                  const pc = state.principalClients.find((c) => c.id === p.principalClientId);
                  return (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="transition-colors hover:bg-ink-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-extrabold tabular-nums text-brand-700">
                        {formatVersementRef(p.refNo)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                        {formatDate(p.date, lang)} · {p.time}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-bold text-ink-900">
                        {pc ? fullName(pc) : '—'}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-2.5 text-xs text-ink-500">
                        {p.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-500">{p.createdBy}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-emerald-600">
                        +{fm(p.amount)}
                      </td>
                      {(onEdit || onDelete || canPrint) && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {canPrint && (
                              <IconButton
                                label={t('printReceipt')}
                                variant="secondary"
                                onClick={() => setReceipt(p)}
                              >
                                <Printer size={14} />
                              </IconButton>
                            )}
                            {onEdit && (
                              <IconButton
                                label={t('editPayment')}
                                variant="secondary"
                                onClick={() => onEdit(p)}
                              >
                                <Pencil size={14} />
                              </IconButton>
                            )}
                            {onDelete && (
                              <IconButton
                                label={t('deletePayment')}
                                variant="secondary"
                                onClick={() => onDelete(p)}
                                className="!text-rose-600 hover:!border-rose-300 hover:!bg-rose-50"
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            )}
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
                <td colSpan={5} className="px-4 py-2.5 text-[13px] font-bold text-ink-700">
                  {t('totalPaid')}
                </td>
                <td className="px-4 py-2.5 text-end text-sm font-extrabold tabular-nums text-emerald-700">
                  {fm(data.money.paid)}
                </td>
                {(onEdit || onDelete || canPrint) && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Print dialog — container payment follow-up
   ============================================================ */

function PrintDialog({ container, onClose }: { container: Container | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const data = useMemo(() => {
    if (!container) return null;
    return {
      cars: carsOfContainer(state, container.id),
      money: containerMoney(state, container.id),
      lines: containerBreakdown(state, container.id),
      payments: paymentsOfContainer(state, container.id),
    };
  }, [state, container]);

  if (!container || !data) return null;

  return (
    <PrintPreview
      open={!!container}
      onClose={onClose}
      heading={t('printTemplate')}
      subheading={`${container.name} · ${container.tcNumber}`}
    >
      <PrintDocument
        title={t('paymentReceipt')}
        reference={`${container.name} · ${container.tcNumber}`}
        meta={[
          { label: t('container'), value: container.name, strong: true },
          { label: t('tcNumber'), value: container.tcNumber, mono: true },
          {
            label: t('totalCars'),
            value: `${formatNumber(data.cars.length, lang)} / ${MAX_CARS_PER_CONTAINER}`,
          },
        ]}
      >
        {/* container identity */}
        <PrintSection>
          <div className="tp-box grid grid-cols-2 gap-x-4 gap-y-2.5 rounded p-3 sm:grid-cols-4">
            <InfoCell label={t('containerName')} value={container.name} />
            <InfoCell label={t('tcNumber')} value={container.tcNumber} mono />
            <InfoCell label={t('arrivalDate')} value={formatDate(container.arrivalDate, lang)} />
            <InfoCell
              label={t('totalCars')}
              value={`${formatNumber(data.cars.length, lang)} / ${MAX_CARS_PER_CONTAINER}`}
            />
          </div>
        </PrintSection>

        {/* headline figures, right under the identity strip */}
        <PrintSection>
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

        {/* content */}
        <PrintSection title={t('containerContent')}>
          <table>
            <thead>
              <tr>
                <th className="text-start" style={{ width: '8%' }}>
                  {t('declarationNo')}
                </th>
                <th className="text-start">{t('secondaryClient')}</th>
                <th className="text-start">{t('car')}</th>
                <th className="text-start">{t('chassisNumber')}</th>
                <th className="text-start">{t('principalClient')}</th>
                <th className="text-end">{t('price')}</th>
              </tr>
            </thead>
            <tbody>
              {data.cars.map((c) => {
                const pc = state.principalClients.find((p) => p.id === c.principalClientId);
                return (
                  <tr key={c.id}>
                    <td className="text-start font-mono tabular-nums">
                      {formatDeclarationNo(c.declarationNo)}
                    </td>
                    <td className="text-start font-bold">{fullName(c)}</td>
                    <td className="text-start">
                      {c.car.brand} {c.car.name}
                    </td>
                    <td className="text-start font-mono">{c.car.chassisNumber}</td>
                    <td className="text-start">{pc ? fullName(pc) : '—'}</td>
                    <td className="text-end font-bold tabular-nums">{fm(c.price)}</td>
                  </tr>
                );
              })}
              {data.cars.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    {t('noCarsInContainer')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="text-start">
                  {t('totalAmount')}
                </td>
                <td className="text-end tabular-nums">{fm(data.money.total)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        {/* per principal client */}
        <PrintSection title={t('restPerClient')}>
          <table>
            <thead>
              <tr>
                <th className="text-start">{t('principalClient')}</th>
                <th className="text-end">{t('totalCars')}</th>
                <th className="text-end">{t('totalAmount')}</th>
                <th className="text-end">{t('totalPaid')}</th>
                <th className="text-end">{t('totalRest')}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.client.id}>
                  <td className="text-start font-bold">{fullName(l.client)}</td>
                  <td className="text-end tabular-nums">{l.cars.length}</td>
                  <td className="text-end tabular-nums">{fm(l.money.total)}</td>
                  <td className="text-end tabular-nums">{fm(l.money.paid)}</td>
                  <td className="text-end font-bold tabular-nums">{fm(l.money.rest)}</td>
                </tr>
              ))}
              {data.lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="text-start">{t('total')}</td>
                <td className="text-end tabular-nums">{data.cars.length}</td>
                <td className="text-end tabular-nums">{fm(data.money.total)}</td>
                <td className="text-end tabular-nums">{fm(data.money.paid)}</td>
                <td className="text-end tabular-nums">{fm(data.money.rest)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        {/* payments ledger */}
        <PrintSection title={t('paymentHistory')}>
          <table>
            <thead>
              <tr>
                <th className="text-start" style={{ width: '8%' }}>
                  {t('versementRefShort')}
                </th>
                <th className="text-start">{t('date')}</th>
                <th className="text-start">{t('principalClient')}</th>
                <th className="text-start">{t('description')}</th>
                <th className="text-start">{t('by')}</th>
                <th className="text-end">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => {
                const pc = state.principalClients.find((c) => c.id === p.principalClientId);
                return (
                  <tr key={p.id}>
                    <td className="text-start font-mono tabular-nums">
                      {formatVersementRef(p.refNo)}
                    </td>
                    <td className="text-start tabular-nums">
                      {formatDate(p.date, lang)} · {p.time}
                    </td>
                    <td className="text-start font-bold">{pc ? fullName(pc) : '—'}</td>
                    <td className="text-start">{p.description || '—'}</td>
                    <td className="text-start">{p.createdBy}</td>
                    <td className="text-end font-bold tabular-nums">{fm(p.amount)}</td>
                  </tr>
                );
              })}
              {data.payments.length === 0 && (
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
                <td className="text-end tabular-nums">{fm(data.money.paid)}</td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>

        <PrintSignatures />
      </PrintDocument>
    </PrintPreview>
  );
}
