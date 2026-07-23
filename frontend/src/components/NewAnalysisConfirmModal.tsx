import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import { deleteAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';
import { useModalClose } from '../lib/useModalClose';
import { useModalA11y } from '../lib/useModalA11y';
import { DURATION } from '../lib/motion';

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
  // Two independent close paths (cancel vs. confirm) so the right callback fires after the exit
  // animation regardless of which one the user took — a shared "closing" flag drives the CSS.
  const cancelClose = useModalClose(onCancel, DURATION.fast);
  const confirmClose = useModalClose(onConfirmed, DURATION.fast);
  const closing = cancelClose.closing || confirmClose.closing;
  const dialogRef = useModalA11y(cancelClose.requestClose);

  async function confirm() {
    setWorking(true);
    try {
      await deleteAnalysis(analysisId);
      track({ name: 'new_analysis_confirmed' }, analysisId);
      confirmClose.requestClose();
    } catch {
      setWorking(false);
    }
  }

  function cancel() {
    track({ name: 'new_analysis_cancelled' }, analysisId);
    cancelClose.requestClose();
  }

  return (
    <div
      className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-6"
      data-state={closing ? 'closed' : 'open'}
      onClick={cancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-analysis-confirm-title"
        tabIndex={-1}
        className="motion-dialog bg-white border border-border rounded-rl shadow-sh-lg p-7 max-w-[440px] w-full text-center focus:outline-none"
        data-state={closing ? 'closed' : 'open'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-warning-bg text-warning flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 id="new-analysis-confirm-title" className="text-[19px] font-bold mb-2">{t.newAnalysisConfirm.title}</h2>
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
