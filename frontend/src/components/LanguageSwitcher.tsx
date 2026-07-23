import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LANGUAGES } from '../lib/i18n/locales';
import { useDelayedUnmount } from '../lib/useDelayedUnmount';
import { DURATION } from '../lib/motion';

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const { shouldRender, dataState } = useDelayedUnmount(open, DURATION.instant);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = LANGUAGES.find((l) => l.code === lang)!;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-semibold border border-border text-text2 bg-white hover:bg-bg2 focus-ring"
      >
        <span>{active.flag}</span>
        <span>{active.code.toUpperCase()}</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-[var(--motion-standard)] ease-[var(--ease-standard)]', open && 'rotate-180')} />
      </button>
      {shouldRender && (
        <div
          data-state={dataState}
          className="motion-popover absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-rl shadow-sh-lg py-1.5 z-50"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] hover:bg-bg2 text-left transition-colors duration-[var(--motion-fast)]"
            >
              <span>{l.flag}</span>
              <span className="flex-1">{l.name}</span>
              {l.code === lang && <Check className="w-4 h-4 text-teal" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
