import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { Button, Card } from './ui';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { useCurrentSession } from '../lib/useCurrentSession';
import { track } from '../lib/analytics';
import type { Dict } from '../lib/i18n/locales';

/** Simple "~N hours" — deliberately not a live seconds countdown (product requirement: an
 * approximate expiry time only). Rounds up so "expires in under a minute" never reads as 0h. */
function formatExpiresIn(t: Dict, entitlementExpiresAt: string): string {
  const ms = new Date(entitlementExpiresAt).getTime() - Date.now();
  if (ms <= 0) return '';
  const hours = Math.ceil(ms / 3_600_000);
  return hours < 1 ? t.resumeCard.expiresInUnderHour : t.resumeCard.expiresInHours.replace('{hours}', String(hours));
}

/** Homepage "pick up where you left off" card — the actual fix for the reported bug: previously,
 * losing the URL (refresh landing on '/', a logo click, a closed/reopened tab) meant a paid user
 * had no way back to their analysis even though it was still fully intact server-side. Reads the
 * session-scoped most-recent analysis via useCurrentSession(); renders nothing while restoring or
 * when there's genuinely no active analysis for this browser. */
export function ResumeAnalysisCard() {
  const { state } = useCurrentSession();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const trackId = 'analysisId' in state ? state.analysisId : undefined;
  useEffect(() => {
    if (state.kind === 'paidActiveAnalysis') track({ name: 'active_analysis_restored' }, trackId);
  }, [state.kind, trackId]);

  if (state.kind === 'restoring' || state.kind === 'noActiveAnalysis') return null;

  const variant = {
    processing: { title: t.resumeCard.processingTitle, body: t.resumeCard.processingBody, cta: t.resumeCard.processingCta, path: `/processing/${state.analysisId}` },
    failed: { title: t.resumeCard.failedTitle, body: t.resumeCard.failedBody, cta: t.resumeCard.failedCta, path: `/processing/${state.analysisId}` },
    unpaidAnalysis: { title: t.resumeCard.unpaidTitle, body: t.resumeCard.unpaidBody, cta: t.resumeCard.unpaidCta, path: `/results/${state.analysisId}` },
    paidActiveAnalysis: { title: t.resumeCard.paidTitle, body: t.resumeCard.paidBody, cta: t.resumeCard.paidCta, path: `/workspace/${state.analysisId}/report` },
  }[state.kind];

  function handleClick() {
    track({ name: 'resume_analysis_clicked' }, trackId);
    navigate(variant.path);
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-7">
      <Card className="p-5 flex items-center gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-success-bg text-success flex items-center justify-center flex-none">
          <Clock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold text-[15px]">{variant.title}</div>
          <div className="text-[13.5px] text-text2">{variant.body}</div>
          {state.kind === 'paidActiveAnalysis' && (
            <div className="text-[12px] text-muted mt-1">
              {t.resumeCard.expiresInPrefix} {formatExpiresIn(t, state.entitlementExpiresAt)}
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleClick}>
          {variant.cta}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Card>
    </div>
  );
}
