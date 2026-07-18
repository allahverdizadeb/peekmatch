import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, AlertTriangle, Lock, CheckCircle2, TrendingUp, Users, Activity } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { RadialGauge, CategoryBarChart } from '../components/charts';
import { getAnalysis, getResult, type FreeResult, type AnalysisInfo } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';

const STRENGTH_ICONS = [TrendingUp, Users, Activity];

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [result, setResult] = useState<FreeResult | null>(null);
  const [error, setError] = useState('');
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAnalysis(id), getResult(id)])
      .then(([i, r]) => {
        setInfo(i);
        setResult(r);
      })
      .catch((err) => setError(err.message || t.results.errorFallback));
  }, [id, t]);

  if (error) {
    return (
      <div className="max-w-[520px] mx-auto px-6 py-20 text-center">
        <p className="text-danger text-[15px] mb-4">{error}</p>
        <Button onClick={() => navigate('/analyze')}>{t.results.newAnalysisCta}</Button>
      </div>
    );
  }
  if (!result || !info) {
    return <div className="max-w-[520px] mx-auto px-6 py-20 text-center text-text2">{t.common.loading}</div>;
  }

  const recTone = result.recommendationTone === 'positive' ? 'success' : result.recommendationTone === 'negative' ? 'danger' : 'warning';
  const reliabilityText =
    result.reliability === 'yüksək' ? t.results.reliabilityHigh : result.reliability === 'orta' ? t.results.reliabilityMedium : t.results.reliabilityLow;

  return (
    <div>
      <AppHeader vacancyTitle={info.vacancyTitle} vacancyCompany={info.vacancyCompany} vacancyLocation={info.vacancyLocation} />
      <div className="max-w-[1160px] mx-auto px-6 py-9">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-[26px] font-bold">{t.results.title}</h1>
            <p className="text-[15px] text-text2 mt-1">
              {t.results.subtitlePrefix} {info.vacancyTitle || t.results.subtitleFallbackVacancy} {t.results.subtitleSuffix}
            </p>
          </div>
          <Badge tone="info">{t.results.reliabilityLabel} {reliabilityText}</Badge>
        </div>
        <p className="text-[12.5px] text-muted mb-8">{t.results.retentionNote}</p>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 flex flex-col items-center text-center">
            <span className="text-[13px] font-semibold text-text2 mb-3 self-start">{t.results.kpiCompatTitle}</span>
            <RadialGauge value={result.compatibility} label={result.compatibilityLabel} />
            <p className="text-[12.5px] text-text2 mt-3">{t.results.kpiCompatText}</p>
          </Card>

          <Card className="p-5">
            <span className="text-[13px] font-semibold text-text2 mb-3 block">{t.results.kpiReqTitle}</span>
            <div className="text-[26px] font-extrabold text-navy mb-3">
              {result.mainRequirementsMet} / {result.mainRequirementsTotal}
            </div>
            <div className="flex gap-1 mb-3">
              {Array.from({ length: result.mainRequirementsTotal }, (_, i) => {
                const tone =
                  i < result.mainRequirementsMet ? '#198754' : i < result.mainRequirementsMet + result.mainRequirementsPartial ? '#C97800' : '#CF3F4F';
                return <div key={i} className="h-2.5 flex-1 rounded-full" style={{ background: tone }} />;
              })}
            </div>
            <div className="text-[12px] text-text2 space-y-0.5">
              <div>{result.mainRequirementsMet} {t.results.reqFullyMet}</div>
              <div>{result.mainRequirementsPartial} {t.results.reqPartial}</div>
              <div>{result.mainRequirementsMissing} {t.results.reqMissing}</div>
            </div>
          </Card>

          <Card className="p-5">
            <span className="text-[13px] font-semibold text-text2 mb-3 block">{t.results.kpiGapsTitle}</span>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <span className="text-[26px] font-extrabold text-navy">{result.criticalGapsCount}</span>
            </div>
            <p className="text-[12.5px] text-text2">{result.criticalGapSummary}</p>
          </Card>

          <Card className="p-5 relative">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[13px] font-semibold text-text2">{t.results.kpiHrTitle}</span>
              <button onMouseEnter={() => setTooltipOpen(true)} onMouseLeave={() => setTooltipOpen(false)} className="text-muted">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {tooltipOpen && (
              <div className="absolute z-10 right-4 top-12 w-64 bg-navy text-white text-[12px] leading-relaxed rounded-rc p-3 shadow-sh-lg">
                {t.results.hrTooltip}
              </div>
            )}
            <RadialGauge value={result.hrScreeningEstimate} size={100} stroke={9} />
            <p className="text-[11.5px] text-muted mt-3">{t.results.hrNote}</p>
          </Card>
        </div>

        {/* Category chart */}
        <Card className="p-6 mb-8">
          <h2 className="text-[17px] font-bold mb-1">{t.results.categoryTitle}</h2>
          <p className="text-[13px] text-text2 mb-5">{t.results.categorySubtitle}</p>
          <CategoryBarChart data={result.categoryScores} />
        </Card>

        {/* Strengths */}
        <div className="mb-8">
          <h2 className="text-[19px] font-bold mb-4">{t.results.strengthsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.strengths.length === 0 && <p className="text-[14px] text-text2">{t.results.strengthsEmpty}</p>}
            {result.strengths.map((s, i) => {
              const Icon = STRENGTH_ICONS[i % STRENGTH_ICONS.length];
              return (
                <Card key={i} className="p-5">
                  <Icon className="w-6 h-6 text-teal mb-3" />
                  <h3 className="text-[15px] font-bold mb-1.5">{s.title}</h3>
                  <p className="text-[13.5px] text-text2 leading-relaxed mb-3">{s.text}</p>
                  {s.evidenceFound && <Badge tone="success">{t.results.evidenceFoundBadge}</Badge>}
                  {s.relatedRequirement && <p className="text-[12px] text-muted mt-2">{t.results.relatedRequirement} {s.relatedRequirement}</p>}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Most important requirement */}
        <Card className="p-6 mb-8 border-warning border">
          <h2 className="text-[17px] font-bold mb-3">{t.results.mostImportantTitle}</h2>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-none mt-0.5" />
            <div>
              <div className="text-[15px] font-semibold">{result.mostImportantMissingRequirement}</div>
              <Badge tone="warning" className="my-2">{t.results.criticalGapBadge}</Badge>
              <p className="text-[13.5px] text-text2 leading-relaxed">{result.mostImportantMissingExplanation}</p>
              <p className="text-[12.5px] text-text2 mt-2 italic">
                {t.results.mostImportantNote}
              </p>
            </div>
          </div>
        </Card>

        {/* Recommendation */}
        <Card className="p-6 mb-8">
          <Badge tone={recTone as any} className="mb-3">{result.recommendationStatus}</Badge>
          <ul className="grid gap-1.5 mb-4">
            {result.recommendationReasons.map((r, i) => (
              <li key={i} className="text-[13.5px] text-text2 flex gap-2">
                <span className="text-teal">•</span>
                {r}
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-navy font-medium mb-5">{result.recommendationNextAction}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(`/pricing/${id}?pkg=2`)}>{t.results.tailorCvCta}</Button>
            <Button variant="secondary" onClick={() => navigate(`/pricing/${id}?pkg=1`)}>{t.results.openReportCta}</Button>
          </div>
        </Card>

        {/* Locked report preview */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-premium" />
            <h2 className="text-[17px] font-bold">{t.results.lockedTitle}</h2>
          </div>
          <div className="grid gap-2 mb-4 opacity-40 select-none pointer-events-none">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-rk p-3">
                <CheckCircle2 className="w-4 h-4 text-muted" />
                <div className="h-2.5 bg-bg2 rounded flex-1" />
                <div className="h-2.5 bg-bg2 rounded w-16" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3 bg-premium-bg rounded-rc p-4">
            <div>
              <div className="font-bold text-[15px]">{t.results.lockedPackageName}</div>
              <div className="text-[13px] text-text2">{t.results.lockedPackageDesc}</div>
            </div>
            <Button variant="premium" onClick={() => navigate(`/pricing/${id}?pkg=1`)}>{t.results.openReportCta}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
