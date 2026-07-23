import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, TrendingUp, Users, Activity, Trash2 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card, MetricCard } from '../components/ui';
import { Tooltip } from '../components/Tooltip';
import { RadialGauge, CategoryBarChart, ReadinessGauge, RequirementCoverageBar } from '../components/charts';
import { LifecycleState } from '../components/LifecycleState';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { CvChangeCard } from '../components/CvChangeCard';
import { LanguageMismatchNotice } from '../components/LanguageMismatchNotice';
import { Reveal } from '../components/Reveal';
import { getAnalysis, getResult, type FreeResult, type AnalysisInfo } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { computeApplicationReadiness, type ApplicationReadiness } from '../lib/readiness';
import { STAGGER, staggerDelay } from '../lib/motion';

const STRENGTH_ICONS = [TrendingUp, Users, Activity];
// A candidate whose CV presentation lags meaningfully behind their real fit gets the "your
// experience is aligned but your CV undersells it" message — below this gap it's not worth calling out.
const PRESENTATION_GAP_THRESHOLD = 15;

// Display-only mirror of the server's package prices (backend/src/lib/pricing.ts is the real
// source of truth — never trusted for the actual charge, same convention already used by
// Pricing.tsx/Checkout.tsx/Workspace.tsx).
const CONVERSION_PRICE: Record<number, string> = { 1: '0.90 USD', 2: '2.90 USD' };

