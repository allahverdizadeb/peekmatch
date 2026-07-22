import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NewAnalysisConfirmModal } from './NewAnalysisConfirmModal';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function AppHeader({
  vacancyTitle,
  vacancyCompany,
  vacancyLocation,
  timestamp,
  analysisId,
}: {
  vacancyTitle?: string | null;
  vacancyCompany?: string | null;
  vacancyLocation?: string | null;
  timestamp?: string;
  /** When set, "Yeni analiz" warns before replacing this active analysis (see
   * NewAnalysisConfirmModal) instead of navigating straight to /analyze — every page that reaches
   * this point already has a real, loaded analysis, so the button is never a no-op discard. */
  analysisId?: string;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Logo/homepage navigation deliberately does nothing but navigate — it must never clear
  // workspace/session/entitlement state (see ANONYMOUS_ACCESS_RESTORATION_REPORT.md).
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (analysisId ? setConfirmOpen(true) : navigate('/analyze'))}
          >
            {t.header.newAnalysis}
          </Button>
        </div>
      </div>
      {confirmOpen && analysisId && (
        <NewAnalysisConfirmModal
          analysisId={analysisId}
          onCancel={() => setConfirmOpen(false)}
          onConfirmed={() => navigate('/analyze')}
        />
      )}
    </header>
  );
}
