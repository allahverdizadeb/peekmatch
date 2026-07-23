import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from './ui';
import { deleteAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { useModalClose } from '../lib/useModalClose';
import { useModalA11y } from '../lib/useModalA11y';
import { DURATION } from '../lib/motion';

export function DeleteConfirmDialog({ analysisId, onClose }: { analysisId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const { closing, requestClose } = useModalClose(onClose, DURATION.fast);
  const dialogRef = useModalA11y(requestClose);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteAnalysis(analysisId);
      navigate('/');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-6"
      data-state={closing ? 'closed' : 'open'}
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        tabIndex={-1}
        className="motion-dialog bg-white border border-border rounded-rl shadow-sh-lg p-7 max-w-[420px] w-full text-center focus:outline-none"
        data-state={closing ? 'closed' : 'open'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-danger-bg text-danger flex items-center justify-center">
          <Trash2 className="w-6 h-6" />
        </div>
        <h2 id="delete-confirm-title" className="text-[19px] font-bold mb-2">{t.lifecycle.deleteConfirmTitle}</h2>
        <p className="text-[14px] text-text2 mb-6 leading-relaxed">{t.lifecycle.deleteConfirmBody}</p>
        <div className="grid gap-2.5">
          <Button variant="danger" loading={deleting} onClick={confirmDelete}>
            {t.lifecycle.deleteConfirmCta}
          </Button>
          <Button variant="secondary" onClick={requestClose} disabled={deleting}>
            {t.lifecycle.cancelCta}
          </Button>
        </div>
      </div>
    </div>
  );
}
