/* ============================================================
   Entrepôts — the storage sites cars are parked in.
   One card per site, created and edited from a single dialog.
   ============================================================ */

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  Calendar,
  Car as CarIcon,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { formatDate, norm } from '../lib/format';
import type { Warehouse } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  SearchBar,
  StaggerItem,
  StaggerList,
  Textarea,
} from '../components/ui/primitives';
import { Modal, useConfirm, useToast } from '../components/ui/overlays';
import { DataPoint, PageHeader, ResultCount, StatCard } from '../components/shared';

const EMPTY_FORM = { name: '', address: '', phone: '', email: '', description: '' };

/* ============================================================
   Page
   ============================================================ */

export function Warehouses() {
  const { t } = useI18n();
  const { state, can, addWarehouse, updateWarehouse, deleteWarehouse } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  /* How many cars sit in each site — the number that makes a card worth reading. */
  const carCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of state.secondaryClients) {
      if (!c.warehouseId) continue;
      out.set(c.warehouseId, (out.get(c.warehouseId) ?? 0) + 1);
    }
    return out;
  }, [state.secondaryClients]);

  const visible = useMemo(() => {
    const q = norm(query);
    return state.warehouses
      .filter((w) => {
        if (!q) return true;
        return (
          norm(w.name).includes(q) ||
          norm(w.address).includes(q) ||
          norm(w.phone).includes(q) ||
          norm(w.email).includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.warehouses, query]);

  const storedCars = useMemo(
    () => state.secondaryClients.filter((c) => c.warehouseId).length,
    [state.secondaryClients],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setFormOpen(true);
  };

  const handleDelete = async (w: Warehouse) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{w.name}</p>
          <p className="mt-1">{t('deleteWarehouseWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteWarehouse(w.id);
    toast.success(t('warehouseDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<WarehouseIcon size={24} />}
        title={t('warehouses')}
        subtitle={t('warehousesSubtitle')}
        actions={
          can('warehouses', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newWarehouse')}
            </Button>
          )
        }
      />

      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
        <StaggerItem>
          <StatCard
            label={t('warehouses')}
            value={state.warehouses.length}
            icon={<WarehouseIcon size={20} />}
            tone="ocean"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('carsStored')}
            value={storedCars}
            icon={<CarIcon size={20} />}
            tone="brand"
            hint={`${state.secondaryClients.length - storedCars} ${t('noWarehouseAssigned').toLowerCase()}`}
          />
        </StaggerItem>
      </StaggerList>

      <Card className="mb-4 p-3.5">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('searchWarehousePlaceholder')}
          className="lg:max-w-sm"
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
            icon={<WarehouseIcon size={28} />}
            title={query ? t('noResults') : t('noWarehouses')}
            hint={query ? t('noResultsHint') : t('noWarehousesHint')}
            action={
              can('warehouses', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newWarehouse')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((w) => (
              <motion.div
                key={w.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <WarehouseCard
                  warehouse={w}
                  cars={carCounts.get(w.id) ?? 0}
                  onEdit={can('warehouses', 'edit') ? () => openEdit(w) : undefined}
                  onDelete={can('warehouses', 'delete') ? () => handleDelete(w) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <WarehouseForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            updateWarehouse(editing.id, data);
            toast.success(t('warehouseUpdated'));
          } else {
            addWarehouse(data);
            toast.success(t('warehouseCreated'));
          }
          setFormOpen(false);
        }}
      />
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function WarehouseCard({
  warehouse,
  cars,
  onEdit,
  onDelete,
}: {
  warehouse: Warehouse;
  cars: number;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t, lang } = useI18n();

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grad-ocean text-white shadow-sm ring-2 ring-white">
          <WarehouseIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{warehouse.name}</h3>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs font-semibold text-ink-500">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-1">{warehouse.address || '—'}</span>
          </p>
        </div>
        <span className="chip shrink-0 bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <CarIcon size={13} />
          {cars}
        </span>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint
            label={t('phone')}
            value={warehouse.phone ? <span dir="ltr">{warehouse.phone}</span> : '—'}
            icon={<Phone size={11} />}
          />
          <DataPoint
            label={t('email')}
            value={warehouse.email ? <span dir="ltr">{warehouse.email}</span> : '—'}
            icon={<Mail size={11} />}
          />
          <DataPoint
            label={t('carsStored')}
            value={cars}
            icon={<CarIcon size={11} />}
          />
          <DataPoint
            label={t('createdOn')}
            value={formatDate(warehouse.createdAt, lang)}
            icon={<Calendar size={11} />}
          />
        </div>

        <div className="rounded-xl bg-ink-50/80 p-3 ring-1 ring-ink-200/60">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
            <FileText size={11} />
            {t('description')}
          </p>
          <p className="mt-1 line-clamp-3 text-[13px] font-medium text-ink-700">
            {warehouse.description || '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/60 p-3">
        {onEdit && (
          <Button size="sm" variant="soft" icon={<Pencil size={15} />} onClick={onEdit}>
            {t('edit')}
          </Button>
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

function WarehouseForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Warehouse | null;
  onClose: () => void;
  onSave: (data: Omit<Warehouse, 'id' | 'createdAt'>) => void;
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
            address: editing.address,
            phone: editing.phone,
            email: editing.email,
            description: editing.description,
          }
        : EMPTY_FORM,
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('requiredField');
    if (!form.address.trim()) errs.address = t('requiredField');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      description: form.description.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('editWarehouse') : t('newWarehouse')}
      subtitle={t('warehousesSubtitle')}
      icon={<WarehouseIcon size={20} />}
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
          label={t('warehouseName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          icon={<Building2 size={16} />}
          required
        />
        <Textarea
          label={t('address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          error={errors.address}
          rows={2}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={`${t('phone')} (${t('optional')})`}
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            icon={<Phone size={16} />}
            placeholder="0770 00 00 00"
          />
          <Input
            label={`${t('email')} (${t('optional')})`}
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            icon={<Mail size={16} />}
          />
        </div>
        <Textarea
          label={`${t('description')} (${t('optional')})`}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </form>
    </Modal>
  );
}
