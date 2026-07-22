import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Banknote,
  Boxes,
  CalendarRange,
  Car,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Percent,
  Printer,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  carsOfContainer,
  cashBalance,
  containerFill,
  containerMoney,
  fullName,
} from '../lib/selectors';
import {
  addDays,
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  formatPercent,
  inRange,
  toISO,
  todayISO,
} from '../lib/format';
import { CUSTOMS_STATUSES, MAX_CARS_PER_CONTAINER } from '../lib/types';
import type { AppState } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  Input,
  StaggerItem,
  StaggerList,
  cx,
  type Tone,
} from '../components/ui/primitives';
import { Modal, useToast } from '../components/ui/overlays';
import { CUSTOMS_META, DataPoint, PageHeader, StatCard } from '../components/shared';
import type { Lang, TranslationKey } from '../i18n/translations';

/* ============================================================
   Report model
   ============================================================ */

type Fmt = 'money' | 'number' | 'decimal' | 'percent';

interface Line {
  date?: string;
  label: string;
  amount?: number;
}

interface Stat {
  id: string;
  label: string;
  value: number;
  format: Fmt;
  tone: Tone;
  icon: ReactNode;
  formula: string;
  breakdown: { label: string; value: string }[];
  items: Line[];
}

interface Section {
  key: string;
  title: string;
  icon: ReactNode;
  stats: Stat[];
}

interface ContainerLine {
  id: string;
  name: string;
  tc: string;
  cars: number;
  total: number;
  paid: number;
  rest: number;
}

interface Report {
  from: string;
  to: string;
  sections: Section[];
  containers: ContainerLine[];
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const firstOfMonth = () => {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
};
const firstOfYear = () => toISO(new Date(new Date().getFullYear(), 0, 1));

const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

/* ============================================================
   Page
   ============================================================ */

export function Reports() {
  const { t, lang } = useI18n();
  const { state, can } = useStore();
  const toast = useToast();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayISO);
  const [report, setReport] = useState<Report | null>(null);
  const [drill, setDrill] = useState<Stat | null>(null);

