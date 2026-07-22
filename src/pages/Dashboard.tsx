import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Boxes,
  Car,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Info,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../i18n/I18nProvider';
import { useStore } from '../store/AppStore';
import {
  cashBalance,
  cashTotals,
  containerFill,
  containerMoney,
  customsBreakdown,
  fullName,
  globalMoney,
  principalMoney,
} from '../lib/selectors';
import { buildAlerts, type Severity } from '../lib/alerts';
import {
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  formatPercent,
  monthKey,
  monthLabel,
} from '../lib/format';
import { CUSTOMS_META, PageHeader, StatCard, MoneySummary } from '../components/shared';
import { Avatar, Button, Card, EmptyState, ProgressBar, SectionTitle, StaggerItem, StaggerList, cx } from '../components/ui/primitives';
import { CUSTOMS_STATUSES, type PageKey } from '../lib/types';

const SEV_STYLE: Record<Severity, { chip: string; icon: typeof AlertTriangle; bar: string }> = {
  high: { chip: 'bg-rose-50 text-rose-700 ring-rose-200', icon: AlertTriangle, bar: 'bg-grad-rose' },
  medium: { chip: 'bg-amber-50 text-amber-700 ring-amber-200', icon: BellRing, bar: 'bg-grad-sun' },
  low: { chip: 'bg-ocean-50 text-ocean-700 ring-ocean-200', icon: Info, bar: 'bg-grad-ocean' },
};

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const { t, lang } = useI18n();
  const { state, session, can } = useStore();

  const cur = t('currency');
  const fm = (n: number) => formatMoney(n, lang, cur);
  const fms = (n: number) => formatMoneyShort(n, lang, cur);

  const g = useMemo(() => globalMoney(state), [state]);
  const cash = useMemo(() => cashTotals(state), [state]);
  const customs = useMemo(() => customsBreakdown(state), [state]);
  const alerts = useMemo(() => buildAlerts(state, fm), [state, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const cars = state.secondaryClients.length;
  const delivered = customs.remis_client;
  const inTransit = cars - delivered;

  /* ---- monthly collection series ---- */
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of state.payments) {
      const k = monthKey(p.date);
      map.set(k, (map.get(k) ?? 0) + p.amount);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([k, v]) => ({ key: k, label: monthLabel(k, lang), value: v }));
  }, [state.payments, lang]);

  /* ---- customs pie ---- */
  const pie = useMemo(
    () =>
      CUSTOMS_STATUSES.map((s) => ({
        name: t(CUSTOMS_META[s].key),
        value: customs[s],
        status: s,
      })).filter((d) => d.value > 0),
    [customs, t],
  );

  const PIE_COLORS: Record<string, string> = {
    non_arrive: '#94a3b8',
    arrive: '#0ea5e9',
    saisie: '#f59e0b',
    liquide: '#8b5cf6',
    sortie: '#38bdf8',
    remis_client: '#10b981',
  };

  /* ---- container fill ---- */
  const fills = useMemo(
    () =>
      state.containers.map((c) => ({
        name: c.name.replace('CNT-', ''),
        cars: containerFill(state, c.id).count,
        rest: containerMoney(state, c.id).rest,
      })),
    [state],
  );

  /* ---- top clients ---- */
  const topClients = useMemo(
    () =>
      state.principalClients
        .map((c) => ({ client: c, money: principalMoney(state, c.id) }))
        .sort((a, b) => b.money.total - a.money.total)
        .slice(0, 5),
    [state],
  );

  const recentPayments = useMemo(
    () =>
      [...state.payments]
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 6),
    [state.payments],
  );

  const containersActive = state.containers.filter(
    (c) => containerFill(state, c.id).count > 0,
  ).length;

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={24} />}
        title={`${t('welcomeBack')}, ${session?.name?.split(' ')[0] ?? ''}`}
        subtitle={t('dashboardSubtitle')}
        actions={
          <div className="hidden items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3.5 py-2 shadow-card sm:flex">
            <ShieldCheck size={16} className="text-brand-600" />
            <span className="text-[13px] font-bold text-ink-700">{session?.roleName}</span>
          </div>
        }
      />

      {/* ---------- KPI row ---------- */}
      <StaggerList className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('totalRevenue')}
            value={g.total}
            format={fms}
            icon={<TrendingUp size={20} />}
            tone="brand"
            hint={`${formatNumber(cars, lang)} ${t('totalCars').toLowerCase()}`}
            onClick={can('paymentTracking') ? () => onNavigate('paymentTracking') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('totalPaid')}
            value={g.paid}
            format={fms}
            icon={<CreditCard size={20} />}
            tone="emerald"
            hint={`${t('collectionRate')}: ${formatPercent(g.progress, lang)}`}
            onClick={can('paymentTracking') ? () => onNavigate('paymentTracking') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('outstanding')}
            value={g.rest}
            format={fms}
            icon={<Wallet size={20} />}
            tone={g.rest > 0 ? 'rose' : 'emerald'}
            hint={`${state.containers.filter((c) => containerMoney(state, c.id).rest > 0).length} ${t('containers').toLowerCase()}`}
            onClick={can('paymentTracking') ? () => onNavigate('paymentTracking') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('cashBalance')}
            value={cashBalance(state)}
            format={fms}
            icon={<Wallet size={20} />}
            tone="ocean"
            hint={`${fms(cash.deposits)} / ${fms(cash.withdrawals)}`}
            onClick={can('caisse') ? () => onNavigate('caisse') : undefined}
          />
        </StaggerItem>
      </StaggerList>

      <StaggerList className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            label={t('principalClients')}
            value={state.principalClients.length}
            icon={<Users size={20} />}
            tone="violet"
            hint={`${state.principalClients.filter((c) => c.status === 'active').length} ${t('active').toLowerCase()}`}
            onClick={can('principalClients') ? () => onNavigate('principalClients') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('activeContainers')}
            value={containersActive}
            icon={<Boxes size={20} />}
            tone="sky"
            hint={`${state.containers.length} ${t('total').toLowerCase()}`}
            onClick={can('containers') ? () => onNavigate('containers') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('carsInTransit')}
            value={inTransit}
            icon={<Car size={20} />}
            tone="amber"
            hint={`${delivered} ${t('carsDelivered').toLowerCase()}`}
            onClick={can('customs') ? () => onNavigate('customs') : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label={t('workers')}
            value={state.workers.filter((w) => w.active).length}
            icon={<Users size={20} />}
            tone="slate"
            hint={`${state.roles.length} ${t('role').toLowerCase()}`}
            onClick={can('workers') ? () => onNavigate('workers') : undefined}
          />
        </StaggerItem>
      </StaggerList>

      {/* ---------- financial band ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4 }}
        className="mt-4"
      >
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200/70 px-5 py-3.5">
            <SectionTitle
              icon={<TrendingUp size={17} />}
              title={t('revenueOverview')}
              subtitle={`${formatNumber(state.payments.length, lang)} ${t('payments').toLowerCase()}`}
            />
          </div>
          <div className="p-5">
            <MoneySummary money={g} />
          </div>
        </Card>
      </motion.div>

      {/* ---------- charts + alerts ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* monthly */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          className="xl:col-span-2"
        >
          <Card className="h-full p-5">
            <SectionTitle icon={<CreditCard size={17} />} title={t('monthlyPayments')} className="mb-4" />
            {monthly.length === 0 ? (
              <EmptyState title={t('noPayments')} />
            ) : (
              <div className="h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => fms(v).replace(` ${cur}`, '')}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v) => [fm(Number(v)), t('totalPaid')] as [string, string]}
                      contentStyle={{
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.2)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="url(#gArea)"
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        {/* customs pie */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4 }}
        >
          <Card className="h-full p-5">
            <SectionTitle icon={<Car size={17} />} title={t('statusDistribution')} className="mb-2" />
            {pie.length === 0 ? (
              <EmptyState title={t('empty')} />
            ) : (
              <>
                <div className="h-52" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="88%"
                        paddingAngle={3}
                        animationDuration={800}
                      >
                        {pie.map((d) => (
                          <Cell key={d.status} fill={PIE_COLORS[d.status]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [`${v} ${t('totalCars').toLowerCase()}`, String(n)] as [string, string]}
                        contentStyle={{
                          borderRadius: 14,
                          border: '1px solid #e2e8f0',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* text legend doubles as the accessible data table */}
                <ul className="mt-2 space-y-1.5">
                  {pie.map((d) => (
                    <li key={d.status} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: PIE_COLORS[d.status] }}
                      />
                      <span className="flex-1 truncate font-medium text-ink-600">{d.name}</span>
                      <span className="font-bold tabular-nums text-ink-900">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ---------- alerts ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-4"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-200/70 bg-grad-brand-soft px-5 py-3.5">
            <SectionTitle
              icon={<BellRing size={17} />}
              title={t('alerts')}
              subtitle={t('alertsSubtitle')}
            />
            <span
              className={cx(
                'rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ring-1',
                alerts.length ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
              )}
            >
              {alerts.length}
            </span>
          </div>

          {alerts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={28} />} title={t('noAlerts')} />
          ) : (
            <StaggerList className="max-h-[26rem] divide-y divide-ink-100 overflow-y-auto">
              {alerts.map((a) => {
                const s = SEV_STYLE[a.severity];
                const Icon = s.icon;
                const allowed = can(a.target);
                return (
                  <StaggerItem key={a.id}>
                    <button
                      disabled={!allowed}
                      onClick={() => allowed && onNavigate(a.target)}
                      className={cx(
                        'group relative flex w-full items-center gap-3.5 px-5 py-3 text-start transition-colors',
                        allowed ? 'cursor-pointer hover:bg-ink-50' : 'cursor-default',
                      )}
                    >
                      <span className={cx('absolute inset-y-0 start-0 w-1', s.bar)} />
                      <span
                        className={cx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
                          s.chip,
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink-800">
                          {t(a.messageKey, a.vars)}
                        </span>
                        <span className={cx('mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide ring-1', s.chip)}>
                          {t(a.severity === 'high' ? 'severityHigh' : a.severity === 'medium' ? 'severityMedium' : 'severityLow')}
                        </span>
                      </span>
                      {allowed && (
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                        />
                      )}
                    </button>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </Card>
      </motion.div>

      {/* ---------- bottom row ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* container fill */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full p-5">
            <SectionTitle icon={<Boxes size={17} />} title={t('containerFill')} className="mb-4" />
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fills} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 4]}
                    ticks={[0, 1, 2, 3, 4]}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`${v} / 4`, t('totalCars')] as [string, string]}
                    contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}
                    cursor={{ fill: 'rgba(20,184,166,0.06)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Bar
                    dataKey="cars"
                    name={t('totalCars')}
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                  >
                    {fills.map((f, i) => (
                      <Cell key={i} fill={f.cars >= 4 ? '#10b981' : f.cars === 0 ? '#cbd5e1' : '#14b8a6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* top clients */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.4 }}
        >
          <Card className="h-full p-5">
            <SectionTitle icon={<Users size={17} />} title={t('topClients')} className="mb-4" />
            <ul className="space-y-3">
              {topClients.map(({ client, money }, i) => (
                <li key={client.id} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-xs font-extrabold tabular-nums text-ink-300">
                    {i + 1}
                  </span>
                  <Avatar name={fullName(client)} size="sm" gradient="from-violet-500 to-fuchsia-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-900">{fullName(client)}</p>
                    <ProgressBar
                      value={money.progress}
                      height="h-1.5"
                      tone={money.status === 'paid' ? 'emerald' : 'amber'}
                      className="mt-1"
                    />
                  </div>
                  <span className="shrink-0 text-end">
                    <span className="block text-xs font-extrabold tabular-nums text-ink-900">
                      {fms(money.total)}
                    </span>
                    {money.rest > 0 && (
                      <span className="block text-2xs font-bold tabular-nums text-rose-600">
                        −{fms(money.rest)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      </div>

      {/* ---------- recent payments ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.4 }}
        className="mt-4"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-200/70 px-5 py-3.5">
            <SectionTitle icon={<CreditCard size={17} />} title={t('recentPayments')} />
            {can('paymentTracking') && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onNavigate('paymentTracking')}
                iconRight={<ArrowRight size={14} className="rtl:rotate-180" />}
              >
                {t('goToSection')}
              </Button>
            )}
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState title={t('noPayments')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-ink-200/70 bg-ink-50/60 text-2xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2.5 text-start font-bold">{t('date')}</th>
                    <th className="px-5 py-2.5 text-start font-bold">{t('container')}</th>
                    <th className="px-5 py-2.5 text-start font-bold">{t('principalClient')}</th>
                    <th className="px-5 py-2.5 text-start font-bold">{t('description')}</th>
                    <th className="px-5 py-2.5 text-end font-bold">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {recentPayments.map((p) => {
                    const ct = state.containers.find((c) => c.id === p.containerId);
                    const pc = state.principalClients.find((c) => c.id === p.principalClientId);
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-ink-50/70">
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs font-semibold tabular-nums text-ink-600">
                          {formatDate(p.date, lang)} · {p.time}
                        </td>
                        <td className="px-5 py-2.5 text-[13px] font-bold text-ink-900">{ct?.name ?? '—'}</td>
                        <td className="px-5 py-2.5 text-[13px] text-ink-700">
                          {pc ? fullName(pc) : '—'}
                        </td>
                        <td className="max-w-[16rem] truncate px-5 py-2.5 text-xs text-ink-500">
                          {p.description || '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-end text-[13px] font-extrabold tabular-nums text-emerald-600">
                          +{fm(p.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
