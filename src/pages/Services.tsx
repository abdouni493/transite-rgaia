/* ============================================================
   Services — the billable catalog behind the invoicing screen.
   Each service carries a price excluding tax and its VAT rate.
   ============================================================ */

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  Calendar,
  FileText,
  Percent,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { formatDate, formatMoney, formatMoneyShort, formatPercent, norm } from '../lib/format';
import type { Service } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  SearchBar,
  StaggerItem,
  StaggerList,
} from '../components/ui/primitives';
import { useConfirm, useToast } from '../components/ui/overlays';
import { ServiceForm } from '../components/ServiceForm';
import { DataPoint, PageHeader, ResultCount, StatCard } from '../components/shared';

/** A service's price with tax — the figure the client actually pays. */
const ttc = (s: { amount: number; tva: number }) => s.amount * (1 + s.tva / 100);

/* ============================================================
   Page
   ============================================================ */

export function Services() {
  const { t, lang } = useI18n();
  const { state, can, addService, updateService, deleteService } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const visible = useMemo(() => {
    const q = norm(query);
    return state.services
      .filter((s) => !q || norm(s.name).includes(q) || norm(s.description).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.services, query]);

  const totals = useMemo(() => {
    const list = state.services;
    return {
      count: list.length,
      ht: list.reduce((a, s) => a + s.amount, 0),
      avgTva: list.length ? list.reduce((a, s) => a + s.tva, 0) / list.length : 0,
    };
  }, [state.services]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Service) => {
    setEditing(s);
    setFormOpen(true);
  };

  const handleDelete = async (s: Service) => {
    const ok = await confirm({
      title: t('confirmDelete'),
      message: (
        <>
          <p className="font-bold text-ink-900">{s.name}</p>
          <p className="mt-1">{t('deleteServiceWarn')}</p>
          <p className="mt-1 text-xs">{t('deleteWarning')}</p>
        </>
      ),
      confirmLabel: t('delete'),
      tone: 'danger',
      icon: <Trash2 size={26} />,
    });
    if (!ok) return;
    deleteService(s.id);
    toast.success(t('serviceDeleted'));
  };

  return (
    <div>
      <PageHeader
        icon={<Wrench size={24} />}
        title={t('services')}
        subtitle={t('servicesSubtitle')}
        actions={
          can('services', 'create') && (
            <Button icon={<Plus size={17} />} onClick={openCreate}>
              {t('newService')}
            </Button>
          )
        }
      />

      <StaggerList className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label={t('servicesCount')}
            value={totals.count}
            icon={<Wrench size={20} />}
            tone="ocean"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('amountHt')}
            value={totals.ht}
            format={fms}
            icon={<Wallet size={20} />}
            tone="brand"
          />
        </StaggerItem>
        <StaggerItem className="col-span-2 lg:col-span-1">
          <StatCard
            label={t('avgTva')}
            value={totals.avgTva}
            format={(n) => formatPercent(n, lang)}
            icon={<Percent size={20} />}
            tone="violet"
          />
        </StaggerItem>
      </StaggerList>

      <Card className="mb-4 p-3.5">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('searchServicePlaceholder')}
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
            icon={<Wrench size={28} />}
            title={query ? t('noResults') : t('noServices')}
            hint={query ? t('noResultsHint') : t('noServicesHint')}
            action={
              can('services', 'create') && (
                <Button icon={<Plus size={17} />} onClick={openCreate}>
                  {t('newService')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <ServiceCard
                  service={s}
                  onEdit={can('services', 'edit') ? () => openEdit(s) : undefined}
                  onDelete={can('services', 'delete') ? () => handleDelete(s) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <ServiceForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            updateService(editing.id, data);
            toast.success(t('serviceUpdated'));
          } else {
            addService(data);
            toast.success(t('serviceCreated'));
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

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: Service;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <Card className="card-hover group flex h-full flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ink-100 bg-grad-brand-soft p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grad-violet text-white shadow-sm ring-2 ring-white">
          <Wrench size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{service.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            <Calendar size={12} className="shrink-0" />
            {formatDate(service.createdAt, lang)}
          </p>
        </div>
        <span className="chip shrink-0 bg-violet-50 text-violet-700 ring-1 ring-violet-200">
          <Percent size={13} />
          {formatPercent(service.tva, lang)}
        </span>
      </div>

      <div className="flex-1 p-4">
        {/* the price block — the reason this card exists */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <DataPoint label={t('amountHt')} value={fm(service.amount)} icon={<Tag size={11} />} />
          <DataPoint
            label={t('tvaAmount')}
            value={fm(service.amount * (service.tva / 100))}
            icon={<Percent size={11} />}
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-grad-brand-soft px-3.5 py-3 ring-1 ring-brand-100">
          <span className="text-2xs font-bold uppercase tracking-wide text-brand-700">
            {t('amountTtc')}
          </span>
          <span className="text-[15px] font-extrabold tabular-nums text-brand-800">
            {fm(ttc(service))}
          </span>
        </div>

        <div className="rounded-xl bg-ink-50/80 p-3 ring-1 ring-ink-200/60">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
            <FileText size={11} />
            {t('description')}
          </p>
          <p className="mt-1 line-clamp-3 text-[13px] font-medium text-ink-700">
            {service.description || '—'}
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
