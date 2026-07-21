import { Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/i18n/LanguageContext';

/** AI-generated content is baked into the analysis in whatever language it was created with — there
 * is no language-neutral structured layer to re-translate it from (see CLAUDE.md). Rather than
 * silently mixing an Azerbaijani/English result inside a differently-language interface, this
 * surfaces the mismatch clearly and points the user at the one safe fix: a new analysis in their
 * current language. */
export function LanguageMismatchNotice({ analysisLanguage, uiLang }: { analysisLanguage: string; uiLang: 'az' | 'en' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (analysisLanguage === uiLang) return null;
  const analysisLanguageName = (t.languageSwitcher as Record<string, string>)[analysisLanguage] || t.languageSwitcher.en;

  return (
    <div className="flex items-start gap-2.5 border border-info rounded-rc bg-info-bg p-3.5 mb-6 flex-wrap sm:flex-nowrap">
      <Info className="w-4 h-4 text-info flex-none mt-0.5" />
      <p className="text-[13px] text-navy leading-relaxed flex-1 min-w-0">
        {t.languageMismatch.prefix} <span className="font-semibold">{analysisLanguageName}</span> {t.languageMismatch.suffix}
      </p>
      <button
        onClick={() => navigate('/analyze')}
        className="text-[12.5px] font-semibold text-teal hover:text-teal-h flex-none whitespace-nowrap"
      >
        {t.languageMismatch.cta} →
      </button>
    </div>
  );
}
