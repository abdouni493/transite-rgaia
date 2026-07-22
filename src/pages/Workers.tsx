import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Briefcase,
  Calendar,
  CalendarX,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  History,
  IdCard,
  KeyRound,
  ListChecks,
  Lock,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  payrollsOfWorker,
  pendingAbsences,
  pendingAdvances,
  roleName,
} from '../lib/selectors';
import {
  addDays,
  daysBetween,
  diffYMD,
  formatDate,
  formatMoney,
  formatMoneyShort,
  monthsBetween,
  norm,
  toISO,
  todayISO,
} from '../lib/format';
import { PAGE_ACTIONS } from '../lib/types';
import type { TranslationKey } from '../i18n/translations';
import type {
  ActionDef,
  ID,
  PageKey,
  Permissions,
  SalaryMode,
  Worker,
} from '../lib/types';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  PasswordInput,
  SearchBar,
  Select,
  StaggerItem,
  StaggerList,
  Textarea,
  Toggle,
  cx,
} from '../components/ui/primitives';
import { Modal, Tabs, useConfirm, useToast } from '../components/ui/overlays';
import {
  DataPoint,
  FilterPills,
  PageHeader,
  ResultCount,
  StatCard,
} from '../components/shared';
import { collapseVariants } from '../components/ui/motion';

type Filter = 'all' | 'active' | 'inactive' | 'account' | 'salary';

/** Preset avatar gradients for freshly created workers. */
const AVATAR_GRADIENTS = [
  'from-brand-900 to-ocean-400',
  'from-brand-700 to-brand-400',
  'from-ocean-700 to-ocean-300',
  'from-brand-800 to-ocean-500',
  'from-ocean-800 to-brand-400',
  'from-brand-950 to-brand-500',
  'from-ocean-600 to-ocean-200',
];

/** Daily salaries are annualised on this many worked days for the payroll-cost KPI. */
const WORK_DAYS_PER_MONTH = 26;

const pickGradient = () => AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];

const lastDayOfMonth = (monthKeyStr: string) => {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return toISO(new Date(y, m, 0));
};

/* ============================================================
   Page
   ============================================================ */

