import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff, Search as SearchIcon, X } from 'lucide-react';
import { itemVariants, itemVariantsReduced, listVariants } from './motion';

export function cx(...parts: unknown[]) {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

/* ============================== Button ============================== */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'soft';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-grad-brand text-white shadow-float hover:brightness-[1.06] active:brightness-95 border-transparent',
  secondary: 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50 hover:border-ink-300 shadow-sm',
  outline:
    'bg-transparent text-brand-700 border-brand-300 hover:bg-brand-50 hover:border-brand-400',
  ghost: 'bg-transparent text-ink-600 border-transparent hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-grad-rose text-white shadow-[0_10px_24px_-12px_rgb(225_29_72_/_0.6)] hover:brightness-[1.06] border-transparent',
  success: 'bg-grad-emerald text-white shadow-[0_10px_24px_-12px_rgb(4_120_87_/_0.55)] hover:brightness-[1.06] border-transparent',
  soft: 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100',
};

const SIZES: Record<Size, string> = {
  xs: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, block, className, children, disabled, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      whileHover={reduce || disabled || loading ? undefined : { scale: 1.025 }}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center border font-semibold',
        'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        !disabled && !loading && 'cursor-pointer',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...(rest as HTMLMotionProps<'button'>)}
    >
      {loading ? (
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </motion.button>
  );
});

/** Compact square icon button — keeps a 44px hit area via padding. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant; tone?: string }
>(function IconButton({ label, variant = 'ghost', className, children, ...rest }, ref) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      whileHover={reduce ? undefined : { scale: 1.08 }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        VARIANTS[variant],
        className,
      )}
      {...(rest as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
});

/* ============================== Card ============================== */

export function Card({
  className,
  children,
  as: _as,
  ...rest
}: HTMLMotionProps<'div'> & { as?: never }) {
  return (
    <motion.div className={cx('card', className)} {...rest}>
      {children}
    </motion.div>
  );
}

/** Grid/list wrapper that staggers its children in. */
export function StaggerList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div variants={listVariants} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}

/** A single staggered child. */
export function StaggerItem({
  className,
  children,
  layout,
  ...rest
}: HTMLMotionProps<'div'>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? itemVariantsReduced : itemVariants}
      layout={layout}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ============================== Badge ============================== */

export type Tone =
  | 'brand'
  | 'ocean'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'slate'
  | 'sky';

export const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  ocean: 'bg-ocean-50 text-ocean-700 ring-1 ring-ocean-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  slate: 'bg-ink-100 text-ink-600 ring-1 ring-ink-200',
  sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
};

export const TONE_GRAD: Record<Tone, string> = {
  brand: 'bg-grad-brand',
  ocean: 'bg-grad-ocean',
  emerald: 'bg-grad-emerald',
  amber: 'bg-grad-sun',
  rose: 'bg-grad-rose',
  violet: 'bg-grad-violet',
  slate: 'bg-gradient-to-br from-ink-500 to-ink-700',
  sky: 'bg-gradient-to-br from-brand-500 to-ocean-400',
};

export function Badge({
  tone = 'slate',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx('chip', TONE_CHIP[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/* ============================== Inputs ============================== */

interface FieldWrapProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function FieldWrap({ label, hint, error, required, children, htmlFor, className }: FieldWrapProps) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ms-1 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="mt-1.5 text-xs font-medium text-rose-600"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  wrapClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, suffix, required, className, wrapClassName, ...rest },
  ref,
) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldWrap
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={wrapClassName}
    >
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-ink-400">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={!!error}
          className={cx('field', icon && 'ps-10', suffix && 'pe-12', error && 'field-err', className)}
          {...rest}
        />
        {suffix && (
          <span className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-xs font-semibold text-ink-500">
            {suffix}
          </span>
        )}
      </div>
    </FieldWrap>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps & { showLabel?: string; hideLabel?: string }>(
  function PasswordInput({ showLabel = 'Show', hideLabel = 'Hide', ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} {...rest} type={show ? 'text' : 'password'} className="pe-11" />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? hideLabel : showLabel}
          className={cx(
            'absolute end-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-400',
            'transition-colors hover:bg-ink-100 hover:text-ink-700',
            rest.label ? 'top-[30px]' : 'top-1.5',
          )}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    );
  },
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, ...rest },
  ref,
) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        rows={3}
        className={cx('field resize-y', error && 'field-err', className)}
        {...rest}
      />
    </FieldWrap>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, className, ...rest },
  ref,
) {
  const autoId = useId();
  const id = rest.id ?? autoId;
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select
        ref={ref}
        id={id}
        className={cx('field cursor-pointer appearance-none bg-no-repeat pe-9', error && 'field-err', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '16px',
        }}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
});

/* ============================== SearchBar ============================== */

export function SearchBar({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cx('relative', className)}>
      <SearchIcon
        size={17}
        className="pointer-events-none absolute inset-y-0 start-0 my-auto ms-3.5 text-ink-400"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field ps-10 pe-10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="clear"
          className="absolute inset-y-0 end-0 my-auto me-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/* ============================== Toggle ============================== */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        'flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-250',
          checked ? 'bg-grad-brand' : 'bg-ink-300',
          !disabled && 'cursor-pointer',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md',
            checked ? 'start-[22px]' : 'start-0.5',
          )}
        />
      </button>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-semibold text-ink-800">{label}</span>}
          {hint && <span className="block text-xs text-ink-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

/* ============================== Checkbox ============================== */

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  tone = 'brand',
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: string;
  tone?: 'brand' | 'rose';
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        'group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-ink-50',
      )}
    >
      <span
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
        className={cx(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-all duration-200',
          checked
            ? tone === 'rose'
              ? 'border-rose-500 bg-rose-500'
              : 'border-brand-600 bg-brand-600'
            : 'border-ink-300 bg-white group-hover:border-ink-400',
        )}
      >
        <motion.svg
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 28 }}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </motion.svg>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

/* ============================== Progress ============================== */

export function ProgressBar({
  value,
  tone = 'brand',
  height = 'h-2',
  showLabel,
  className,
}: {
  value: number;
  tone?: Tone;
  height?: string;
  showLabel?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      <div
        className={cx('relative w-full overflow-hidden rounded-full bg-ink-150 bg-ink-200/70', height)}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={cx('h-full rounded-full', TONE_GRAD[tone])}
        />
      </div>
      {showLabel && <p className="mt-1 text-xs font-medium text-ink-500">{showLabel}</p>}
    </div>
  );
}

/* ============================== EmptyState ============================== */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-grad-brand-soft text-brand-500 ring-1 ring-brand-100">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-ink-800">{title}</h3>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ============================== Misc ============================== */

export function SectionTitle({
  icon,
  title,
  subtitle,
  right,
  className,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-brand-600">{icon}</span>}
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Label/value row used across all detail panels. */
export function InfoRow({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-500">
        {icon}
        {label}
      </span>
      <span
        className={cx(
          'text-end text-[13px] font-semibold text-ink-900',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Avatar({
  name,
  gradient = 'from-brand-800 to-ocean-400',
  size = 'md',
  src,
}: {
  name: string;
  gradient?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  src?: string;
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-2xl',
  };
  const ini = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cx('shrink-0 rounded-2xl object-cover ring-2 ring-white', sizes[size])}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-sm ring-2 ring-white',
        gradient,
        sizes[size],
      )}
    >
      {ini}
    </span>
  );
}
