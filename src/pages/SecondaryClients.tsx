/* ============================================================
   Secondary clients — one person + one car + one container.
   Creation goes through a 5-step wizard; edition reuses the
   same dialog as a single scrollable form.
   ============================================================ */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Calendar,
  Car as CarIcon,
  Check,
  CreditCard,
  Eye,
  Hash,
  History,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  UserRound,
  Users,
  Wallet,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  carMoney,
  containerFill,
  fullName,
  modelsOfBrand,
  nextDeclarationNo,
  principalMoney,
  secondariesOfPrincipal,
} from '../lib/selectors';
import {
  formatDate,
  formatDeclarationNo,
  formatMoney,
  formatMoneyShort,
  matchesRef,
  norm,
} from '../lib/format';
import { CUSTOMS_STATUSES, MAX_CARS_PER_CONTAINER } from '../lib/types';
import type {
  AppState,
  Container,
  CustomsStatus,
  Payment,
  PrincipalClient,
  SecondaryClient,
  Warehouse,
} from '../lib/types';
import type { TranslationKey } from '../i18n/translations';
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
  CUSTOMS_META,
  CustomsBadge,
  DataPoint,
  FilterPills,
  MoneySummary,
  PageHeader,
  PaymentBadge,
  ResultCount,
  StatCard,
} from '../components/shared';

type Filter = 'all' | CustomsStatus;

interface WizardForm {
  /** Optional: left empty the store hands out the next free number, and the
      Douane screen asks for the real one when the file is marked "Saisie". */
  declarationNo: string;
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  principalClientId: string;
  /** The car is picked from the shared catalog, so both makes and models stay consistent. */
  carBrandId: string;
  carModelId: string;
  chassisNumber: string;
  containerId: string;
  warehouseId: string;
  price: string;
}

const EMPTY_FORM: WizardForm = {
  declarationNo: '',
  firstName: '',
  lastName: '',
  address: '',
  phone: '',
  principalClientId: '',
  carBrandId: '',
  carModelId: '',
  chassisNumber: '',
  containerId: '',
  warehouseId: '',
  price: '',
};

const STEPS: { key: string; labelKey: TranslationKey; icon: ReactNode }[] = [
  { key: 'identity', labelKey: 'stepIdentity', icon: <UserRound size={15} /> },
  { key: 'principal', labelKey: 'stepPrincipal', icon: <Users size={15} /> },
  { key: 'car', labelKey: 'stepCar', icon: <CarIcon size={15} /> },
  { key: 'container', labelKey: 'stepContainer', icon: <Boxes size={15} /> },
  { key: 'warehouse', labelKey: 'stepWarehouse', icon: <WarehouseIcon size={15} /> },
  { key: 'price', labelKey: 'stepPrice', icon: <Wallet size={15} /> },
];

/**
 * Maps a stored car ("Renault" / "Clio 5") back onto catalog ids so the edit
 * form opens with the right entries pre-selected. Anything the catalog does not
 * know yet comes back empty and the user picks — or creates — it.
 */
function resolveCar(
  s: AppState,
  brand: string,
  model: string,
): { carBrandId: string; carModelId: string } {
  const b = s.carBrands.find((x) => norm(x.name) === norm(brand));
  if (!b) return { carBrandId: '', carModelId: '' };
  const m = s.carModels.find((x) => x.brandId === b.id && norm(x.name) === norm(model));
  return { carBrandId: b.id, carModelId: m?.id ?? '' };
}

/* ============================================================
   Page
   ============================================================ */

