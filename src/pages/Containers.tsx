/* ============================================================
   Containers — max 5 cars each. Money is always read from the
   selectors so container totals can never drift.
   ============================================================ */

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import {
  Boxes,
  Calendar,
  Car as CarIcon,
  CreditCard,
  Eye,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  Tag,
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
  principalName,
} from '../lib/selectors';
import {
  formatDate,
  formatDeclarationNo,
  formatMoney,
  formatMoneyShort,
  formatVersementRef,
  norm,
} from '../lib/format';
import { MAX_CARS_PER_CONTAINER } from '../lib/types';
import type { Container, Payment } from '../lib/types';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  SearchBar,
  StaggerItem,
  StaggerList,
  Textarea,
  cx,
} from '../components/ui/primitives';
import { Modal, Tabs, useConfirm, useToast } from '../components/ui/overlays';
import {
  PaymentReceiptDialog,
  PaymentsPrintDialog,
  type PaymentsPrintScope,
} from '../components/print/PaymentPrints';
import {
  CustomsBadge,
  DataPoint,
  FilterPills,
  MoneySummary,
  PageHeader,
  PaymentBadge,
  ResultCount,
  StatCard,
} from '../components/shared';

type Filter = 'all' | 'empty' | 'partial' | 'full' | 'unpaid' | 'paid';

const EMPTY_FORM = { name: '', tcNumber: '', arrivalDate: '', notes: '' };

/* ============================================================
   Page
   ============================================================ */

