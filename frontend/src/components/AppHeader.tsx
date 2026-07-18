import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function AppHeader({
  vacancyTitle,
  vacancyCompany,
  vacancyLocation,
  timestamp,
}: {
  vacancyTitle?: string | null;
  vacancyCompany?: string | null;
  vacancyLocation?: string | null;
  timestamp?: string;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border">
      <div className="max-w-[1320px] mx-auto px-6 h-[68px] flex items-center gap-6">
        <button onClick={() => navigate('/')} className="flex items-center flex-none">
          <Logo size={18} />
        </button>
        {vacancyTitle && (
          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <span className="text-[14px] font-semibold text-navy truncate">{vacancyTitle}</span>
            <span className="text-[12px] text-muted truncate">
              {vacancyCompany}
              {vacancyLocation ? ` · ${vacancyLocation}` : ''}
              {timestamp ? ` · ${timestamp}` : ''}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <Button size="sm" variant="secondary" onClick={() => navigate('/analyze')}>
            {t.header.newAnalysis}
          </Button>
        </div>
      </div>
    </header>
  );
}
