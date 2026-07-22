import { motion } from 'framer-motion';
import { Languages } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { cx } from '../ui/primitives';

const OPTIONS = [
  { value: 'fr' as const, label: 'FR', full: 'Français' },
  { value: 'ar' as const, label: 'ع', full: 'العربية' },
];

/** Two-state language segmented control with a sliding indicator. */
export function LangSwitch({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={cx('flex items-center gap-2', className)}>
      {showIcon && <Languages size={16} className="hidden text-ink-400 sm:block" aria-hidden />}
      <div
        role="group"
        aria-label={t('language')}
        className="flex items-center gap-0.5 rounded-xl border border-ink-200 bg-ink-100/80 p-0.5"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setLang(o.value)}
            aria-pressed={lang === o.value}
            title={o.full}
            className={cx(
              'relative h-8 w-11 cursor-pointer rounded-lg text-[13px] font-bold transition-colors duration-200',
              lang === o.value ? 'text-white' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {lang === o.value && (
              <motion.span
                layoutId="lang-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-grad-brand shadow-sm"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
