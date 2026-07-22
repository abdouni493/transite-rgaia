import { ShieldCheck } from 'lucide-react';
import { cx } from '../ui/primitives';

type BrandSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<BrandSize, { box: string; icon: number; text: string }> = {
  sm: { box: 'h-10 w-10', icon: 20, text: 'text-[13px]' },
  md: { box: 'h-12 w-12', icon: 24, text: 'text-[15px]' },
  lg: { box: 'h-16 w-16', icon: 32, text: 'text-xl' },
  xl: { box: 'h-20 w-20', icon: 38, text: 'text-2xl' },
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The company identity mark: the uploaded logo inside a circle, or the
 * company initials — falling back to the app shield when neither is set yet.
 */
export function BrandMark({
  logo,
  name,
  size = 'sm',
  className,
}: {
  logo?: string;
  name?: string;
  size?: BrandSize;
  className?: string;
}) {
  const s = SIZES[size];

  if (logo) {
    return (
      <img
        src={logo}
        alt={name || 'Logo'}
        className={cx(
          'shrink-0 rounded-full bg-white object-contain p-1 shadow-float ring-1 ring-ink-200',
          s.box,
          className,
        )}
      />
    );
  }

  const ini = initials(name ?? '');
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-grad-brand font-extrabold text-white shadow-float',
        s.box,
        s.text,
        className,
      )}
    >
      {ini || <ShieldCheck size={s.icon} />}
    </span>
  );
}
