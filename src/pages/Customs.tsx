import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useMemo, useState } from 'react';
import {
  Boxes,
  Car,
  ChevronRight,
  FileSpreadsheet,
  Hash,
  MapPin,
  MoreVertical,
  Phone,
  Printer,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import { fullName, nextDeclarationNo } from '../lib/selectors';
import {
  formatDate,
  formatDeclarationNo,
  formatMoney,
  formatMoneyShort,
  matchesRef,
  norm,
} from '../lib/format';
import { CUSTOMS_STATUSES } from '../lib/types';
import type { Container, CustomsStatus, PrincipalClient, SecondaryClient } from '../lib/types';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  SearchBar,
  SectionTitle,
  StaggerItem,
  StaggerList,
  TONE_CHIP,
  TONE_GRAD,
  cx,
} from '../components/ui/primitives';
import { DropdownMenu, Modal, useConfirm, useToast } from '../components/ui/overlays';
import { DeliveryReceiptDialog } from '../components/print/DeliveryReceiptPrint';
import {
  CUSTOMS_META,
  CustomsBadge,
  DataPoint,
  FilterPills,
  PageHeader,
  ResultCount,
  StatCard,
} from '../components/shared';

type Filter = 'all' | CustomsStatus;

interface Row {
  car: SecondaryClient;
  principal?: PrincipalClient;
  container?: Container;
}

