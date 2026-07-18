import { useNavigate } from 'react-router-dom';
import { Clock, Trash2 } from 'lucide-react';
import { Button, Card } from './ui';
import { useLanguage } from '../lib/i18n/LanguageContext';

/** Shared inline state for analyses that 410 — either auto-expired (24h TTL) or user-deleted.
 * Rendered wherever api.ts surfaces `err.code === 'expired' | 'deleted'`, in place of the page's
 * normal content — no dedicated /expired or /deleted route. */
export function LifecycleState({ code }: { code: 'expired' | 'deleted' }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isDeleted = code === 'deleted';

  return (
    <div className="max-w-[480px] mx-auto px-6 py-20">
      <Card className="p-8 text-center">
        <div
          className={
            'w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ' +
            (isDeleted ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')
          }
        >
          {isDeleted ? <Trash2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
        </div>
        <h1 className="text-[21px] font-bold mb-2">{isDeleted ? t.lifecycle.deletedTitle : t.lifecycle.expiredTitle}</h1>
        <p className="text-[14.5px] text-text2 mb-6 leading-relaxed">
          {isDeleted ? t.lifecycle.deletedBody : t.lifecycle.expiredBody}
        </p>
        <Button className="w-full" onClick={() => navigate('/analyze')}>
          {t.lifecycle.newAnalysisCta}
        </Button>
      </Card>
    </div>
  );
}
