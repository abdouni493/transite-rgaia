/* ============================================================
   Shared A4 print document.

   Every printable screen renders through <PrintDocument>, so the chrome is
   identical everywhere:

     ─────────────────────────────────────────────────────────
      [logo]  ENTREPRISE                    ┌───────────────┐
              activité                      │ RÉFÉRENCE     │
              adresse · tél · e-mail        │ 00042         │
                                            └───────────────┘
     ═════════════════════════════════════════════════════════
                       REÇU DE VERSEMENT
     ─────────────────────────────────────────────────────────
      … sections …
     ─────────────────────────────────────────────────────────
      NIF · NIS · Art. · RC                            Page 1
   ============================================================ */

import type { ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useStore } from '../../store/AppStore';
import { formatDate, todayISO } from '../../lib/format';
import { Button, cx } from '../ui/primitives';
import { Modal } from '../ui/overlays';

/* ---------------- palette ----------------
   Kept in one place: these are the only colours a printed page ever uses,
   and every one of them has to survive "background graphics: off" gracefully. */

const INK = '#0d1526';
const NAVY = '#172952';
const LINE = '#c6ced9';
const WASH = '#f6f8fb';

/* ---------------- print stylesheet ---------------- */

export const PRINT_CSS = `
.tp-doc {
  color: ${INK};
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

/* ---- tables ---- */
.tp-doc table { width: 100%; border-collapse: collapse; }
.tp-doc th, .tp-doc td {
  border: 1px solid ${LINE};
  padding: 6px 9px;
  font-size: 11px;
  line-height: 1.4;
  vertical-align: top;
}
.tp-doc thead th {
  background-color: ${NAVY}; color: #ffffff; font-weight: 800;
  text-transform: uppercase; letter-spacing: .05em; font-size: 9px;
  vertical-align: middle; padding-top: 7px; padding-bottom: 7px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-doc tbody tr:nth-child(even) td {
  background-color: ${WASH};
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-doc tfoot td {
  background-color: #dfe4ec; font-weight: 800; border-top: 2px solid ${NAVY};
  font-size: 11.5px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ---- surfaces ---- */
.tp-box {
  border: 1px solid ${LINE}; background-color: ${WASH};
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-panel {
  border: 1px solid ${LINE}; background-color: #ffffff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* the navy band used for the one figure that matters on each document */
.tp-hero {
  background-color: ${NAVY}; color: #ffffff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ---- rules ---- */
.tp-rule {
  height: 3px;
  background: linear-gradient(90deg, #080f22 0%, #1f366c 40%, #6f7b8e 75%, #c9cfdb 100%);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.tp-hair { height: 1px; background-color: ${LINE}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ---- section heading: a navy tab rather than a bare bold line ---- */
.tp-legend {
  display: inline-block;
  background-color: ${NAVY}; color: #ffffff;
  padding: 3px 10px; border-radius: 2px;
  font-size: 9px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .1em;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ---- document banner ---- */
.tp-title {
  background-color: ${WASH};
  border-top: 1px solid ${LINE}; border-bottom: 1px solid ${LINE};
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
  /* the dialog's own scroll padding must not add to the @page margin */
  .print-area > div { padding: 0 !important; }
  /* let the sheet use the full printable width @page already inset for us */
  .tp-doc { max-width: none !important; }
}
`;

/* ---------------- logo ---------------- */