export function Containers() {
  const { t, lang } = useI18n();
  const { state, can, addContainer, updateContainer, deleteContainer } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Container | null>(null);
  const [detail, setDetail] = useState<Container | null>(null);

  /* ---------- enriched list ---------- */
  const rows = useMemo(
    () =>
      state.containers.map((ct) => ({
        container: ct,
        money: containerMoney(state, ct.id),
        fill: containerFill(state, ct.id),
      })),
    [state],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      empty: rows.filter((r) => r.fill.count === 0).length,
      partial: rows.filter((r) => r.fill.count > 0 && !r.fill.isFull).length,
      full: rows.filter((r) => r.fill.isFull).length,
      unpaid: rows.filter((r) => r.money.rest > 0).length,
      paid: rows.filter((r) => r.money.rest <= 0 && r.money.total > 0).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => {
        if (filter === 'empty') return r.fill.count === 0;
        if (filter === 'partial') return r.fill.count > 0 && !r.fill.isFull;
        if (filter === 'full') return r.fill.isFull;
        if (filter === 'unpaid') return r.money.rest > 0;
        if (filter === 'paid') return r.money.rest <= 0 && r.money.total > 0;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return norm(r.container.name).includes(q) || norm(r.container.tcNumber).includes(q);
      })
      .sort((a, b) => b.money.rest - a.money.rest || a.container.name.localeCompare(b.container.name));
  }, [rows, query, filter]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          total: acc.total + r.money.total,
          paid: acc.paid + r.money.paid,
          rest: acc.rest + r.money.rest,
          cars: acc.cars + r.fill.count,
        }),
        { total: 0, paid: 0, rest: 0, cars: 0 },
      ),
    [rows],
  );

  /* ---------- actions ---------- */
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Container) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleDelete = async (c: Container) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{c.name}</p>
          <p className="mt-1">{t('deleteContainerWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteContainer(c.id);
    setDetail(null);
    toast.success(t('containerDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<Boxes size={24} />}
        title={t('containers')}
        subtitle={`${counts.all} ${t('containers').toLowerCase()} · ${totals.cars} ${t('carsCount')}`}
        actions={
          can('containers', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newContainer')}
            </Button>
          )
        }
      />

      {/* summary */}
      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('containers')}
            value={counts.all}
            icon={<Boxes size={20} />}
            tone="ocean"
            hint={`${totals.cars} ${t('carsCount')}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard label={t('totalAmount')} value={totals.total} format={fms} icon={<Wallet size={20} />} tone="brand" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label={t('totalPaid')} value={totals.paid} format={fms} icon={<CreditCard size={20} />} tone="emerald" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalRest')}
            value={totals.rest}
            format={fms}
            icon={<Wallet size={20} />}
            tone={totals.rest > 0 ? 'rose' : 'emerald'}
            hint={`${counts.unpaid} ${t('containers').toLowerCase()}`}
          />
        </StaggerItem>
      </StaggerList>

      {/* toolbar */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchContainerPlaceholder')}
            className="lg:max-w-sm lg:flex-1"
          />
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            className="lg:ms-auto"
            options={[
              { value: 'all', label: t('all'), count: counts.all },
              { value: 'empty', label: t('occupancyEmpty'), count: counts.empty, tone: 'slate' },
              { value: 'partial', label: t('occupancyPartial'), count: counts.partial, tone: 'amber' },
              { value: 'full', label: t('occupancyFull'), count: counts.full, tone: 'ocean' },
              { value: 'unpaid', label: t('unpaid'), count: counts.unpaid, tone: 'rose' },
              { value: 'paid', label: t('paid'), count: counts.paid, tone: 'emerald' },
            ]}
          />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
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

      {/* cards */}
      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes size={28} />}
            title={t('noResults')}
            hint={t('noResultsHint')}
            action={
              can('containers', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newContainer')}
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
                  fill={r.fill}
                  onView={can('containers', 'view') ? () => setDetail(r.container) : undefined}
                  onEdit={can('containers', 'edit') ? () => openEdit(r.container) : undefined}
                  onDelete={can('containers', 'delete') ? () => handleDelete(r.container) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* dialogs */}
      <ContainerForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            updateContainer(editing.id, data);
            toast.success(t('containerUpdated'));
          } else {
            addContainer(data);
            toast.success(t('containerCreated'));
          }
          setFormOpen(false);
        }}
      />

      <ContainerDetail
        container={detail}
        onClose={() => setDetail(null)}
        onEdit={
          can('containers', 'edit')
            ? (c) => {
                setDetail(null);
                openEdit(c);
              }
            : undefined
        }
      />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function ContainerCard({
  container,
  money,
  fill,
  onView,
  onEdit,
  onDelete,
}: {
  container: Container;
  money: ReturnType<typeof containerMoney>;
  fill: ReturnType<typeof containerFill>;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grad-ocean text-white shadow-sm ring-2 ring-white">
          <Boxes size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{container.name}</h3>
          <p className="mt-0.5 truncate font-mono text-2xs tracking-tight text-ink-500" dir="ltr">
            {container.tcNumber}
          </p>
        </div>
        <PaymentBadge status={money.status} />
      </div>

      {/* body */}
      <div className="flex-1 p-4">
        {/* occupancy */}
        <div className="mb-3 rounded-xl bg-ink-50/80 p-3 ring-1 ring-ink-200/60">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              <Layers size={11} />
              {t('occupancy')}
            </span>
            <span
              className={cx(
                'text-[13px] font-extrabold tabular-nums',
                fill.isFull ? 'text-rose-600' : fill.count > 0 ? 'text-amber-600' : 'text-ink-500',
              )}
            >
              {fill.count}/{MAX_CARS_PER_CONTAINER}
            </span>
          </div>
          <ProgressBar
            value={fill.percent}
            height="h-2"
            tone={fill.isFull ? 'rose' : fill.count > 0 ? 'amber' : 'emerald'}
            className="mt-2"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint label={t('totalCars')} value={fill.count} icon={<CarIcon size={11} />} />
          <DataPoint
            label={t('arrivalDate')}
            value={container.arrivalDate ? <ArrivalDate iso={container.arrivalDate} /> : '—'}
            icon={<Calendar size={11} />}
          />
        </div>

        <MoneySummary money={money} compact />
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 border-t border-ink-100 bg-ink-50/60 p-3">
        {onView && (
          <Button size="sm" variant="soft" icon={<Eye size={15} />} onClick={onView} className="flex-1">
            {t('viewDetails')}
          </Button>
        )}
        {!onView && <span className="flex-1" />}
        {onEdit && (
          <IconButton label={t('edit')} variant="secondary" onClick={onEdit}>
            <Pencil size={15} />
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

function ArrivalDate({ iso }: { iso: string }) {
  const { lang } = useI18n();
  return <span className="tabular-nums">{formatDate(iso, lang)}</span>;
}

/* ============================================================
   Create / edit form
   ============================================================ */

function ContainerForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Container | null;
  onClose: () => void;
  onSave: (data: Omit<Container, 'id' | 'createdAt'>) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const target = editing?.id ?? (open ? '__new__' : null);
  if (target !== seed) {
    setSeed(target);
    setErrors({});
    setForm(
      editing
        ? {
            name: editing.name,
            tcNumber: editing.tcNumber,
            arrivalDate: editing.arrivalDate ?? '',
            notes: editing.notes ?? '',
          }
        : EMPTY_FORM,
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('requiredField');
    if (!form.tcNumber.trim()) errs.tcNumber = t('requiredField');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      name: form.name.trim(),
      tcNumber: form.tcNumber.trim(),
      arrivalDate: form.arrivalDate || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editContainer') : t('newContainer')}
      subtitle={t('containerContent')}
      icon={<Boxes size={20} />}
      size="md"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button block onClick={submit} icon={<Plus size={16} />}>
            {editing ? t('saveChanges') : t('create')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label={t('containerName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          icon={<Boxes size={16} />}
          placeholder="CNT-2026-014"
          required
        />
        <Input
          label={t('tcNumber')}
          dir="ltr"
          value={form.tcNumber}
          onChange={(e) => setForm({ ...form, tcNumber: e.target.value })}
          error={errors.tcNumber}
          icon={<Tag size={16} />}
          className="font-mono"
          placeholder="MSKU 483920-1"
          required
        />
        <Input
          label={`${t('arrivalDate')} (${t('optional')})`}
          type="date"
          value={form.arrivalDate}
          onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
        />
        <Textarea
          label={`${t('notes')} (${t('optional')})`}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
      </form>
    </Modal>
  );
}

/* ============================================================
   Detail dialog — content / payments / rest per principal
   ============================================================ */

function ContainerDetail({
  container,
  onClose,
  onEdit,
}: {
  container: Container | null;
  onClose: () => void;
  onEdit?: (c: Container) => void;
}) {
  const { t, lang } = useI18n();
  const { state, can } = useStore();
  const [tab, setTab] = useState('content');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [printAll, setPrintAll] = useState(false);

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const data = useMemo(() => {
    if (!container) return null;
    return {
      cars: carsOfContainer(state, container.id),
      money: containerMoney(state, container.id),
      fill: containerFill(state, container.id),
      payments: paymentsOfContainer(state, container.id),
      breakdown: containerBreakdown(state, container.id),
    };
  }, [state, container]);

  const printScope = useMemo<PaymentsPrintScope | null>(() => {
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

  const tabs = [
    { key: 'content', label: t('containerContent'), icon: <Package size={15} />, badge: data.cars.length },
    ...(can('containers', 'viewPaymentHistory')
      ? [
          {
            key: 'payments',
            label: t('paymentHistory'),
            icon: <CreditCard size={15} />,
            badge: data.payments.length,
          },
        ]
      : []),
    ...(can('containers', 'viewRestPerClient')
      ? [
          {
            key: 'breakdown',
            label: t('restPerClient'),
            icon: <Users size={15} />,
            badge: data.breakdown.length,
          },
        ]
      : []),
  ];

  const active = tabs.some((x) => x.key === tab) ? tab : 'content';

  return (
    <Modal
      open={!!container}
      onClose={onClose}
      size="xl"
      icon={<Boxes size={20} />}
      title={container.name}
      subtitle={container.tcNumber}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('createdOn')} {formatDate(container.createdAt, lang)}
          </span>
          <div className="flex gap-2">
            {onEdit && (
              <Button size="sm" variant="secondary" icon={<Pencil size={15} />} onClick={() => onEdit(container)}>
                {t('edit')}
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
      <PaymentsPrintDialog open={printAll} onClose={() => setPrintAll(false)} scope={printScope} />

      {/* occupancy strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200/80 bg-ink-50/70 p-3.5">
        <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
          <Layers size={12} />
          {t('occupancy')}
        </span>
        <span
          className={cx(
            'text-sm font-extrabold tabular-nums',
            data.fill.isFull ? 'text-rose-600' : 'text-ink-800',
          )}
        >
          {data.fill.count}/{MAX_CARS_PER_CONTAINER}
        </span>
        <ProgressBar
          value={data.fill.percent}
          tone={data.fill.isFull ? 'rose' : data.fill.count > 0 ? 'amber' : 'emerald'}
          className="min-w-[8rem] flex-1"
        />
        {container.arrivalDate && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            <Calendar size={12} />
            {formatDate(container.arrivalDate, lang)}
          </span>
        )}
      </div>

      <MoneySummary money={data.money} className="mb-4" />
      <Tabs tabs={tabs} active={active} onChange={setTab} variant="pill" className="mb-4" />

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ---- content ---- */}
          {active === 'content' &&
            (data.cars.length === 0 ? (
              <EmptyState icon={<CarIcon size={26} />} title={t('noCarsInContainer')} hint={t('emptyContainer')} />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-ink-200/80">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2.5 text-start font-bold">{t('declarationNo')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('secondaryClient')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('car')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('principalClient')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('status')}</th>
                        <th className="px-4 py-2.5 text-end font-bold">{t('price')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {data.cars.map((sc) => (
                        <tr key={sc.id} className="transition-colors hover:bg-ink-50/70">
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-extrabold tabular-nums text-brand-700">
                            {formatDeclarationNo(sc.declarationNo)}
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-[13px] font-bold text-ink-900">{fullName(sc)}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-2xs text-ink-500">
                              <MapPin size={10} className="shrink-0" />
                              <span className="line-clamp-1">{sc.address}</span>
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-[13px] font-semibold text-ink-800">
                              {sc.car.brand} {sc.car.name}
                            </p>
                            <p className="mt-0.5 font-mono text-2xs text-ink-500">
                              {sc.car.chassisNumber}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-[13px] font-semibold text-ink-700">
                            {principalName(state, sc.principalClientId)}
                          </td>
                          <td className="px-4 py-2.5">
                            <CustomsBadge status={sc.customsStatus} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-ink-900">
                            {fm(sc.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink-200 bg-ink-50">
                        <td colSpan={5} className="px-4 py-2.5 text-[13px] font-bold text-ink-700">
                          {t('totalAmount')}
                        </td>
                        <td className="px-4 py-2.5 text-end text-sm font-extrabold tabular-nums text-ink-900">
                          {fm(data.money.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <MoneySummary money={data.money} />
              </div>
            ))}

          {/* ---- payments ---- */}
          {active === 'payments' &&
            (data.payments.length === 0 ? (
              <EmptyState icon={<CreditCard size={26} />} title={t('noContainerPayments')} />
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Printer size={15} />}
                    onClick={() => setPrintAll(true)}
                  >
                    {t('printHistory')}
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-ink-200/80">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2.5 text-start font-bold">{t('versementRefShort')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('date')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('principalClient')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('description')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('by')}</th>
                        <th className="px-4 py-2.5 text-end font-bold">{t('amount')}</th>
                        <th className="px-4 py-2.5 text-end font-bold">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {data.payments.map((p) => (
                        <tr key={p.id} className="transition-colors hover:bg-ink-50/70">
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-extrabold tabular-nums text-brand-700">
                            {formatVersementRef(p.refNo)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                            {formatDate(p.date, lang)} · {p.time}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] font-bold text-ink-900">
                            {principalName(state, p.principalClientId)}
                          </td>
                          <td className="max-w-[14rem] truncate px-4 py-2.5 text-xs text-ink-500">
                            {p.description || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-ink-500">{p.createdBy}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-emerald-600">
                            +{fm(p.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-end">
                            <IconButton
                              label={t('printReceipt')}
                              variant="secondary"
                              onClick={() => setReceipt(p)}
                            >
                              <Printer size={14} />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink-200 bg-ink-50">
                        <td colSpan={5} className="px-4 py-2.5 text-[13px] font-bold text-ink-700">
                          {t('totalPaid')}
                        </td>
                        <td className="px-4 py-2.5 text-end text-sm font-extrabold tabular-nums text-emerald-700">
                          {fm(data.money.paid)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}

          {/* ---- rest per principal client ---- */}
          {active === 'breakdown' &&
            (data.breakdown.length === 0 ? (
              <EmptyState icon={<Users size={26} />} title={t('noCarsInContainer')} />
            ) : (
              <div className="space-y-3">
                {data.breakdown.map((line, i) => (
                  <motion.div
                    key={line.client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-2xl border border-ink-200/80 bg-white p-3.5 transition-shadow hover:shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={fullName(line.client)} size="sm" gradient="from-violet-500 to-fuchsia-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold text-ink-900">
                          {fullName(line.client)}
                        </p>
                        <p className="mt-0.5 truncate text-2xs text-ink-500">
                          {line.cars.length} {t('carsCount')} ·{' '}
                          <span dir="ltr" className="tabular-nums">
                            {line.client.phone}
                          </span>
                        </p>
                      </div>
                      <PaymentBadge status={line.money.status} />
                    </div>

                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {line.cars.map((sc) => (
                        <li
                          key={sc.id}
                          className="chip bg-ink-100 text-ink-600 ring-1 ring-ink-200"
                          title={sc.car.chassisNumber}
                        >
                          <CarIcon size={11} />
                          {sc.car.brand} {sc.car.name}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <DataPoint label={t('totalAmount')} value={fm(line.money.total)} />
                      <DataPoint label={t('totalPaid')} value={fm(line.money.paid)} />
                      <DataPoint label={t('rest')} value={fm(line.money.rest)} />
                    </div>

                    <ProgressBar
                      value={line.money.progress}
                      tone={
                        line.money.status === 'paid'
                          ? 'emerald'
                          : line.money.status === 'partial'
                            ? 'amber'
                            : 'rose'
                      }
                      className="mt-3"
                    />
                  </motion.div>
                ))}
              </div>
            ))}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
