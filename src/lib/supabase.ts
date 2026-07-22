import { createClient } from '@supabase/supabase-js';

/**
 * Supabase connection.
 *
 * The values are read from Vite env vars (set them in Vercel → Settings →
 * Environment Variables) and fall back to this project so a fresh clone runs
 * with no configuration. The anon key is a public key — it is safe in the
 * bundle; every table is protected by the RLS policies in supabase_schema.sql.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://wbsekdrvehqcnmaymikp.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indic2VrZHJ2ZWhxY25tYXltaWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2Njk5OTIsImV4cCI6MjEwMDI0NTk5Mn0.1kYoEiMVmK3C95clYEo2II-klmJ-S6-KSf5GZoN9r8c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * A second client that never touches localStorage.
 *
 * Creating an employee login calls `signUp`, which would otherwise replace the
 * admin's own session with the brand-new employee's. Running it through this
 * throwaway client leaves the admin signed in.
 */
export function createIsolatedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** `crypto.randomUUID`, with a fallback for older browsers. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