export function Workers() {
  const { t, lang } = useI18n();
  const { state, can, addWorker, updateWorker, deleteWorker } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);

  const [detailId, setDetailId] = useState<ID | null>(null);
  const [permsId, setPermsId] = useState<ID | null>(null);
  const [advId, setAdvId] = useState<ID | null>(null);
  const [absId, setAbsId] = useState<ID | null>(null);
  const [payId, setPayId] = useState<ID | null>(null);

  /* ---------- enriched rows ---------- */
  const today = todayISO();

  const rows = useMemo(
    () =>
      state.workers.map((w) => ({
        worker: w,
        role: roleName(state, w.roleId),
        seniority: diffYMD(w.startDate, today),
        monthlyCost: w.salary.enabled
          ? w.salary.mode === 'monthly'
            ? w.salary.amount
            : w.salary.amount * WORK_DAYS_PER_MONTH
          : 0,
      })),
    [state, today],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.worker.active).length,
      inactive: rows.filter((r) => !r.worker.active).length,
      account: rows.filter((r) => r.worker.account.enabled).length,
      salary: rows.filter((r) => r.worker.salary.enabled).length,
    }),
    [rows],
  );

  const salaryMass = useMemo(() => rows.reduce((a, r) => a + r.monthlyCost, 0), [rows]);

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => {
        if (filter === 'active') return r.worker.active;
        if (filter === 'inactive') return !r.worker.active;
        if (filter === 'account') return r.worker.account.enabled;
        if (filter === 'salary') return r.worker.salary.enabled;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return (
          norm(r.worker.fullName).includes(q) ||
          norm(r.role).includes(q) ||
          norm(r.worker.phone).includes(q) ||
          r.worker.phone.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
        );
      })
      .sort(
        (a, b) =>
          Number(b.worker.active) - Number(a.worker.active) ||
          a.worker.fullName.localeCompare(b.worker.fullName),
      );
  }, [rows, query, filter]);

  /* ---------- actions ---------- */
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (w: Worker) => {
    setEditing(w);
    setFormOpen(true);
  };

  const handleDelete = async (w: Worker) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{w.fullName}</p>
          <p className="mt-1">{t('deleteWorkerWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteWorker(w.id);
    setDetailId(null);
    toast.success(t('workerDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<Users size={24} />}
        title={t('workers')}
        subtitle={t('workersSubtitle')}
        actions={
          can('workers', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newWorker')}
            </Button>
          )
        }
      />

      {/* summary */}
      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('workers')}
            value={counts.all}
            icon={<Users size={20} />}
            tone="violet"
            hint={`${counts.active} ${t('active').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('salaried')}
            value={counts.salary}
            icon={<Banknote size={20} />}
            tone="emerald"
            hint={`${counts.all - counts.salary} ${t('notSalaried').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('withAccount')}
            value={counts.account}
            icon={<KeyRound size={20} />}
            tone="ocean"
            hint={t('accountAccess')}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalSalaryCost')}
            value={salaryMass}
            format={fms}
            icon={<Wallet size={20} />}
            tone="brand"
            hint={t('perMonth')}
          />
        </StaggerItem>
      </StaggerList>

      {/* toolbar */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchWorkerPlaceholder')}
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
              { value: 'account', label: t('withAccount'), count: counts.account, tone: 'ocean' },
              { value: 'salary', label: t('salaried'), count: counts.salary, tone: 'violet' },
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
            icon={<Users size={28} />}
            title={t('noResults')}
            hint={t('noResultsHint')}
            action={
              can('workers', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newWorker')}
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
                key={r.worker.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <WorkerCard
                  worker={r.worker}
                  role={r.role}
                  seniority={r.seniority}
                  onView={can('workers', 'view') ? () => setDetailId(r.worker.id) : undefined}
                  onEdit={can('workers', 'edit') ? () => openEdit(r.worker) : undefined}
                  onDelete={can('workers', 'delete') ? () => handleDelete(r.worker) : undefined}
                  onPermissions={
                    can('workers', 'permissions') ? () => setPermsId(r.worker.id) : undefined
                  }
                  onAdvances={can('workers', 'advances') ? () => setAdvId(r.worker.id) : undefined}
                  onAbsences={can('workers', 'absences') ? () => setAbsId(r.worker.id) : undefined}
                  onPayroll={can('workers', 'payroll') ? () => setPayId(r.worker.id) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* dialogs */}
      <WorkerForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            updateWorker(editing.id, data);
            toast.success(t('workerUpdated'));
          } else {
            addWorker(data);
            toast.success(t('workerCreated'));
          }
          setFormOpen(false);
        }}
      />

      <WorkerDetail
        workerId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={
          can('workers', 'edit')
            ? (w) => {
                setDetailId(null);
                openEdit(w);
              }
            : undefined
        }
        onPayroll={
          can('workers', 'payroll')
            ? (w) => {
                setDetailId(null);
                setPayId(w.id);
              }
            : undefined
        }
      />

      <PermissionsDialog workerId={permsId} onClose={() => setPermsId(null)} />
      <LedgerDialog kind="advance" workerId={advId} onClose={() => setAdvId(null)} />
      <LedgerDialog kind="absence" workerId={absId} onClose={() => setAbsId(null)} />
      <PayrollDialog workerId={payId} onClose={() => setPayId(null)} />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function WorkerCard({
  worker,
  role,
  seniority,
  onView,
  onEdit,
  onDelete,
  onPermissions,
  onAdvances,
  onAbsences,
  onPayroll,
}: {
  worker: Worker;
  role: string;
  seniority: { years: number; months: number; days: number };
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPermissions?: () => void;
  onAdvances?: () => void;
  onAbsences?: () => void;
  onPayroll?: () => void;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="relative flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <Avatar name={worker.fullName} gradient={worker.avatarColor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{worker.fullName}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-semibold text-brand-700">
            <Briefcase size={12} className="shrink-0" />
            <span className="truncate">{role}</span>
          </p>
        </div>
        <span
          className={cx(
            'chip shrink-0',
            worker.active
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-ink-100 text-ink-500 ring-1 ring-ink-200',
          )}
        >
          {worker.active ? t('active') : t('inactive')}
        </span>
      </div>

      {/* body */}
      <div className="flex-1 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
          <Phone size={13} className="shrink-0" />
          <span dir="ltr" className="tabular-nums">
            {worker.phone}
          </span>
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint
            label={t('startWorkDate')}
            value={formatDate(worker.startDate, lang)}
            icon={<Calendar size={11} />}
          />
          <DataPoint
            label={t('seniority')}
            value={`${seniority.years} ${t('years')} · ${seniority.months} ${t('months')}`}
            icon={<Clock size={11} />}
          />
        </div>

        <div className="grid gap-2">
          <div
            className={cx(
              'flex items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1',
              worker.salary.enabled
                ? 'bg-emerald-50/70 ring-emerald-200/70'
                : 'bg-ink-50 ring-ink-200/70',
            )}
          >
            <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-500">
              <Banknote size={12} />
              {t('salaryInfo')}
            </span>
            <span
              className={cx(
                'truncate text-[13px] font-extrabold tabular-nums',
                worker.salary.enabled ? 'text-emerald-700' : 'text-ink-400',
              )}
            >
              {worker.salary.enabled
                ? `${fm(worker.salary.amount)} ${
                    worker.salary.mode === 'monthly' ? t('perMonth') : t('perDay')
                  }`
                : t('notSalaried')}
            </span>
          </div>

          <div
            className={cx(
              'flex items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1',
              worker.account.enabled
                ? 'bg-ocean-50/70 ring-ocean-200/70'
                : 'bg-ink-50 ring-ink-200/70',
            )}
          >
            <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-500">
              <KeyRound size={12} />
              {t('accountAccess')}
            </span>
            <span
              className={cx(
                'flex items-center gap-1.5 truncate text-[13px] font-bold',
                worker.account.enabled ? 'text-ocean-700' : 'text-ink-400',
              )}
            >
              {worker.account.enabled ? <BadgeCheck size={14} /> : <Lock size={14} />}
              {worker.account.enabled ? t('loginEnabled') : t('loginDisabled')}
            </span>
          </div>
        </div>
      </div>

      {/* actions — every one the viewer is allowed to use is on the card,
          labelled. Nothing hides behind a "…" menu. */}
      <div className="border-t border-ink-100 bg-ink-50/60 p-3">
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
          {t('actions')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {onView && (
            <Button size="sm" variant="soft" icon={<Eye size={15} />} onClick={onView}>
              {t('view')}
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="secondary" icon={<Pencil size={15} />} onClick={onEdit}>
              {t('edit')}
            </Button>
          )}
          {onPermissions && (
            <Button
              size="sm"
              variant="secondary"
              icon={<ShieldCheck size={15} />}
              onClick={onPermissions}
            >
              {t('permissions')}
            </Button>
          )}
          {onAdvances && (
            <Button size="sm" variant="secondary" icon={<Banknote size={15} />} onClick={onAdvances}>
              {t('advances')}
            </Button>
          )}
          {onAbsences && (
            <Button size="sm" variant="secondary" icon={<CalendarX size={15} />} onClick={onAbsences}>
              {t('absences')}
            </Button>
          )}
          {onPayroll && (
            <Button size="sm" variant="success" icon={<CreditCard size={15} />} onClick={onPayroll}>
              {t('payment')}
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={onDelete}
              className="col-span-2"
            >
              {t('delete')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   Create / edit form
   ============================================================ */

interface WorkerFormState {
  fullName: string;
  birthday: string;
  idCardNumber: string;
  phone: string;
  startDate: string;
  roleId: string;
  salaryEnabled: boolean;
  salaryMode: SalaryMode;
  salaryAmount: string;
  accountEnabled: boolean;
  email: string;
  username: string;
  password: string;
  active: boolean;
}

const emptyForm = (roleId: string): WorkerFormState => ({
  fullName: '',
  birthday: '',
  idCardNumber: '',
  phone: '',
  startDate: todayISO(),
  roleId,
  salaryEnabled: true,
  salaryMode: 'monthly',
  salaryAmount: '',
  accountEnabled: false,
  email: '',
  username: '',
  password: '',
  active: true,
});

function FormSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white p-4">
      <div className="mb-3.5 flex items-start gap-2.5 border-b border-ink-100 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-grad-brand-soft text-brand-600 ring-1 ring-brand-100">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-ink-900">{title}</h3>
          {hint && <p className="text-xs text-ink-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function WorkerForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Worker | null;
  onClose: () => void;
  onSave: (data: Omit<Worker, 'id' | 'createdAt'>) => void;
}) {
  const { t } = useI18n();
  const { state, can, addRole } = useStore();
  const toast = useToast();

  const firstRole = state.roles[0]?.id ?? '';
  const [form, setForm] = useState<WorkerFormState>(() => emptyForm(firstRole));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState('');

  const target = editing?.id ?? (open ? '__new__' : null);
  if (target !== seed) {
    setSeed(target);
    setErrors({});
    setRoleFormOpen(false);
    setRoleDraft('');
    setForm(
      editing
        ? {
            fullName: editing.fullName,
            birthday: editing.birthday,
            idCardNumber: editing.idCardNumber ?? '',
            phone: editing.phone,
            startDate: editing.startDate,
            roleId: editing.roleId,
            salaryEnabled: editing.salary.enabled,
            salaryMode: editing.salary.mode,
            salaryAmount: editing.salary.amount ? String(editing.salary.amount) : '',
            accountEnabled: editing.account.enabled,
            email: editing.account.email,
            username: editing.account.username,
            password: editing.account.password,
            active: editing.active,
          }
        : emptyForm(firstRole),
    );
  }

  const createRole = () => {
    const name = roleDraft.trim();
    if (!name) return;
    const role = addRole(name);
    setForm((f) => ({ ...f, roleId: role.id }));
    setRoleDraft('');
    setRoleFormOpen(false);
    toast.success(t('roleCreated'));
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = t('requiredField');
    if (!form.birthday) errs.birthday = t('requiredField');
    if (!form.phone.trim()) errs.phone = t('requiredField');
    if (!form.startDate) errs.startDate = t('requiredField');
    if (!form.roleId) errs.roleId = t('requiredField');

    const amount = Number(form.salaryAmount.replace(/\s/g, ''));
    if (form.salaryEnabled && (!form.salaryAmount.trim() || Number.isNaN(amount) || amount <= 0))
      errs.salaryAmount = t('invalidNumber');

    if (form.accountEnabled) {
      if (!form.email.trim()) errs.email = t('requiredField');
      if (!form.username.trim()) errs.username = t('requiredField');
      if (!form.password.trim()) errs.password = t('requiredField');
    }

    setErrors(errs);
    if (Object.keys(errs).length) return;

    onSave({
      fullName: form.fullName.trim(),
      birthday: form.birthday,
      idCardNumber: form.idCardNumber.trim() || undefined,
      phone: form.phone.trim(),
      roleId: form.roleId,
      startDate: form.startDate,
      salary: {
        enabled: form.salaryEnabled,
        mode: form.salaryMode,
        amount: form.salaryEnabled ? amount : 0,
      },
      account: {
        enabled: form.accountEnabled,
        email: form.accountEnabled ? form.email.trim() : '',
        username: form.accountEnabled ? form.username.trim() : '',
        password: form.accountEnabled ? form.password : '',
      },
      // A new worker starts with their role but NO permissions — granted afterwards.
      permissions: editing ? editing.permissions : {},
      active: editing ? form.active : true,
      avatarColor: editing?.avatarColor ?? pickGradient(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editWorker') : t('newWorker')}
      subtitle={t('workersSubtitle')}
      icon={<UserRound size={20} />}
      size="lg"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" block onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button block onClick={() => submit()} icon={<Plus size={16} />}>
            {editing ? t('saveChanges') : t('create')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* --- identity --- */}
        <FormSection icon={<IdCard size={16} />} title={t('identityInfo')} hint={t('personalInfo')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('fullName')}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              error={errors.fullName}
              icon={<UserRound size={16} />}
              wrapClassName="sm:col-span-2"
              required
            />
            <Input
              label={t('birthday')}
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              error={errors.birthday}
              required
            />
            <Input
              label={`${t('idCardNumber')} (${t('optional')})`}
              value={form.idCardNumber}
              onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })}
            />
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
            <Input
              label={t('startWorkDate')}
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              error={errors.startDate}
              required
            />
          </div>
        </FormSection>

        {/* --- role --- */}
        <FormSection icon={<Briefcase size={16} />} title={t('role')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label={t('role')}
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              error={errors.roleId}
              options={state.roles.map((r) => ({ value: r.id, label: r.name }))}
              className="w-full"
              required
            />
            {can('workers', 'manageRoles') && (
              <Button
                type="button"
                variant="secondary"
                icon={<Plus size={16} />}
                onClick={() => setRoleFormOpen((v) => !v)}
                className="shrink-0"
              >
                {t('createRole')}
              </Button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {roleFormOpen && (
              <motion.div
                variants={collapseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-3 sm:flex-row sm:items-end">
                  <Input
                    label={t('roleName')}
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createRole();
                      }
                    }}
                    wrapClassName="flex-1"
                    placeholder={t('newRole')}
                  />
                  <Button type="button" onClick={createRole} icon={<Plus size={16} />} className="shrink-0">
                    {t('create')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        {/* --- payment --- */}
        <FormSection icon={<Banknote size={16} />} title={t('paymentInfoSection')}>
          <Toggle
            checked={form.salaryEnabled}
            onChange={(v) => setForm({ ...form, salaryEnabled: v })}
            label={t('salaryEnabled')}
            hint={t('salaryInfo')}
          />
          <AnimatePresence initial={false}>
            {form.salaryEnabled && (
              <motion.div
                variants={collapseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="overflow-hidden"
              >
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  <Select
                    label={t('salaryMode')}
                    value={form.salaryMode}
                    onChange={(e) =>
                      setForm({ ...form, salaryMode: e.target.value as SalaryMode })
                    }
                    options={[
                      { value: 'monthly', label: t('monthly') },
                      { value: 'daily', label: t('daily') },
                    ]}
                  />
                  <Input
                    label={t('salaryAmount')}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.salaryAmount}
                    onChange={(e) => setForm({ ...form, salaryAmount: e.target.value })}
                    error={errors.salaryAmount}
                    suffix={form.salaryMode === 'monthly' ? t('perMonth') : t('perDay')}
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        {/* --- account --- */}
        <FormSection icon={<KeyRound size={16} />} title={t('accountAccess')}>
          <Toggle
            checked={form.accountEnabled}
            onChange={(v) => setForm({ ...form, accountEnabled: v })}
            label={t('accountEnabled')}
            hint={t('permissionsSubtitle')}
          />
          <AnimatePresence initial={false}>
            {form.accountEnabled && (
              <motion.div
                variants={collapseVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="overflow-hidden"
              >
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  <Input
                    label={t('email')}
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={errors.email}
                    required
                  />
                  <Input
                    label={t('username')}
                    dir="ltr"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    error={errors.username}
                    required
                  />
                  <div className="sm:col-span-2">
                    <PasswordInput
                      label={t('password')}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      error={errors.password}
                      showLabel={t('showPassword')}
                      hideLabel={t('hidePassword')}
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </FormSection>

        {editing && (
          <FormSection icon={<BadgeCheck size={16} />} title={t('status')}>
            <Toggle
              checked={form.active}
              onChange={(v) => setForm({ ...form, active: v })}
              label={t('active')}
              hint={t('accountAccess')}
            />
          </FormSection>
        )}
      </form>
    </Modal>
  );
}

/* ============================================================
   Permissions dialog — two panes
   ============================================================ */

function PermissionsDialog({ workerId, onClose }: { workerId: ID | null; onClose: () => void }) {
  const { t } = useI18n();
  const { state, setWorkerPermissions } = useStore();
  const toast = useToast();

  const worker = state.workers.find((w) => w.id === workerId) ?? null;

  const [perms, setPerms] = useState<Permissions>({});
  const [selected, setSelected] = useState<PageKey>(PAGE_ACTIONS[0].key);
  const [seed, setSeed] = useState<ID | null>(null);

  if (workerId && seed !== workerId) {
    setSeed(workerId);
    setSelected(PAGE_ACTIONS[0].key);
    const src = worker?.permissions ?? {};
    const copy: Permissions = {};
    for (const k of Object.keys(src) as PageKey[]) copy[k] = [...(src[k] ?? [])];
    setPerms(copy);
  }

  if (!worker) return null;

  const page = PAGE_ACTIONS.find((p) => p.key === selected) ?? PAGE_ACTIONS[0];
  const granted = perms[selected] ?? [];
  const standard = page.actions.filter((a) => !a.sensitive);
  const sensitive = page.actions.filter((a) => a.sensitive);

  const togglePage = (key: PageKey, on: boolean) => {
    setPerms((p) => {
      const next = { ...p };
      if (on) next[key] = next[key] ?? [];
      else delete next[key];
      return next;
    });
  };

  const toggleAction = (key: PageKey, action: string, on: boolean) => {
    setPerms((p) => {
      const cur = p[key] ?? [];
      const list = on ? [...new Set([...cur, action])] : cur.filter((a) => a !== action);
      return { ...p, [key]: list };
    });
  };

  const setAll = (on: boolean) => {
    setPerms((p) => ({
      ...p,
      [selected]: on ? page.actions.map((a) => a.key) : [],
    }));
  };

  const pageCount = Object.keys(perms).length;
  const actionCount = Object.values(perms).reduce((a, v) => a + (v?.length ?? 0), 0);

  const renderAction = (a: ActionDef) => (
    <Checkbox
      key={a.key}
      checked={granted.includes(a.key)}
      onChange={(v) => toggleAction(selected, a.key, v)}
      tone={a.sensitive ? 'rose' : 'brand'}
      label={
        <span className="flex flex-wrap items-center gap-1.5">
          {t(`act_${a.key}` as TranslationKey)}
          {a.sensitive && (
            <span className="chip bg-rose-50 text-rose-700 ring-1 ring-rose-200">
              <AlertTriangle size={11} />
              {t('sensitiveAction')}
            </span>
          )}
        </span>
      }
    />
  );

  return (
    <Modal
      open={!!workerId}
      onClose={onClose}
      size="xl"
      icon={<ShieldCheck size={20} />}
      title={t('permissions')}
      subtitle={`${worker.fullName} · ${t('permissionsCount', { count: pageCount, actions: actionCount })}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">{t('permissionsSubtitle')}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              icon={<ShieldCheck size={15} />}
              onClick={() => {
                setWorkerPermissions(worker.id, perms);
                toast.success(t('permissionsSaved'));
                onClose();
              }}
            >
              {t('save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* ---- LEFT: pages ---- */}
        <div className="rounded-2xl border border-ink-200/80 bg-ink-50/60 p-2.5">
          <p className="px-1.5 pb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
            {t('pagesAccess')}
          </p>
          <div className="space-y-1">
            {PAGE_ACTIONS.map((p) => {
              const on = perms[p.key] !== undefined;
              const n = perms[p.key]?.length ?? 0;
              return (
                <div
                  key={p.key}
                  className={cx(
                    'flex items-center gap-1 rounded-xl border transition-colors duration-200',
                    selected === p.key
                      ? 'border-brand-400 bg-white ring-4 ring-brand-500/10'
                      : 'border-transparent bg-white/70 hover:border-ink-200',
                  )}
                >
                  <Checkbox
                    checked={on}
                    onChange={(v) => togglePage(p.key, v)}
                    label={<span className="sr-only">{t(p.key)}</span>}
                  />
                  <button
                    type="button"
                    onClick={() => setSelected(p.key)}
                    aria-label={t(p.key)}
                    className="min-w-0 flex-1 cursor-pointer rounded-xl px-1 py-2 text-start"
                  >
                    <span className="block truncate text-[13px] font-bold text-ink-800">
                      {t(p.key)}
                    </span>
                    <span className="block truncate text-2xs font-semibold text-ink-400">
                      {on ? `${n} / ${p.actions.length} ${t('grantedActions')}` : t('noPermissions')}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- RIGHT: actions of selected page ---- */}
        <div className="min-w-0 rounded-2xl border border-ink-200/80 bg-white p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-bold text-ink-900">
                {t('actionsFor', { page: t(selected) })}
              </h3>
              <p className="text-xs text-ink-500">{t('selectPageForActions')}</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="xs" variant="secondary" onClick={() => setAll(true)}>
                {t('selectAll')}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setAll(false)}>
                {t('deselectAll')}
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selected}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              {standard.length > 0 && (
                <div className="rounded-xl bg-ink-50/70 p-1.5 ring-1 ring-ink-200/60">
                  <p className="flex items-center gap-1.5 px-2 py-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                    <ListChecks size={12} />
                    {t('standardActions')}
                  </p>
                  {standard.map(renderAction)}
                </div>
              )}

              {sensitive.length > 0 && (
                <div className="rounded-xl bg-rose-50/60 p-1.5 ring-1 ring-rose-200/70">
                  <p className="flex items-center gap-1.5 px-2 py-1.5 text-2xs font-bold uppercase tracking-wide text-rose-600">
                    <AlertTriangle size={12} />
                    {t('sensitiveActions')}
                  </p>
                  <p className="px-2 pb-1.5 text-xs font-medium text-rose-700/80">
                    {t('sensitiveWarning')}
                  </p>
                  {sensitive.map(renderAction)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Advances / absences ledger dialog
   ============================================================ */

function LedgerDialog({
  kind,
  workerId,
  onClose,
}: {
  kind: 'advance' | 'absence';
  workerId: ID | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const { state, addAdvance, addAbsence, deleteAdvance, deleteAbsence } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const isAdvance = kind === 'advance';

  const worker = state.workers.find((w) => w.id === workerId) ?? null;

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const items = useMemo(() => {
    if (!workerId) return [];
    const src = isAdvance
      ? state.advances
          .filter((a) => a.workerId === workerId)
          .map((a) => ({ id: a.id, date: a.date, value: a.amount, description: a.description, settled: a.settled }))
      : state.absences
          .filter((a) => a.workerId === workerId)
          .map((a) => ({ id: a.id, date: a.date, value: a.cost, description: a.description, settled: a.settled }));
    return src.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.advances, state.absences, workerId, isAdvance]);

  const seedKey = workerId ? `${kind}-${workerId}` : null;
  if (seedKey && seed !== seedKey) {
    setSeed(seedKey);
    setDate(todayISO());
    setAmount('');
    setDescription('');
    setErrors({});
  }

  if (!worker) return null;

  const totals = items.reduce(
    (acc, i) => ({
      total: acc.total + i.value,
      pending: acc.pending + (i.settled ? 0 : i.value),
    }),
    { total: 0, pending: 0 },
  );

  const submit = () => {
    const numeric = Number(amount.replace(/\s/g, ''));
    const errs: Record<string, string> = {};
    if (!date) errs.date = t('requiredField');
    if (!amount.trim() || Number.isNaN(numeric) || numeric <= 0) errs.amount = t('invalidNumber');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (isAdvance) {
      addAdvance({
        workerId: worker.id,
        date,
        amount: numeric,
        description: description.trim() || undefined,
      });
      toast.success(t('advanceAdded'));
    } else {
      addAbsence({
        workerId: worker.id,
        date,
        cost: numeric,
        description: description.trim() || undefined,
      });
      toast.success(t('absenceAdded'));
    }
    setAmount('');
    setDescription('');
  };

  const remove = async (id: ID) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: t('deleteWarning'),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    if (isAdvance) {
      deleteAdvance(id);
      toast.success(t('advanceDeleted'));
    } else {
      deleteAbsence(id);
      toast.success(t('absenceDeleted'));
    }
  };

  return (
    <Modal
      open={!!workerId}
      onClose={onClose}
      size="lg"
      icon={isAdvance ? <Banknote size={20} /> : <CalendarX size={20} />}
      title={isAdvance ? t('advances') : t('absences')}
      subtitle={worker.fullName}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('pending')}:{' '}
            <span className="font-extrabold tabular-nums text-rose-600">{fm(totals.pending)}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      {/* add form */}
      <div className="mb-4 rounded-2xl border border-ink-200/80 bg-ink-50/60 p-3.5">
        <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-800">
          <Plus size={15} className="text-brand-600" />
          {isAdvance ? t('newAdvance') : t('newAbsence')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            required
          />
          <Input
            label={isAdvance ? t('amount') : t('absenceCost')}
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            suffix={cur}
            required
          />
          <div className="sm:col-span-2">
            <Textarea
              label={`${t('description')} (${t('optional')})`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" icon={<Plus size={15} />} onClick={submit}>
            {isAdvance ? t('addAdvance') : t('addAbsence')}
          </Button>
        </div>
      </div>

      {/* list */}
      {items.length === 0 ? (
        <EmptyState
          icon={isAdvance ? <Banknote size={26} /> : <CalendarX size={26} />}
          title={isAdvance ? t('noAdvances') : t('noAbsences')}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {items.map((i) => (
              <motion.div
                key={i.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 rounded-xl border border-ink-200/80 bg-white p-3"
              >
                <span
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    i.settled ? 'bg-ink-100 text-ink-400' : 'bg-grad-sun text-white',
                  )}
                >
                  {isAdvance ? <Banknote size={16} /> : <CalendarX size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink-900">
                    {formatDate(i.date, lang)}
                    <span
                      className={cx(
                        'chip',
                        i.settled
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                      )}
                    >
                      {i.settled ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      {i.settled ? t('settled') : t('pending')}
                    </span>
                  </p>
                  <p className="truncate text-xs text-ink-500">{i.description || '—'}</p>
                </div>
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-rose-600">
                  −{fm(i.value)}
                </span>
                <IconButton
                  label={t('delete')}
                  variant="secondary"
                  onClick={() => remove(i.id)}
                  className="!text-rose-600 hover:!border-rose-300 hover:!bg-rose-50"
                >
                  <Trash2 size={15} />
                </IconButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Payroll dialog — the calculation screen
   ============================================================ */

function PayrollDialog({ workerId, onClose }: { workerId: ID | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { state, can, addPayroll, deletePayroll } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const worker = state.workers.find((w) => w.id === workerId) ?? null;

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [net, setNet] = useState('');
  const [seed, setSeed] = useState<ID | null>(null);

  const calc = useMemo(() => {
    if (!worker || !worker.salary.enabled) return null;
    const today = todayISO();
    const runs = payrollsOfWorker(state, worker.id);
    const advs = pendingAdvances(state, worker.id);
    const abss = pendingAbsences(state, worker.id);
    const advTotal = advs.reduce((a, x) => a + x.amount, 0);
    const absTotal = abss.reduce((a, x) => a + x.cost, 0);

    if (worker.salary.mode === 'monthly') {
      const all = monthsBetween(worker.startDate, today);
      const unpaidMonths = all.filter((m) => !runs.some((r) => r.periodLabel.includes(m)));
      const base = unpaidMonths.length * worker.salary.amount;
      return {
        mode: 'monthly' as const,
        units: unpaidMonths.length,
        unpaidMonths,
        base,
        advs,
        abss,
        advTotal,
        absTotal,
        net: base - advTotal - absTotal,
        periodLabel: unpaidMonths.length ? unpaidMonths.join(', ') : today.slice(0, 7),
        periodStart: unpaidMonths.length ? `${unpaidMonths[0]}-01` : today,
        periodEnd: unpaidMonths.length
          ? lastDayOfMonth(unpaidMonths[unpaidMonths.length - 1])
          : today,
      };
    }

    const lastEnd = runs.reduce((max, r) => (r.periodEnd > max ? r.periodEnd : max), '');
    const from = lastEnd ? addDays(lastEnd, 1) : worker.startDate;
    const days = daysBetween(from, today);
    const base = days * worker.salary.amount;
    return {
      mode: 'daily' as const,
      units: days,
      unpaidMonths: [] as string[],
      base,
      advs,
      abss,
      advTotal,
      absTotal,
      net: base - advTotal - absTotal,
      periodLabel: `${from} → ${today}`,
      periodStart: from,
      periodEnd: today,
    };
  }, [state, worker]);

  if (workerId && seed !== workerId) {
    setSeed(workerId);
    setDate(todayISO());
    setDescription('');
    setNet(calc ? String(Math.round(calc.net)) : '');
  }

  if (!worker) return null;

  const history = payrollsOfWorker(state, worker.id);
  const numericNet = Number(net.replace(/\s/g, ''));
  const edited = !!calc && numericNet !== Math.round(calc.net);
  const nothingToPay = !calc || (calc.units === 0 && calc.advTotal === 0 && calc.absTotal === 0);

  const submit = () => {
    if (!calc) return;
    addPayroll({
      workerId: worker.id,
      periodLabel: calc.periodLabel,
      periodStart: calc.periodStart,
      periodEnd: calc.periodEnd,
      baseAmount: calc.base,
      advancesDeducted: calc.advTotal,
      absencesDeducted: calc.absTotal,
      netAmount: Number.isNaN(numericNet) ? Math.round(calc.net) : numericNet,
      date,
      description: description.trim() || undefined,
      advanceIds: calc.advs.map((a) => a.id),
      absenceIds: calc.abss.map((a) => a.id),
    });
    toast.success(t('payrollDone'));
    onClose();
  };

  const removeRun = async (id: ID) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: t('deleteWarning'),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deletePayroll(id);
    toast.success(t('payrollDeleted'));
  };

  return (
    <Modal
      open={!!workerId}
      onClose={onClose}
      size="xl"
      icon={<CreditCard size={20} />}
      title={t('payrollTitle')}
      subtitle={worker.fullName}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('netToPay')}:{' '}
            <span className="text-sm font-extrabold tabular-nums text-emerald-700">
              {fm(Number.isNaN(numericNet) ? 0 : numericNet)}
            </span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            {calc && (
              <Button
                size="sm"
                variant="success"
                icon={<CreditCard size={15} />}
                onClick={submit}
                disabled={nothingToPay}
              >
                {t('payNow')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {!calc ? (
        <EmptyState icon={<Banknote size={26} />} title={t('salaryDisabled')} hint={t('salaryInfo')} />
      ) : (
        <div className="space-y-4">
          {/* periods */}
          <section className="rounded-2xl border border-ink-200/80 bg-white p-3.5">
            <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink-900">
              <Calendar size={15} className="text-brand-600" />
              {calc.mode === 'monthly' ? t('unpaidPeriods') : t('unpaidDays')}
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                {calc.units}
              </span>
            </h3>
            {calc.units === 0 ? (
              <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs font-semibold text-ink-500">
                {t('noUnpaidPeriods')}
              </p>
            ) : calc.mode === 'monthly' ? (
              <div className="flex flex-wrap gap-1.5">
                {calc.unpaidMonths.map((m) => (
                  <span
                    key={m}
                    className="chip bg-ocean-50 text-ocean-700 ring-1 ring-ocean-200 tabular-nums"
                  >
                    <Calendar size={11} />
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <DataPoint label={t('from')} value={formatDate(calc.periodStart, lang)} />
                <DataPoint label={t('to')} value={formatDate(calc.periodEnd, lang)} />
                <DataPoint label={t('unpaidDays')} value={`${calc.units} ${t('days')}`} />
              </div>
            )}
          </section>

          {/* deductions */}
          <div className="grid gap-4 lg:grid-cols-2">
            <DeductionList
              title={t('pendingAdvances')}
              icon={<Banknote size={15} />}
              total={calc.advTotal}
              items={calc.advs.map((a) => ({
                id: a.id,
                date: a.date,
                label: a.description || t('advance'),
                value: a.amount,
              }))}
            />
            <DeductionList
              title={t('pendingAbsences')}
              icon={<CalendarX size={15} />}
              total={calc.absTotal}
              items={calc.abss.map((a) => ({
                id: a.id,
                date: a.date,
                label: a.description || t('absence'),
                value: a.cost,
              }))}
            />
          </div>

          {/* calculation panel */}
          <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900">
              <Wallet size={15} className="text-emerald-600" />
              {t('calculationDetail')}
            </h3>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 py-1.5">
                <dt className="font-semibold text-ink-600">
                  {t('baseAmount')} · {calc.units} ×{' '}
                  {fm(worker.salary.amount)}
                </dt>
                <dd className="font-extrabold tabular-nums text-ink-900">{fm(calc.base)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 py-1.5">
                <dt className="font-semibold text-ink-600">− {t('advances')}</dt>
                <dd className="font-extrabold tabular-nums text-rose-600">−{fm(calc.advTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 py-1.5">
                <dt className="font-semibold text-ink-600">− {t('absences')}</dt>
                <dd className="font-extrabold tabular-nums text-rose-600">−{fm(calc.absTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <dt className="text-sm font-extrabold text-ink-900">= {t('computedNet')}</dt>
                <dd className="text-base font-extrabold tabular-nums text-emerald-700">
                  {fm(calc.net)}
                </dd>
              </div>
            </dl>
          </section>

          {/* editable net + date */}
          <section className="rounded-2xl border border-ink-200/80 bg-white p-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label={t('netToPay')}
                  type="number"
                  inputMode="numeric"
                  value={net}
                  onChange={(e) => setNet(e.target.value)}
                  suffix={cur}
                  hint={edited ? t('netEdited') : t('editManually')}
                />
                {edited && (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<RotateCcw size={13} />}
                    onClick={() => setNet(String(Math.round(calc.net)))}
                    className="mt-1.5"
                  >
                    {t('resetToComputed')}
                  </Button>
                )}
              </div>
              <Input
                label={t('date')}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <div className="sm:col-span-2">
                <Textarea
                  label={`${t('description')} (${t('optional')})`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </section>

          {/* history */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink-900">
              <History size={15} className="text-brand-600" />
              {t('payrollHistory')}
              <span className="chip bg-ink-100 text-ink-600 ring-1 ring-ink-200">
                {history.length}
              </span>
            </h3>
            {history.length === 0 ? (
              <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs font-semibold text-ink-500">
                {t('noPayrolls')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink-200/80">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                      <th className="px-4 py-2.5 text-start font-bold">{t('date')}</th>
                      <th className="px-4 py-2.5 text-start font-bold">{t('period')}</th>
                      <th className="px-4 py-2.5 text-end font-bold">{t('baseAmount')}</th>
                      <th className="px-4 py-2.5 text-end font-bold">{t('deductions')}</th>
                      <th className="px-4 py-2.5 text-end font-bold">{t('netToPay')}</th>
                      <th className="px-4 py-2.5 text-end font-bold">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {history.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-ink-50/70">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                          {formatDate(r.date, lang)}
                        </td>
                        <td className="max-w-[12rem] truncate px-4 py-2.5 text-xs font-bold text-ink-900">
                          {r.periodLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end text-xs tabular-nums text-ink-700">
                          {fm(r.baseAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end text-xs tabular-nums text-rose-600">
                          −{fm(r.advancesDeducted + r.absencesDeducted)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-emerald-700">
                          {fm(r.netAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          {can('workers', 'payroll') && (
                            <IconButton
                              label={t('delete')}
                              variant="secondary"
                              onClick={() => removeRun(r.id)}
                              className="!text-rose-600 hover:!border-rose-300 hover:!bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function DeductionList({
  title,
  icon,
  items,
  total,
}: {
  title: string;
  icon: ReactNode;
  items: { id: string; date: string; label: string; value: number }[];
  total: number;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white p-3.5">
      <h3 className="mb-2.5 flex items-center justify-between gap-2 text-[13px] font-bold text-ink-900">
        <span className="flex items-center gap-2">
          <span className="text-amber-600">{icon}</span>
          {title}
        </span>
        <span className="font-extrabold tabular-nums text-rose-600">−{fm(total)}</span>
      </h3>
      {items.length === 0 ? (
        <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs font-semibold text-ink-500">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-ink-50/80 px-3 py-2 ring-1 ring-ink-200/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink-800">
                  {i.label}
                </span>
                <span className="block text-2xs tabular-nums text-ink-400">
                  {formatDate(i.date, lang)}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-rose-600">
                −{fm(i.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ============================================================
   Detail dialog — 4 panels
   ============================================================ */

function WorkerDetail({
  workerId,
  onClose,
  onEdit,
  onPayroll,
}: {
  workerId: ID | null;
  onClose: () => void;
  onEdit?: (w: Worker) => void;
  onPayroll?: (w: Worker) => void;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const [tab, setTab] = useState('info');

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);

  const worker = state.workers.find((w) => w.id === workerId) ?? null;

  const data = useMemo(() => {
    if (!worker) return null;
    return {
      advances: state.advances
        .filter((a) => a.workerId === worker.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
      absences: state.absences
        .filter((a) => a.workerId === worker.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
      payrolls: payrollsOfWorker(state, worker.id),
    };
  }, [state, worker]);

  if (!worker || !data) return null;

  const seniority = diffYMD(worker.startDate, todayISO());
  const age = diffYMD(worker.birthday, todayISO());
  const permEntries = (Object.keys(worker.permissions ?? {}) as PageKey[]).sort();
  const historyCount = data.advances.length + data.absences.length + data.payrolls.length;

  const tabs = [
    { key: 'info', label: t('personalInfo'), icon: <UserRound size={15} /> },
    { key: 'salary', label: t('salaryAndAccount'), icon: <Banknote size={15} /> },
    {
      key: 'perms',
      label: t('permissions'),
      icon: <ShieldCheck size={15} />,
      badge: permEntries.length,
    },
    { key: 'history', label: t('history'), icon: <History size={15} />, badge: historyCount },
  ];

  return (
    <Modal
      open={!!workerId}
      onClose={onClose}
      size="xl"
      icon={<UserRound size={20} />}
      title={worker.fullName}
      subtitle={`${roleName(state, worker.roleId)} · ${worker.phone}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {t('createdOn')} {formatDate(worker.createdAt, lang)}
          </span>
          <div className="flex gap-2">
            {onPayroll && worker.salary.enabled && (
              <Button
                size="sm"
                variant="success"
                icon={<CreditCard size={15} />}
                onClick={() => onPayroll(worker)}
              >
                {t('payroll')}
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil size={15} />}
                onClick={() => onEdit(worker)}
              >
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
      <div className="mb-4 flex items-center gap-4 rounded-2xl bg-grad-brand-soft p-4 ring-1 ring-brand-100">
        <Avatar name={worker.fullName} gradient={worker.avatarColor} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-ink-900">{worker.fullName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-500">
            <span className="chip bg-white text-brand-700 ring-1 ring-brand-200">
              <Briefcase size={11} />
              {roleName(state, worker.roleId)}
            </span>
            <span
              className={cx(
                'chip',
                worker.active
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-ink-100 text-ink-500 ring-1 ring-ink-200',
              )}
            >
              {worker.active ? t('active') : t('inactive')}
            </span>
          </p>
        </div>
      </div>

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
              <DataPoint label={t('fullName')} value={worker.fullName} />
              <DataPoint
                label={t('phone')}
                value={<span dir="ltr">{worker.phone}</span>}
                icon={<Phone size={11} />}
              />
              <DataPoint
                label={t('birthday')}
                value={formatDate(worker.birthday, lang)}
                icon={<Calendar size={11} />}
              />
              <DataPoint label={t('age')} value={`${age.years} ${t('years')}`} />
              <DataPoint
                label={t('idCardNumber')}
                value={worker.idCardNumber || '—'}
                icon={<IdCard size={11} />}
                mono
              />
              <DataPoint label={t('role')} value={roleName(state, worker.roleId)} icon={<Briefcase size={11} />} />
              <DataPoint
                label={t('startWorkDate')}
                value={formatDate(worker.startDate, lang)}
                icon={<Calendar size={11} />}
              />
              <DataPoint
                label={t('seniority')}
                value={`${seniority.years} ${t('years')} · ${seniority.months} ${t('months')} · ${seniority.days} ${t('days')}`}
                icon={<Clock size={11} />}
              />
            </div>
          )}

          {/* ---- salary & account ---- */}
          {tab === 'salary' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <DataPoint
                label={t('salaryEnabled')}
                value={worker.salary.enabled ? t('yes') : t('no')}
                icon={<Banknote size={11} />}
              />
              <DataPoint
                label={t('salaryMode')}
                value={worker.salary.enabled ? t(worker.salary.mode) : '—'}
              />
              <DataPoint
                label={t('salaryAmount')}
                value={
                  worker.salary.enabled
                    ? `${fm(worker.salary.amount)} ${
                        worker.salary.mode === 'monthly' ? t('perMonth') : t('perDay')
                      }`
                    : '—'
                }
                className="sm:col-span-2"
              />
              <DataPoint
                label={t('accountEnabled')}
                value={worker.account.enabled ? t('loginEnabled') : t('loginDisabled')}
                icon={<KeyRound size={11} />}
              />
              <DataPoint
                label={t('username')}
                value={worker.account.enabled ? worker.account.username : '—'}
                mono
              />
              <DataPoint
                label={t('email')}
                value={worker.account.enabled ? worker.account.email : '—'}
                className="sm:col-span-2"
                mono
              />
            </div>
          )}

          {/* ---- permissions ---- */}
          {tab === 'perms' &&
            (permEntries.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={26} />} title={t('noPermissions')} />
            ) : (
              <div className="space-y-2.5">
                {permEntries.map((k) => {
                  const acts = worker.permissions[k] ?? [];
                  const defs = PAGE_ACTIONS.find((p) => p.key === k)?.actions ?? [];
                  return (
                    <div key={k} className="rounded-2xl border border-ink-200/80 bg-white p-3.5">
                      <p className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-extrabold text-ink-900">
                        <ShieldCheck size={14} className="text-brand-600" />
                        {t(k)}
                        <span className="chip bg-ink-100 text-ink-600 ring-1 ring-ink-200">
                          {acts.length} {t('grantedActions')}
                        </span>
                      </p>
                      {acts.length === 0 ? (
                        <p className="text-xs text-ink-500">{t('noPermissions')}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {acts.map((a) => {
                            const sensitive = defs.find((d) => d.key === a)?.sensitive;
                            return (
                              <span
                                key={a}
                                className={cx(
                                  'chip',
                                  sensitive
                                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                    : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
                                )}
                              >
                                {sensitive && <AlertTriangle size={11} />}
                                {t(`act_${a}` as TranslationKey)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {/* ---- history ---- */}
          {tab === 'history' &&
            (historyCount === 0 ? (
              <EmptyState icon={<History size={26} />} title={t('empty')} />
            ) : (
              <div className="space-y-4">
                <HistoryBlock
                  title={t('advances')}
                  icon={<Banknote size={15} />}
                  empty={t('noAdvances')}
                  rows={data.advances.map((a) => ({
                    id: a.id,
                    date: a.date,
                    label: a.description || t('advance'),
                    value: -a.amount,
                    settled: a.settled,
                  }))}
                />
                <HistoryBlock
                  title={t('absences')}
                  icon={<CalendarX size={15} />}
                  empty={t('noAbsences')}
                  rows={data.absences.map((a) => ({
                    id: a.id,
                    date: a.date,
                    label: a.description || t('absence'),
                    value: -a.cost,
                    settled: a.settled,
                  }))}
                />
                <HistoryBlock
                  title={t('payrollHistory')}
                  icon={<CreditCard size={15} />}
                  empty={t('noPayrolls')}
                  rows={data.payrolls.map((p) => ({
                    id: p.id,
                    date: p.date,
                    label: p.periodLabel,
                    value: p.netAmount,
                  }))}
                />
              </div>
            ))}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function HistoryBlock({
  title,
  icon,
  empty,
  rows,
}: {
  title: string;
  icon: ReactNode;
  empty: string;
  rows: { id: string; date: string; label: string; value: number; settled?: boolean }[];
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(Math.abs(n), lang, t('currency'));

  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900">
        <span className="text-brand-600">{icon}</span>
        {title}
        <span className="chip bg-ink-100 text-ink-600 ring-1 ring-ink-200">{rows.length}</span>
      </h4>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs font-semibold text-ink-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.24 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-200/80 bg-white px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-ink-900">{r.label}</span>
                <span className="flex items-center gap-1.5 text-2xs font-semibold tabular-nums text-ink-400">
                  <Calendar size={10} />
                  {formatDate(r.date, lang)}
                  {r.settled !== undefined && (
                    <span className={r.settled ? 'text-emerald-600' : 'text-amber-600'}>
                      · {r.settled ? t('settled') : t('pending')}
                    </span>
                  )}
                </span>
              </span>
              <span
                className={cx(
                  'shrink-0 text-[13px] font-extrabold tabular-nums',
                  r.value < 0 ? 'text-rose-600' : 'text-emerald-600',
                )}
              >
                {r.value < 0 ? '−' : '+'}
                {fm(r.value)}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
