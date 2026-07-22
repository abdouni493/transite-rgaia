import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useStore } from './store/AppStore';
import { useI18n } from './i18n/I18nProvider';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { EmptyState } from './components/ui/primitives';
import type { PageKey } from './lib/types';

/* Route-level code splitting keeps the initial bundle small. */
const PrincipalClients = lazy(() =>
  import('./pages/PrincipalClients').then((m) => ({ default: m.PrincipalClients })),
);
const SecondaryClients = lazy(() =>
  import('./pages/SecondaryClients').then((m) => ({ default: m.SecondaryClients })),
);
const Containers = lazy(() =>
  import('./pages/Containers').then((m) => ({ default: m.Containers })),
);
const Customs = lazy(() => import('./pages/Customs').then((m) => ({ default: m.Customs })));
const PaymentTracking = lazy(() =>
  import('./pages/PaymentTracking').then((m) => ({ default: m.PaymentTracking })),
);
const Caisse = lazy(() => import('./pages/Caisse').then((m) => ({ default: m.Caisse })));
const Workers = lazy(() => import('./pages/Workers').then((m) => ({ default: m.Workers })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const HASH_KEY = 'transitpro.page';

function readPage(): PageKey {
  const h = window.location.hash.replace('#/', '');
  if (h) return h as PageKey;
  return (localStorage.getItem(HASH_KEY) as PageKey) || 'dashboard';
}

export function App() {
  const { session, can, visiblePages, loading } = useStore();
  const { t } = useI18n();
  const [page, setPage] = useState<PageKey>(readPage);

  /* Deep-link support: every screen is reachable via #/<page>. */
  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!session) return;
    localStorage.setItem(HASH_KEY, page);
    if (window.location.hash !== `#/${page}`) window.location.hash = `#/${page}`;
  }, [page, session]);

  /* Land on the first page the user is actually allowed to see. */
  useEffect(() => {
    if (session && !can(page) && visiblePages.length) setPage(visiblePages[0]);
  }, [session, page, can, visiblePages]);

  /* Restoring the Supabase session — avoids flashing the login screen at
     someone who is already signed in. */
  if (loading && !session) return <BootScreen label={t('connecting')} />;

  if (!session) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35 }}
        >
          <Login />
        </motion.div>
      </AnimatePresence>
    );
  }

  const denied = (
    <EmptyState
      icon={<Lock size={28} />}
      title={t('accessDenied')}
      hint={t('accessDeniedHint')}
      className="rounded-3xl border border-ink-200/80 bg-white shadow-card"
    />
  );

  const render = () => {
    if (!can(page)) return denied;
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} />;
      case 'principalClients':
        return <PrincipalClients />;
      case 'secondaryClients':
        return <SecondaryClients />;
      case 'containers':
        return <Containers />;
      case 'customs':
        return <Customs />;
      case 'paymentTracking':
        return <PaymentTracking />;
      case 'caisse':
        return <Caisse />;
      case 'workers':
        return <Workers />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return denied;
    }
  };

  return (
    <AppLayout page={page} onNavigate={setPage}>
      <Suspense fallback={<PageSkeleton />}>{render()}</Suspense>
    </AppLayout>
  );
}

/** Shown while the Supabase session and the first data load resolve. */
function BootScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-grad-brand-soft">
      <motion.span
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl bg-grad-brand text-white shadow-float"
      >
        <ShieldCheck size={30} />
      </motion.span>
      <div className="flex items-center gap-2.5 text-sm font-semibold text-ink-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

/** Reserves layout space while a route chunk loads (avoids CLS). */
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-14 w-72 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}
