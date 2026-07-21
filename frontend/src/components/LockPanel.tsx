import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from './ui';
import { useLanguage } from '../lib/i18n/LanguageContext';

export interface LockPreviewStat {
  value: number | string;
  label: string;
}

/** Generic paywall panel shown in place of a locked Workspace tab. Extracted from a private
 * function that used to live inline in Workspace.tsx so every gated tab can reuse it instead of
 * duplicating the markup. `previewStats` (optional) shows real, already-computed counts from the
 * free result — e.g. "8 CV changes found, 3 critical" — instead of a generic "unlock premium"
 * message with nothing concrete behind it; callers only ever pass numbers the backend already
 * returned, never a hardcoded figure. */
export function LockPanel({
  pkgName,
  price,
  analysisId,
  pkgId,
  previewStats,
}: {
  pkgName: string;
  price: string;
  analysisId: string;
  pkgId: number;
  previewStats?: LockPreviewStat[];
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Card className="p-10 text-center">
      <Lock className="w-8 h-8 text-premium mx-auto mb-4" />
      <h2 className="text-[18px] font-bold mb-1.5">{t.workspace.lockedTitle}</h2>
      <p className="text-[14px] text-text2 mb-6">
        <span className="font-semibold text-navy">{pkgName}</span> {t.workspace.lockedTextSuffix}
      </p>
      {previewStats && previewStats.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-7 max-w-[420px] mx-auto">
          {previewStats.map((s, i) => (
            <div key={i}>
              <div className="font-display font-semibold text-[26px] text-navy tabular-nums leading-none">{s.value}</div>
              <div className="text-[12px] text-text2 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <Button variant="premium" onClick={() => navigate(`/checkout/${analysisId}/${pkgId}`)}>
        {t.workspace.unlockCtaPrefix} {price}
      </Button>
    </Card>
  );
}
