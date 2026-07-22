/* ============================================================
   Facturation — one invoice per secondary client file.

   Creation is a 3-step wizard: find the client (by name or by numéro de
   déclaration), pick the services, review. The invoice snapshots the car
   price and every service line, so a reprint always shows what was billed.
   ============================================================ */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Calendar,
  Car as CarIcon,
  Check,
  Eye,
  Hash,
  Minus,
  Percent,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { fullName, invoiceTotals, nextInvoiceNo } from '../lib/selectors';
import {
  formatDate,
  formatDeclarationNo,
  formatInvoiceNo,
  formatMoney,
  formatMoneyShort,
  formatPercent,
  matchesRef,
  norm,
  todayISO,
} from '../lib/format';
import type { Invoice, InvoiceLine, SecondaryClient } from '../lib/types';
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
import { InvoicePrintDialog } from '../components/print/InvoicePrint';
import { DataPoint, PageHeader, ResultCount, StatCard } from '../components/shared';

/* ============================================================
   Page
   ============================================================ */

export function Invoices() {
  const { t, lang } = useI18n();
  const { state, can, deleteInvoice } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);

  const rows = useMemo(
    () =>
      state.invoices.map((inv) => ({
        invoice: inv,
        client: state.secondaryClients.find((c) => c.id === inv.secondaryClientId),
        totals: invoiceTotals(inv.carPrice, inv.lines),
      })),
    [state],
  );

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => {
        if (!q) return true;
        return (
          matchesRef(formatInvoiceNo(r.invoice.invoiceNo), query) ||
          (r.client
            ? matchesRef(formatDeclarationNo(r.client.declarationNo), query) ||
              norm(fullName(r.client)).includes(q) ||
              norm(r.client.car.chassisNumber).includes(q)
            : false)
        );
      })
      .sort((a, b) => b.invoice.invoiceNo - a.invoice.invoiceNo);
  }, [rows, query]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          count: acc.count + 1,
          grand: acc.grand + r.totals.grandTotal,
          tva: acc.tva + r.totals.tva,
        }),
        { count: 0, grand: 0, tva: 0 },
      ),
    [rows],
  );

  const handleDelete = async (inv: Invoice, clientName: string) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">
            {t('invoice')} {formatInvoiceNo(inv.invoiceNo)} · {clientName}
          </p>
          <p className="mt-1">{t('deleteInvoiceWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteInvoice(inv.id);
    setDetail(null);
    toast.success(t('invoiceDeleted'));
  };

  /* Creation ends with the one question that always follows an invoice. */
  const afterCreate = async (created: Invoice) => {
    setFormOpen(false);
    toast.success(t('invoiceCreated', { no: formatInvoiceNo(created.invoiceNo) }));
    if (!can('invoices', 'print')) return;
    const yes = await confirm({
      title: t('printInvoiceQuestion'),
      message: t('printInvoiceHint', { no: formatInvoiceNo(created.invoiceNo) }),
      confirmLabel: t('printNow'),
      cancelLabel: t('later'),
      tone: 'brand',
      icon: <Printer size={26} />,
    });
    if (yes) setPrinting(created);
  };

  return (
    <div>
      <PageHeader
        icon={<ReceiptText size={24} />}
        title={t('invoices')}
        subtitle={t('invoicesSubtitle')}
        actions={
          can('invoices', 'create') && (
            <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
              {t('newInvoice')}
            </Button>
          )
        }
      />

      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label={t('invoicesCount')}
            value={totals.count}
            icon={<ReceiptText size={20} />}
            tone="ocean"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalInvoiced')}
            value={totals.grand}
            format={fms}
            icon={<Wallet size={20} />}
            tone="brand"
          />
        </StaggerItem>
        <StaggerItem className="col-span-2 lg:col-span-1">
          <StatCard
            label={t('totalTva')}
            value={totals.tva}
            format={fms}
            icon={<Percent size={20} />}
            tone="violet"
          />
        </StaggerItem>
      </StaggerList>

      <Card className="mb-4 p-3.5">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('searchInvoicePlaceholder')}
          className="lg:max-w-md"
        />
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
          <ResultCount n={visible.length} />
          {query && (
            <Button size="xs" variant="ghost" onClick={() => setQuery('')}>
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptText size={28} />}
            title={query ? t('noResults') : t('noInvoices')}
            hint={query ? t('noResultsHint') : t('noInvoicesHint')}
            action={
              can('invoices', 'create') && (
                <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
                  {t('newInvoice')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((r) => (
              <motion.div
                key={r.invoice.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <InvoiceCard
                  invoice={r.invoice}
                  client={r.client}
                  totals={r.totals}
                  onView={can('invoices', 'view') ? () => setDetail(r.invoice) : undefined}
                  onPrint={can('invoices', 'print') ? () => setPrinting(r.invoice) : undefined}
                  onDelete={
                    can('invoices', 'delete')
                      ? () => handleDelete(r.invoice, r.client ? fullName(r.client) : '—')
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <InvoiceWizard open={formOpen} onClose={() => setFormOpen(false)} onCreated={afterCreate} />

      <InvoiceDetail
        invoice={detail}
        onClose={() => setDetail(null)}
        onPrint={
          can('invoices', 'print')
            ? (inv) => {
                setDetail(null);
                setPrinting(inv);
              }
            : undefined
        }
      />

      <InvoicePrintDialog invoice={printing} onClose={() => setPrinting(null)} />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function InvoiceCard({
  invoice,
  client,
  totals,
  onView,
  onPrint,
  onDelete,
}: {
  invoice: Invoice;
  client?: SecondaryClient;
  totals: ReturnType<typeof invoiceTotals>;
  onView?: () => void;
  onPrint?: () => void;
  onDelete?: () => void;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <Avatar name={client ? fullName(client) : '—'} gradient="from-brand-800 to-ocean-400" />
        <div className="min-w-0 flex-1">
          <p
            className="flex items-center gap-1 font-mono text-2xs font-extrabold tracking-wide text-brand-600"
            title={t('invoiceNo')}
          >
            <ReceiptText size={10} className="shrink-0" />
            {formatInvoiceNo(invoice.invoiceNo)}
          </p>
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">
            {client ? fullName(client) : '—'}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            <Calendar size={12} className="shrink-0" />
            {formatDate(invoice.date, lang)}
          </p>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-3 rounded-xl bg-ink-50/80 p-3 ring-1 ring-ink-200/60">
          <p className="flex items-center gap-2 text-[13px] font-extrabold text-ink-900">
            <CarIcon size={14} className="shrink-0 text-ocean-600" />
            <span className="truncate">
              {client ? `${client.car.brand} ${client.car.name}` : '—'}
            </span>
          </p>
          <p className="mt-1 truncate font-mono text-2xs tracking-tight text-ink-500">
            {client?.car.chassisNumber ?? '—'}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint
            label={t('declarationNo')}
            value={client ? formatDeclarationNo(client.declarationNo) : '—'}
            icon={<Hash size={11} />}
            mono
          />
          <DataPoint
            label={t('services')}
            value={invoice.lines.length}
            icon={<Wrench size={11} />}
          />
          <DataPoint label={t('carAmount')} value={fm(totals.carPrice)} icon={<CarIcon size={11} />} />
          <DataPoint label={t('totalTva')} value={fm(totals.tva)} icon={<Percent size={11} />} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-grad-brand-soft px-3.5 py-3 ring-1 ring-brand-100">
          <span className="text-2xs font-bold uppercase tracking-wide text-brand-700">
            {t('grandTotal')}
          </span>
          <span className="text-[15px] font-extrabold tabular-nums text-brand-800">
            {fm(totals.grandTotal)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-100 bg-ink-50/60 p-3">
        {onView && (
          <Button size="sm" variant="soft" icon={<Eye size={15} />} onClick={onView} className="flex-1">
            {t('viewDetails')}
          </Button>
        )}
        {!onView && <span className="flex-1" />}
        {onPrint && (
          <IconButton label={t('print')} variant="secondary" onClick={onPrint}>
            <Printer size={15} />
          </IconButton>
        )}
        {onDelete && (
          <IconButton
            label={t('delete')}
            variant="secondary"
            onClick={onDelete}
            className="!text-rose-600 hover:!bg-rose-50 hover:!border-rose-300"
          >
            <Trash2 size={15} />
          </IconButton>
        )}
      </div>
    </Card>
  );
}

/* ============================================================
   Totals block — shared by the wizard, the detail dialog and nothing else
   ============================================================ */

function TotalsPanel({ totals }: { totals: ReturnType<typeof invoiceTotals> }) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  const row = (label: string, value: string, strong?: boolean) => (
    <div className="flex items-center justify-between gap-4 border-b border-ink-100 py-2 last:border-0">
      <span className={cx('text-[13px]', strong ? 'font-bold text-ink-800' : 'text-ink-500')}>
        {label}
      </span>
      <span
        className={cx(
          'tabular-nums',
          strong ? 'text-[14px] font-extrabold text-ink-900' : 'text-[13px] font-semibold text-ink-800',
        )}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div>
      <div className="rounded-2xl border border-ink-200/80 bg-white px-3.5 py-1">
        {row(t('carAmount'), fm(totals.carPrice))}
        {row(t('totalServicesHt'), fm(totals.servicesHt))}
        {row(t('totalTva'), fm(totals.tva))}
        {row(t('totalServicesTtc'), fm(totals.servicesTtc), true)}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-4 rounded-2xl bg-grad-brand px-4 py-3.5 text-white shadow-float">
        <span className="text-2xs font-extrabold uppercase tracking-[0.14em]">
          {t('grandTotal')}
        </span>
        <span className="text-lg font-extrabold tabular-nums">{fm(totals.grandTotal)}</span>
      </div>
    </div>
  );
}

/* ============================================================
   Create wizard
   ============================================================ */

const STEPS = ['stepClient', 'stepServices', 'stepReview'] as const;

function InvoiceWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: Invoice) => void;
}) {
  const { t, lang, isRtl } = useI18n();
  const { state, addInvoice } = useStore();
  const reduce = useReducedMotion();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [seed, setSeed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [clientId, setClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  /** serviceId → quantity, in insertion order. */
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  if (open !== seed) {
    setSeed(open);
    if (open) {
      setStep(0);
      setDir(1);
      setErrors({});
      setClientId('');
      setClientQuery('');
      setServiceQuery('');
      setPicked({});
      setDate(todayISO());
      setNotes('');
    }
  }

  /* The search box answers to the declaration number first — that is the
     reference the client walks in with. */
  const clientResults = useMemo(() => {
    const q = norm(clientQuery);
    return state.secondaryClients
      .filter((c) => {
        if (!q) return true;
        return (
          matchesRef(formatDeclarationNo(c.declarationNo), clientQuery) ||
          norm(fullName(c)).includes(q) ||
          norm(c.car.chassisNumber).includes(q)
        );
      })
      .sort((a, b) => b.declarationNo - a.declarationNo)
      .slice(0, 40);
  }, [state.secondaryClients, clientQuery]);

  const serviceResults = useMemo(() => {
    const q = norm(serviceQuery);
    return state.services
      .filter((s) => !q || norm(s.name).includes(q) || norm(s.description).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.services, serviceQuery]);

  const client = state.secondaryClients.find((c) => c.id === clientId);
  const container = client ? state.containers.find((c) => c.id === client.containerId) : undefined;
  const warehouse = client ? state.warehouses.find((w) => w.id === client.warehouseId) : undefined;
  const principal = client
    ? state.principalClients.find((p) => p.id === client.principalClientId)
    : undefined;

  const lines = useMemo<InvoiceLine[]>(
    () =>
      Object.entries(picked).flatMap(([id, quantity]) => {
        const s = state.services.find((x) => x.id === id);
        if (!s) return [];
        return [{ serviceId: s.id, name: s.name, amount: s.amount, tva: s.tva, quantity }];
      }),
    [picked, state.services],
  );

  const totals = invoiceTotals(client?.price ?? 0, lines);

  const validate = (which: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (which === 0 && !clientId) e.clientId = t('selectClientFirst');
    if (which === 1 && lines.length === 0) e.services = t('selectServicesFirst');
    return e;
  };

  const goNext = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setDir(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setErrors({});
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = () => {
    const e = { ...validate(0), ...validate(1) };
    setErrors(e);
    if (Object.keys(e).length || !client) return;
    const created = addInvoice({
      secondaryClientId: client.id,
      date,
      carPrice: client.price,
      lines,
      notes: notes.trim() || undefined,
    });
    onCreated(created);
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });

  const setQty = (id: string, q: number) =>
    setPicked((p) => ({ ...p, [id]: Math.max(1, Math.min(999, q)) }));

  /* ---------- step 1: the client ---------- */
  const clientStep = (
    <div className="space-y-3">
      <SearchBar
        value={clientQuery}
        onChange={setClientQuery}
        placeholder={t('searchSecondaryForInvoice')}
        autoFocus
      />
      <div className="max-h-[22rem] space-y-2 overflow-y-auto pe-1">
        {clientResults.length === 0 ? (
          <EmptyState icon={<Users size={24} />} title={t('noResults')} hint={t('noResultsHint')} />
        ) : (
          clientResults.map((c) => {
            const on = c.id === clientId;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={fullName(c)}
                aria-pressed={on}
                onClick={() => {
                  setClientId(c.id);
                  setErrors({});
                }}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200',
                  on
                    ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                    : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <Avatar name={fullName(c)} size="sm" gradient="from-brand-800 to-ocean-400" />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-2xs font-extrabold text-brand-600">
                    {formatDeclarationNo(c.declarationNo)}
                  </span>
                  <span className="block truncate text-[13px] font-extrabold text-ink-900">
                    {fullName(c)}
                  </span>
                  <span className="block truncate text-2xs text-ink-500">
                    {c.car.brand} {c.car.name} · {c.car.chassisNumber}
                  </span>
                </span>
                <span className="shrink-0 text-end text-[13px] font-extrabold tabular-nums text-ink-800">
                  {fm(c.price)}
                </span>
              </button>
            );
          })
        )}
      </div>
      {errors.clientId && <p className="text-xs font-medium text-rose-600">{errors.clientId}</p>}
    </div>
  );

  /* ---------- step 2: the services ---------- */
  const servicesStep = (
    <div className="space-y-3">
      <SearchBar
        value={serviceQuery}
        onChange={setServiceQuery}
        placeholder={t('searchServicePlaceholder')}
      />
      <p className="text-xs text-ink-500">{t('availableServices')}</p>

      <div className="max-h-[20rem] space-y-2 overflow-y-auto pe-1">
        {serviceResults.length === 0 ? (
          <EmptyState
            icon={<Wrench size={24} />}
            title={state.services.length ? t('noResults') : t('noServices')}
            hint={state.services.length ? t('noResultsHint') : t('noServicesHint')}
          />
        ) : (
          serviceResults.map((s) => {
            const on = picked[s.id] !== undefined;
            return (
              <div
                key={s.id}
                className={cx(
                  'rounded-xl border p-3 transition-all duration-200',
                  on
                    ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                    : 'border-ink-200 bg-white hover:border-ink-300',
                )}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={s.name}
                  onClick={() => {
                    toggle(s.id);
                    setErrors({});
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 text-start"
                >
                  <span
                    className={cx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      on ? 'bg-grad-brand text-white' : 'bg-ink-100 text-ink-500',
                    )}
                  >
                    {on ? <Check size={17} strokeWidth={3} /> : <Wrench size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold text-ink-900">
                      {s.name}
                    </span>
                    <span className="block truncate text-2xs text-ink-500">
                      {fm(s.amount)} · {t('tva')} {formatPercent(s.tva, lang)}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-[13px] font-extrabold tabular-nums text-ink-800">
                    {fm(s.amount * (1 + s.tva / 100))}
                  </span>
                </button>

                {/* quantity only appears once the line is on the invoice */}
                {on && (
                  <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-brand-200/70 pt-2.5">
                    <span className="text-2xs font-bold uppercase tracking-wide text-ink-500">
                      {t('quantity')}
                    </span>
                    <div className="flex items-center gap-2">
                      <IconButton
                        label="-"
                        variant="secondary"
                        className="!h-8 !w-8"
                        onClick={() => setQty(s.id, (picked[s.id] ?? 1) - 1)}
                      >
                        <Minus size={14} />
                      </IconButton>
                      <span className="w-9 text-center text-[13px] font-extrabold tabular-nums text-ink-900">
                        {picked[s.id]}
                      </span>
                      <IconButton
                        label="+"
                        variant="secondary"
                        className="!h-8 !w-8"
                        onClick={() => setQty(s.id, (picked[s.id] ?? 1) + 1)}
                      >
                        <Plus size={14} />
                      </IconButton>
                      <span className="ms-2 w-24 text-end text-[13px] font-extrabold tabular-nums text-brand-700">
                        {fm(s.amount * (picked[s.id] ?? 1) * (1 + s.tva / 100))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {errors.services && <p className="text-xs font-medium text-rose-600">{errors.services}</p>}

      {lines.length > 0 && (
        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
            {t('summary')}
          </p>
          <TotalsPanel totals={totals} />
        </div>
      )}
    </div>
  );

  /* ---------- step 3: review ---------- */
  const reviewStep = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('invoiceDate')}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label={t('invoiceNo')}
          value={formatInvoiceNo(nextInvoiceNo(state))}
          readOnly
          disabled
          icon={<ReceiptText size={16} />}
          className="font-mono"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <DataPoint
          label={t('declarationNo')}
          value={client ? formatDeclarationNo(client.declarationNo) : '—'}
          icon={<Hash size={11} />}
          mono
        />
        <DataPoint
          label={t('secondaryClient')}
          value={client ? fullName(client) : '—'}
          icon={<UserRound size={11} />}
        />
        <DataPoint
          label={t('car')}
          value={client ? `${client.car.brand} ${client.car.name}` : '—'}
          icon={<CarIcon size={11} />}
        />
        <DataPoint label={t('chassisNumber')} value={client?.car.chassisNumber ?? '—'} mono />
        <DataPoint
          label={t('container')}
          value={container?.name ?? '—'}
          icon={<Boxes size={11} />}
        />
        <DataPoint label={t('warehouse')} value={warehouse?.name ?? '—'} />
        <DataPoint
          label={t('principalClient')}
          value={principal ? fullName(principal) : '—'}
          icon={<Users size={11} />}
          className="sm:col-span-2"
        />
      </div>

      <div>
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
          {t('selectedServices')}
        </p>
        <div className="overflow-hidden rounded-2xl border border-ink-200/80">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50">
              <tr className="text-2xs uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 text-start font-bold">{t('designation')}</th>
                <th className="px-2 py-2 text-center font-bold">{t('qtyShort')}</th>
                <th className="px-2 py-2 text-center font-bold">{t('tva')}</th>
                <th className="px-3 py-2 text-end font-bold">{t('amountTtc')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.serviceId} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-bold text-ink-900">{l.name}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-ink-700">{l.quantity}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-ink-700">
                    {formatPercent(l.tva, lang)}
                  </td>
                  <td className="px-3 py-2 text-end font-extrabold tabular-nums text-ink-900">
                    {fm(l.amount * l.quantity * (1 + l.tva / 100))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TotalsPanel totals={totals} />

      <Textarea
        label={`${t('invoiceNotes')} (${t('optional')})`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
    </div>
  );

  const slide = reduce ? 0 : 28;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<ReceiptText size={20} />}
      title={t('newInvoice')}
      subtitle={t('stepOf', { current: step + 1, total: STEPS.length })}
      footer={
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={step === 0 ? onClose : goBack}
            icon={step === 0 ? undefined : <ArrowLeft size={16} className="rtl:rotate-180" />}
            className="flex-1"
          >
            {step === 0 ? t('cancel') : t('previous')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={goNext}
              iconRight={<ArrowRight size={16} className="rtl:rotate-180" />}
              className="flex-1"
            >
              {t('next')}
            </Button>
          ) : (
            <Button onClick={submit} icon={<Plus size={16} />} className="flex-1">
              {t('create')}
            </Button>
          )}
        </div>
      }
    >
      <div>
        {/* compact step rail */}
        <div className="mb-5 flex items-center gap-1">
          {STEPS.map((key, i) => {
            const done = i < step;
            const on = i === step;
            return (
              <div key={key} className="flex min-w-0 flex-1 items-center gap-1.5 last:flex-none">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tabular-nums transition-colors duration-300',
                      done
                        ? 'bg-grad-emerald text-white'
                        : on
                          ? 'bg-grad-brand text-white shadow-float'
                          : 'bg-ink-100 text-ink-400',
                    )}
                    aria-current={on ? 'step' : undefined}
                  >
                    {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cx(
                      'hidden truncate text-2xs font-bold uppercase tracking-wide sm:block',
                      on ? 'text-brand-700' : done ? 'text-emerald-600' : 'text-ink-400',
                    )}
                  >
                    {t(key)}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={cx(
                      'h-1 min-w-[10px] flex-1 rounded-full transition-colors duration-300',
                      done ? 'bg-emerald-400' : 'bg-ink-200',
                    )}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: dir * slide * (isRtl ? -1 : 1) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * slide * (isRtl ? -1 : 1) }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && clientStep}
            {step === 1 && servicesStep}
            {step === 2 && reviewStep}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}

/* ============================================================
   Detail dialog
   ============================================================ */

function InvoiceDetail({
  invoice,
  onClose,
  onPrint,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onPrint?: (inv: Invoice) => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  const data = useMemo(() => {
    if (!invoice) return null;
    const client = state.secondaryClients.find((c) => c.id === invoice.secondaryClientId);
    return {
      client,
      container: client ? state.containers.find((c) => c.id === client.containerId) : undefined,
      warehouse: client ? state.warehouses.find((w) => w.id === client.warehouseId) : undefined,
      principal: client
        ? state.principalClients.find((p) => p.id === client.principalClientId)
        : undefined,
      totals: invoiceTotals(invoice.carPrice, invoice.lines),
    };
  }, [state, invoice]);

  if (!invoice || !data) return null;
  const { client, container, warehouse, principal, totals } = data;

  return (
    <Modal
      open={!!invoice}
      onClose={onClose}
      size="lg"
      icon={<ReceiptText size={20} />}
      title={`${t('invoice')} ${formatInvoiceNo(invoice.invoiceNo)}`}
      subtitle={`${client ? fullName(client) : '—'} · ${formatDate(invoice.date, lang)}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('by')} {invoice.createdBy || '—'}
          </span>
          <div className="flex gap-2">
            {onPrint && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Printer size={15} />}
                onClick={() => onPrint(invoice)}
              >
                {t('printInvoice')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <DataPoint
            label={t('invoiceNo')}
            value={formatInvoiceNo(invoice.invoiceNo)}
            icon={<ReceiptText size={11} />}
            mono
          />
          <DataPoint
            label={t('declarationNo')}
            value={client ? formatDeclarationNo(client.declarationNo) : '—'}
            icon={<Hash size={11} />}
            mono
          />
          <DataPoint
            label={t('secondaryClient')}
            value={client ? fullName(client) : '—'}
            icon={<UserRound size={11} />}
          />
          <DataPoint
            label={t('principalClient')}
            value={principal ? fullName(principal) : '—'}
            icon={<Users size={11} />}
          />
          <DataPoint
            label={t('car')}
            value={client ? `${client.car.brand} ${client.car.name}` : '—'}
            icon={<CarIcon size={11} />}
          />
          <DataPoint label={t('chassisNumber')} value={client?.car.chassisNumber ?? '—'} mono />
          <DataPoint
            label={t('container')}
            value={container?.name ?? '—'}
            icon={<Boxes size={11} />}
          />
          <DataPoint label={t('warehouse')} value={warehouse?.name ?? '—'} />
        </div>

        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
            {t('invoiceLines')}
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink-200/80">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50">
                <tr className="text-2xs uppercase tracking-wide text-ink-500">
                  <th className="px-3 py-2 text-start font-bold">{t('designation')}</th>
                  <th className="px-2 py-2 text-center font-bold">{t('qtyShort')}</th>
                  <th className="px-2 py-2 text-end font-bold">{t('unitPrice')}</th>
                  <th className="px-2 py-2 text-center font-bold">{t('tva')}</th>
                  <th className="px-3 py-2 text-end font-bold">{t('amountTtc')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-ink-100 bg-ocean-50/40">
                  <td className="px-3 py-2 font-bold text-ink-900">{t('carAmount')}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-ink-700">1</td>
                  <td className="px-2 py-2 text-end tabular-nums text-ink-700">
                    {fm(invoice.carPrice)}
                  </td>
                  <td className="px-2 py-2 text-center text-ink-400">—</td>
                  <td className="px-3 py-2 text-end font-extrabold tabular-nums text-ink-900">
                    {fm(invoice.carPrice)}
                  </td>
                </tr>
                {invoice.lines.map((l, i) => (
                  <tr key={`${l.serviceId}-${i}`} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-bold text-ink-900">{l.name}</td>
                    <td className="px-2 py-2 text-center tabular-nums text-ink-700">{l.quantity}</td>
                    <td className="px-2 py-2 text-end tabular-nums text-ink-700">{fm(l.amount)}</td>
                    <td className="px-2 py-2 text-center tabular-nums text-ink-700">
                      {formatPercent(l.tva, lang)}
                    </td>
                    <td className="px-3 py-2 text-end font-extrabold tabular-nums text-ink-900">
                      {fm(l.amount * l.quantity * (1 + l.tva / 100))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <TotalsPanel totals={totals} />

        {invoice.notes && (
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('invoiceNotes')}
            </p>
            <p className="rounded-2xl bg-ink-50/80 p-3 text-[13px] text-ink-700 ring-1 ring-ink-200/60">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
