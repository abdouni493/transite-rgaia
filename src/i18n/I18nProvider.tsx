import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { dictionaries, type Lang, type TranslationKey } from './translations';

const STORAGE_KEY = 'transitpro.lang';

interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  /** Translate; `vars` fills `{placeholders}`. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readInitial(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'ar' || saved === 'fr' ? saved : 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitial);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((p) => (p === 'fr' ? 'ar' : 'fr')), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let out: string = dictionaries[lang][key] ?? dictionaries.fr[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return out;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, isRtl: dir === 'rtl', setLang, toggleLang, t }),
    [lang, dir, setLang, toggleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
