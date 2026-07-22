/* ============================================================
   Amount spelled out in full.

   Every receipt and invoice printed in Algeria carries the sum in letters
   under the figure — "arrêté le présent reçu à la somme de …". It is what
   makes the document hard to alter after the fact, so it belongs on the
   page next to the amount, not as decoration.
   ============================================================ */

import type { Lang } from '../i18n/translations';

/* ---------------- French ---------------- */

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];

const FR_TENS: Record<number, string> = {
  2: 'vingt',
  3: 'trente',
  4: 'quarante',
  5: 'cinquante',
  6: 'soixante',
};

/**
 * 0–99, with the 70/80/90 irregularities French is famous for.
 *
 * `beforeMille` marks a group that "mille" follows. Both "vingt" and "cent"
 * drop their plural s there — quatre-vingt mille, but quatre-vingts millions,
 * because "million" is a noun and "mille" is not.
 */
function frBelow100(n: number, beforeMille = false): string {
  if (n < 17) return FR_UNITS[n];
  if (n < 20) return `dix-${FR_UNITS[n - 10]}`;

  // 80–99 counts on from 80: quatre-vingt-un, quatre-vingt-douze. No "et".
  if (n >= 80) {
    const rest = n - 80;
    if (rest === 0) return beforeMille ? 'quatre-vingt' : 'quatre-vingts';
    return `quatre-vingt-${frBelow100(rest)}`;
  }

  // 70–79 counts on from 60: soixante-dix, soixante-et-onze, soixante-douze.
  if (n >= 70) {
    const rest = n - 60;
    return rest === 11 ? 'soixante-et-onze' : `soixante-${frBelow100(rest)}`;
  }

  const ten = Math.floor(n / 10);
  const rest = n % 10;
  if (rest === 0) return FR_TENS[ten];
  if (rest === 1) return `${FR_TENS[ten]}-et-un`;
  return `${FR_TENS[ten]}-${FR_UNITS[rest]}`;
}

function frBelow1000(n: number, beforeMille = false): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return frBelow100(rest, beforeMille);
  // "cent" takes an s only when multiplied and no numeral follows it.
  const plural = rest === 0 && !beforeMille;
  const head = h === 1 ? 'cent' : `${FR_UNITS[h]} cent${plural ? 's' : ''}`;
  return rest === 0 ? head : `${head} ${frBelow100(rest, beforeMille)}`;
}

function frWords(n: number): string {
  if (n === 0) return FR_UNITS[0];

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  const out: string[] = [];
  if (billions) out.push(billions === 1 ? 'un milliard' : `${frBelow1000(billions)} milliards`);
  if (millions) out.push(millions === 1 ? 'un million' : `${frBelow1000(millions)} millions`);
  // "mille" is invariable and never preceded by "un"; it also freezes the
  // plural of the vingt/cent that precedes it.
  if (thousands) out.push(thousands === 1 ? 'mille' : `${frBelow1000(thousands, true)} mille`);
  if (rest) out.push(frBelow1000(rest));

  return out.join(' ');
}

/* ---------------- Arabic ---------------- */

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];

const AR_TEENS = [
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر',
  'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];

const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

const AR_HUNDREDS = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة',
  'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة',
];

function arBelow100(n: number): string {
  if (n < 10) return AR_ONES[n];
  if (n < 20) return AR_TEENS[n - 10];
  const unit = n % 10;
  const ten = AR_TENS[Math.floor(n / 10)];
  // Arabic states the unit first: واحد وعشرون.
  return unit ? `${AR_ONES[unit]} و${ten}` : ten;
}

function arBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return arBelow100(rest);
  return rest === 0 ? AR_HUNDREDS[h] : `${AR_HUNDREDS[h]} و${arBelow100(rest)}`;
}

/**
 * Arabic counted nouns change shape with the count: one, a dual, a plural for
 * 3–10, then the singular accusative again from 11 up.
 */
function arScale(count: number, forms: [string, string, string, string]): string {
  const [one, two, few, many] = forms;
  if (count === 1) return one;
  if (count === 2) return two;
  if (count >= 3 && count <= 10) return `${arBelow1000(count)} ${few}`;
  return `${arBelow1000(count)} ${many}`;
}

function arWords(n: number): string {
  if (n === 0) return 'صفر';

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  const out: string[] = [];
  if (billions) out.push(arScale(billions, ['مليار', 'ملياران', 'مليارات', 'ملياراً']));
  if (millions) out.push(arScale(millions, ['مليون', 'مليونان', 'ملايين', 'مليوناً']));
  if (thousands) out.push(arScale(thousands, ['ألف', 'ألفان', 'آلاف', 'ألفاً']));
  if (rest) out.push(arBelow1000(rest));

  return out.join(' و');
}

/* ---------------- public ---------------- */

/**
 * Spells out a money amount, centimes included when there are any.
 * Amounts beyond a thousand billion fall back to the figure — no document
 * in this application will ever reach it, and a wrong reading is worse
 * than none.
 */
export function amountInWords(value: number, lang: Lang = 'fr', currency = 'DA'): string {
  const safe = Math.abs(Math.round((value || 0) * 100) / 100);
  if (!Number.isFinite(safe) || safe >= 1e12) return `${safe} ${currency}`;

  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);
  const negative = value < 0;

  if (lang === 'ar') {
    const head = `${arWords(whole)} ${currency}`;
    const tail = cents ? ` و${arWords(cents)} سنتيم` : '';
    return `${negative ? 'ناقص ' : ''}${head}${tail}`;
  }

  const head = `${frWords(whole)} ${currency}`;
  const tail = cents ? ` et ${frWords(cents)} centimes` : '';
  const text = `${negative ? 'moins ' : ''}${head}${tail}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
