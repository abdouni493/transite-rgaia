import type { Lang } from '../i18n/translations';

/** Money — always tabular, grouped, no decimals (DZD has no practical cents here). */
export function formatMoney(value: number, lang: Lang = 'fr', currency = 'DA'): string {
  const locale = lang === 'ar' ? 'ar-DZ' : 'fr-DZ';
  const n = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(value || 0));
  return `${n} ${currency}`;
}

export function formatNumber(value: number, lang: Lang = 'fr'): string {
  const locale = lang === 'ar' ? 'ar-DZ' : 'fr-DZ';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0);
}

/** Compact money for tight card slots: 2,4 M DA */
export function formatMoneyShort(value: number, lang: Lang = 'fr', currency = 'DA'): string {
  const abs = Math.abs(value);
  const locale = lang === 'ar' ? 'ar-DZ' : 'fr-DZ';
  const f = (v: number, d: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  if (abs >= 1_000_000) return `${f(value / 1_000_000, 2)} M ${currency}`;
  if (abs >= 1_000) return `${f(value / 1_000, 1)} K ${currency}`;
  return `${f(value, 0)} ${currency}`;
}

export function formatDate(iso: string | undefined, lang: Lang = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateLong(iso: string | undefined, lang: Lang = 'fr'): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(iso: string, time?: string, lang: Lang = 'fr'): string {
  return time ? `${formatDate(iso, lang)} · ${time}` : formatDate(iso, lang);
}

export function formatPercent(value: number, lang: Lang = 'fr'): string {
  const locale = lang === 'ar' ? 'ar-DZ' : 'fr-DZ';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value || 0)} %`;
}

/* ---------- date helpers (local-time safe, no TZ drift) ---------- */

export function todayISO(): string {
  return toISO(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string, lang: Lang = 'fr'): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    month: 'short',
    year: '2-digit',
  }).format(d);
}

/** Inclusive range test on yyyy-MM-dd strings (lexicographic works). */
export function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

/** Whole months elapsed between two ISO dates, plus leftover days. */
export function diffYMD(fromISO: string, toISOStr: string) {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISOStr}T00:00:00`);
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISOStr}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** All yyyy-MM month keys from `from` to `to`, inclusive. */
export function monthsBetween(fromISO: string, toISOStr: string): string[] {
  const out: string[] = [];
  const a = new Date(`${fromISO.slice(0, 7)}-01T00:00:00`);
  const b = new Date(`${toISOStr.slice(0, 7)}-01T00:00:00`);
  while (a <= b) {
    out.push(`${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}`);
    a.setMonth(a.getMonth() + 1);
  }
  return out;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Normalize for accent-insensitive search (café → cafe). */
export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
