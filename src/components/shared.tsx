/* ============================================================
   Domain-aware widgets shared by every page.
   ============================================================ */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  Ship,
  Truck,
  UserCheck,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { formatMoney, formatMoneyShort, formatPercent } from '../lib/format';
import type { CustomsStatus, PaymentStatus } from '../lib/types';
import type { Money } from '../lib/selectors';
import { Badge, cx, ProgressBar, TONE_GRAD, type Tone } from './ui/primitives';
import type { TranslationKey } from '../i18n/translations';

/* ---------------- status maps ---------------- */

export const CUSTOMS_META: Record<
  CustomsStatus,
  { tone: Tone; key: TranslationKey; icon: ReactNode; order: number }
> = {
  non_arrive: { tone: 'slate', key: 'st_non_arrive', icon: <Clock size={13} />, order: 0 },
  arrive: { tone: 'ocean', key: 'st_arrive', icon: <Ship size={13} />, order: 1 },
  saisie: { tone: 'amber', key: 'st_saisie', icon: <AlertCircle size={13} />, order: 2 },
  liquide: { tone: 'violet', key: 'st_liquide', icon: <PackageCheck size={13} />, order: 3 },
  sortie: { tone: 'sky', key: 'st_sortie', icon: <Truck size={13} />, order: 4 },
  remis_client: { tone: 'emerald', key: 'st_remis_client', icon: <UserCheck size={13} />, order: 5 },
};

export const PAY_META: Record<PaymentStatus, { tone: Tone; key: TranslationKey }> = {
  unpaid: { tone: 'rose', key: 'unpaid' },
  partial: { tone: 'amber', key: 'partial' },
  paid: { tone: 'emerald', key: 'paid' },
};

export function CustomsBadge({ status }: { status: CustomsStatus }) {
  const { t } = useI18n();
  const m = CUSTOMS_META[status];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {t(m.key)}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  const m = PAY_META[status];
  return (
    <Badge
      tone={m.tone}
      icon={status === 'paid' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
    >
      {t(m.key)}
    </Badge>
  );
}

/* ---------------- animated number ---------------- */

/** Counts up to `value` on mount; respects reduced motion. */
export function CountUp({
  value,
  format,
  duration = 900,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration, reduce]);

  return <span className="tnum">{format(display)}</span>;
}

/* ---------------- stat card ---------------- */

export interface StatCardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: ReactNode;
  tone?: Tone;
  hint?: string;
  trend?: { value: number; label?: string };
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  format,
  icon,
  tone = 'brand',
  hint,
  trend,
  onClick,
  className,
}: StatCardProps) {
  const reduce = useReducedMotion();
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('fr-DZ'));

  return (
    <motion.div
      whileHover={onClick && !reduce ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      onClick={onClick}
      className={cx(
        'group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card transition-shadow duration-200 sm:p-5',
        onClick && 'cursor-pointer hover:shadow-card-hover',
        className,
      )}
    >
      {/* gradient wash that intensifies on hover */}
      <span
        aria-hidden
        className={cx(
          'pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-25',
          TONE_GRAD[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink-500">{label}</p>
          <p className="mt-1.5 text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
            <CountUp value={value} format={fmt} />
          </p>
          {hint && <p className="mt-1 truncate text-xs text-ink-400">{hint}</p>}
          {trend && (
            <p
              className={cx(
                'mt-1.5 inline-flex items-center gap-1 text-xs font-bold',
                trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {trend.value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(trend.value).toFixed(1)} %{trend.label && <span className="font-medium text-ink-400"> · {trend.label}</span>}
            </p>
          )}
        </div>
        <span
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
            TONE_GRAD[tone],
          )}
        >
          {icon}
        </span>
      </div>
    </motion.div>
  );
}

/* ---------------- money summary ---------------- */

/** Total / paid / rest triple with a progress bar — the app's signature block. */
export function MoneySummary({
  money,
  compact,
  className,
}: {
  money: Money;
  compact?: boolean;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const f = compact
    ? (n: number) => formatMoneyShort(n, lang, t('currency'))
    : (n: number) => formatMoney(n, lang, t('currency'));

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <MoneyCell label={t('totalAmount')} value={f(money.total)} tone="ink" />
        <MoneyCell label={t('totalPaid')} value={f(money.paid)} tone="emerald" />
        <MoneyCell
          label={t('totalRest')}
          value={f(money.rest)}
          tone={money.rest > 0 ? 'rose' : 'emerald'}
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          value={money.progress}
          tone={money.status === 'paid' ? 'emerald' : money.status === 'partial' ? 'amber' : 'rose'}
          className="flex-1"
        />
        <span className="shrink-0 text-xs font-bold tabular-nums text-ink-600">
          {formatPercent(money.progress, lang)}
        </span>
      </div>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ink' | 'emerald' | 'rose';
}) {
  const styles = {
    ink: 'bg-ink-50 text-ink-900 ring-ink-200/70',
    emerald: 'bg-emerald-50/70 text-emerald-700 ring-emerald-200/70',
    rose: 'bg-rose-50/70 text-rose-700 ring-rose-200/70',
  };
  return (
    <div className={cx('rounded-xl px-2.5 py-2 ring-1', styles[tone])}>
      <p className="truncate text-2xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-extrabold tabular-nums sm:text-sm">{value}</p>
    </div>
  );
}

/* ---------------- page header ---------------- */

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  stats,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {icon && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-grad-brand text-white shadow-float">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
              {title}
            </h1>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-500 sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {stats}
    </motion.header>
  );
}

/* ---------------- filter pills ---------------- */

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number; tone?: Tone }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const layoutId = useRef(`fp-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors duration-200',
            value === o.value
              ? 'border-transparent text-white'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={layoutId}
              className={cx('absolute inset-0 rounded-full', TONE_GRAD[o.tone ?? 'brand'])}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-1.5 whitespace-nowrap">
            {o.label}
            {o.count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 text-2xs tabular-nums',
                  value === o.value ? 'bg-white/25' : 'bg-ink-100 text-ink-500',
                )}
              >
                {o.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- misc ---------------- */

/** Small key/value block used in dense detail grids. */
export function DataPoint({
  label,
  value,
  icon,
  mono,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('rounded-xl bg-ink-50/80 px-3 py-2.5 ring-1 ring-ink-200/60', className)}>
      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
        {icon}
        {label}
      </p>
      <p
        className={cx(
          'mt-1 break-words text-[13px] font-bold text-ink-900',
          mono && 'font-mono text-xs tracking-tight',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ResultCount({ n }: { n: number }) {
  const { t } = useI18n();
  return (
    <span className="text-[13px] font-semibold text-ink-500">
      <span className="tabular-nums text-ink-800">{n}</span> {n === 1 ? t('result') : t('results')}
    </span>
  );
}