export function CompanyMark({ logo, size = 54 }: { logo?: string; size?: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        style={{
          height: size,
          width: size,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
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

export interface DocMeta {
  label: string;
  value: string;
  mono?: boolean;
  /** Renders the value larger and navy — for the document's own number. */
  strong?: boolean;
}

export function PrintDocument({
  title,
  reference,
  meta,
  children,
}: {
  /** Big centred banner under the rule, e.g. "Reçu de versement". */
  title: string;
  /** Small line under the banner — container name, client, period… */
  reference?: string;
  /** Boxed key/value panel in the top-right corner: reference, date, page. */
  meta?: DocMeta[];
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const co = state.company;

  const contact = [
    co.address && `${t('address')}: ${co.address}`,
    co.phone && `${t('phone')}: ${co.phone}`,
    co.email && `${t('email')}: ${co.email}`,
  ].filter(Boolean) as string[];

  /* The fiscal identifiers belong at the foot of the page, the way every
     Algerian commercial document sets them out. */
  const legal = [
    co.nif && `${t('nif')}: ${co.nif}`,
    co.nis && `${t('nis')}: ${co.nis}`,
    co.article && `${t('articleNumber')}: ${co.article}`,
    co.rc && `${t('rc')}: ${co.rc}`,
  ].filter(Boolean) as string[];

  return (
    <div className="tp-doc mx-auto flex w-full max-w-[210mm] flex-col bg-white">
      {/* ---------- masthead ---------- */}
      <header className="print-break">
        <div className="flex items-start justify-between gap-6">
          {/* identity */}
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <CompanyMark logo={co.logo} />
            <div className="min-w-0">
              <p className="text-[19px] font-extrabold uppercase leading-[1.15] tracking-tight">
                {co.name || t('appName')}
              </p>
              {co.description && (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  {co.description}
                </p>
              )}
              {contact.length > 0 && (
                <div className="mt-1.5 space-y-[1px]">
                  {contact.map((l) => (
                    <p key={l} className="text-[9.5px] leading-[1.5] text-ink-600">
                      {l}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* document meta — the reference box */}
          {meta && meta.length > 0 && (
            <div className="tp-panel w-[46mm] shrink-0 rounded-[2px]">
              {meta.map((m, i) => (
                <div
                  key={m.label}
                  className={cx('px-3 py-1.5', i > 0 && 'border-t border-[#c6ced9]')}
                >
                  <p className="text-[7.5px] font-extrabold uppercase tracking-[0.12em] text-ink-500">
                    {m.label}
                  </p>
                  <p
                    className={cx(
                      'mt-[1px] truncate font-extrabold leading-tight',
                      m.strong ? 'text-[15px]' : 'text-[10.5px]',
                      m.mono && 'font-mono tracking-tight',
                    )}
                    style={m.strong ? { color: NAVY } : undefined}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tp-rule mt-3" />

        {/* ---------- document banner ---------- */}
        <div className="tp-title px-4 py-2.5 text-center">
          <h1 className="text-[16px] font-extrabold uppercase leading-tight tracking-[0.16em]">
            {title}
          </h1>
          {reference && <p className="mt-0.5 text-[10.5px] font-bold text-ink-600">{reference}</p>}
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="mt-4 flex-1 space-y-3.5">{children}</div>

      {/* ---------- legal footer ---------- */}
      <footer className="print-break mt-6">
        <div className="tp-hair" />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1.5">
          <p className="min-w-0 flex-1 text-[8px] leading-[1.5] text-ink-500">
            {legal.length > 0 ? legal.join('  ·  ') : (co.name || t('appName'))}
          </p>
          <p className="shrink-0 text-[8px] font-semibold text-ink-500">
            {t('printedOn')} {formatDate(todayISO(), lang)}
          </p>
        </div>
      </footer>
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
        <div className="mb-1.5">
          <span className="tp-legend">{title}</span>
        </div>
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
      <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-500">{label}</p>
      <p className={cx('mt-[1px] truncate text-[11.5px] font-bold', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  );
}

export function TotalCell({
  label,
  value,
  color = INK,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="tp-box rounded-[2px] px-3 py-2 text-center">
      <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-500">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/**
 * The one figure a document exists to state — navy band, big and unmissable.
 * `words` prints the sum in letters underneath, the way a receipt should.
 */
export function HeroAmount({
  label,
  value,
  words,
  wordsLabel,
}: {
  label: string;
  value: string;
  words?: string;
  wordsLabel?: string;
}) {
  return (
    <div className="print-break">
      <div className="tp-hero flex flex-wrap items-center justify-between gap-4 rounded-[2px] px-5 py-3.5">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">{label}</span>
        <span className="text-[23px] font-extrabold leading-none tabular-nums">{value}</span>
      </div>
      {words && (
        <div className="tp-box rounded-b-[2px] px-4 py-2">
          {wordsLabel && (
            <span className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-500">
              {wordsLabel}{' '}
            </span>
          )}
          <span className="text-[10.5px] font-bold italic">{words}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Two signature rules — always the last thing before the legal footer.
 *
 * The company side carries the electronic stamp from Paramètres when one is
 * uploaded; without it the block keeps the same height so the layout of a
 * printed page never shifts depending on the settings.
 */
export function PrintSignatures() {
  const { t } = useI18n();
  const { state } = useStore();
  const stamp = state.company.stamp;

  const box = (label: string, align: 'start' | 'end', children?: ReactNode) => (
    <div className={cx('min-w-[46%] flex-1', align === 'end' && 'text-end')}>
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-ink-500">{label}</p>
      <div
        className={cx(
          'mt-1 flex h-[74px] items-center rounded-[2px] border border-dashed border-[#c6ced9] px-3',
          align === 'end' ? 'justify-end' : 'justify-start',
        )}
      >
        {children}
      </div>
    </div>
  );

  return (
    <footer className="print-break mt-8 flex flex-wrap items-end justify-between gap-8">
      {box(t('clientSignature'), 'start')}
      {box(
        t('companySignature'),
        'end',
        stamp ? (
          <img
            src={stamp}
            alt=""
            style={{
              maxHeight: 66,
              maxWidth: 170,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
            className="object-contain"
          />
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-300">
            {state.company.name || t('appName')}
          </span>
        ),
      )}
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

      {/* the sheet reads as paper on screen too, so the preview is honest */}
      <div className="rounded-2xl bg-ink-100/60 p-4 print:bg-transparent print:p-0 sm:p-6">
        <div className="mx-auto max-w-[210mm] bg-white p-[10mm] shadow-card print:p-0 print:shadow-none">
          {children}
        </div>
      </div>
    </Modal>
  );
}
