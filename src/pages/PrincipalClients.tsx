import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import {
  Boxes,
  Calendar,
  Car,
  CreditCard,
  Eye,
  History,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  containersOfPrincipal,
  fullName,
  principalMoney,
  principalTimeline,
  paymentsOfPrincipal,
  secondariesOfPrincipal,
  carMoney,
} from '../lib/selectors';
import {
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatVersementRef,
  norm,
  todayISO,
  nowTime,
} from '../lib/format';
import type { ClientStatus, Payment, PrincipalClient } from '../lib/types';
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
import { Modal, Tabs, useConfirm, useToast } from '../components/ui/overlays';
import {
  PaymentReceiptDialog,
  PaymentsPrintDialog,
  usePrincipalScope,
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

type Filter = 'all' | ClientStatus | 'debtor' | 'settled';

const EMPTY_FORM = { firstName: '', lastName: '', phone: '', address: '', notes: '', status: 'active' as ClientStatus };

export function PrincipalClients() {
  const { t, lang } = useI18n();
  const { state, can, addPrincipal, updatePrincipal, deletePrincipal, addPayment } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrincipalClient | null>(null);
  const [detail, setDetail] = useState<PrincipalClient | null>(null);
  const [payFor, setPayFor] = useState<PrincipalClient | null>(null);

  /* ---------- enriched + filtered list ---------- */
  const rows = useMemo(
    () =>
      state.principalClients.map((c) => ({
        client: c,
        money: principalMoney(state, c.id),
        cars: secondariesOfPrincipal(state, c.id).length,
        containers: containersOfPrincipal(state, c.id).length,
      })),
    [state],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.client.status === 'active').length,
      inactive: rows.filter((r) => r.client.status === 'inactive').length,
      debtor: rows.filter((r) => r.money.rest > 0).length,
      settled: rows.filter((r) => r.money.rest <= 0 && r.money.total > 0).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => {
        if (filter === 'active' || filter === 'inactive') return r.client.status === filter;
        if (filter === 'debtor') return r.money.rest > 0;
        if (filter === 'settled') return r.money.rest <= 0 && r.money.total > 0;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return (
          norm(fullName(r.client)).includes(q) ||
          norm(r.client.phone).includes(q) ||
          r.client.phone.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
        );
      })
      .sort((a, b) => b.money.rest - a.money.rest || fullName(a.client).localeCompare(fullName(b.client)));
  }, [rows, query, filter]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          total: acc.total + r.money.total,
          paid: acc.paid + r.money.paid,
          rest: acc.rest + r.money.rest,
        }),
        { total: 0, paid: 0, rest: 0 },
      ),
    [rows],
  );

  /* ---------- actions ---------- */
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: PrincipalClient) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleDelete = async (c: PrincipalClient) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{fullName(c)}</p>
          <p className="mt-1">{t('deleteClientWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deletePrincipal(c.id);
    setDetail(null);
    toast.success(t('clientDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<Users size={24} />}
        title={t('principalClients')}
        subtitle={`${counts.all} ${t('principalClients').toLowerCase()} · ${counts.debtor} ${t('unpaid').toLowerCase()}`}
        actions={
          can('principalClients', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newPrincipalClient')}
            </Button>
          )
        }
      />

      {/* summary */}
      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label={t('principalClients')} value={counts.all} icon={<Users size={20} />} tone="violet" hint={`${counts.active} ${t('active').toLowerCase()}`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label={t('totalAmount')} value={totals.total} format={fms} icon={<Wallet size={20} />} tone="brand" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label={t('totalPaid')} value={totals.paid} format={fms} icon={<CreditCard size={20} />} tone="emerald" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label={t('totalRest')} value={totals.rest} format={fms} icon={<Wallet size={20} />} tone={totals.rest > 0 ? 'rose' : 'emerald'} hint={`${counts.debtor} ${t('principalClients').toLowerCase()}`} />
        </StaggerItem>
      </StaggerList>

      {/* toolbar */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchClientPlaceholder')}
            className="lg:max-w-sm lg:flex-1"
          />
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            className="lg:ms-auto"
            options={[
              { value: 'all', label: t('all'), count: counts.all },
              { value: 'active', label: t('active'), count: counts.active, tone: 'emerald' },
              { value: 'inactive', label: t('inactive'), count: counts.inactive, tone: 'slate' },
              { value: 'debtor', label: t('unpaid'), count: counts.debtor, tone: 'rose' },
              { value: 'settled', label: t('paid'), count: counts.settled, tone: 'emerald' },
            ]}
          />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
          <ResultCount n={visible.length} />
          {(query || filter !== 'all') && (
            <Button size="xs" variant="ghost" onClick={() => { setQuery(''); setFilter('all'); }}>
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {/* cards */}
      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={28} />}
            title={t('noResults')}
            hint={t('noResultsHint')}
            action={
              can('principalClients', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newPrincipalClient')}
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
                key={r.client.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <ClientCard
                  client={r.client}
                  money={r.money}
                  cars={r.cars}
                  containers={r.containers}
                  onView={() => setDetail(r.client)}
                  onEdit={can('principalClients', 'edit') ? () => openEdit(r.client) : undefined}
                  onDelete={can('principalClients', 'delete') ? () => handleDelete(r.client) : undefined}
                  onPay={can('principalClients', 'addPayment') ? () => setPayFor(r.client) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* dialogs */}
      <ClientForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            updatePrincipal(editing.id, data);
            toast.success(t('clientUpdated'));
          } else {
            addPrincipal(data);
            toast.success(t('clientCreated'));
          }
          setFormOpen(false);
        }}
      />

      <ClientDetail
        client={detail}
        onClose={() => setDetail(null)}
        onEdit={can('principalClients', 'edit') ? (c) => { setDetail(null); openEdit(c); } : undefined}
        onPay={can('principalClients', 'addPayment') ? (c) => setPayFor(c) : undefined}
      />

      <PaymentDialog
        client={payFor}
        onClose={() => setPayFor(null)}
        onSave={(p) => {
          const created = addPayment(p);
          setPayFor(null);
          toast.success(
            `${t('paymentAdded')} · ${t('versementRef')} ${formatVersementRef(created.refNo)}`,
          );
        }}
      />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function ClientCard({
  client,
  money,
  cars,
  containers,
  onView,
  onEdit,
  onDelete,
  onPay,
}: {
  client: PrincipalClient;
  money: ReturnType<typeof principalMoney>;
  cars: number;
  containers: number;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPay?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="relative flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <Avatar name={fullName(client)} gradient="from-violet-500 to-fuchsia-500" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{fullName(client)}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-semibold text-ink-500">
            <Phone size={12} className="shrink-0" />
            <span dir="ltr" className="tabular-nums">{client.phone}</span>
          </p>
        </div>
        <span
          className={cx(
            'chip shrink-0',
            client.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-ink-100 text-ink-500 ring-1 ring-ink-200',
          )}
        >
          {t(client.status)}
        </span>
      </div>

      {/* body */}
      <div className="flex-1 p-4">
        <p className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-500">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{client.address}</span>
        </p>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <DataPoint label={t('totalCars')} value={cars} icon={<Car size={11} />} />
          <DataPoint label={t('containers')} value={containers} icon={<Boxes size={11} />} />
          <DataPoint label={t('status')} value={<PaymentBadge status={money.status} />} />
        </div>

        <MoneySummary money={money} compact />
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 border-t border-ink-100 bg-ink-50/60 p-3">
        <Button size="sm" variant="soft" icon={<Eye size={15} />} onClick={onView} className="flex-1">
          {t('viewDetails')}
        </Button>
        {onPay && (
          <IconButton label={t('addPayment')} variant="success" onClick={onPay}>
            <CreditCard size={16} />
          </IconButton>
        )}
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

/* ============================================================
   Create / edit form
   ============================================================ */

function ClientForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: PrincipalClient | null;
  onClose: () => void;
  onSave: (data: Omit<PrincipalClient, 'id' | 'createdAt'>) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  // Re-seed the form whenever the dialog target changes.
  const target = editing?.id ?? (open ? '__new__' : null);
  if (target !== seed) {
    setSeed(target);
    setErrors({});
    setForm(
      editing
        ? {
            firstName: editing.firstName,
            lastName: editing.lastName,
            phone: editing.phone,
            address: editing.address,
            notes: editing.notes ?? '',
            status: editing.status,
          }
        : EMPTY_FORM,
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = t('requiredField');
    if (!form.lastName.trim()) errs.lastName = t('requiredField');
    if (!form.phone.trim()) errs.phone = t('requiredField');
    if (!form.address.trim()) errs.address = t('requiredField');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim() || undefined,
      status: form.status,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editPrincipalClient') : t('newPrincipalClient')}
      subtitle={t('clientInfo')}
      icon={<UserRound size={20} />}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('firstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            error={errors.firstName}
            icon={<UserRound size={16} />}
            required
          />
          <Input
            label={t('lastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            error={errors.lastName}
            required
          />
        </div>
        <Input
          label={t('phone')}
          type="tel"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={errors.phone}
          icon={<Phone size={16} />}
          placeholder="0770 00 00 00"
          required
        />
        <Textarea
          label={t('address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          error={errors.address}
          required
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
   Detail dialog — 4 organised panels
   ============================================================ */

function ClientDetail({
  client,
  onClose,
  onEdit,
  onPay,
}: {
  client: PrincipalClient | null;
  onClose: () => void;
  onEdit?: (c: PrincipalClient) => void;
  onPay?: (c: PrincipalClient) => void;
}) {
  const { t, lang } = useI18n();
  const { state, can } = useStore();
  const [tab, setTab] = useState('info');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [printAll, setPrintAll] = useState(false);

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const printScope = usePrincipalScope(client?.id ?? null);

  const data = useMemo(() => {
    if (!client) return null;
    return {
      money: principalMoney(state, client.id),
      secondaries: secondariesOfPrincipal(state, client.id),
      payments: paymentsOfPrincipal(state, client.id),
      timeline: principalTimeline(state, client.id),
      containers: containersOfPrincipal(state, client.id),
    };
  }, [state, client]);

  if (!client || !data) return null;

  const tabs = [
    { key: 'info', label: t('clientInfo'), icon: <UserRound size={15} /> },
    { key: 'secondaries', label: t('clientSecondaries'), icon: <Car size={15} />, badge: data.secondaries.length },
    { key: 'history', label: t('transactionHistory'), icon: <History size={15} />, badge: data.timeline.length },
    ...(can('principalClients', 'viewPayments')
      ? [{ key: 'payments', label: t('allPayments'), icon: <CreditCard size={15} />, badge: data.payments.length }]
      : []),
  ];

  return (
    <Modal
      open={!!client}
      onClose={onClose}
      size="xl"
      icon={<UserRound size={20} />}
      title={fullName(client)}
      subtitle={client.phone}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('createdOn')} {formatDate(client.createdAt, lang)}
          </span>
          <div className="flex gap-2">
            {onPay && (
              <Button size="sm" variant="success" icon={<CreditCard size={15} />} onClick={() => onPay(client)}>
                {t('addPayment')}
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="secondary" icon={<Pencil size={15} />} onClick={() => onEdit(client)}>
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

      <MoneySummary money={data.money} className="mb-4" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ---- info ---- */}
          {tab === 'info' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <DataPoint label={t('firstName')} value={client.firstName} />
              <DataPoint label={t('lastName')} value={client.lastName} />
              <DataPoint label={t('phone')} value={<span dir="ltr">{client.phone}</span>} icon={<Phone size={11} />} />
              <DataPoint label={t('status')} value={t(client.status)} />
              <DataPoint label={t('address')} value={client.address} icon={<MapPin size={11} />} className="sm:col-span-2" />
              <DataPoint label={t('totalCars')} value={data.secondaries.length} icon={<Car size={11} />} />
              <DataPoint label={t('containers')} value={data.containers.length} icon={<Boxes size={11} />} />
              {client.notes && (
                <DataPoint label={t('notes')} value={client.notes} className="sm:col-span-2" />
              )}
            </div>
          )}

          {/* ---- secondary clients ---- */}
          {tab === 'secondaries' &&
            (data.secondaries.length === 0 ? (
              <EmptyState icon={<Car size={26} />} title={t('noSecondaryClients')} />
            ) : (
              <div className="space-y-2.5">
                {data.secondaries.map((sc) => {
                  const ct = state.containers.find((c) => c.id === sc.containerId);
                  const m = carMoney(state, sc);
                  return (
                    <div
                      key={sc.id}
                      className="rounded-2xl border border-ink-200/80 bg-white p-3.5 transition-shadow hover:shadow-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-extrabold text-ink-900">
                            {fullName(sc)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-500">
                            {sc.car.brand} {sc.car.name} · <span className="font-mono">{sc.car.chassisNumber}</span>
                          </p>
                        </div>
                        <CustomsBadge status={sc.customsStatus} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <DataPoint label={t('container')} value={ct?.name ?? '—'} icon={<Boxes size={11} />} />
                        <DataPoint label={t('price')} value={fm(sc.price)} />
                        <DataPoint label={t('totalPaid')} value={fm(m.paid)} />
                        <DataPoint label={t('rest')} value={fm(m.rest)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* ---- timeline ---- */}
          {tab === 'history' &&
            (data.timeline.length === 0 ? (
              <EmptyState icon={<History size={26} />} title={t('empty')} />
            ) : (
              <ol className="relative space-y-3 ps-6">
                <span className="absolute inset-y-2 start-[7px] w-0.5 rounded-full bg-ink-200" aria-hidden />
                {data.timeline.map((ev, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className="relative"
                  >
                    <span
                      className={cx(
                        'absolute -start-6 top-3 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white',
                        ev.kind === 'payment' ? 'bg-emerald-500' : 'bg-ocean-500',
                      )}
                      aria-hidden
                    />
                    <div className="rounded-xl border border-ink-200/80 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13px] font-bold text-ink-900">
                          {ev.kind === 'payment' ? <CreditCard size={14} className="text-emerald-600" /> : <Car size={14} className="text-ocean-600" />}
                          {ev.kind === 'payment'
                            ? `${t('payment')} · ${ev.container?.name ?? '—'}`
                            : `${fullName(ev.car)} · ${ev.car.car.brand} ${ev.car.car.name}`}
                        </span>
                        <span
                          className={cx(
                            'text-[13px] font-extrabold tabular-nums',
                            ev.kind === 'payment' ? 'text-emerald-600' : 'text-ink-700',
                          )}
                        >
                          {ev.kind === 'payment' ? `+${fm(ev.payment.amount)}` : fm(ev.car.price)}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                        <Calendar size={11} />
                        {formatDate(ev.date, lang)}
                        {ev.kind === 'payment' && ` · ${ev.time}`}
                        {ev.kind === 'payment' && ev.payment.description && ` · ${ev.payment.description}`}
                        {ev.kind === 'car' && ev.container && ` · ${ev.container.name}`}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            ))}

          {/* ---- payments ---- */}
          {tab === 'payments' &&
            (data.payments.length === 0 ? (
              <EmptyState icon={<CreditCard size={26} />} title={t('noPayments')} />
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
                  <table className="w-full min-w-[38rem] text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2.5 text-start font-bold">{t('versementRefShort')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('date')}</th>
                        <th className="px-4 py-2.5 text-start font-bold">{t('container')}</th>
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
                            {state.containers.find((c) => c.id === p.containerId)?.name ?? '—'}
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
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

/* ============================================================
   Payment dialog — pick container, then record the payment
   ============================================================ */

function PaymentDialog({
  client,
  onClose,
  onSave,
}: {
  client: PrincipalClient | null;
  onClose: () => void;
  onSave: (p: {
    containerId: string;
    principalClientId: string;
    amount: number;
    date: string;
    time: string;
    description?: string;
  }) => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [containerId, setContainerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const lines = useMemo(() => {
    if (!client) return [];
    return containersOfPrincipal(state, client.id).map((ct) => {
      const cars = state.secondaryClients.filter(
        (c) => c.containerId === ct.id && c.principalClientId === client.id,
      );
      const total = cars.reduce((a, c) => a + c.price, 0);
      const paid = state.payments
        .filter((p) => p.containerId === ct.id && p.principalClientId === client.id)
        .reduce((a, p) => a + p.amount, 0);
      return { container: ct, cars: cars.length, total, paid, rest: total - paid };
    });
  }, [state, client]);

  if (client && seed !== client.id) {
    setSeed(client.id);
    setContainerId(lines.find((l) => l.rest > 0)?.container.id ?? lines[0]?.container.id ?? '');
    setAmount('');
    setDate(todayISO());
    setTime(nowTime());
    setDescription('');
    setErrors({});
  }

  if (!client) return null;

  const selected = lines.find((l) => l.container.id === containerId);
  const numeric = Number(amount.replace(/\s/g, ''));

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!containerId) errs.container = t('selectContainerFirst');
    if (!amount.trim() || Number.isNaN(numeric) || numeric <= 0) errs.amount = t('invalidNumber');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      containerId,
      principalClientId: client.id,
      amount: numeric,
      date,
      time,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      open={!!client}
      onClose={onClose}
      title={t('newPayment')}
      subtitle={fullName(client)}
      icon={<CreditCard size={20} />}
      size="md"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="success" block onClick={submit} icon={<CreditCard size={16} />}>
            {t('addPayment')}
          </Button>
        </div>
      }
    >
      {lines.length === 0 ? (
        <EmptyState icon={<Boxes size={26} />} title={t('noResults')} hint={t('noSecondaryClients')} />
      ) : (
        <div className="space-y-4">
          {/* container picker */}
          <div>
            <label className="label">{t('container')}</label>
            <div className="space-y-2">
              {lines.map((l) => {
                const on = l.container.id === containerId;
                return (
                  <button
                    key={l.container.id}
                    onClick={() => setContainerId(l.container.id)}
                    className={cx(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200',
                      on
                        ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                        : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        on ? 'bg-grad-brand text-white' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      <Boxes size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold text-ink-900">
                        {l.container.name}
                      </span>
                      <span className="block truncate font-mono text-2xs text-ink-500">
                        {l.container.tcNumber} · {l.cars} {t('carsCount')}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-2xs font-bold uppercase text-ink-400">{t('rest')}</span>
                      <span
                        className={cx(
                          'block text-[13px] font-extrabold tabular-nums',
                          l.rest > 0 ? 'text-rose-600' : 'text-emerald-600',
                        )}
                      >
                        {fm(l.rest)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.container && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.container}</p>}
          </div>

          {selected && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
              <DataPoint label={t('totalAmount')} value={fm(selected.total)} />
              <DataPoint label={t('totalPaid')} value={fm(selected.paid)} />
              <DataPoint label={t('rest')} value={fm(selected.rest)} />
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
          {selected && numeric > selected.rest && selected.rest >= 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              {t('overpaidWarning')}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label={t('time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
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
