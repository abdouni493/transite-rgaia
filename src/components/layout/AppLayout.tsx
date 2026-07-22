import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/translations';
import { useStore } from '../../store/AppStore';
import type { PageKey } from '../../lib/types';
import { Avatar, cx, IconButton } from '../ui/primitives';
import { useConfirm } from '../ui/overlays';
import { pageVariants, pageVariantsReduced } from '../ui/motion';
import { BrandMark } from './BrandMark';
import { LangSwitch } from './LangSwitch';

interface NavDef {
  key: PageKey;
  label: TranslationKey;
  icon: ReactNode;
}

const NAV: NavDef[] = [
  { key: 'dashboard', label: 'dashboard', icon: <LayoutDashboard size={19} /> },
  { key: 'principalClients', label: 'principalClients', icon: <Users size={19} /> },
  { key: 'secondaryClients', label: 'secondaryClients', icon: <UsersRound size={19} /> },
  { key: 'containers', label: 'containers', icon: <Boxes size={19} /> },
  { key: 'customs', label: 'customs', icon: <FileSpreadsheet size={19} /> },
  { key: 'paymentTracking', label: 'paymentTracking', icon: <CreditCard size={19} /> },
  { key: 'caisse', label: 'caisse', icon: <Wallet size={19} /> },
  { key: 'workers', label: 'workers', icon: <UserCog size={19} /> },
  { key: 'reports', label: 'reports', icon: <BarChart3 size={19} /> },
  { key: 'settings', label: 'settings', icon: <SettingsIcon size={19} /> },
];

export function AppLayout({
  page,
  onNavigate,
  children,
}: {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  children: ReactNode;
}) {
  const { t, isRtl } = useI18n();
  const { session, logout, can, state } = useStore();
  const confirm = useConfirm();
  const reduce = useReducedMotion();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('transitpro.sidebar') === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('transitpro.sidebar', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [page]);

  const items = NAV.filter((n) => can(n.key));

  const handleLogout = async () => {
    const ok = await confirm({
      title: t('logout'),
      message: t('logoutConfirm'),
      confirmLabel: t('logout'),
      tone: 'danger',
      icon: <LogOut size={26} />,
    });
    if (ok) logout();
  };

  const sidebar = (mobile: boolean) => (
    <div
      className={cx(
        'flex h-full flex-col bg-white',
        mobile ? 'w-[17rem]' : 'border-e border-ink-200/80',
      )}
    >
      {/* brand */}
      <div
        className={cx(
          'flex h-16 shrink-0 items-center gap-3 border-b border-ink-200/70 px-4',
          collapsed && !mobile && 'justify-center px-2',
        )}
      >
        <BrandMark logo={state.company.logo} name={state.company.name} size="sm" />
        <AnimatePresence initial={false}>
          {(!collapsed || mobile) && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 overflow-hidden"
            >
              <p className="truncate text-[15px] font-extrabold leading-tight text-ink-900">
                {state.company.name || t('appName')}
              </p>
              <p className="truncate text-2xs font-semibold text-brand-600">{t('appTagline')}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {mobile && (
          <IconButton label={t('close')} onClick={() => setMobileOpen(false)} className="ms-auto">
            <X size={18} />
          </IconButton>
        )}
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
        {(!collapsed || mobile) && (
          <p className="mb-2 px-2.5 text-2xs font-bold uppercase tracking-widest text-ink-400">
            {t('navigation')}
          </p>
        )}
        <ul className="space-y-1">
          {items.map((n) => {
            const activeItem = page === n.key;
            return (
              <li key={n.key}>
                <button
                  onClick={() => onNavigate(n.key)}
                  title={collapsed && !mobile ? t(n.label) : undefined}
                  aria-current={activeItem ? 'page' : undefined}
                  className={cx(
                    'group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[13.5px] font-semibold transition-colors duration-200',
                    collapsed && !mobile && 'justify-center px-2',
                    activeItem ? 'text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )}
                >
                  {activeItem && (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-grad-brand shadow-float"
                    />
                  )}
                  <span className="relative shrink-0">{n.icon}</span>
                  {(!collapsed || mobile) && (
                    <span className="relative truncate">{t(n.label)}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="my-3 h-px bg-ink-200/70" />

        {/* logout is spatially separated from navigation (destructive-nav-separation) */}
        <button
          onClick={handleLogout}
          title={collapsed && !mobile ? t('logout') : undefined}
          className={cx(
            'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start text-[13.5px] font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-50',
            collapsed && !mobile && 'justify-center px-2',
          )}
        >
          <LogOut size={19} className="shrink-0" />
          {(!collapsed || mobile) && <span className="truncate">{t('logout')}</span>}
        </button>
      </nav>

      {/* user */}
      <div className={cx('shrink-0 border-t border-ink-200/70 p-3', collapsed && !mobile && 'px-2')}>
        <div
          className={cx(
            'flex items-center gap-2.5 rounded-2xl bg-grad-brand-soft p-2.5 ring-1 ring-brand-100',
            collapsed && !mobile && 'justify-center bg-transparent p-1 ring-0',
          )}
        >
          <Avatar name={session?.name ?? '?'} size="sm" gradient="from-brand-800 to-ocean-400" />
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink-900">{session?.name}</p>
              <p className="truncate text-2xs font-semibold text-brand-600">{session?.roleName}</p>
            </div>
          )}
        </div>
      </div>

      {!mobile && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
          title={collapsed ? t('expandMenu') : t('collapseMenu')}
          className="mx-3 mb-3 flex cursor-pointer items-center justify-center rounded-xl border border-ink-200 bg-white py-2 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
        >
          {collapsed === isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-ink-50">
      {/* desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 268 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="sticky top-0 z-30 hidden h-dvh shrink-0 lg:block"
      >
        {sidebar(false)}
      </motion.aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[90] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-ink-900/45 backdrop-blur-[3px]"
            />
            <motion.div
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="absolute inset-y-0 start-0 z-10 shadow-2xl"
            >
              {sidebar(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <IconButton
            label={t('navigation')}
            variant="secondary"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </IconButton>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.p
                key={page}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="truncate text-sm font-bold text-ink-900"
              >
                {t(NAV.find((n) => n.key === page)?.label ?? 'dashboard')}
              </motion.p>
            </AnimatePresence>
          </div>

          <LangSwitch />
        </header>

        <main className="min-w-0 flex-1 bg-grad-mesh px-4 py-5 sm:px-6 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              variants={reduce ? pageVariantsReduced : pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mx-auto w-full max-w-[1600px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
