import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, cx, IconButton, type Tone } from './primitives';
import { backdropVariants, drawerVariants, modalVariants, toastVariants } from './motion';

/* ============================== Modal ============================== */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const MODAL_W: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[95vw]',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  /** Slide-in drawer instead of a centered dialog. */
  drawer?: boolean;
  /** Hide the default header (for fully custom content). */
  bare?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  footer,
  children,
  drawer,
  bare,
  className,
}: ModalProps) {
  const { isRtl } = useI18n();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const panelVariants = drawer ? drawerVariants(isRtl) : modalVariants;
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cx(
            'fixed inset-0 z-[100] flex',
            drawer ? 'justify-end' : 'items-center justify-center p-4 sm:p-6',
          )}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-ink-900/45 backdrop-blur-[3px]"
          />
          <motion.div
            variants={reduce ? fade : panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cx(
              'relative z-10 flex w-full flex-col overflow-hidden bg-white shadow-2xl',
              drawer
                ? 'h-full max-w-xl rounded-none sm:rounded-s-3xl'
                : cx('max-h-[92vh] rounded-3xl', MODAL_W[size]),
              className,
            )}
          >
            {!bare && (
              <div className="relative shrink-0 border-b border-ink-200/70 bg-grad-brand-soft px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3.5 pe-10">
                  {icon && (
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grad-brand text-white shadow-float">
                      {icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {title && (
                      <h2 className="truncate text-base font-bold text-ink-900 sm:text-lg">{title}</h2>
                    )}
                    {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
                  </div>
                </div>
                <IconButton
                  label="close"
                  onClick={onClose}
                  variant="ghost"
                  className="absolute end-4 top-4 hover:bg-white"
                >
                  <X size={18} />
                </IconButton>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

            {footer && (
              <div className="shrink-0 border-t border-ink-200/70 bg-ink-50/70 px-5 py-3.5 sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ============================== Confirm dialog ============================== */

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand' | 'success' | 'amber';
  icon?: ReactNode;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const CONFIRM_TONE = {
  danger: { ring: 'bg-rose-100 text-rose-600', btn: 'danger' as const },
  brand: { ring: 'bg-brand-100 text-brand-700', btn: 'primary' as const },
  success: { ring: 'bg-emerald-100 text-emerald-700', btn: 'success' as const },
  amber: { ring: 'bg-amber-100 text-amber-700', btn: 'primary' as const },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  const tone = CONFIRM_TONE[opts?.tone ?? 'danger'];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => settle(false)}
        size="sm"
        bare
        footer={
          <div className="flex gap-2.5">
            <Button variant="secondary" block onClick={() => settle(false)}>
              {opts?.cancelLabel ?? t('cancel')}
            </Button>
            <Button variant={tone.btn} block onClick={() => settle(true)}>
              {opts?.confirmLabel ?? t('confirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.05 }}
            className={cx('mb-4 flex h-14 w-14 items-center justify-center rounded-2xl', tone.ring)}
          >
            {opts?.icon ?? <AlertTriangle size={26} />}
          </motion.span>
          <h3 className="text-lg font-bold text-ink-900">{opts?.title}</h3>
          {opts?.message && (
            <div className="mt-2 text-sm leading-relaxed text-ink-600">{opts.message}</div>
          )}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

/* ============================== Toasts ============================== */

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
  warning: (m: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_STYLE: Record<ToastKind, { icon: ReactNode; bar: string; ring: string }> = {
  success: {
    icon: <Check size={16} strokeWidth={3} />,
    bar: 'bg-grad-emerald',
    ring: 'bg-emerald-500',
  },
  error: { icon: <XCircle size={16} />, bar: 'bg-grad-rose', ring: 'bg-rose-500' },
  info: { icon: <Info size={16} />, bar: 'bg-grad-ocean', ring: 'bg-ocean-500' },
  warning: { icon: <AlertTriangle size={16} />, bar: 'bg-grad-sun', ring: 'bg-amber-500' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current;
    setItems((p) => [...p, { id, kind, message }]);
    window.setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 3800);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      warning: (m) => push('warning', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const s = TOAST_STYLE[item.kind];
              return (
                <motion.div
                  key={item.id}
                  layout
                  variants={toastVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="pointer-events-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl border border-ink-200/80 bg-white/95 py-3 pe-4 ps-0 shadow-card-hover backdrop-blur-xl"
                >
                  <span className={cx('h-full w-1.5 self-stretch', s.bar)} />
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white',
                      s.ring,
                    )}
                  >
                    {s.icon}
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] font-semibold text-ink-800">
                    {item.message}
                  </p>
                  <button
                    onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                    aria-label="dismiss"
                    className="shrink-0 cursor-pointer rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ============================== Tabs ============================== */

export interface TabDef {
  key: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  tone?: Tone;
}

/**
 * Segmented tab bar with a shared-layout indicator.
 * Used for the multi-panel "view details" dialogs.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
  variant = 'pill',
}: {
  tabs: TabDef[];
  active: string;
  onChange: (k: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}) {
  const layoutId = useRef(`tabs-${Math.random().toString(36).slice(2)}`).current;

  if (variant === 'underline') {
    return (
      <div className={cx('flex gap-1 overflow-x-auto border-b border-ink-200', className)}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => onChange(tb.key)}
            className={cx(
              'relative shrink-0 cursor-pointer px-4 py-2.5 text-[13px] font-semibold transition-colors',
              active === tb.key ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <span className="flex items-center gap-2">
              {tb.icon}
              {tb.label}
              {tb.badge !== undefined && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-2xs font-bold text-ink-600">
                  {tb.badge}
                </span>
              )}
            </span>
            {active === tb.key && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-grad-brand"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cx(
        'flex gap-1 overflow-x-auto rounded-2xl border border-ink-200/80 bg-ink-100/70 p-1',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tb) => (
        <button
          key={tb.key}
          role="tab"
          aria-selected={active === tb.key}
          onClick={() => onChange(tb.key)}
          className={cx(
            'relative shrink-0 cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200',
            active === tb.key ? 'text-brand-800' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {active === tb.key && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-ink-200/70"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-2 whitespace-nowrap">
            {tb.icon}
            {tb.label}
            {tb.badge !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-2xs font-bold',
                  active === tb.key ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-600',
                )}
              >
                {tb.badge}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ============================== Dropdown menu ============================== */

export interface MenuItemDef {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Renders a separator above this item. */
  divider?: boolean;
}

/** The "three dots" action menu. Closes on outside click, Escape, or selection. */
export function DropdownMenu({
  items,
  trigger,
  align = 'end',
  className,
  header,
}: {
  items: MenuItemDef[];
  trigger: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div ref={ref} className={cx('relative', className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            className={cx(
              'absolute z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-1.5 shadow-card-hover',
              align === 'end' ? 'end-0' : 'start-0',
            )}
          >
            {header && (
              <div className="border-b border-ink-100 px-3 pb-2 pt-1.5 text-2xs font-bold uppercase tracking-wide text-ink-400">
                {header}
              </div>
            )}
            {items.map((it) => (
              <div key={it.key}>
                {it.divider && <div className="my-1.5 h-px bg-ink-150 bg-ink-100" />}
                <button
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13px] font-semibold transition-colors duration-150',
                    it.disabled
                      ? 'cursor-not-allowed text-ink-300'
                      : it.danger
                        ? 'cursor-pointer text-rose-600 hover:bg-rose-50'
                        : 'cursor-pointer text-ink-700 hover:bg-ink-100',
                  )}
                >
                  <span className={cx('shrink-0', it.danger ? 'text-rose-500' : 'text-ink-400')}>
                    {it.icon}
                  </span>
                  {it.label}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
