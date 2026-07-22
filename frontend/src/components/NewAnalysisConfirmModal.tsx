import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import { deleteAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';

/** Warns before an active analysis is replaced — required whenever a user is about to leave a
 * real, in-progress-or-owned analysis to start a fresh one (via AppHeader's "Yeni analiz"/"New
 * analysis" button, or landing on /analyze directly while one is already active). Reuses the
 * existing DELETE /:id (invalidate-my-data) route on confirm rather than a dedicated endpoint —
 * it already does exactly the right thing: nulls content, sets deletedAt, preserves Order rows. */
export function NewAnalysisConfirmModal({
  analysisId,
  onCancel,
  onConfirmed,
}: {
  analysisId: string;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const { t } = useLanguage();
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await deleteAnalysis(analysisId);
      track({ name: 'new_analysis_confirmed' }, analysisId);
      onConfirmed();
    } catch {
      setWorking(false);
    }
  }

  function cancel() {
    track({ name: 'new_analysis_cancelled' }, analysisId);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-6" onClick={cancel}>
      <div
        className="bg-white border border-border rounded-rl shadow-sh-lg p-7 max-w-[440px] w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-warning-bg text-warning flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-[19px] font-bold mb-2">{t.newAnalysisConfirm.title}</h2>
        <p className="text-[14px] text-text2 mb-6 leading-relaxed">{t.newAnalysisConfirm.body}</p>
        <div className="grid gap-2.5">
          <Button variant="danger" loading={working} onClick={confirm}>
            {t.newAnalysisConfirm.confirmCta}
          </Button>
          <Button variant="secondary" onClick={cancel} disabled={working}>
            {t.newAnalysisConfirm.cancelCta}
          </Button>
        </div>
      </div>
    </div>
  );
}
