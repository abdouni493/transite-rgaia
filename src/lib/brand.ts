/* ============================================================
   Branding shown before the store holds anything.

   The login screen runs anonymously and Postgres only serves the `company`
   row to authenticated users, so the name and logo are mirrored into
   localStorage on every sign-in and read back the next time someone lands on
   the login page.
   ============================================================ */

const KEY = 'transitpro.brand';

export interface Brand {
  name: string;
  logo?: string;
}

export const EMPTY_BRAND: Brand = { name: '' };

export function readBrand(): Brand {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_BRAND;
    const parsed = JSON.parse(raw) as Partial<Brand>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      logo: typeof parsed.logo === 'string' ? parsed.logo : undefined,
    };
  } catch {
    return EMPTY_BRAND;
  }
}

export function writeBrand(brand: Brand) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: brand.name, logo: brand.logo }));
  } catch {
    // Quota exceeded (a large logo) — the login screen just falls back to the
    // app default, which is not worth interrupting the user for.
  }
}
