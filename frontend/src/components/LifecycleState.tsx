import { useNavigate } from 'react-router-dom';
import { Clock, Trash2 } from 'lucide-react';
import { Button, Card } from './ui';
import { useLanguage } from '../lib/i18n/LanguageContext';

/** Shared inline state for analyses that 410 — auto-expired (24h TTL), user-deleted, or a paid
 * analysis whose 24h entitlement window has ended (a distinct, privacy-specific message: see
 * resolveAnalysis()'s 'entitlement_expired' kind in analysisLifecycle.ts). Also covers a plain 404
 * (never-existed OR an ownership mismatch — the backend deliberately can't tell these apart from
 * the outside, see the IDOR note there) with the same generic "not found" treatment, so a
 * non-owner never learns whether an id exists at all. Rendered wherever api.ts surfaces
 * `err.status === 410 | 404`, in place of the page's normal content — no dedicated route per state. */
export function LifecycleState({ code }: { code: 'expired' | 'deleted' | 'entitlement_expired' | 'not_found' }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const copy =
    code === 'deleted'
      ? { title: t.lifecycle.deletedTitle, body: t.lifecycle.deletedBody, icon: <Trash2 className="w-7 h-7" />, tone: 'success' as const }
      : code === 'entitlement_expired'
        ? {
            title: t.lifecycle.entitlementExpiredTitle,
            body: t.lifecycle.entitlementExpiredBody,
            icon: <Clock className="w-7 h-7" />,
            tone: 'warning' as const,
          }
        : code === 'not_found'
          ? { title: t.lifecycle.deletedTitle, body: t.lifecycle.deletedBody, icon: <Trash2 className="w-7 h-7" />, tone: 'success' as const }
          : { title: t.lifecycle.expiredTitle, body: t.lifecycle.expiredBody, icon: <Clock className="w-7 h-7" />, tone: 'warning' as const };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-20">
      <Card className="p-8 text-center">
        <div
          className={
            'w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ' +
            (copy.tone === 'success' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')
          }
        >
          {copy.icon}
        </div>
        <h1 className="text-[21px] font-bold mb-2">{copy.title}</h1>
        <p className="text-[14.5px] text-text2 mb-6 leading-relaxed">{copy.body}</p>
        <Button className="w-full" onClick={() => navigate('/analyze')}>
          {t.lifecycle.newAnalysisCta}
        </Button>
      </Card>
    </div>
  );
}
