import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import { Dialog } from './Dialog';
import { deleteAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';
import { useModalClose } from '../lib/useModalClose';
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
    <Dialog titleId="new-analysis-confirm-title" descriptionId="new-analysis-confirm-body" closing={closing} onRequestClose={cancel}>
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-warning-bg text-warning flex items-center justify-center">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 id="new-analysis-confirm-title" className="text-[19px] font-bold mb-2">{t.newAnalysisConfirm.title}</h2>
      <p id="new-analysis-confirm-body" className="text-[14px] text-text2 mb-6 leading-relaxed">{t.newAnalysisConfirm.body}</p>
      <div className="grid gap-2.5">
        <Button variant="danger" loading={working} onClick={confirm}>
          {t.newAnalysisConfirm.confirmCta}
        </Button>
        <Button variant="secondary" onClick={cancel} disabled={working}>
          {t.newAnalysisConfirm.cancelCta}
        </Button>
      </div>
    </Dialog>
  );
}