  const formatter = useMemo(
    () => (f: Fmt) => (n: number) => {
      if (f === 'money') return fms(n);
      if (f === 'percent') return formatPercent(n, lang);
      if (f === 'decimal')
        return new Intl.NumberFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
          maximumFractionDigits: 1,
        }).format(n || 0);
      return formatNumber(n, lang);
    },
    [lang, fms],
  );

  const generate = () => {
    if (!from || !to || from > to) return;
    setReport(buildReport(state, from, to, t, lang));
    toast.success(t('reportReady'));
  };

  const preset = (f: string, tt: string) => {
    setFrom(f);
    setTo(tt);
  };

  const totalsRow = useMemo(() => {
    if (!report) return null;
    return report.containers.reduce(
      (acc, c) => ({
        cars: acc.cars + c.cars,
        total: acc.total + c.total,
        paid: acc.paid + c.paid,
        rest: acc.rest + c.rest,
      }),
      { cars: 0, total: 0, paid: 0, rest: 0 },
    );
  }, [report]);

  return (
    <div>
      <PageHeader
        icon={<BarChart3 size={24} />}
        title={t('reports')}
        subtitle={t('reportsSubtitle')}
        actions={
          report &&
          can('reports', 'print') && (
            <Button
              variant="secondary"
              icon={<Printer size={17} />}
              onClick={() => window.print()}
              className="no-print"
            >
              {t('print')}
            </Button>
          )
        }
      />

      {/* ---------- control bar ---------- */}
      <Card className="no-print mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Input
            label={t('startDate')}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            wrapClassName="lg:w-48"
          />
          <Input
            label={t('endDate')}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            wrapClassName="lg:w-48"
          />
          <div className="flex flex-wrap gap-1.5 lg:pb-1">
            <Button size="sm" variant="secondary" onClick={() => preset(firstOfMonth(), todayISO())}>
              {t('thisMonth')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => preset(addDays(todayISO(), -29), todayISO())}
            >
              {t('last30Days')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => preset(firstOfYear(), todayISO())}>
              {t('thisYear')}
            </Button>
          </div>
          {can('reports', 'generate') && (
            <Button
              icon={<Sparkles size={17} />}
              onClick={generate}
              className="lg:ms-auto"
              disabled={!from || !to || from > to}
            >
              {report ? t('regenerate') : t('generateReport')}
            </Button>
          )}
        </div>
        {report && (
          <p className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3 text-xs font-semibold text-ink-500">
            <CalendarRange size={13} className="text-brand-600" />
            {t('reportFor', { from: formatDate(report.from, lang), to: formatDate(report.to, lang) })}
            {can('reports', 'drillDown') && <span className="text-ink-400">· {t('clickCardHint')}</span>}
          </p>
        )}
      </Card>

      {/* ---------- body ---------- */}
      <AnimatePresence mode="wait">
        {!report ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <EmptyState
                icon={<FileText size={28} />}
                title={t('selectPeriodFirst')}
                hint={t('reportsSubtitle')}
                action={
                  can('reports', 'generate') && (
                    <Button icon={<Sparkles size={17} />} onClick={generate}>
                      {t('generateReport')}
                    </Button>
                  )
                }
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key={`${report.from}-${report.to}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="print-area space-y-6"
          >
            {/* print-only header */}
            <div className="hidden print:block">
              <h1 className="text-lg font-extrabold text-ink-900">{state.company.name}</h1>
              <p className="text-sm text-ink-600">
                {t('reportFor', {
                  from: formatDate(report.from, lang),
                  to: formatDate(report.to, lang),
                })}
              </p>
            </div>

            {report.sections.map((sec) => (
              <section key={sec.key} className="print-break">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-brand text-white shadow-float">
                    {sec.icon}
                  </span>
                  <h2 className="text-[15px] font-extrabold text-ink-900">{sec.title}</h2>
                </div>
                <StaggerList className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {sec.stats.map((s) => (
                    <StaggerItem key={s.id}>
                      <StatCard
                        label={s.label}
                        value={s.value}
                        format={formatter(s.format)}
                        icon={s.icon}
                        tone={s.tone}
                        hint={`${s.items.length} ${s.items.length === 1 ? t('result') : t('results')}`}
                        onClick={can('reports', 'drillDown') ? () => setDrill(s) : undefined}
                        className="h-full"
                      />
                    </StaggerItem>
                  ))}
                </StaggerList>
              </section>
            ))}

            {/* ---------- per-container table ---------- */}
            <section className="print-break">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-ocean text-white shadow-float">
                  <Boxes size={18} />
                </span>
                <h2 className="text-[15px] font-extrabold text-ink-900">{t('rp_perContainer')}</h2>
              </div>
              <Card className="overflow-hidden p-0">
                {report.containers.length === 0 ? (
                  <EmptyState icon={<Boxes size={26} />} title={t('noDataInPeriod')} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead>
                        <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                          <th className="px-4 py-3 text-start font-bold">{t('container')}</th>
                          <th className="px-4 py-3 text-start font-bold">{t('tcNumber')}</th>
                          <th className="px-4 py-3 text-end font-bold">{t('rp_cars')}</th>
                          <th className="px-4 py-3 text-end font-bold">{t('totalAmount')}</th>
                          <th className="px-4 py-3 text-end font-bold">{t('totalPaid')}</th>
                          <th className="px-4 py-3 text-end font-bold">{t('rest')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {report.containers.map((c) => (
                          <tr key={c.id} className="transition-colors hover:bg-ink-50/70">
                            <td className="px-4 py-2.5 text-[13px] font-bold text-ink-900">{c.name}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-ink-500">{c.tc}</td>
                            <td className="px-4 py-2.5 text-end text-xs font-semibold tabular-nums text-ink-700">
                              {c.cars}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-end text-xs tabular-nums text-ink-700">
                              {fm(c.total)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-end text-xs tabular-nums text-emerald-600">
                              {fm(c.paid)}
                            </td>
                            <td
                              className={cx(
                                'whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums',
                                c.rest > 0 ? 'text-rose-600' : 'text-emerald-600',
                              )}
                            >
                              {fm(c.rest)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {totalsRow && (
                        <tfoot>
                          <tr className="border-t-2 border-ink-200 bg-ink-50">
                            <td colSpan={2} className="px-4 py-3 text-[13px] font-bold text-ink-700">
                              {t('total')}
                            </td>
                            <td className="px-4 py-3 text-end text-xs font-bold tabular-nums text-ink-800">
                              {totalsRow.cars}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-end text-xs font-extrabold tabular-nums text-ink-900">
                              {fm(totalsRow.total)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-end text-xs font-extrabold tabular-nums text-emerald-700">
                              {fm(totalsRow.paid)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-end text-sm font-extrabold tabular-nums text-rose-700">
                              {fm(totalsRow.rest)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </Card>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- drill-down ---------- */}
      <DrillDownModal stat={drill} onClose={() => setDrill(null)} formatter={formatter} />
    </div>
  );
}

/* ============================================================
   Drill-down modal — renders any stat
   ============================================================ */

function DrillDownModal({
  stat,
  onClose,
  formatter,
}: {
  stat: Stat | null;
  onClose: () => void;
  formatter: (f: Fmt) => (n: number) => string;
}) {
  const { t, lang } = useI18n();
  const fm = (n: number) => formatMoney(n, lang, t('currency'));

  if (!stat) return null;

  const totalAmount = sum(
    stat.items.filter((i) => typeof i.amount === 'number'),
    (i) => i.amount ?? 0,
  );
  const hasAmounts = stat.items.some((i) => typeof i.amount === 'number');

  return (
    <Modal
      open={!!stat}
      onClose={onClose}
      size="lg"
      icon={<Percent size={20} />}
      title={t('calculationDetail')}
      subtitle={stat.label}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-500">
            {stat.label}:{' '}
            <span className="text-sm font-extrabold tabular-nums text-ink-900">
              {formatter(stat.format)(stat.value)}
            </span>
          </span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      {/* (a) formula */}
      <div className="mb-4 rounded-2xl bg-grad-brand-soft p-4 ring-1 ring-brand-100">
        <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-brand-700">
          <Sparkles size={12} />
          {t('formula')}
        </p>
        <p className="break-words text-[13px] font-semibold leading-relaxed text-ink-800">
          {stat.formula}
        </p>
      </div>

      {/* (b) numeric breakdown */}
      <div className="mb-4">
        <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
          {t('breakdown')}
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {stat.breakdown.map((b, i) => (
            <DataPoint key={i} label={b.label} value={b.value} />
          ))}
        </div>
      </div>

      {/* (c) line items */}
      <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-400">
        {t('lineItems')}
      </p>
      {stat.items.length === 0 ? (
        <EmptyState icon={<FileText size={26} />} title={t('noDataInPeriod')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200/80">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-2xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5 text-start font-bold">{t('date')}</th>
                <th className="px-4 py-2.5 text-start font-bold">{t('description')}</th>
                {hasAmounts && <th className="px-4 py-2.5 text-end font-bold">{t('amount')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {stat.items.map((i, idx) => (
                <tr key={idx} className="transition-colors hover:bg-ink-50/70">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                    {i.date ? formatDate(i.date, lang) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-ink-800">{i.label}</td>
                  {hasAmounts && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-ink-900">
                      {typeof i.amount === 'number' ? fm(i.amount) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 bg-ink-50">
                <td colSpan={2} className="px-4 py-2.5 text-[13px] font-bold text-ink-700">
                  {t('total')} · {stat.items.length}
                </td>
                {hasAmounts && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-end text-sm font-extrabold tabular-nums text-brand-700">
                    {fm(totalAmount)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Report builder — one place, every number
   ============================================================ */

function buildReport(s: AppState, from: string, to: string, t: Translate, lang: Lang): Report {
  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const fn = (n: number) => formatNumber(n, lang);
  const range = `[${formatDate(from, lang)} → ${formatDate(to, lang)}]`;

  /* ---- raw slices ---- */
  const newPrincipals = s.principalClients.filter((c) => inRange(c.createdAt, from, to));
  const newSecondaries = s.secondaryClients.filter((c) => inRange(c.createdAt, from, to));
  const newContainers = s.containers.filter((c) => inRange(c.createdAt, from, to));
  const periodPayments = s.payments
    .filter((p) => inRange(p.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date));
  const periodCash = s.cash.filter((c) => inRange(c.date, from, to));
  const periodAdvances = s.advances.filter((a) => inRange(a.date, from, to));
  const periodAbsences = s.absences.filter((a) => inRange(a.date, from, to));
  const periodPayrolls = s.payrolls.filter((p) => inRange(p.date, from, to));

  const nameOfPrincipal = (id: string) => {
    const p = s.principalClients.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  const nameOfContainer = (id: string) => s.containers.find((x) => x.id === id)?.name ?? '—';

  /* ---- finance ---- */
  const totalInvoiced = sum(newSecondaries, (c) => c.price);
  const totalCollected = sum(periodPayments, (p) => p.amount);
  const totalRest = totalInvoiced - totalCollected;
  const collectionRate = safeDiv(totalCollected, totalInvoiced) * 100;
  const avgPayment = safeDiv(totalCollected, periodPayments.length);
  const avgPerCar = safeDiv(totalInvoiced, newSecondaries.length);
  const avgPerContainer = safeDiv(totalInvoiced, newContainers.length || s.containers.length);

  /* ---- containers ---- */
  const fillSource = newContainers.length ? newContainers : s.containers;
  const fillRate = safeDiv(
    sum(fillSource, (c) => containerFill(s, c.id).percent),
    fillSource.length,
  );
  const avgCars = safeDiv(newSecondaries.length, newContainers.length || s.containers.length);

  /* ---- cash ---- */
  const deposits = periodCash.filter((c) => c.kind === 'deposit');
  const withdrawals = periodCash.filter((c) => c.kind === 'withdraw');
  const depositTotal = sum(deposits, (c) => c.amount);
  const withdrawTotal = sum(withdrawals, (c) => c.amount);

  /* ---- workers ---- */
  const activeWorkers = s.workers.filter((w) => w.active);
  const advTotal = sum(periodAdvances, (a) => a.amount);
  const absTotal = sum(periodAbsences, (a) => a.cost);
  const payrollTotal = sum(periodPayrolls, (p) => p.netAmount);
  const salaryCost = sum(s.workers, (w) =>
    w.salary.enabled ? (w.salary.mode === 'monthly' ? w.salary.amount : w.salary.amount * 26) : 0,
  );

  const stat = (x: Stat): Stat => x;

  /* ---------------- sections ---------------- */

  const clients: Section = {
    key: 'clients',
    title: t('sectionClients'),
    icon: <Users size={18} />,
    stats: [
      stat({
        id: 'newPrincipals',
        label: t('rp_newPrincipals'),
        value: newPrincipals.length,
        format: 'number',
        tone: 'violet',
        icon: <Users size={20} />,
        formula: `${t('rp_newPrincipals')} = Σ ${t('principalClients')} · ${t('createdOn')} ∈ ${range}`,
        breakdown: [
          { label: t('newInPeriod'), value: fn(newPrincipals.length) },
          { label: t('rp_totalPrincipals'), value: fn(s.principalClients.length) },
        ],
        items: newPrincipals.map((c) => ({ date: c.createdAt, label: fullName(c) })),
      }),
      stat({
        id: 'totalPrincipals',
        label: t('rp_totalPrincipals'),
        value: s.principalClients.length,
        format: 'number',
        tone: 'brand',
        icon: <Users size={20} />,
        formula: `${t('rp_totalPrincipals')} = Σ ${t('principalClients')}`,
        breakdown: [
          { label: t('active'), value: fn(s.principalClients.filter((c) => c.status === 'active').length) },
          { label: t('inactive'), value: fn(s.principalClients.filter((c) => c.status === 'inactive').length) },
        ],
        items: s.principalClients.map((c) => ({ date: c.createdAt, label: fullName(c) })),
      }),
      stat({
        id: 'activePrincipals',
        label: t('rp_activePrincipals'),
        value: s.principalClients.filter((c) => c.status === 'active').length,
        format: 'number',
        tone: 'emerald',
        icon: <CheckCircle2 size={20} />,
        formula: `${t('rp_activePrincipals')} = Σ ${t('principalClients')} · ${t('status')} = ${t('active')}`,
        breakdown: [
          { label: t('rp_totalPrincipals'), value: fn(s.principalClients.length) },
        ],
        items: s.principalClients
          .filter((c) => c.status === 'active')
          .map((c) => ({ date: c.createdAt, label: fullName(c) })),
      }),
      stat({
        id: 'inactivePrincipals',
        label: t('rp_inactivePrincipals'),
        value: s.principalClients.filter((c) => c.status === 'inactive').length,
        format: 'number',
        tone: 'slate',
        icon: <Users size={20} />,
        formula: `${t('rp_inactivePrincipals')} = Σ ${t('principalClients')} · ${t('status')} = ${t('inactive')}`,
        breakdown: [{ label: t('rp_totalPrincipals'), value: fn(s.principalClients.length) }],
        items: s.principalClients
          .filter((c) => c.status === 'inactive')
          .map((c) => ({ date: c.createdAt, label: fullName(c) })),
      }),
      stat({
        id: 'newSecondaries',
        label: t('rp_newSecondaries'),
        value: newSecondaries.length,
        format: 'number',
        tone: 'ocean',
        icon: <Car size={20} />,
        formula: `${t('rp_newSecondaries')} = Σ ${t('secondaryClients')} · ${t('createdOn')} ∈ ${range}`,
        breakdown: [
          { label: t('newInPeriod'), value: fn(newSecondaries.length) },
          { label: t('rp_totalSecondaries'), value: fn(s.secondaryClients.length) },
        ],
        items: newSecondaries.map((c) => ({
          date: c.createdAt,
          label: `${fullName(c)} · ${nameOfPrincipal(c.principalClientId)}`,
          amount: c.price,
        })),
      }),
      stat({
        id: 'totalSecondaries',
        label: t('rp_totalSecondaries'),
        value: s.secondaryClients.length,
        format: 'number',
        tone: 'sky',
        icon: <Car size={20} />,
        formula: `${t('rp_totalSecondaries')} = Σ ${t('secondaryClients')}`,
        breakdown: [{ label: t('totalAmount'), value: fm(sum(s.secondaryClients, (c) => c.price)) }],
        items: s.secondaryClients.map((c) => ({
          date: c.createdAt,
          label: `${fullName(c)} · ${c.car.brand} ${c.car.name}`,
          amount: c.price,
        })),
      }),
    ],
  };

  const containersSection: Section = {
    key: 'containers',
    title: t('sectionContainersCars'),
    icon: <Boxes size={18} />,
    stats: [
      stat({
        id: 'newContainers',
        label: t('rp_newContainers'),
        value: newContainers.length,
        format: 'number',
        tone: 'brand',
        icon: <Boxes size={20} />,
        formula: `${t('rp_newContainers')} = Σ ${t('containers')} · ${t('createdOn')} ∈ ${range}`,
        breakdown: [
          { label: t('newInPeriod'), value: fn(newContainers.length) },
          { label: t('rp_totalContainers'), value: fn(s.containers.length) },
        ],
        items: newContainers.map((c) => ({ date: c.createdAt, label: `${c.name} · ${c.tcNumber}` })),
      }),
      stat({
        id: 'totalContainers',
        label: t('rp_totalContainers'),
        value: s.containers.length,
        format: 'number',
        tone: 'ocean',
        icon: <Boxes size={20} />,
        formula: `${t('rp_totalContainers')} = Σ ${t('containers')}`,
        breakdown: [{ label: t('totalCars'), value: fn(s.secondaryClients.length) }],
        items: s.containers.map((c) => ({
          date: c.createdAt,
          label: `${c.name} · ${carsOfContainer(s, c.id).length}/${MAX_CARS_PER_CONTAINER}`,
          amount: containerMoney(s, c.id).total,
        })),
      }),
      stat({
        id: 'carsInPeriod',
        label: t('rp_carsInPeriod'),
        value: newSecondaries.length,
        format: 'number',
        tone: 'violet',
        icon: <Car size={20} />,
        formula: `${t('rp_carsInPeriod')} = Σ ${t('totalCars')} · ${t('createdOn')} ∈ ${range}`,
        breakdown: [{ label: t('totalAmount'), value: fm(totalInvoiced) }],
        items: newSecondaries.map((c) => ({
          date: c.createdAt,
          label: `${c.car.brand} ${c.car.name} · ${nameOfContainer(c.containerId)}`,
          amount: c.price,
        })),
      }),
      stat({
        id: 'avgCars',
        label: t('rp_avgCarsPerContainer'),
        value: avgCars,
        format: 'decimal',
        tone: 'amber',
        icon: <TrendingUp size={20} />,
        formula: `${t('rp_avgCarsPerContainer')} = ${t('rp_carsInPeriod')} ÷ ${t('rp_newContainers')}`,
        breakdown: [
          { label: t('rp_carsInPeriod'), value: fn(newSecondaries.length) },
          { label: t('rp_newContainers'), value: fn(newContainers.length || s.containers.length) },
        ],
        items: (newContainers.length ? newContainers : s.containers).map((c) => ({
          date: c.createdAt,
          label: `${c.name} · ${carsOfContainer(s, c.id).length}/${MAX_CARS_PER_CONTAINER}`,
        })),
      }),
      stat({
        id: 'fillRate',
        label: t('rp_fillRate'),
        value: fillRate,
        format: 'percent',
        tone: 'sky',
        icon: <Percent size={20} />,
        formula: `${t('rp_fillRate')} = Σ (${t('occupancy')} ÷ ${MAX_CARS_PER_CONTAINER}) ÷ ${t('rp_totalContainers')} × 100`,
        breakdown: [
          { label: t('rp_totalContainers'), value: fn(fillSource.length) },
          { label: t('rp_fillRate'), value: formatPercent(fillRate, lang) },
        ],
        items: fillSource.map((c) => ({
          date: c.createdAt,
          label: `${c.name} · ${containerFill(s, c.id).count}/${MAX_CARS_PER_CONTAINER} (${formatPercent(containerFill(s, c.id).percent, lang)})`,
        })),
      }),
    ],
  };

  const finance: Section = {
    key: 'finance',
    title: t('sectionFinance'),
    icon: <Wallet size={18} />,
    stats: [
      stat({
        id: 'invoiced',
        label: t('rp_totalInvoiced'),
        value: totalInvoiced,
        format: 'money',
        tone: 'brand',
        icon: <Wallet size={20} />,
        formula: `${t('rp_totalInvoiced')} = Σ ${t('price')} · ${t('secondaryClients')} ${range}`,
        breakdown: [
          { label: t('rp_carsInPeriod'), value: fn(newSecondaries.length) },
          { label: t('avgPerCar'), value: fm(avgPerCar) },
        ],
        items: newSecondaries.map((c) => ({
          date: c.createdAt,
          label: `${fullName(c)} · ${c.car.brand} ${c.car.name}`,
          amount: c.price,
        })),
      }),
      stat({
        id: 'collected',
        label: t('rp_totalCollected'),
        value: totalCollected,
        format: 'money',
        tone: 'emerald',
        icon: <CreditCard size={20} />,
        formula: `${t('rp_totalCollected')} = Σ ${t('payments')} · ${t('date')} ∈ ${range}`,
        breakdown: [
          { label: t('payments'), value: fn(periodPayments.length) },
          { label: t('avgPayment'), value: fm(avgPayment) },
        ],
        items: periodPayments.map((p) => ({
          date: p.date,
          label: `${nameOfContainer(p.containerId)} · ${nameOfPrincipal(p.principalClientId)}${
            p.description ? ` · ${p.description}` : ''
          }`,
          amount: p.amount,
        })),
      }),
      stat({
        id: 'restFinance',
        label: t('rp_totalRest'),
        value: totalRest,
        format: 'money',
        tone: totalRest > 0 ? 'rose' : 'emerald',
        icon: <Wallet size={20} />,
        formula: `${t('rp_totalRest')} = ${t('rp_totalInvoiced')} − ${t('rp_totalCollected')}`,
        breakdown: [
          { label: t('rp_totalInvoiced'), value: fm(totalInvoiced) },
          { label: t('rp_totalCollected'), value: fm(totalCollected) },
          { label: t('rp_totalRest'), value: fm(totalRest) },
        ],
        items: newSecondaries.map((c) => ({
          date: c.createdAt,
          label: `${fullName(c)} · ${nameOfContainer(c.containerId)}`,
          amount: c.price,
        })),
      }),
      stat({
        id: 'collectionRate',
        label: t('collectionRate'),
        value: collectionRate,
        format: 'percent',
        tone: 'amber',
        icon: <Percent size={20} />,
        formula: `${t('collectionRate')} = ${t('rp_totalCollected')} ÷ ${t('rp_totalInvoiced')} × 100`,
        breakdown: [
          { label: t('rp_totalCollected'), value: fm(totalCollected) },
          { label: t('rp_totalInvoiced'), value: fm(totalInvoiced) },
          { label: t('collectionRate'), value: formatPercent(collectionRate, lang) },
        ],
        items: periodPayments.map((p) => ({
          date: p.date,
          label: nameOfContainer(p.containerId),
          amount: p.amount,
        })),
      }),
      stat({
        id: 'avgPayment',
        label: t('avgPayment'),
        value: avgPayment,
        format: 'money',
        tone: 'ocean',
        icon: <CreditCard size={20} />,
        formula: `${t('avgPayment')} = ${t('rp_totalCollected')} ÷ ${t('payments')}`,
        breakdown: [
          { label: t('rp_totalCollected'), value: fm(totalCollected) },
          { label: t('payments'), value: fn(periodPayments.length) },
        ],
        items: periodPayments.map((p) => ({
          date: p.date,
          label: `${nameOfPrincipal(p.principalClientId)} · ${p.time}`,
          amount: p.amount,
        })),
      }),
      stat({
        id: 'avgPerCar',
        label: t('avgPerCar'),
        value: avgPerCar,
        format: 'money',
        tone: 'violet',
        icon: <Car size={20} />,
        formula: `${t('avgPerCar')} = ${t('rp_totalInvoiced')} ÷ ${t('rp_carsInPeriod')}`,
        breakdown: [
          { label: t('rp_totalInvoiced'), value: fm(totalInvoiced) },
          { label: t('rp_carsInPeriod'), value: fn(newSecondaries.length) },
        ],
        items: newSecondaries.map((c) => ({
          date: c.createdAt,
          label: `${c.car.brand} ${c.car.name}`,
          amount: c.price,
        })),
      }),
      stat({
        id: 'avgPerContainer',
        label: t('avgPerContainer'),
        value: avgPerContainer,
        format: 'money',
        tone: 'sky',
        icon: <Boxes size={20} />,
        formula: `${t('avgPerContainer')} = ${t('rp_totalInvoiced')} ÷ ${t('rp_newContainers')}`,
        breakdown: [
          { label: t('rp_totalInvoiced'), value: fm(totalInvoiced) },
          { label: t('rp_newContainers'), value: fn(newContainers.length || s.containers.length) },
        ],
        items: (newContainers.length ? newContainers : s.containers).map((c) => ({
          date: c.createdAt,
          label: c.name,
          amount: containerMoney(s, c.id).total,
        })),
      }),
    ],
  };

  const customs: Section = {
    key: 'customs',
    title: t('sectionCustoms'),
    icon: <Car size={18} />,
    stats: [
      ...CUSTOMS_STATUSES.map((st) => {
        const list = newSecondaries.filter((c) => c.customsStatus === st);
        return stat({
          id: `customs-${st}`,
          label: t(CUSTOMS_META[st].key),
          value: list.length,
          format: 'number',
          tone: CUSTOMS_META[st].tone,
          icon: CUSTOMS_META[st].icon,
          formula: `${t(CUSTOMS_META[st].key)} = Σ ${t('totalCars')} · ${t('status')} = ${t(
            CUSTOMS_META[st].key,
          )} ${range}`,
          breakdown: [
            { label: t('rp_carsInPeriod'), value: fn(newSecondaries.length) },
            {
              label: t('progress'),
              value: formatPercent(safeDiv(list.length, newSecondaries.length) * 100, lang),
            },
          ],
          items: list.map((c) => ({
            date: c.createdAt,
            label: `${fullName(c)} · ${c.car.brand} ${c.car.name}`,
            amount: c.price,
          })),
        });
      }),
      stat({
        id: 'delivered',
        label: t('rp_delivered'),
        value: newSecondaries.filter((c) => c.customsStatus === 'remis_client').length,
        format: 'number',
        tone: 'emerald',
        icon: <CheckCircle2 size={20} />,
        formula: `${t('rp_delivered')} = Σ ${t('totalCars')} · ${t('status')} = ${t('st_remis_client')}`,
        breakdown: [
          { label: t('rp_carsInPeriod'), value: fn(newSecondaries.length) },
          {
            label: t('progress'),
            value: formatPercent(
              safeDiv(
                newSecondaries.filter((c) => c.customsStatus === 'remis_client').length,
                newSecondaries.length,
              ) * 100,
              lang,
            ),
          },
        ],
        items: newSecondaries
          .filter((c) => c.customsStatus === 'remis_client')
          .map((c) => ({ date: c.createdAt, label: fullName(c), amount: c.price })),
      }),
    ],
  };

  const caisse: Section = {
    key: 'caisse',
    title: t('sectionCash'),
    icon: <Landmark size={18} />,
    stats: [
      stat({
        id: 'deposits',
        label: t('rp_deposits'),
        value: depositTotal,
        format: 'money',
        tone: 'emerald',
        icon: <Landmark size={20} />,
        formula: `${t('rp_deposits')} = Σ ${t('deposit')} · ${t('date')} ∈ ${range}`,
        breakdown: [{ label: t('transactions'), value: fn(deposits.length) }],
        items: deposits.map((c) => ({
          date: c.date,
          label: c.description || t('deposit'),
          amount: c.amount,
        })),
      }),
      stat({
        id: 'withdrawals',
        label: t('rp_withdrawals'),
        value: withdrawTotal,
        format: 'money',
        tone: 'rose',
        icon: <Landmark size={20} />,
        formula: `${t('rp_withdrawals')} = Σ ${t('withdraw')} · ${t('date')} ∈ ${range}`,
        breakdown: [{ label: t('transactions'), value: fn(withdrawals.length) }],
        items: withdrawals.map((c) => ({
          date: c.date,
          label: c.description || t('withdraw'),
          amount: c.amount,
        })),
      }),
      stat({
        id: 'netFlow',
        label: t('netFlow'),
        value: depositTotal - withdrawTotal,
        format: 'money',
        tone: depositTotal - withdrawTotal >= 0 ? 'emerald' : 'rose',
        icon: <TrendingUp size={20} />,
        formula: `${t('netFlow')} = ${t('rp_deposits')} − ${t('rp_withdrawals')}`,
        breakdown: [
          { label: t('rp_deposits'), value: fm(depositTotal) },
          { label: t('rp_withdrawals'), value: fm(withdrawTotal) },
          { label: t('netFlow'), value: fm(depositTotal - withdrawTotal) },
        ],
        items: periodCash.map((c) => ({
          date: c.date,
          label: `${c.kind === 'deposit' ? t('deposit') : t('withdraw')} · ${c.description || '—'}`,
          amount: c.kind === 'deposit' ? c.amount : -c.amount,
        })),
      }),
      stat({
        id: 'closingBalance',
        label: t('rp_closingBalance'),
        value: cashBalance(s),
        format: 'money',
        tone: 'brand',
        icon: <Wallet size={20} />,
        formula: `${t('cashBalance')} = ${t('netFlow')} + ${t('payments')} − ${t('payroll')}`,
        breakdown: [
          { label: t('netFlow'), value: fm(sum(s.cash, (c) => (c.kind === 'deposit' ? c.amount : -c.amount))) },
          { label: t('totalPaid'), value: fm(sum(s.payments, (p) => p.amount)) },
          { label: t('payroll'), value: fm(sum(s.payrolls, (p) => p.netAmount)) },
        ],
        items: periodCash.map((c) => ({
          date: c.date,
          label: `${c.kind === 'deposit' ? t('deposit') : t('withdraw')} · ${c.description || '—'}`,
          amount: c.kind === 'deposit' ? c.amount : -c.amount,
        })),
      }),
    ],
  };

  const workers: Section = {
    key: 'workers',
    title: t('sectionWorkers'),
    icon: <Users size={18} />,
    stats: [
      stat({
        id: 'workersCount',
        label: t('rp_workersCount'),
        value: activeWorkers.length,
        format: 'number',
        tone: 'violet',
        icon: <Users size={20} />,
        formula: `${t('rp_workersCount')} = Σ ${t('workers')} · ${t('status')} = ${t('active')}`,
        breakdown: [
          { label: t('workers'), value: fn(s.workers.length) },
          { label: t('inactive'), value: fn(s.workers.length - activeWorkers.length) },
        ],
        items: activeWorkers.map((w) => ({ date: w.startDate, label: w.fullName })),
      }),
      stat({
        id: 'advancesPeriod',
        label: t('rp_advancesPeriod'),
        value: advTotal,
        format: 'money',
        tone: 'amber',
        icon: <Banknote size={20} />,
        formula: `${t('rp_advancesPeriod')} = Σ ${t('advances')} · ${t('date')} ∈ ${range}`,
        breakdown: [{ label: t('count'), value: fn(periodAdvances.length) }],
        items: periodAdvances.map((a) => ({
          date: a.date,
          label: `${s.workers.find((w) => w.id === a.workerId)?.fullName ?? '—'} · ${
            a.description || t('advance')
          }`,
          amount: a.amount,
        })),
      }),
      stat({
        id: 'absencesPeriod',
        label: t('rp_absencesPeriod'),
        value: absTotal,
        format: 'money',
        tone: 'rose',
        icon: <CalendarRange size={20} />,
        formula: `${t('rp_absencesPeriod')} = Σ ${t('absenceCost')} · ${t('date')} ∈ ${range}`,
        breakdown: [{ label: t('count'), value: fn(periodAbsences.length) }],
        items: periodAbsences.map((a) => ({
          date: a.date,
          label: `${s.workers.find((w) => w.id === a.workerId)?.fullName ?? '—'} · ${
            a.description || t('absence')
          }`,
          amount: a.cost,
        })),
      }),
      stat({
        id: 'payrollPaid',
        label: t('rp_payrollPaid'),
        value: payrollTotal,
        format: 'money',
        tone: 'emerald',
        icon: <CreditCard size={20} />,
        formula: `${t('rp_payrollPaid')} = Σ ${t('netToPay')} · ${t('date')} ∈ ${range}`,
        breakdown: [{ label: t('count'), value: fn(periodPayrolls.length) }],
        items: periodPayrolls.map((p) => ({
          date: p.date,
          label: `${s.workers.find((w) => w.id === p.workerId)?.fullName ?? '—'} · ${p.periodLabel}`,
          amount: p.netAmount,
        })),
      }),
      stat({
        id: 'salaryCost',
        label: t('rp_salaryCost'),
        value: salaryCost,
        format: 'money',
        tone: 'brand',
        icon: <Wallet size={20} />,
        formula: `${t('rp_salaryCost')} = Σ ${t('salaryAmount')} (${t('monthly')} + ${t('daily')} × 26)`,
        breakdown: [
          { label: t('salaried'), value: fn(s.workers.filter((w) => w.salary.enabled).length) },
          { label: t('totalSalaryCost'), value: fm(salaryCost) },
        ],
        items: s.workers
          .filter((w) => w.salary.enabled)
          .map((w) => ({
            date: w.startDate,
            label: `${w.fullName} · ${w.salary.mode === 'monthly' ? t('monthly') : t('daily')}`,
            amount: w.salary.amount,
          })),
      }),
    ],
  };

  /* ---------------- per-container table ---------------- */
  const activeIds = new Set<string>([
    ...newContainers.map((c) => c.id),
    ...newSecondaries.map((c) => c.containerId),
    ...periodPayments.map((p) => p.containerId),
  ]);

  const containersTable: ContainerLine[] = s.containers
    .filter((c) => activeIds.has(c.id))
    .map((c) => {
      const m = containerMoney(s, c.id);
      return {
        id: c.id,
        name: c.name,
        tc: c.tcNumber,
        cars: carsOfContainer(s, c.id).length,
        total: m.total,
        paid: m.paid,
        rest: m.rest,
      };
    })
    .sort((a, b) => b.rest - a.rest || a.name.localeCompare(b.name));

  return {
    from,
    to,
    sections: [clients, containersSection, finance, customs, caisse, workers],
    containers: containersTable,
  };
}