export function SecondaryClients() {
  const { t, lang } = useI18n();
  const { state, can, deleteSecondary } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SecondaryClient | null>(null);
  const [detail, setDetail] = useState<SecondaryClient | null>(null);

  /* ---------- enriched rows ---------- */
  const rows = useMemo(
    () =>
      state.secondaryClients.map((sc) => ({
        car: sc,
        money: carMoney(state, sc),
        container: state.containers.find((c) => c.id === sc.containerId),
        warehouse: state.warehouses.find((w) => w.id === sc.warehouseId),
        principal: state.principalClients.find((p) => p.id === sc.principalClientId),
      })),
    [state],
  );

  const counts = useMemo(() => {
    const out: Record<Filter, number> = {
      all: rows.length,
      non_arrive: 0,
      arrive: 0,
      saisie: 0,
      liquide: 0,
      sortie: 0,
      remis_client: 0,
    };
    for (const r of rows) out[r.car.customsStatus] += 1;
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => (filter === 'all' ? true : r.car.customsStatus === filter))
      .filter((r) => {
        if (!q) return true;
        // The declaration number is the client's business id, so it is the
        // first thing the search box answers to.
        return (
          matchesRef(formatDeclarationNo(r.car.declarationNo), query) ||
          norm(fullName(r.car)).includes(q) ||
          norm(r.car.address).includes(q)
        );
      })
      .sort(
        (a, b) =>
          CUSTOMS_META[a.car.customsStatus].order - CUSTOMS_META[b.car.customsStatus].order ||
          fullName(a.car).localeCompare(fullName(b.car)),
      );
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
  const openEdit = (c: SecondaryClient) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleDelete = async (c: SecondaryClient) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{fullName(c)}</p>
          <p className="mt-1">{t('deleteSecondaryWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteSecondary(c.id);
    setDetail(null);
    toast.success(t('secondaryDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<CarIcon size={24} />}
        title={t('secondaryClients')}
        subtitle={`${counts.all} ${t('carsCount')} · ${counts.remis_client} ${t('st_remis_client').toLowerCase()}`}
        actions={
          can('secondaryClients', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newSecondaryClient')}
            </Button>
          )
        }
      />

      {/* summary */}
      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('totalCars')}
            value={counts.all}
            icon={<CarIcon size={20} />}
            tone="ocean"
            hint={`${counts.non_arrive} ${t('st_non_arrive').toLowerCase()}`}
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
          />
        </StaggerItem>
      </StaggerList>

      {/* toolbar */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchSecondaryPlaceholder')}
            className="lg:max-w-sm lg:flex-1"
          />
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            className="lg:ms-auto"
            options={[
              { value: 'all', label: t('all'), count: counts.all },
              ...CUSTOMS_STATUSES.map((s) => ({
                value: s as Filter,
                label: t(CUSTOMS_META[s].key),
                count: counts[s],
                tone: CUSTOMS_META[s].tone,
              })),
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
            icon={<CarIcon size={28} />}
            title={t('noResults')}
            hint={t('noResultsHint')}
            action={
              can('secondaryClients', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newSecondaryClient')}
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
                key={r.car.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <SecondaryCard
                  car={r.car}
                  money={r.money}
                  container={r.container}
                  warehouse={r.warehouse}
                  principal={r.principal}
                  onView={can('secondaryClients', 'view') ? () => setDetail(r.car) : undefined}
                  onEdit={can('secondaryClients', 'edit') ? () => openEdit(r.car) : undefined}
                  onDelete={can('secondaryClients', 'delete') ? () => handleDelete(r.car) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* dialogs */}
      <SecondaryDialog open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />

      <SecondaryDetail
        car={detail}
        onClose={() => setDetail(null)}
        onEdit={
          can('secondaryClients', 'edit')
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

function SecondaryCard({
  car,
  money,
  container,
  warehouse,
  principal,
  onView,
  onEdit,
  onDelete,
}: {
  car: SecondaryClient;
  money: ReturnType<typeof carMoney>;
  container?: Container;
  warehouse?: Warehouse;
  principal?: PrincipalClient;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <Avatar name={fullName(car)} gradient="from-brand-800 to-ocean-400" />
        <div className="min-w-0 flex-1">
          <p
            className="flex items-center gap-1 font-mono text-2xs font-extrabold tracking-wide text-brand-600"
            title={t('declarationNo')}
          >
            <Hash size={10} className="shrink-0" />
            {formatDeclarationNo(car.declarationNo)}
          </p>
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{fullName(car)}</h3>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs font-semibold text-ink-500">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-1">{car.address}</span>
          </p>
        </div>
        <CustomsBadge status={car.customsStatus} />
      </div>

      {/* body */}
      <div className="flex-1 p-4">
        <div className="mb-3 rounded-xl bg-ink-50/80 p-3 ring-1 ring-ink-200/60">
          <p className="flex items-center gap-2 text-[13px] font-extrabold text-ink-900">
            <CarIcon size={14} className="shrink-0 text-ocean-600" />
            <span className="truncate">
              {car.car.brand} {car.car.name}
            </span>
          </p>
          <p className="mt-1 truncate font-mono text-2xs tracking-tight text-ink-500">
            {car.car.chassisNumber}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint label={t('container')} value={container?.name ?? '—'} icon={<Boxes size={11} />} />
          <DataPoint
            label={t('principalClient')}
            value={principal ? fullName(principal) : '—'}
            icon={<Users size={11} />}
          />
          <DataPoint
            label={t('warehouse')}
            value={warehouse?.name ?? '—'}
            icon={<WarehouseIcon size={11} />}
          />
          <DataPoint label={t('price')} value={fm(car.price)} icon={<Tag size={11} />} />
          <DataPoint
            label={t('status')}
            value={<PaymentBadge status={money.status} />}
            className="col-span-2"
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

/* ============================================================
   Step indicator
   ============================================================ */

function StepIndicator({ current }: { current: number }) {
  const { t } = useI18n();
  return (
    <div className="mb-5 flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <div key={s.key} className="flex min-w-0 flex-1 items-center gap-1.5 last:flex-none">
            <div className="flex min-w-0 items-center gap-2">
              <motion.span
                animate={{ scale: on ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
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
              </motion.span>
              <span
                className={cx(
                  'hidden truncate text-2xs font-bold uppercase tracking-wide lg:block',
                  on ? 'text-brand-700' : done ? 'text-emerald-600' : 'text-ink-400',
                )}
              >
                {t(s.labelKey)}
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
  );
}

/* ============================================================
   Catalog picker — search an existing entry or add one on the spot.

   Backs both halves of the car step: makes ("Renault") and models
   ("Clio 5"). Everything the office types once is reusable next time.
   ============================================================ */

function NamePicker({
  label,
  icon,
  options,
  value,
  onChange,
  canCreate,
  onCreate,
  searchPlaceholder,
  emptyText,
  createLabel,
  duplicateMessage,
  disabled,
  disabledHint,
  error,
}: {
  label: string;
  icon: ReactNode;
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  canCreate: boolean;
  onCreate: (name: string) => string;
  searchPlaceholder: string;
  emptyText: string;
  createLabel: string;
  duplicateMessage: string;
  disabled?: boolean;
  disabledHint?: string;
  error?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');

  const selected = options.find((o) => o.id === value);

  const results = useMemo(() => {
    const q = norm(query);
    return options.filter((o) => !q || norm(o.name).includes(q));
  }, [options, query]);

  const reset = () => {
    setAdding(false);
    setDraft('');
    setDraftError('');
    setQuery('');
  };

  const create = () => {
    const name = draft.trim();
    if (!name) {
      setDraftError(t('requiredField'));
      return;
    }
    if (options.some((o) => norm(o.name) === norm(name))) {
      setDraftError(duplicateMessage);
      return;
    }
    onChange(onCreate(name));
    reset();
    toast.success(createLabel);
  };

  if (disabled) {
    return (
      <div>
        <p className="label">{label}</p>
        <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-5 text-center text-xs font-semibold text-ink-400">
          {disabledHint}
        </div>
      </div>
    );
  }

  /* Chosen: collapse to a single row so the step stays short. */
  if (selected) {
    return (
      <div>
        <p className="label">{label}</p>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-500 bg-brand-50/70 p-3 ring-4 ring-brand-500/10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-grad-brand text-white">
            {icon}
          </span>
          <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink-900">
            {selected.name}
          </p>
          <Button size="xs" variant="secondary" onClick={() => onChange('')}>
            {t('clear')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="label">{label}</p>
      <div className="space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1"
          />
          {canCreate && (
            <Button
              type="button"
              size="sm"
              variant={adding ? 'secondary' : 'primary'}
              icon={adding ? <X size={15} /> : <Plus size={15} />}
              className="shrink-0"
              onClick={() => {
                setDraftError('');
                setDraft(adding ? '' : query);
                setAdding((v) => !v);
              }}
            >
              {adding ? t('cancel') : t('add')}
            </Button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-brand-200 bg-grad-brand-soft p-3.5">
                <Input
                  label={createLabel}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDraftError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())}
                  error={draftError || undefined}
                  icon={icon}
                  autoFocus
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={reset}>
                    {t('cancel')}
                  </Button>
                  <Button size="sm" icon={<Plus size={15} />} onClick={create}>
                    {t('create')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-h-[13rem] space-y-1.5 overflow-y-auto pe-1">
          {results.length === 0 ? (
            <p className="rounded-xl bg-ink-50 px-3 py-4 text-center text-xs font-semibold text-ink-400">
              {emptyText}
            </p>
          ) : (
            results.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-label={o.name}
                onClick={() => onChange(o.id)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 bg-white p-2.5 text-start transition-all duration-200 hover:border-ink-300 hover:bg-ink-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  {icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900">
                  {o.name}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

/* ============================================================
   Create wizard / edit form — one dialog, two modes
   ============================================================ */

function SecondaryDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: SecondaryClient | null;
  onClose: () => void;
}) {
  const { t, lang, isRtl } = useI18n();
  const {
    state,
    can,
    addSecondary,
    updateSecondary,
    addContainer,
    addWarehouse,
    addCarBrand,
    addCarModel,
  } = useStore();
  const toast = useToast();
  const reduce = useReducedMotion();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [seed, setSeed] = useState<string | null>(null);

  const [principalQuery, setPrincipalQuery] = useState('');
  const [pickingPrincipal, setPickingPrincipal] = useState(true);
  const [containerQuery, setContainerQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncTc, setNcTc] = useState('');
  const [ncErrors, setNcErrors] = useState<Record<string, string>>({});

  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [nwOpen, setNwOpen] = useState(false);
  const [nwForm, setNwForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [nwErrors, setNwErrors] = useState<Record<string, string>>({});

  const isEdit = !!editing;

  /* Re-seed whenever the dialog target changes. */
  const target = editing?.id ?? (open ? '__new__' : null);
  if (target !== seed) {
    setSeed(target);
    setErrors({});
    setStep(0);
    setDir(1);
    setPrincipalQuery('');
    setContainerQuery('');
    setNewOpen(false);
    setNcName('');
    setNcTc('');
    setNcErrors({});
    setWarehouseQuery('');
    setNwOpen(false);
    setNwForm({ name: '', address: '', phone: '', email: '' });
    setNwErrors({});
    setPickingPrincipal(!editing);
    setForm(
      editing
        ? {
            declarationNo: String(editing.declarationNo),
            firstName: editing.firstName,
            lastName: editing.lastName,
            address: editing.address,
            phone: editing.phone ?? '',
            principalClientId: editing.principalClientId,
            // The catalog was seeded from the existing rows, so an older car's
            // make and model resolve straight back to their catalog entries.
            ...resolveCar(state, editing.car.brand, editing.car.name),
            chassisNumber: editing.car.chassisNumber,
            containerId: editing.containerId,
            warehouseId: editing.warehouseId ?? '',
            price: String(editing.price),
          }
        : // the declaration number stays empty: filing a car no longer waits
          // for it, and the store numbers the row on save
          { ...EMPTY_FORM },
    );
  }

  /* ---------- derived ---------- */
  const principalResults = useMemo(() => {
    const q = norm(principalQuery);
    const raw = principalQuery.replace(/\s/g, '');
    return state.principalClients.filter((p) => {
      if (!q) return true;
      return (
        norm(fullName(p)).includes(q) ||
        norm(p.phone).includes(q) ||
        p.phone.replace(/\s/g, '').includes(raw)
      );
    });
  }, [state.principalClients, principalQuery]);

  const containerResults = useMemo(() => {
    const q = norm(containerQuery);
    return state.containers
      .filter((c) => !q || norm(c.name).includes(q) || norm(c.tcNumber).includes(q))
      .map((c) => ({ container: c, fill: containerFill(state, c.id) }));
  }, [state, containerQuery]);

  const warehouseResults = useMemo(() => {
    const q = norm(warehouseQuery);
    return state.warehouses.filter(
      (w) => !q || norm(w.name).includes(q) || norm(w.address).includes(q),
    );
  }, [state.warehouses, warehouseQuery]);

  const selectedPrincipal = state.principalClients.find((p) => p.id === form.principalClientId);
  const selectedContainer = state.containers.find((c) => c.id === form.containerId);
  const selectedWarehouse = state.warehouses.find((w) => w.id === form.warehouseId);
  const selectedBrand = state.carBrands.find((b) => b.id === form.carBrandId);
  const selectedModel = state.carModels.find((m) => m.id === form.carModelId);
  const brandModels = useMemo(
    () => modelsOfBrand(state, form.carBrandId),
    [state, form.carBrandId],
  );
  const numericPrice = Number(form.price.replace(/\s/g, ''));
  const typedDeclaration = form.declarationNo.trim();
  const numericDeclaration = Number(form.declarationNo.replace(/\s/g, ''));
  /** Shown as the placeholder, and what the store will hand out if left empty. */
  const autoDeclaration = useMemo(() => nextDeclarationNo(state), [state]);

  /** The unique index in Postgres is the real guard; this catches it earlier. */
  const declarationTaken =
    !!typedDeclaration &&
    state.secondaryClients.some(
      (c) => c.id !== editing?.id && c.declarationNo === numericDeclaration,
    );

  /** A container is blocked when full — unless the car being edited already sits in it. */
  const isBlocked = (id: string) => {
    const fill = containerFill(state, id);
    if (editing && editing.containerId === id) return false;
    return fill.isFull;
  };

  /* ---------- validation ---------- */
  const validate = (which: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (which === 0) {
      // Empty is allowed: the number is assigned on save and can be typed
      // later, on the Douane screen. Only a typed number is checked.
      if (typedDeclaration) {
        if (!Number.isInteger(numericDeclaration) || numericDeclaration < 1)
          e.declarationNo = t('invalidNumber');
        else if (declarationTaken) e.declarationNo = t('declarationNoTaken');
      }
      if (!form.firstName.trim()) e.firstName = t('requiredField');
      if (!form.lastName.trim()) e.lastName = t('requiredField');
      if (!form.address.trim()) e.address = t('requiredField');
    }
    if (which === 1 && !form.principalClientId) e.principalClientId = t('selectPrincipalFirst');
    if (which === 2) {
      if (!form.carBrandId) e.carBrand = t('selectCarBrand');
      if (!form.carModelId) e.carName = t('selectCarName');
      if (!form.chassisNumber.trim()) e.chassisNumber = t('requiredField');
    }
    if (which === 3) {
      if (!form.containerId) e.containerId = t('selectContainerFirst');
      else if (isBlocked(form.containerId)) e.containerId = t('containerFullError');
    }
    if (which === 4 && !form.warehouseId) e.warehouseId = t('selectWarehouseFirst');
    if (which === 5) {
      if (!form.price.trim() || Number.isNaN(numericPrice) || numericPrice <= 0)
        e.price = t('invalidNumber');
    }
    return e;
  };

  const validateAll = () => {
    const e: Record<string, string> = {};
    for (let i = 0; i < STEPS.length; i += 1) Object.assign(e, validate(i));
    return e;
  };

  /* ---------- actions ---------- */
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

  /* Catalog ids become plain names on the row: a car keeps the wording it was
     filed under even if the catalog entry is renamed later. */
  const payload = () => ({
    // omitted when the field is empty: creating numbers the row, editing keeps
    // the number the file already carries
    ...(typedDeclaration ? { declarationNo: numericDeclaration } : {}),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    address: form.address.trim(),
    phone: form.phone.trim() || undefined,
    principalClientId: form.principalClientId,
    containerId: form.containerId,
    warehouseId: form.warehouseId || undefined,
    car: {
      name: selectedModel?.name ?? '',
      brand: selectedBrand?.name ?? '',
      chassisNumber: form.chassisNumber.trim(),
    },
    price: numericPrice,
  });

  const submitCreate = () => {
    // The number may have been taken by someone else while this wizard was
    // open — send the user back to the field rather than failing at the API.
    const first = validate(0);
    if (first.declarationNo) {
      setErrors(first);
      setDir(-1);
      setStep(0);
      return;
    }
    const e = validate(5);
    setErrors(e);
    if (Object.keys(e).length) return;
    const created = addSecondary(payload());
    toast.success(
      `${t('secondaryCreated')} · ${t('declarationNo')} ${formatDeclarationNo(created.declarationNo)}`,
    );
    onClose();
  };

  const submitEdit = () => {
    const e = validateAll();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!editing) return;
    updateSecondary(editing.id, payload());
    toast.success(t('secondaryUpdated'));
    onClose();
  };

  const createContainerInline = () => {
    const e: Record<string, string> = {};
    if (!ncName.trim()) e.name = t('requiredField');
    if (!ncTc.trim()) e.tcNumber = t('requiredField');
    setNcErrors(e);
    if (Object.keys(e).length) return;
    const created = addContainer({ name: ncName.trim(), tcNumber: ncTc.trim() });
    setForm((f) => ({ ...f, containerId: created.id }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.containerId;
      return next;
    });
    setNewOpen(false);
    setNcName('');
    setNcTc('');
    setContainerQuery('');
    toast.success(t('containerAutoSelected'));
  };

  const createWarehouseInline = () => {
    const e: Record<string, string> = {};
    if (!nwForm.name.trim()) e.name = t('requiredField');
    if (!nwForm.address.trim()) e.address = t('requiredField');
    setNwErrors(e);
    if (Object.keys(e).length) return;
    const created = addWarehouse({
      name: nwForm.name.trim(),
      address: nwForm.address.trim(),
      phone: nwForm.phone.trim(),
      email: nwForm.email.trim(),
      description: '',
    });
    setForm((f) => ({ ...f, warehouseId: created.id }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.warehouseId;
      return next;
    });
    setNwOpen(false);
    setNwForm({ name: '', address: '', phone: '', email: '' });
    setWarehouseQuery('');
    toast.success(t('warehouseAutoSelected'));
  };

  /* ---------- shared field groups ---------- */
  const identityFields = (
    <div className="space-y-4">
      <Input
        label={t('declarationNo')}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        dir="ltr"
        value={form.declarationNo}
        onChange={(ev) => setForm({ ...form, declarationNo: ev.target.value })}
        error={errors.declarationNo}
        placeholder={
          isEdit
            ? undefined
            : t('declarationNoAutoPlaceholder', { no: formatDeclarationNo(autoDeclaration) })
        }
        hint={
          isEdit
            ? t('declarationNoManualHint')
            : t('declarationNoOptionalHint', { no: formatDeclarationNo(autoDeclaration) })
        }
        icon={<Hash size={16} />}
        className="font-mono"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('firstName')}
          value={form.firstName}
          onChange={(ev) => setForm({ ...form, firstName: ev.target.value })}
          error={errors.firstName}
          icon={<UserRound size={16} />}
          required
        />
        <Input
          label={t('lastName')}
          value={form.lastName}
          onChange={(ev) => setForm({ ...form, lastName: ev.target.value })}
          error={errors.lastName}
          required
        />
      </div>
      <Textarea
        label={t('address')}
        value={form.address}
        onChange={(ev) => setForm({ ...form, address: ev.target.value })}
        error={errors.address}
        rows={2}
        required
      />
      <Input
        label={`${t('phone')} (${t('optional')})`}
        type="tel"
        dir="ltr"
        value={form.phone}
        onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
        icon={<Phone size={16} />}
        placeholder="0770 00 00 00"
      />
    </div>
  );

  const canCreateCar = can('secondaryClients', 'createCarInline');

  const carFields = (
    <div className="space-y-4">
      <NamePicker
        label={t('carBrand')}
        icon={<Tag size={16} />}
        options={state.carBrands}
        value={form.carBrandId}
        // switching make invalidates the model underneath it
        onChange={(id) => {
          setForm({ ...form, carBrandId: id, carModelId: '' });
          setErrors({});
        }}
        canCreate={canCreateCar}
        onCreate={(name) => addCarBrand(name).id}
        searchPlaceholder={t('searchBrandPlaceholder')}
        emptyText={t('noBrandsYet')}
        createLabel={t('newCarBrand')}
        duplicateMessage={t('brandExists')}
        error={errors.carBrand}
      />

      <NamePicker
        label={t('carName')}
        icon={<CarIcon size={16} />}
        options={brandModels}
        value={form.carModelId}
        onChange={(id) => {
          setForm({ ...form, carModelId: id });
          setErrors({});
        }}
        canCreate={canCreateCar}
        onCreate={(name) => addCarModel(form.carBrandId, name).id}
        searchPlaceholder={t('searchModelPlaceholder')}
        emptyText={t('noModelsYet')}
        createLabel={t('newCarName')}
        duplicateMessage={t('carNameExists')}
        disabled={!form.carBrandId}
        disabledHint={t('selectBrandFirst')}
        error={errors.carName}
      />

      <Input
        label={t('chassisNumber')}
        dir="ltr"
        value={form.chassisNumber}
        onChange={(ev) => setForm({ ...form, chassisNumber: ev.target.value })}
        error={errors.chassisNumber}
        icon={<Hash size={16} />}
        className="font-mono"
        required
      />
    </div>
  );

  const priceField = (
    <Input
      label={t('price')}
      type="number"
      inputMode="numeric"
      min={1}
      value={form.price}
      onChange={(ev) => setForm({ ...form, price: ev.target.value })}
      error={errors.price}
      suffix={cur}
      required
    />
  );

  const principalPicker = (
    <div className="space-y-3">
      {selectedPrincipal && !pickingPrincipal ? (
        <div className="rounded-2xl border border-brand-500 bg-brand-50/70 p-3.5 ring-4 ring-brand-500/10">
          <div className="flex items-center gap-3">
            <Avatar name={fullName(selectedPrincipal)} gradient="from-violet-500 to-fuchsia-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-extrabold text-ink-900">
                {fullName(selectedPrincipal)}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-500" dir="ltr">
                {selectedPrincipal.phone}
              </p>
            </div>
            <Button size="xs" variant="secondary" onClick={() => setPickingPrincipal(true)}>
              {t('changePrincipal')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SearchBar
            value={principalQuery}
            onChange={setPrincipalQuery}
            placeholder={t('searchClientPlaceholder')}
          />
          <p className="text-xs text-ink-500">{t('findPrincipalHint')}</p>
          <div className="max-h-[17rem] space-y-2 overflow-y-auto pe-1">
            {principalResults.length === 0 ? (
              <EmptyState icon={<Users size={24} />} title={t('noResults')} hint={t('noResultsHint')} />
            ) : (
              principalResults.map((p) => {
                const on = p.id === form.principalClientId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={fullName(p)}
                    aria-pressed={on}
                    onClick={() => {
                      setForm({ ...form, principalClientId: p.id });
                      setErrors({});
                      setPickingPrincipal(false);
                    }}
                    className={cx(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200',
                      on
                        ? 'border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                        : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    <Avatar name={fullName(p)} size="sm" gradient="from-violet-500 to-fuchsia-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold text-ink-900">
                        {fullName(p)}
                      </span>
                      <span className="block truncate text-2xs text-ink-500">
                        <span dir="ltr" className="tabular-nums">
                          {p.phone}
                        </span>{' '}
                        · {p.address}
                      </span>
                    </span>
                    {on && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-grad-brand text-white">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
      {errors.principalClientId && (
        <p className="text-xs font-medium text-rose-600">{errors.principalClientId}</p>
      )}
    </div>
  );

  const containerPicker = (
    <div className="space-y-3">
      {/* Search and "create a container" sit on the same row: picking an existing
          container and making a new one are the two ways out of this step. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBar
          value={containerQuery}
          onChange={setContainerQuery}
          placeholder={t('searchContainerPlaceholder')}
          className="min-w-0 flex-1"
        />
        {can('secondaryClients', 'createContainerInline') && (
          <Button
            type="button"
            variant={newOpen ? 'secondary' : 'primary'}
            icon={newOpen ? <X size={15} /> : <Plus size={15} />}
            className="shrink-0"
            onClick={() => {
              setNcErrors({});
              setNewOpen((v) => !v);
            }}
          >
            {newOpen ? t('cancel') : t('newContainer')}
          </Button>
        )}
      </div>

      {/* inline creation form, revealed right under the row that opened it */}
      {can('secondaryClients', 'createContainerInline') && (
        <AnimatePresence initial={false}>
          {newOpen && (
            <motion.div
              key="nc-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-brand-200 bg-grad-brand-soft p-3.5">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
                  <Plus size={15} className="text-brand-600" />
                  {t('newContainer')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={t('containerName')}
                    value={ncName}
                    onChange={(ev) => setNcName(ev.target.value)}
                    error={ncErrors.name}
                    icon={<Boxes size={16} />}
                    required
                  />
                  <Input
                    label={t('tcNumber')}
                    dir="ltr"
                    value={ncTc}
                    onChange={(ev) => setNcTc(ev.target.value)}
                    error={ncErrors.tcNumber}
                    className="font-mono"
                    required
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setNewOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button size="sm" icon={<Plus size={15} />} onClick={createContainerInline}>
                    {t('create')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <p className="text-xs text-ink-500">{t('findContainerHint')}</p>

      <div className="max-h-[15rem] space-y-2 overflow-y-auto pe-1">
        {containerResults.length === 0 ? (
          <EmptyState icon={<Boxes size={24} />} title={t('noResults')} hint={t('noResultsHint')} />
        ) : (
          containerResults.map(({ container: ct, fill }) => {
            const blocked = isBlocked(ct.id);
            const on = ct.id === form.containerId;
            return (
              <button
                key={ct.id}
                type="button"
                disabled={blocked}
                aria-label={ct.name}
                aria-pressed={on}
                onClick={() => {
                  if (blocked) return;
                  setForm({ ...form, containerId: ct.id });
                  setErrors({});
                }}
                className={cx(
                  'w-full rounded-xl border p-3 text-start transition-all duration-200',
                  blocked
                    ? 'cursor-not-allowed border-rose-200 bg-rose-50/50 opacity-70'
                    : on
                      ? 'cursor-pointer border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10'
                      : 'cursor-pointer border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <span className="flex items-center gap-3">
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
                      {ct.name}
                    </span>
                    <span className="block truncate font-mono text-2xs text-ink-500">
                      {ct.tcNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block text-[13px] font-extrabold tabular-nums text-ink-800">
                      {fill.count}/{MAX_CARS_PER_CONTAINER}
                    </span>
                    {blocked ? (
                      <span className="chip mt-0.5 bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                        {t('full')}
                      </span>
                    ) : (
                      <span className="block text-2xs font-semibold text-ink-400">
                        {t('spotsLeft', { count: fill.free })}
                      </span>
                    )}
                  </span>
                </span>
                <ProgressBar
                  value={fill.percent}
                  height="h-1.5"
                  tone={fill.isFull ? 'rose' : fill.count > 0 ? 'amber' : 'emerald'}
                  className="mt-2.5"
                />
              </button>
            );
          })
        )}
      </div>

      {errors.containerId && (
        <p className="text-xs font-medium text-rose-600">{errors.containerId}</p>
      )}

    </div>
  );

  const warehousePicker = (
    <div className="space-y-3">
      {/* Same shape as the container step: search what exists, or add a site. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBar
          value={warehouseQuery}
          onChange={setWarehouseQuery}
          placeholder={t('searchWarehousePlaceholder')}
          className="min-w-0 flex-1"
        />
        {can('secondaryClients', 'createWarehouseInline') && (
          <Button
            type="button"
            variant={nwOpen ? 'secondary' : 'primary'}
            icon={nwOpen ? <X size={15} /> : <Plus size={15} />}
            className="shrink-0"
            onClick={() => {
              setNwErrors({});
              setNwOpen((v) => !v);
            }}
          >
            {nwOpen ? t('cancel') : t('newWarehouse')}
          </Button>
        )}
      </div>

      {can('secondaryClients', 'createWarehouseInline') && (
        <AnimatePresence initial={false}>
          {nwOpen && (
            <motion.div
              key="nw-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-brand-200 bg-grad-brand-soft p-3.5">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
                  <Plus size={15} className="text-brand-600" />
                  {t('newWarehouse')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={t('warehouseName')}
                    value={nwForm.name}
                    onChange={(ev) => setNwForm({ ...nwForm, name: ev.target.value })}
                    error={nwErrors.name}
                    icon={<WarehouseIcon size={16} />}
                    required
                  />
                  <Input
                    label={t('address')}
                    value={nwForm.address}
                    onChange={(ev) => setNwForm({ ...nwForm, address: ev.target.value })}
                    error={nwErrors.address}
                    icon={<MapPin size={16} />}
                    required
                  />
                  <Input
                    label={`${t('phone')} (${t('optional')})`}
                    type="tel"
                    dir="ltr"
                    value={nwForm.phone}
                    onChange={(ev) => setNwForm({ ...nwForm, phone: ev.target.value })}
                    icon={<Phone size={16} />}
                  />
                  <Input
                    label={`${t('email')} (${t('optional')})`}
                    type="email"
                    dir="ltr"
                    value={nwForm.email}
                    onChange={(ev) => setNwForm({ ...nwForm, email: ev.target.value })}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setNwOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button size="sm" icon={<Plus size={15} />} onClick={createWarehouseInline}>
                    {t('create')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <p className="text-xs text-ink-500">{t('findWarehouseHint')}</p>

      <div className="max-h-[15rem] space-y-2 overflow-y-auto pe-1">
        {warehouseResults.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon size={24} />}
            title={state.warehouses.length ? t('noResults') : t('noWarehouses')}
            hint={state.warehouses.length ? t('noResultsHint') : t('noWarehousesHint')}
          />
        ) : (
          warehouseResults.map((w) => {
            const on = w.id === form.warehouseId;
            return (
              <button
                key={w.id}
                type="button"
                aria-label={w.name}
                aria-pressed={on}
                onClick={() => {
                  setForm({ ...form, warehouseId: w.id });
                  setErrors({});
                }}
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
                  <WarehouseIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-extrabold text-ink-900">
                    {w.name}
                  </span>
                  <span className="block truncate text-2xs text-ink-500">{w.address}</span>
                </span>
                {on && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-grad-brand text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {errors.warehouseId && (
        <p className="text-xs font-medium text-rose-600">{errors.warehouseId}</p>
      )}
    </div>
  );

  const review = (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <DataPoint
        label={t('declarationNo')}
        value={
          typedDeclaration && Number.isFinite(numericDeclaration) && numericDeclaration > 0
            ? formatDeclarationNo(numericDeclaration)
            : editing
              ? formatDeclarationNo(editing.declarationNo)
              : t('declarationNoAutoPlaceholder', { no: formatDeclarationNo(autoDeclaration) })
        }
        icon={<Hash size={11} />}
        mono
        className="sm:col-span-2"
      />
      <DataPoint label={t('fullName')} value={`${form.firstName} ${form.lastName}`} icon={<UserRound size={11} />} />
      <DataPoint label={t('address')} value={form.address || '—'} icon={<MapPin size={11} />} />
      <DataPoint
        label={t('principalClient')}
        value={selectedPrincipal ? fullName(selectedPrincipal) : '—'}
        icon={<Users size={11} />}
      />
      <DataPoint
        label={t('container')}
        value={selectedContainer ? selectedContainer.name : '—'}
        icon={<Boxes size={11} />}
      />
      <DataPoint
        label={t('warehouse')}
        value={selectedWarehouse ? selectedWarehouse.name : '—'}
        icon={<WarehouseIcon size={11} />}
      />
      <DataPoint
        label={t('car')}
        value={
          selectedBrand || selectedModel
            ? `${selectedBrand?.name ?? ''} ${selectedModel?.name ?? ''}`.trim()
            : '—'
        }
        icon={<CarIcon size={11} />}
      />
      <DataPoint label={t('chassisNumber')} value={form.chassisNumber || '—'} mono />
      <DataPoint
        label={t('price')}
        value={Number.isNaN(numericPrice) ? '—' : fm(numericPrice || 0)}
        icon={<Tag size={11} />}
        className="sm:col-span-2"
      />
    </div>
  );

  /* ---------- render ---------- */
  const slide = reduce ? 0 : 28;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<CarIcon size={20} />}
      title={isEdit ? t('editSecondaryClient') : t('newSecondaryClient')}
      subtitle={isEdit ? fullName(form) : t('stepOf', { current: step + 1, total: STEPS.length })}
      footer={
        isEdit ? (
          <div className="flex gap-2.5">
            <Button variant="secondary" block onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button block onClick={submitEdit} icon={<Check size={16} />}>
              {t('saveChanges')}
            </Button>
          </div>
        ) : (
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
              <Button onClick={submitCreate} icon={<Plus size={16} />} className="flex-1">
                {t('create')}
              </Button>
            )}
          </div>
        )
      }
    >
      {isEdit ? (
        /* ---------- edit: one scrollable form ---------- */
        <div className="space-y-5">
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('personalInfo')}
            </p>
            {identityFields}
          </section>
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('carInfo')}
            </p>
            {carFields}
          </section>
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('assignedPrincipal')}
            </p>
            {principalPicker}
          </section>
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('container')}
            </p>
            {containerPicker}
          </section>
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('warehouse')}
            </p>
            {warehousePicker}
          </section>
          <section>
            <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('stepPrice')}
            </p>
            {priceField}
          </section>
        </div>
      ) : (
        /* ---------- create: wizard ---------- */
        <div>
          <StepIndicator current={step} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: dir * slide * (isRtl ? -1 : 1) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * slide * (isRtl ? -1 : 1) }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && identityFields}
              {step === 1 && principalPicker}
              {step === 2 && carFields}
              {step === 3 && containerPicker}
              {step === 4 && warehousePicker}
              {step === 5 && (
                <div className="space-y-4">
                  {priceField}
                  <div>
                    <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                      {t('summary')}
                    </p>
                    {review}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Detail dialog — 3 organised panels
   ============================================================ */

type CarEvent =
  | { kind: 'payment'; date: string; time: string; payment: Payment }
  | { kind: 'car'; date: string; time: string };

function SecondaryDetail({
  car,
  onClose,
  onEdit,
}: {
  car: SecondaryClient | null;
  onClose: () => void;
  onEdit?: (c: SecondaryClient) => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const [tab, setTab] = useState('info');

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const data = useMemo(() => {
    if (!car) return null;
    const principal = state.principalClients.find((p) => p.id === car.principalClientId);
    const container = state.containers.find((c) => c.id === car.containerId);
    const events: CarEvent[] = [
      ...state.payments
        .filter(
          (p) => p.containerId === car.containerId && p.principalClientId === car.principalClientId,
        )
        .map<CarEvent>((p) => ({ kind: 'payment', date: p.date, time: p.time, payment: p })),
      { kind: 'car' as const, date: car.createdAt, time: '00:00' },
    ].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return {
      principal,
      container,
      warehouse: state.warehouses.find((w) => w.id === car.warehouseId),
      money: carMoney(state, car),
      principalM: principal ? principalMoney(state, principal.id) : null,
      principalCars: principal ? secondariesOfPrincipal(state, principal.id).length : 0,
      events,
    };
  }, [state, car]);

  if (!car || !data) return null;

  const tabs = [
    { key: 'info', label: t('personalInfo'), icon: <UserRound size={15} /> },
    { key: 'principal', label: t('assignedPrincipal'), icon: <Users size={15} /> },
    {
      key: 'history',
      label: t('transactionHistory'),
      icon: <History size={15} />,
      badge: data.events.length,
    },
  ];

  return (
    <Modal
      open={!!car}
      onClose={onClose}
      size="xl"
      icon={<CarIcon size={20} />}
      title={fullName(car)}
      subtitle={`${t('declarationNo')} ${formatDeclarationNo(car.declarationNo)} · ${car.car.brand} ${car.car.name} · ${car.car.chassisNumber}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('createdOn')} {formatDate(car.createdAt, lang)}
          </span>
          <div className="flex gap-2">
            {onEdit && (
              <Button size="sm" variant="secondary" icon={<Pencil size={15} />} onClick={() => onEdit(car)}>
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CustomsBadge status={car.customsStatus} />
        <PaymentBadge status={data.money.status} />
      </div>
      <MoneySummary money={data.money} className="mb-4" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} variant="pill" className="mb-4" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ---- personal + car ---- */}
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DataPoint
                  label={t('declarationNo')}
                  value={formatDeclarationNo(car.declarationNo)}
                  icon={<Hash size={11} />}
                  mono
                  className="sm:col-span-2"
                />
                <DataPoint label={t('firstName')} value={car.firstName} />
                <DataPoint label={t('lastName')} value={car.lastName} />
                <DataPoint
                  label={t('address')}
                  value={car.address}
                  icon={<MapPin size={11} />}
                  className="sm:col-span-2"
                />
                {car.phone && (
                  <DataPoint
                    label={t('phone')}
                    value={<span dir="ltr">{car.phone}</span>}
                    icon={<Phone size={11} />}
                  />
                )}
                <DataPoint label={t('createdOn')} value={formatDate(car.createdAt, lang)} icon={<Calendar size={11} />} />
              </div>

              <div>
                <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                  {t('carInfo')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DataPoint label={t('carBrand')} value={car.car.brand} icon={<CarIcon size={11} />} />
                  <DataPoint label={t('carName')} value={car.car.name} />
                  <DataPoint label={t('chassisNumber')} value={car.car.chassisNumber} mono />
                  <DataPoint label={t('price')} value={fm(car.price)} icon={<Tag size={11} />} />
                  <DataPoint
                    label={t('container')}
                    value={data.container?.name ?? '—'}
                    icon={<Boxes size={11} />}
                  />
                  <DataPoint
                    label={t('tcNumber')}
                    value={data.container?.tcNumber ?? '—'}
                    mono
                  />
                  <DataPoint
                    label={t('warehouse')}
                    value={data.warehouse?.name ?? t('noWarehouseAssigned')}
                    icon={<WarehouseIcon size={11} />}
                  />
                  <DataPoint
                    label={t('address')}
                    value={data.warehouse?.address ?? '—'}
                    icon={<MapPin size={11} />}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---- principal client ---- */}
          {tab === 'principal' &&
            (!data.principal || !data.principalM ? (
              <EmptyState icon={<Users size={26} />} title={t('empty')} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-ink-200/80 bg-white p-3.5">
                  <Avatar name={fullName(data.principal)} gradient="from-violet-500 to-fuchsia-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold text-ink-900">
                      {fullName(data.principal)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {t(data.principal.status)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                    {t('contactInfo')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DataPoint
                      label={t('phone')}
                      value={<span dir="ltr">{data.principal.phone}</span>}
                      icon={<Phone size={11} />}
                    />
                    <DataPoint label={t('totalCars')} value={data.principalCars} icon={<CarIcon size={11} />} />
                    <DataPoint
                      label={t('address')}
                      value={data.principal.address}
                      icon={<MapPin size={11} />}
                      className="sm:col-span-2"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                    {t('financialSummary')}
                  </p>
                  <MoneySummary money={data.principalM} />
                </div>
              </div>
            ))}

          {/* ---- timeline ---- */}
          {tab === 'history' &&
            (data.events.length === 0 ? (
              <EmptyState icon={<History size={26} />} title={t('empty')} />
            ) : (
              <ol className="relative space-y-3 ps-6">
                <span className="absolute inset-y-2 start-[7px] w-0.5 rounded-full bg-ink-200" aria-hidden />
                {data.events.map((ev, i) => (
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
                          {ev.kind === 'payment' ? (
                            <CreditCard size={14} className="text-emerald-600" />
                          ) : (
                            <CarIcon size={14} className="text-ocean-600" />
                          )}
                          {ev.kind === 'payment'
                            ? `${t('payment')} · ${data.container?.name ?? '—'}`
                            : `${fullName(car)} · ${car.car.brand} ${car.car.name}`}
                        </span>
                        <span
                          className={cx(
                            'text-[13px] font-extrabold tabular-nums',
                            ev.kind === 'payment' ? 'text-emerald-600' : 'text-ink-700',
                          )}
                        >
                          {ev.kind === 'payment' ? `+${fm(ev.payment.amount)}` : fm(car.price)}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                        <Calendar size={11} />
                        {formatDate(ev.date, lang)}
                        {ev.kind === 'payment' && ` · ${ev.time}`}
                        {ev.kind === 'payment' && ev.payment.description
                          ? ` · ${ev.payment.description}`
                          : ''}
                        {ev.kind === 'payment' && ` · ${t('by')} ${ev.payment.createdBy}`}
                        {ev.kind === 'car' && data.container ? ` · ${data.container.name}` : ''}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            ))}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
