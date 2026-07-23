import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from './ui';
import { Dialog } from './Dialog';
import { deleteAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { useModalClose } from '../lib/useModalClose';
import { DURATION } from '../lib/motion';

export function DeleteConfirmDialog({ analysisId, onClose }: { analysisId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const { closing, requestClose } = useModalClose(onClose, DURATION.fast);

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
    <Dialog titleId="delete-confirm-title" descriptionId="delete-confirm-body" closing={closing} onRequestClose={requestClose} maxWidthClassName="max-w-[420px]">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-danger-bg text-danger flex items-center justify-center">
        <Trash2 className="w-6 h-6" />
      </div>
      <h2 id="delete-confirm-title" className="text-[19px] font-bold mb-2">{t.lifecycle.deleteConfirmTitle}</h2>
      <p id="delete-confirm-body" className="text-[14px] text-text2 mb-6 leading-relaxed">{t.lifecycle.deleteConfirmBody}</p>
      <div className="grid gap-2.5">
        <Button variant="danger" loading={deleting} onClick={confirmDelete}>
          {t.lifecycle.deleteConfirmCta}
        </Button>
        <Button variant="secondary" onClick={requestClose} disabled={deleting}>
          {t.lifecycle.cancelCta}
        </Button>
      </div>
    </Dialog>
  );
}
