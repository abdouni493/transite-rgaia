/* ============================================================
   Shared A4 print document.

   Every printable screen in the app renders through <PrintDocument>, so the
   masthead is identical everywhere:

     ─────────────────────────────────────────────────────────
      [logo]
      ENTREPRISE                          coordonnées / NIF / RC
     ═════════════════════════════════════════════════════════
                       SUIVI DE PAIEMENT
     ─────────────────────────────────────────────────────────
   ============================================================ */

import type { ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { formatDate, todayISO } from '../../lib/format';
import { Button, cx } from '../ui/primitives';
import { Modal } from '../ui/overlays';

/* ---------------- print stylesheet ---------------- */

export const PRINT_CSS = `
.tp-doc { color: #0d1526; font-feature-settings: "tnum"; }
.tp-doc table { width: 100%; border-collapse: collapse; }
.tp-doc th, .tp-doc td { border: 1px solid #c6ced9; padding: 6px 9px; font-size: 11.5px; line-height: 1.35; }
.tp-doc thead th {
  background-color: #172952; color: #ffffff; font-weight: 800;
  text-transform: uppercase; letter-spacing: .04em; font-size: 9.5px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-doc tbody tr:nth-child(even) td {
  background-color: #f6f8fb;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-doc tfoot td {
  background-color: #dfe4ec; font-weight: 800; border-top: 2px solid #172952;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-box { border: 1px solid #c6ced9; background-color: #f6f8fb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tp-rule { height: 3px; background: linear-gradient(90deg, #080f22 0%, #1f366c 40%, #6f7b8e 75%, #c9cfdb 100%);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tp-hair { height: 1px; background-color: #c6ced9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tp-title {
  background-color: #f6f8fb; border-top: 1px solid #c6ced9; border-bottom: 1px solid #c6ced9;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
@media print {
  /* Only the preview portal reaches the printer — #root, the dialog that
     opened it, and the toast layer all drop out. */
  body > * { display: none !important; }
  body > div:has(.print-area) {
    position: static !important;
    display: block !important;
    padding: 0 !important;
    z-index: auto !important;
  }
  body > div:has(.print-area) > div:first-child { display: none !important; }
  .print-area, .print-area * { overflow: visible !important; max-height: none !important; }
}
`;

/* ---------------- logo ---------------- */

export function CompanyMark({ logo, size = 56 }: { logo?: string; size?: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        style={{ height: size, width: size }}
        className="shrink-0 rounded-lg object-contain"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      style={{ height: size, width: size }}
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="tpLogo" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#080F22" />
          <stop offset=".45" stopColor="#1F366C" />
          <stop offset="1" stopColor="#8C97A9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#tpLogo)" />
      <path
        d="M14 38h4.2a5 5 0 0 1 9.6 0h8.4a5 5 0 0 1 9.6 0H50"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M14 32V24a3 3 0 0 1 3-3h14v11M31 21h7l7 8v3"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="23" cy="41" r="3.6" fill="#fff" />
      <circle cx="41" cy="41" r="3.6" fill="#fff" />
    </svg>
  );
}

/* ---------------- document frame ---------------- */

export function PrintDocument({
  title,
  reference,
  children,
}: {
  /** Big centred banner under the rule, e.g. "Suivi de paiement". */
  title: string;
  /** Small line under the banner — container name, client, period… */
  reference?: string;
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const co = state.company;

  const line = (label: string, value?: string) =>
    value ? (
      <p className="text-[10.5px] leading-[1.5]">
        <span className="font-bold">{label}:</span> <span>{value}</span>
      </p>
    ) : null;

  return (
    <div className="tp-doc mx-auto w-full max-w-[210mm] bg-white">
      {/* ---------- masthead ---------- */}
      <header className="print-break">
        {/* logo sits alone on the first line */}
        <div className="mb-2">
          <CompanyMark logo={co.logo} />
        </div>

        {/* name on the left, company details on the right */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-[52%]">
            <p className="text-[20px] font-extrabold uppercase leading-tight tracking-tight">
              {co.name || t('appName')}
            </p>
            {co.description && (
              <p className="mt-1 text-[10.5px] font-medium leading-snug text-ink-600">
                {co.description}
              </p>
            )}
          </div>
          <div className="min-w-0 max-w-[46%] text-end">
            {line(t('address'), co.address)}
            {line(t('phone'), co.phone)}
            {line(t('email'), co.email)}
            {line(t('nif'), co.nif)}
            {line(t('nis'), co.nis)}
            {line(t('articleNumber'), co.article)}
            {line(t('rc'), co.rc)}
          </div>
        </div>

        <div className="tp-rule mt-3" />

        {/* ---------- document banner ---------- */}
        <div className="tp-title mt-0 px-4 py-3 text-center">
          <h1 className="text-[17px] font-extrabold uppercase tracking-[0.14em]">{title}</h1>
          {reference && (
            <p className="mt-1 text-[11px] font-bold text-ink-600">{reference}</p>
          )}
          <p className="mt-0.5 text-[10px] font-semibold text-ink-500">
            {t('printedOn')} {formatDate(todayISO(), lang)}
          </p>
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

/* ---------------- reusable body blocks ---------------- */

export function PrintSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('print-break', className)}>
      {title && (
        <h2 className="mb-1.5 border-s-[3px] border-brand-800 ps-2 text-[11.5px] font-extrabold uppercase tracking-wide">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function InfoCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx('mt-0.5 truncate text-[12px] font-bold', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

export function TotalCell({
  label,
  value,
  color = '#0d1526',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="tp-box rounded px-3 py-2 text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-0.5 text-[14px] font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/** Two signature rules — always the last thing on the page. */
export function PrintSignatures() {
  const { t } = useI18n();
  const { state } = useStore();
  return (
    <footer className="print-break mt-10 flex flex-wrap items-end justify-between gap-8">
      <div className="min-w-[40%] flex-1">
        <p className="mb-10 text-[10.5px] font-bold">{t('clientSignature')}</p>
        <div className="tp-hair" />
      </div>
      <div className="min-w-[40%] flex-1 text-end">
        <p className="mb-10 text-[10.5px] font-bold">{t('companySignature')}</p>
        <div className="tp-hair" />
        <p className="mt-1 text-[10.5px] font-extrabold">{state.company.name || t('appName')}</p>
      </div>
    </footer>
  );
}

/* ---------------- modal shell ---------------- */

/**
 * Full-bleed preview dialog. The toolbar is `.no-print`, so what you see
 * below it is exactly what comes out of the printer.
 */
export function PrintPreview({
  open,
  onClose,
  heading,
  subheading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  subheading?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <Modal open={open} onClose={onClose} size="2xl" bare className="print-area">
      <style>{PRINT_CSS}</style>

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-ink-200/70 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-brand text-white shadow-float">
            <Printer size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-ink-900">{heading}</h2>
            {subheading && <p className="truncate text-xs text-ink-500">{subheading}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
            {t('print')}
          </Button>
          <Button size="sm" variant="secondary" icon={<X size={15} />} onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </div>

      {children}
    </Modal>
  );
}