function ConversionPackageCard({ pkg, price }: { pkg: { name: string; desc: string; features: string[] }; price: string }) {
  return (
    <div className="border border-border rounded-rl p-5 bg-bg text-left">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <h3 className="font-bold text-[15px]">{pkg.name}</h3>
        <span className="font-display font-semibold text-[16px] text-navy tabular-nums flex-none">{price}</span>
      </div>
      <p className="text-[12.5px] text-text2 mb-3">{pkg.desc}</p>
      <ul className="grid gap-1.5">
        {pkg.features.map((f, i) => (
          <li key={i} className="text-[12px] text-text2 flex gap-1.5 items-start">
            <Check className="w-3.5 h-3.5 text-teal flex-none mt-0.5" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang: uiLang } = useLanguage();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [result, setResult] = useState<FreeResult | null>(null);
  const [error, setError] = useState('');
  const [lifecycleCode, setLifecycleCode] = useState<'expired' | 'deleted' | 'entitlement_expired' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAnalysis(id), getResult(id)])
      .then(([i, r]) => {
        setInfo(i);
        setResult(r);
      })
      .catch((err) => {
        if (err.status === 410 && (err.code === 'expired' || err.code === 'deleted' || err.code === 'entitlement_expired')) {
          setLifecycleCode(err.code);
        } else {
          setError(err.message || t.results.errorFallback);
        }
      });
  }, [id, t]);

  // The CV Change Plan (premium-preview counts + example card) now generates in the background
  // after the free result is already available, rather than blocking it — poll a few times so the
  // preview fills in without the user having to refresh. Stops as soon as it's ready, and gives up
  // after ~20 tries (~80s) rather than polling forever if the background generation genuinely failed.
  const [planPollCount, setPlanPollCount] = useState(0);
  useEffect(() => {
    if (!id || !result || result.cvChangePlanReady || planPollCount >= 20) return;
    const timer = setTimeout(() => {
      getResult(id)
        .then(setResult)
        .catch(() => {})
        .finally(() => setPlanPollCount((n) => n + 1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, result, planPollCount]);

  if (lifecycleCode) return <LifecycleState code={lifecycleCode} />;

  if (error) {
    return (
      <div className="max-w-[520px] mx-auto px-6 py-20 text-center">
        <p className="text-danger text-[15px] mb-4">{error}</p>
        <Button onClick={() => navigate('/analyze')}>{t.results.newAnalysisCta}</Button>
      </div>
    );
  }
  if (!result || !info || !id) {
    return <div className="max-w-[520px] mx-auto px-6 py-20 text-center text-text2">{t.common.loading}</div>;
  }

  const recTone = result.recommendationTone === 'positive' ? 'success' : result.recommendationTone === 'negative' ? 'danger' : 'warning';
  const reliabilityText =
    result.reliability === 'yüksək' ? t.results.reliabilityHigh : result.reliability === 'orta' ? t.results.reliabilityMedium : t.results.reliabilityLow;
  const presentationGap = result.compatibility - result.cvPresentationScore >= PRESENTATION_GAP_THRESHOLD;

  const readiness: ApplicationReadiness = computeApplicationReadiness(result.compatibility, result.criticalGapsCount);
  const zoneLabels = t.results.readiness.zoneLabel;
  const totalCvChanges = result.cvChangesSummary.critical + result.cvChangesSummary.important + result.cvChangesSummary.optional;

  return (
    <div>
      <AppHeader vacancyTitle={info.vacancyTitle} vacancyCompany={info.vacancyCompany} vacancyLocation={info.vacancyLocation} analysisId={id} />
      <div className="max-w-[1160px] mx-auto px-6 py-9">
        <LanguageMismatchNotice analysisLanguage={info.outputLanguage} uiLang={uiLang} />
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="font-display font-semibold text-[28px]">{t.results.title}</h1>
            <p className="text-[15px] text-text2 mt-1">
              {t.results.subtitlePrefix} {info.vacancyTitle || t.results.subtitleFallbackVacancy} {t.results.subtitleSuffix}
            </p>
          </div>
          <Badge tone="info">{t.results.reliabilityLabel} {reliabilityText}</Badge>
        </div>
        <p className="text-[12.5px] text-muted mb-8">{t.results.retentionNote}</p>

        {/* Application Readiness — a real status computed from compatibility + critical gaps. */}
        <Reveal>
          <Card className="p-6 mb-4 border-t-4 border-t-accent">
            <h2 className="font-display font-semibold text-[19px] mb-4">{t.results.readiness.title}</h2>
            <ReadinessGauge
              status={readiness}
              zoneLabels={[zoneLabels.not_ready, zoneLabels.needs_improvement, zoneLabels.nearly_ready, zoneLabels.ready]}
              statusLabel={zoneLabels[readiness]}
              description={t.results.readiness.description[readiness]}
            />
          </Card>
        </Reveal>

        {/* Candidate Fit — its own full-width card so the gauge and the (potentially long,
            multi-language) supporting text each get clearly separated regions instead of being
            squeezed into a quarter-width KPI cell. Chart/score column and text column stack
            vertically on mobile, sit side by side from md: up. */}
        <Reveal delay={staggerDelay(1, STAGGER.sections)}>
          <Card className="p-6 mb-4">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-8">
              <RadialGauge value={result.compatibility} size={140} />
              <div className="flex-1 min-w-0 text-center md:text-left">
                <h2 className="text-[15px] font-semibold text-text2 mb-1">{t.results.kpiCompatTitle}</h2>
                <p className="font-display font-semibold text-[19px] text-navy mb-3 break-words">{result.compatibilityLabel}</p>
                <div className="flex items-center justify-center md:justify-start gap-1.5 text-[13px]">
                  <span className="text-text2">{t.results.cvPresentationTitle}:</span>
                  <span className="font-bold text-navy tabular-nums">{result.cvPresentationScore}%</span>
                </div>
                {presentationGap && <p className="text-[12.5px] text-text2 mt-2 max-w-[520px]">{t.results.presentationGapMessage}</p>}
                {result.realCompatibility > result.compatibility && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[12.5px] text-premium font-medium">{t.results.realMatchTeaser}</p>
                    <button
                      className="text-[12px] font-semibold text-teal hover:text-teal-h transition-colors"
                      onClick={() => navigate(`/pricing/${id}?pkg=1`)}
                    >
                      {t.results.realMatchTeaserCta} →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Requirement coverage */}
        <Reveal delay={staggerDelay(2, STAGGER.sections)}>
          <Card className="p-6 mb-4">
            <h2 className="text-[15px] font-bold mb-1">{t.results.coverageTitle}</h2>
            <p className="text-[12.5px] text-text2 mb-4">{t.results.coverageSubtitle}</p>
            <RequirementCoverageBar
              met={result.mainRequirementsMet}
              partial={result.mainRequirementsPartial}
              missing={result.mainRequirementsMissing}
              labels={{
                met: t.workspace.statusLabel.met,
                partial: t.workspace.statusLabel.partial,
                missing: t.workspace.statusLabel.missing,
                unknown: t.workspace.statusLabel.insufficient_info,
              }}
            />
          </Card>
        </Reveal>

        {/* KPI grid */}
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card className="p-5">
              <MetricCard
                icon={AlertTriangle}
                value={result.criticalGapsCount}
                label={t.results.kpiGapsTitle}
                tone={result.criticalGapsCount > 0 ? 'danger' : 'success'}
                size="lg"
              />
              <p className="text-[12.5px] text-text2 mt-3">{result.criticalGapSummary}</p>
            </Card>

            <Card className="p-5 relative">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[13px] font-semibold text-text2">{t.results.kpiHrTitle}</span>
                <Tooltip content={t.results.hrTooltip} />
              </div>
              <RadialGauge value={result.hrScreeningEstimate} size={100} stroke={9} />
              <p className="text-[11.5px] text-muted mt-3">{t.results.hrNote}</p>
            </Card>
          </div>
        </Reveal>

        {/* Strength profile */}
        <Reveal>
          <Card className="p-6 mb-8">
            <h2 className="text-[17px] font-bold mb-1">{t.results.categoryTitle}</h2>
            <p className="text-[13px] text-text2 mb-5">{t.results.categorySubtitle}</p>
            <CategoryBarChart data={result.categoryScores} />
          </Card>
        </Reveal>

        {/* Strengths */}
        <div className="mb-8">
          <h2 className="text-[19px] font-bold mb-4">{t.results.strengthsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.strengths.length === 0 && <p className="text-[14px] text-text2">{t.results.strengthsEmpty}</p>}
            {result.strengths.map((s, i) => {
              const Icon = STRENGTH_ICONS[i % STRENGTH_ICONS.length];
              return (
                <Reveal key={i} delay={staggerDelay(i, STAGGER.cards)}>
                  <Card className="p-5">
                    <Icon className="w-6 h-6 text-teal mb-3" />
                    <h3 className="text-[15px] font-bold mb-1.5">{s.title}</h3>
                    <p className="text-[13.5px] text-text2 leading-relaxed mb-3">{s.text}</p>
                    {s.evidenceFound && <Badge tone="success">{t.results.evidenceFoundBadge}</Badge>}
                    {s.relatedRequirement && <p className="text-[12px] text-muted mt-2">{t.results.relatedRequirement} {s.relatedRequirement}</p>}
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Most important requirement */}
        <Reveal>
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
        </Reveal>

        {/* Recommendation — explains the result and the next step only; the paid conversion CTA
            lives in its own dedicated section below, not competing here. */}
        <Reveal>
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
            <p className="text-[13.5px] text-navy font-medium">{result.recommendationNextAction}</p>
          </Card>
        </Reveal>

        {/* Conversion — one clear CTA into the paid packages, personalized with the real,
            already-computed analysis counts (never hardcoded). Navigates to the pricing page so
            the user compares both packages before choosing — never starts payment directly. */}
        <Reveal>
          <Card className="p-6 md:p-10">
            <div className="text-center max-w-[560px] mx-auto mb-7">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-teal mb-2">{t.results.conversion.label}</div>
              <h2 className="font-display font-semibold text-[22px] mb-2">{t.results.conversion.heading}</h2>
              <p className="text-[13.5px] text-text2 mb-4">{t.results.conversion.description}</p>
              {/* cvChangesSummary is only meaningful once the background CV Change Plan generation
                  has finished (cvChangePlanReady) — showing it earlier would mean displaying a real
                  but not-yet-final 0, which reads as "we found nothing" rather than "still counting". */}
              {result.cvChangePlanReady && (
                <p className="text-[14px] font-semibold text-navy motion-pop-in">
                  {t.results.conversion.summaryPrefix} {totalCvChanges} {t.results.conversion.summaryMiddle} {result.interviewRisksCount}{' '}
                  {t.results.conversion.summarySuffix}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
              <ConversionPackageCard pkg={t.results.conversion.packages['1']} price={CONVERSION_PRICE[1]} />
              <ConversionPackageCard pkg={t.results.conversion.packages['2']} price={CONVERSION_PRICE[2]} />
            </div>

            <div className="text-center">
              <Button onClick={() => navigate(`/pricing/${id}`)} className="w-full sm:w-auto sm:px-10">
                {t.results.conversion.cta}
              </Button>
              <p className="text-[11.5px] text-muted mt-3">{t.results.conversion.oneTimePayment}</p>
            </div>
          </Card>
        </Reveal>

        {/* One fully-unlocked CV Change Plan example — proves the product works before paying */}
        {result.exampleCard && (
          <Reveal className="mt-8">
            <h2 className="text-[17px] font-bold mb-1">{t.results.exampleCardTitle}</h2>
            <p className="text-[13px] text-text2 mb-4">{t.results.exampleCardNote}</p>
            <CvChangeCard card={result.exampleCard} analysisId={id} cardIndex={-1} />
          </Reveal>
        )}

        <div className="text-center mt-8">
          <button
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-danger transition-colors duration-[var(--motion-fast)]"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.results.deleteMyDataCta}
          </button>
        </div>
      </div>
      {deleteOpen && id && <DeleteConfirmDialog analysisId={id} onClose={() => setDeleteOpen(false)} />}
    </div>
  );
}