export function Customs() {
  const { t, lang } = useI18n();
  const { state, can, updateSecondary } = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [receiptFor, setReceiptFor] = useState<SecondaryClient | null>(null);
  /* "Saisie" is the moment the declaration is filed — the number is asked for
     then rather than confirmed blindly. */
  const [saisieFor, setSaisieFor] = useState<SecondaryClient | null>(null);

  /* ---------- enriched rows ---------- */
  const rows = useMemo<Row[]>(
    () =>
      state.secondaryClients.map((car) => ({
        car,
        principal: state.principalClients.find((p) => p.id === car.principalClientId),
        container: state.containers.find((c) => c.id === car.containerId),
      })),
    [state],
  );

  const counts = useMemo(() => {
    const out = {
      non_arrive: 0,
      arrive: 0,
      saisie: 0,
      liquide: 0,
      sortie: 0,
      remis_client: 0,
    } as Record<CustomsStatus, number>;
    for (const r of rows) out[r.car.customsStatus] += 1;
    return out;
  }, [rows]);

  const totalValue = useMemo(() => rows.reduce((a, r) => a + r.car.price, 0), [rows]);
  const delivered = counts.remis_client;
  const inTransit = rows.length - delivered;

  const visible = useMemo(() => {
    const q = norm(query);
    return rows
      .filter((r) => (filter === 'all' ? true : r.car.customsStatus === filter))
      .filter((r) => {
        if (!q) return true;
        return (
          matchesRef(formatDeclarationNo(r.car.declarationNo), query) ||
          norm(fullName(r.car)).includes(q) ||
          norm(r.car.car.chassisNumber).includes(q) ||
          norm(`${r.car.car.brand} ${r.car.car.name}`).includes(q) ||
          norm(r.container?.name ?? '').includes(q) ||
          norm(r.container?.tcNumber ?? '').includes(q) ||
          norm(r.principal ? fullName(r.principal) : '').includes(q)
        );
      })
      .sort(
        (a, b) =>
          CUSTOMS_META[a.car.customsStatus].order - CUSTOMS_META[b.car.customsStatus].order ||
          fullName(a.car).localeCompare(fullName(b.car)),
      );
  }, [rows, query, filter]);

  const canChange = can('customs', 'changeStatus');
  const canPrint = can('customs', 'print');

  /* ---------- status change ---------- */
  const changeStatus = async (car: SecondaryClient, status: CustomsStatus) => {
    /* Filing the declaration: show the number the file carries and let it be
       typed or corrected, instead of a yes/no confirmation. */
    if (status === 'saisie') {
      setSaisieFor(car);
      return;
    }

    const ok = await confirm({
      title: t('confirmStatusChange'),
      message: t('confirmStatusMsg', { name: fullName(car), status: t(CUSTOMS_META[status].key) }),
      confirmLabel: t('confirm'),
      tone: 'brand',
      icon: <FileSpreadsheet size={26} />,
    });
    if (!ok) return;
    updateSecondary(car.id, { customsStatus: status });
    toast.success(t('statusChanged'));

    /* Handing a car to its owner is the moment the delivery receipt exists to
       mark — offer to print it straight away. */
    if (status === 'remis_client' && canPrint) {
      const yes = await confirm({
        title: t('printDeliveryReceiptQuestion'),
        message: t('printDeliveryReceiptHint', { name: fullName(car) }),
        confirmLabel: t('printNow'),
        cancelLabel: t('later'),
        tone: 'brand',
        icon: <Printer size={26} />,
      });
      if (yes) setReceiptFor({ ...car, customsStatus: status });
    }
  };

  const confirmSaisie = (declarationNo: number) => {
    if (!saisieFor) return;
    updateSecondary(saisieFor.id, { declarationNo, customsStatus: 'saisie' });
    setSaisieFor(null);
    toast.success(t('statusChanged'));
  };

  return (
    <div>
      <PageHeader
        icon={<FileSpreadsheet size={24} />}
        title={t('customs')}
        subtitle={t('customsSubtitle')}
        actions={
          <div className="hidden items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3.5 py-2 shadow-card sm:flex">
            <Car size={16} className="text-brand-600" />
            <span className="text-[13px] font-bold tabular-nums text-ink-700">
              {rows.length} {t('totalCars').toLowerCase()}
            </span>
          </div>
        }
      />

      {/* ---------- summary ---------- */}
      <StaggerList className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('totalCars')}
            value={rows.length}
            icon={<Car size={20} />}
            tone="brand"
            hint={`${state.containers.length} ${t('containers').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('carsInTransit')}
            value={inTransit}
            icon={<Boxes size={20} />}
            tone="amber"
            hint={`${counts.non_arrive} ${t('st_non_arrive').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('carsDelivered')}
            value={delivered}
            icon={<Car size={20} />}
            tone="emerald"
            hint={`${counts.sortie} ${t('st_sortie').toLowerCase()}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalAmount')}
            value={totalValue}
            format={fms}
            icon={<Wallet size={20} />}
            tone="violet"
          />
        </StaggerItem>
      </StaggerList>

      {/* ---------- pipeline ---------- */}
      <Pipeline counts={counts} total={rows.length} active={filter} onPick={setFilter} />

      {/* ---------- toolbar ---------- */}
      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('searchCustomsPlaceholder')}
            className="xl:max-w-sm xl:flex-1"
          />
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            className="xl:ms-auto"
            options={[
              { value: 'all', label: t('all'), count: rows.length },
              ...CUSTOMS_STATUSES.map((s) => ({
                value: s as Filter,
                label: t(CUSTOMS_META[s].key),
                count: counts[s],
                tone: CUSTOMS_META[s].tone,
              })),
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
          <EmptyState
            icon={<FileSpreadsheet size={28} />}
            title={t('noResults')}
            hint={t('noResultsHint')}
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
                className="relative focus-within:z-40"
              >
                <CarCard
                  row={r}
                  fm={fm}
                  onChangeStatus={canChange ? changeStatus : undefined}
                  onPrintReceipt={canPrint ? () => setReceiptFor(r.car) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <DeclarationDialog
        car={saisieFor}
        others={state.secondaryClients}
        fallbackNo={nextDeclarationNo(state)}
        onClose={() => setSaisieFor(null)}
        onConfirm={confirmSaisie}
      />

      <DeliveryReceiptDialog car={receiptFor} onClose={() => setReceiptFor(null)} />
    </div>
  );
}

/* ============================================================
   Declaration number — asked for when a file is marked "Saisie"
   ============================================================ */

function DeclarationDialog({
  car,
  others,
  fallbackNo,
  onClose,
  onConfirm,
}: {
  car: SecondaryClient | null;
  others: SecondaryClient[];
  /** Used when the file was created without a number of its own. */
  fallbackNo: number;
  onClose: () => void;
  onConfirm: (declarationNo: number) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [seed, setSeed] = useState<string | null>(null);

  /* Re-seed whenever the dialog opens on another car. */
  const target = car?.id ?? null;
  if (target !== seed) {
    setSeed(target);
    setError('');
    setValue(car ? String(car.declarationNo > 0 ? car.declarationNo : fallbackNo) : '');
  }

  if (!car) return null;

  const submit = () => {
    const n = Number(value.replace(/\s/g, ''));
    if (!value.trim() || !Number.isInteger(n) || n < 1) {
      setError(t('invalidNumber'));
      return;
    }
    if (others.some((c) => c.id !== car.id && c.declarationNo === n)) {
      setError(t('declarationNoTaken'));
      return;
    }
    onConfirm(n);
  };

  return (
    <Modal
      open={!!car}
      onClose={onClose}
      size="sm"
      icon={<Hash size={20} />}
      title={t('saisieDeclarationTitle')}
      subtitle={t('saisieDeclarationSubtitle', {
        name: fullName(car),
        car: `${car.car.brand} ${car.car.name}`,
      })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={submit}>
            {t('saisieDeclarationConfirm')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-grad-brand-soft p-3 ring-1 ring-brand-100">
          <span className="text-2xs font-bold uppercase tracking-wide text-ink-500">
            {t('currentDeclarationNo')}
          </span>
          <span dir="ltr" className="font-mono text-sm font-extrabold text-ink-900">
            {car.declarationNo > 0 ? formatDeclarationNo(car.declarationNo) : '—'}
          </span>
        </div>

        <Input
          label={t('declarationNo')}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          dir="ltr"
          autoFocus
          value={value}
          onChange={(ev) => {
            setValue(ev.target.value);
            setError('');
          }}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') submit();
          }}
          error={error}
          hint={t('saisieDeclarationHint')}
          icon={<Hash size={16} />}
          className="font-mono"
          required
        />
      </div>
    </Modal>
  );
}

/* ============================================================
   Pipeline — the 6 clearance stages, in order
   ============================================================ */

function Pipeline({
  counts,
  total,
  active,
  onPick,
}: {
  counts: Record<CustomsStatus, number>;
  total: number;
  active: Filter;
  onPick: (f: Filter) => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b border-ink-200/70 bg-grad-brand-soft px-4 py-3 sm:px-5">
        <SectionTitle
          icon={<Boxes size={17} />}
          title={t('customsPipeline')}
          subtitle={`${total} ${t('totalCars').toLowerCase()}`}
          right={
            active !== 'all' && (
              <Button size="xs" variant="ghost" onClick={() => onPick('all')}>
                {t('clearFilters')}
              </Button>
            )
          }
        />
      </div>

      <div className="flex items-stretch gap-1.5 overflow-x-auto p-3 sm:p-4">
        {CUSTOMS_STATUSES.map((s, i) => {
          const meta = CUSTOMS_META[s];
          const on = active === s;
          const pct = total > 0 ? (counts[s] / total) * 100 : 0;
          return (
            <Fragment key={s}>
              {i > 0 && (
                <span className="hidden shrink-0 self-center text-ink-300 sm:block" aria-hidden>
                  <ChevronRight size={15} className="rtl:rotate-180" />
                </span>
              )}
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${t(meta.key)} — ${counts[s]}`}
                onClick={() => onPick(on ? 'all' : s)}
                className={cx(
                  'group min-w-[7.5rem] flex-1 cursor-pointer rounded-2xl border p-3 text-start transition-all duration-200',
                  on
                    ? cx('border-transparent shadow-card', TONE_CHIP[meta.tone])
                    : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <span
                  className={cx(
                    'mb-2 flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm',
                    TONE_GRAD[meta.tone],
                  )}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <span className="block text-lg font-extrabold tabular-nums text-ink-900">
                  {counts[s]}
                </span>
                <span className="block truncate text-2xs font-bold uppercase tracking-wide text-ink-500">
                  {t(meta.key)}
                </span>
                <ProgressBar value={pct} tone={meta.tone} height="h-1.5" className="mt-2" />
              </button>
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   Card
   ============================================================ */

function CarCard({
  row,
  fm,
  onChangeStatus,
  onPrintReceipt,
}: {
  row: Row;
  fm: (n: number) => string;
  onChangeStatus?: (car: SecondaryClient, status: CustomsStatus) => void;
  onPrintReceipt?: () => void;
}) {
  const { t, lang } = useI18n();
  const { car, principal, container } = row;
  const delivered = car.customsStatus === 'remis_client';

  return (
    <Card className="card-hover flex h-full flex-col">
      {/* header */}
      <div className="flex items-start gap-3 rounded-t-2xl border-b border-ink-100 bg-grad-brand-soft p-4">
        <Avatar name={fullName(car)} gradient="from-brand-700 to-ocean-400" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{fullName(car)}</h3>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-500">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{car.address}</span>
          </p>
        </div>
        {onChangeStatus && (
          <DropdownMenu
            className="shrink-0"
            header={t('markAs')}
            trigger={
              <IconButton label={t('changeStatus')} variant="secondary">
                <MoreVertical size={16} />
              </IconButton>
            }
            items={CUSTOMS_STATUSES.map((s) => ({
              key: s,
              label: t(CUSTOMS_META[s].key),
              icon: CUSTOMS_META[s].icon,
              // "Saisie" stays clickable on a file already at that stage: it is
              // the way back into the declaration number to correct it.
              disabled: s === car.customsStatus && s !== 'saisie',
              onClick: () => onChangeStatus(car, s),
            }))}
          />
        )}
      </div>

      {/* body */}
      <div className="flex-1 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <DataPoint
            label={t('declarationNo')}
            value={formatDeclarationNo(car.declarationNo)}
            icon={<Hash size={11} />}
            mono
          />
          <DataPoint
            label={t('car')}
            value={`${car.car.brand} ${car.car.name}`}
            icon={<Car size={11} />}
          />
          <DataPoint
            label={t('chassisNumber')}
            value={car.car.chassisNumber}
            icon={<Hash size={11} />}
            mono
          />
          <DataPoint
            label={t('container')}
            icon={<Boxes size={11} />}
            value={
              <>
                <span className="block truncate">{container?.name ?? '—'}</span>
                {container && (
                  <span className="block truncate font-mono text-2xs font-semibold text-ink-500">
                    {container.tcNumber}
                  </span>
                )}
              </>
            }
          />
          <DataPoint label={t('price')} value={fm(car.price)} icon={<Wallet size={11} />} />
        </div>

        {/* principal client */}
        <div className="flex items-center gap-2.5 rounded-xl bg-grad-brand-soft p-3 ring-1 ring-brand-100">
          <Avatar
            name={principal ? fullName(principal) : '?'}
            size="sm"
            gradient="from-violet-500 to-fuchsia-500"
          />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-wide text-ink-400">
              {t('principalClient')}
            </p>
            <p className="truncate text-[13px] font-extrabold text-ink-900">
              {principal ? fullName(principal) : '—'}
            </p>
          </div>
          {principal && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-500">
              <Phone size={12} />
              <span dir="ltr" className="tabular-nums">
                {principal.phone}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* footer */}
      <div className="rounded-b-2xl border-t border-ink-100 bg-ink-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CustomsBadge status={car.customsStatus} />
          <span className="flex items-center gap-1.5 text-2xs font-semibold text-ink-400">
            <UserRound size={11} />
            {t('createdOn')} {formatDate(car.createdAt, lang)}
          </span>
        </div>
        {/* the delivery receipt only makes sense once the car is handed over */}
        {delivered && onPrintReceipt && (
          <Button
            size="sm"
            variant="soft"
            icon={<Printer size={15} />}
            onClick={onPrintReceipt}
            className="mt-3 w-full"
          >
            {t('printDeliveryReceipt')}
          </Button>
        )}
      </div>
    </Card>
  );
}
