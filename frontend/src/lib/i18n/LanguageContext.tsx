import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LOCALES } from './locales';
import type { Dict, Lang } from './locales';

const STORAGE_KEY = 'peekmatch:lang';
const DEFAULT_LANG: Lang = 'az';

function readStoredLang(): Lang {
  const v = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return v === 'az' || v === 'en' || v === 'tr' || v === 'ru' ? v : DEFAULT_LANG;
}

type LanguageContextValue = { lang: Lang; setLang: (l: Lang) => void; t: Dict };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t: LOCALES[lang] }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
