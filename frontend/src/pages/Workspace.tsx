import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Copy, Check, Clock } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { CategoryBarChart, SegmentedStatBar, type StatSegment } from '../components/charts';
import { LifecycleState } from '../components/LifecycleState';
import { LockPanel, type LockPreviewStat } from '../components/LockPanel';
import { CvChangeCard } from '../components/CvChangeCard';
import { RequirementPriorityMap } from '../components/RequirementPriorityMap';
import { GeneratingIllustration } from '../components/GeneratingIllustration';
import { InterviewIllustration } from '../components/InterviewIllustration';
import { RotatingHint } from '../components/RotatingHint';
import { LanguageMismatchNotice } from '../components/LanguageMismatchNotice';
import { Accordion } from '../components/Accordion';
import { localizeCategoryName } from '../lib/categoryLabel';
import { countCompletedCards } from '../lib/localCardState';
import { isQuestionReviewed, toggleQuestionReviewed, countReviewedQuestions } from '../lib/journeyState';
import {
  getAnalysis,
  getResult,
  getReport,
  getCvChangePlan,
  getInterviewPrep,
  getInterviewPrepStatus,
  startInterviewPrep,
  getEvidenceChain,
  type AnalysisInfo,
  type FreeResult,
  type FullReport,
  type CvChangeCard as CvChangeCardData,
  type InterviewPrep,
  type InterviewQuestion,
  type EvidenceChainLink,
} from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Dict } from '../lib/i18n/locales';

type Tab = 'report' | 'cv-plan' | 'interview';

function buildTabs(t: Dict): { key: Tab; label: string; minPkg: number }[] {
  return [
    { key: 'report', label: t.workspace.tabs.report, minPkg: 1 },
    { key: 'cv-plan', label: t.workspace.tabs.cvPlan, minPkg: 1 },
    { key: 'interview', label: t.workspace.tabs.interview, minPkg: 2 },
  ];
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  met: 'success',
  partial: 'warning',
  missing: 'danger',
  insufficient_info: 'neutral',
};

const PRICE_FOR_PKG: Record<number, string> = { 1: '0.90 USD', 2: '2.90 USD' };

function cvPlanPreviewStats(freeResult: FreeResult | null, t: Dict): LockPreviewStat[] | undefined {
  if (!freeResult) return undefined;
  const { critical, important, optional } = freeResult.cvChangesSummary;
  return [
    { value: critical + important + optional, label: t.workspace.cvPlanSummaryTitle },
    { value: critical, label: t.results.premiumPreviewCriticalLabel },
  ];
}

export default function Workspace() {
  const { id, tab } = useParams<{ id: string; tab: Tab }>();
  const navigate = useNavigate();
  const { t, lang: uiLang } = useLanguage();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [freeResult, setFreeResult] = useState<FreeResult | null>(null);
  const [lifecycleCode, setLifecycleCode] = useState<'expired' | 'deleted' | 'entitlement_expired' | null>(null);

  useEffect(() => {
    if (!id) return;
    getAnalysis(id)
      .then(setInfo)
      .catch((err) => {
        if (err.status === 410 && (err.code === 'expired' || err.code === 'deleted' || err.code === 'entitlement_expired')) setLifecycleCode(err.code);
      });
    // Free result already carries real, already-computed preview counts (cvChangesSummary,
    // interviewRisksCount) — reused here so a locked tab can show what was actually found instead
    // of a generic "unlock premium" message. Never triggers any paid generation.
    getResult(id).then(setFreeResult).catch(() => {});
  }, [id]);

  const activeTab = (tab as Tab) || 'report';
  const owned = info?.ownedPackage ?? 0;
  const TABS = buildTabs(t);

  if (lifecycleCode) return <LifecycleState code={lifecycleCode} />;

  if (!id || !info) {
    return (
      <div>
        <AppHeader />
        <div className="max-w-[520px] mx-auto px-6 py-20 text-center text-text2">{t.common.loading}</div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader vacancyTitle={info.vacancyTitle} vacancyCompany={info.vacancyCompany} vacancyLocation={info.vacancyLocation} analysisId={id} />
      <div className="max-w-[1080px] mx-auto px-6 py-8">
        <LanguageMismatchNotice analysisLanguage={info.outputLanguage} uiLang={uiLang} />
        <div className="flex gap-1.5 mb-7 overflow-x-auto border-b border-border">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => navigate(`/workspace/${id}/${tb.key}`)}
              className={
                'px-4 py-3 text-[14px] font-semibold whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ' +
                (activeTab === tb.key ? 'border-teal text-teal' : 'border-transparent text-text2 hover:text-navy')
              }
            >
              {owned < tb.minPkg && <Lock className="w-3.5 h-3.5" />}
              {tb.label}
            </button>
          ))}
        </div>

        {activeTab === 'report' &&
          (owned >= 1 ? (
            <ReportTab id={id} />
          ) : (
            <LockPanel
              pkgName={t.workspace.lockPackageNames.report}
              price={PRICE_FOR_PKG[1]}
              analysisId={id}
              pkgId={1}
              previewStats={cvPlanPreviewStats(freeResult, t)}
            />
          ))}
        {activeTab === 'cv-plan' &&
          (owned >= 1 ? (
            <CvPlanTab id={id} />
          ) : (
            <LockPanel
              pkgName={t.workspace.lockPackageNames.cvPlan}
              price={PRICE_FOR_PKG[1]}
              analysisId={id}
              pkgId={1}
              previewStats={cvPlanPreviewStats(freeResult, t)}
            />
          ))}
        {activeTab === 'interview' &&
          (owned >= 2 ? (
            <InterviewPlaybookTab id={id} />
          ) : (
            <LockPanel
              pkgName={t.workspace.lockPackageNames.interview}
              price={PRICE_FOR_PKG[2]}
              analysisId={id}
              pkgId={2}
              previewStats={
                freeResult ? [{ value: freeResult.interviewRisksCount, label: t.results.premiumPreviewInterviewRisksLabel }] : undefined
              }
            />
          ))}
      </div>
    </div>
  );
}

function ReportTab({ id }: { id: string }) {
  const { t, lang } = useLanguage();
  const [report, setReport] = useState<FullReport | null>(null);
  const [chain, setChain] = useState<EvidenceChainLink[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'met' | 'partial' | 'missing'>('all');

  useEffect(() => {
    getReport(id).then(setReport).catch(() => {});
    getEvidenceChain(id).then((r) => setChain(r.chain)).catch(() => {});
  }, [id]);

  const filtered = useMemo(() => {
    if (!report) return [];
    if (filter === 'all') return report.requirements;
    return report.requirements.filter((r) => r.status === filter);
  }, [report, filter]);

  if (!report) return <p className="text-text2">{t.common.loading}</p>;

  const FILTERS = [
    ['all', t.workspace.filterAll],
    ['met', t.workspace.filterMet],
    ['partial', t.workspace.filterPartial],
    ['missing', t.workspace.filterMissing],
  ] as const;

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">{report.compatibility}%</div>
          <div className="text-[12px] text-text2">{t.workspace.statCompat}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">{report.cvPresentationScore}%</div>
          <div className="text-[12px] text-text2">{t.results.cvPresentationTitle}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">
            {report.mainRequirementsMet}/{report.mainRequirementsTotal}
          </div>
          <div className="text-[12px] text-text2">{t.workspace.statMainReq}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">{report.criticalGapsCount}</div>
          <div className="text-[12px] text-text2">{t.workspace.statCriticalGaps}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">{report.hrScreeningEstimate}%</div>
          <div className="text-[12px] text-text2">{t.workspace.statHrChance}</div>
        </Card>
      </div>

      <RequirementPriorityMap requirements={report.requirements} chain={chain} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-[14.5px] font-bold mb-3.5">{t.workspace.realVsVisibleTitle}</h2>
          {[
            [t.workspace.realLabel, report.realCompatibility, '#0F9D91'],
            [t.workspace.visibleLabel, report.compatibility, '#C97800'],
          ].map(([label, value, color], i) => (
            <div key={i} className={i === 0 ? 'mb-3.5' : ''}>
              <div className="flex justify-between text-[13px] mb-1.5">
                <span className="font-semibold">{label}</span>
                <span className="font-extrabold text-[15px]" style={{ color: color as string }}>{value}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-bg2 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value}%`, background: color as string }} />
              </div>
            </div>
          ))}
          {report.realCompatibilityGap && (
            <p className="text-[12.5px] text-text2 mt-3.5 leading-relaxed bg-bg rounded-rk p-2.5">{report.realCompatibilityGap}</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-[14.5px] font-bold mb-2.5">{t.workspace.weightTitle}</h2>
          <p className="text-[12.5px] text-text2 mb-3">{t.workspace.weightSubtitle}</p>
          <div className="grid gap-2">
            {(['kritik', 'əsas', 'üstünlük'] as const).map((tier) => (
              <div key={tier} className="px-2.5 py-2 bg-bg rounded-rk text-[12.5px] text-navy">
                {t.workspace.weightLevelLabel[tier]}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-[16px] font-bold mb-4">{t.workspace.categoryTitle}</h2>
        <CategoryBarChart data={report.categoryScores} />
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-[16px] font-bold">{t.workspace.reqMatrixTitle}</h2>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={
                  'px-3 py-1.5 rounded-full text-[12.5px] font-semibold border ' +
                  (filter === k ? 'border-teal bg-success-bg text-teal' : 'border-border text-text2')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text2 border-b border-border">
                <th className="py-2 pr-3">{t.workspace.tableReq}</th>
                <th className="py-2 pr-3">{t.workspace.tableCategory}</th>
                <th className="py-2 pr-3">{t.workspace.tableImportance}</th>
                <th className="py-2 pr-3">{t.workspace.tableStatus}</th>
                <th className="py-2">{t.workspace.tableEvidence}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border align-top">
                  <td className="py-2.5 pr-3 font-medium">{r.title}</td>
                  <td className="py-2.5 pr-3 text-text2">{localizeCategoryName(r.category, lang)}</td>
                  <td className="py-2.5 pr-3 text-text2">{t.workspace.importanceLabel[r.importance] || r.importance}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={STATUS_TONE[r.status]}>{t.workspace.statusLabel[r.status]}</Badge>
                  </td>
                  <td className="py-2.5 text-text2">{r.evidence || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden grid gap-3">
          {filtered.map((r, i) => (
            <div key={i} className="border border-border rounded-rk p-3.5">
              <div className="flex justify-between items-start gap-2 mb-1.5">
                <span className="font-semibold text-[14px]">{r.title}</span>
                <Badge tone={STATUS_TONE[r.status]}>{t.workspace.statusLabel[r.status]}</Badge>
              </div>
              <div className="text-[12px] text-text2 mb-1">{localizeCategoryName(r.category, lang)} · {t.workspace.importanceLabel[r.importance] || r.importance}</div>
              <div className="text-[13px] text-text2">{r.evidence || r.explanation}</div>
            </div>
          ))}
        </div>
      </Card>

      {report.weakPresentation.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[16px] font-bold mb-4">{t.workspace.weakPresentationTitle}</h2>
          <div className="grid gap-3">
            {report.weakPresentation.map((w, i) => (
              <div key={i} className="border border-border rounded-rk p-4">
                <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.original}</div>
                <p className="text-[13.5px] mb-2 italic text-text2">"{w.original}"</p>
                <div className="text-[12px] font-semibold text-warning mb-1">{t.workspace.problem}</div>
                <p className="text-[13.5px] mb-2 text-text2">{w.issue}</p>
                <div className="text-[12px] font-semibold text-success mb-1">{t.workspace.suggestedDirection}</div>
                <p className="text-[13.5px] text-text2">{w.suggestion}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted mt-3">{t.workspace.weakPresentationNote}</p>
        </Card>
      )}

      {report.improvementOpportunities.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[16px] font-bold mb-4">{t.workspace.improvementTitle}</h2>
          <ol className="grid gap-2.5">
            {report.improvementOpportunities.map((op, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-navy text-white text-[12px] font-bold flex items-center justify-center flex-none">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[14px] font-semibold">{op.title}</div>
                  <div className="text-[12.5px] text-teal">{op.impact}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

const CHANGE_TYPE_ORDER = ['rewrite', 'add', 'clarify', 'remove'] as const;
const CHANGE_TYPE_COLOR: Record<(typeof CHANGE_TYPE_ORDER)[number], string> = {
  rewrite: 'bg-navy',
  add: 'bg-teal',
  clarify: 'bg-info',
  remove: 'bg-muted',
};

function changeTypeSegments(cards: CvChangeCardData[], t: Dict): StatSegment[] {
  return CHANGE_TYPE_ORDER.map((changeType) => ({
    key: changeType,
    value: cards.filter((c) => c.changeType === changeType).length,
    label: t.cvChangePlan.changeTypeLabel[changeType],
    colorClass: CHANGE_TYPE_COLOR[changeType],
  }));
}

function CvPlanTab({ id }: { id: string }) {
  const { t } = useLanguage();
  const [cards, setCards] = useState<CvChangeCardData[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getCvChangePlan(id).then((r) => setCards(r.cards)).catch(() => {});
  }, [id]);

  const completed = cards ? countCompletedCards(id, cards.length) : 0;

  if (!cards) {
    return (
      <div className="py-10">
        <GeneratingIllustration />
        <div className="text-center mt-5 h-5">
          <RotatingHint hints={t.workspace.cvGeneratingHints} className="text-[13px] text-info" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return <p className="text-text2">{t.workspace.cvPlanEmpty}</p>;
  }

  const changeTypeCounts = changeTypeSegments(cards, t);

  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-bold">{t.workspace.cvPlanTitle}</h2>
          <span className="text-[13px] font-semibold text-teal">
            {completed} / {cards.length} {t.workspace.cvPlanProgressSuffix}
          </span>
        </div>
        <p className="text-[13px] text-text2 mb-3">{t.workspace.cvPlanSubtitle}</p>
        <div className="h-2 rounded-full bg-bg2 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal transition-[width] duration-300"
            style={{ width: `${cards.length ? (completed / cards.length) * 100 : 0}%` }}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-[13.5px] font-bold text-navy mb-3">{t.workspace.cvPlanSummaryTitle}</h3>
        <SegmentedStatBar segments={changeTypeCounts} />
      </Card>

      {CHANGE_TYPE_ORDER.map((changeType) => {
        const group = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.changeType === changeType);
        if (group.length === 0) return null;
        return (
          <div key={changeType}>
            <h3 className="text-[14px] font-bold text-teal mb-3">{t.workspace.cvPlanGroupLabels[changeType]}</h3>
            <div className="grid gap-4">
              {group.map(({ c, i }) => (
                <CvChangeCard key={i} card={c} analysisId={id} cardIndex={i} onChange={() => setTick((v) => v + 1)} />
              ))}
            </div>
          </div>
        );
      })}
      {/* tick is read only to force a re-render after localStorage-backed card state changes */}
      <span className="hidden">{tick}</span>
    </div>
  );
}


function QuestionCard({ q, analysisId, questionId, onChange }: { q: InterviewQuestion; analysisId: string; questionId: string; onChange?: () => void }) {
  const { t } = useLanguage();
  const priorityTone = q.priority === 'veryLikely' ? 'danger' : q.priority === 'likely' ? 'warning' : 'neutral';
  const reviewed = isQuestionReviewed(analysisId, questionId);
  return (
    <div className="border border-border rounded-rk p-4 grid gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-[14px]">{q.question}</div>
        <div className="flex items-center gap-1.5 flex-none">
          <Badge tone={priorityTone}>{t.workspace.priorityLabel[q.priority]}</Badge>
          {reviewed && <Badge tone="success">{t.workspace.questionReviewedBadge}</Badge>}
        </div>
      </div>
      <div className="text-[12px] font-semibold text-muted">{t.workspace.whyAsked}</div>
      <p className="text-[13px] text-text2">{q.why}</p>
      {q.relatedRequirement && (
        <p className="text-[12px] text-text2">
          <span className="font-semibold text-muted">{t.workspace.relatedRequirementLabel}:</span> {q.relatedRequirement}
        </p>
      )}
      {q.relevantExperience && (
        <p className="text-[12px] text-text2">
          <span className="font-semibold text-muted">{t.workspace.relevantExperienceLabel}:</span> {q.relevantExperience}
        </p>
      )}
      <div className="text-[12px] font-semibold text-muted">{t.workspace.answerFramework}</div>
      <p className="text-[13px] text-text2">{q.answerFramework}</p>
      {q.likelyFollowUps.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.followUpsLabel}</div>
          <ul className="grid gap-0.5">
            {q.likelyFollowUps.map((f, i) => (
              <li key={i} className="text-[12.5px] text-text2">• {f}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="pt-2 border-t border-border">
        <Button
          size="sm"
          variant={reviewed ? 'primary' : 'secondary'}
          onClick={() => {
            toggleQuestionReviewed(analysisId, questionId);
            onChange?.();
          }}
        >
          <Check className="w-3.5 h-3.5" />
          {t.workspace.questionReviewedCta}
        </Button>
      </div>
    </div>
  );
}

const PRIORITY_COLOR: Record<InterviewQuestion['priority'], string> = {
  veryLikely: 'bg-danger',
  likely: 'bg-warning',
  additional: 'bg-muted',
};

// Interview Playbook generation is now a real, DB-backed job (idle -> processing -> done | failed
// — see analyses.ts's runInterviewPrepGeneration) with a hard backend deadline well under 30s per
// call, so the frontend's job is just: start it (idempotent), poll the real status, and render the
// result the moment it's ready. No elapsed-time tracking, no seconds, no countdown, no estimated
// percentage — the stage label and progress bar below cycle on a fixed decorative interval that
// carries no timing information at all (a slow connection and a fast one look identical); they
// exist purely so the wait doesn't feel frozen, matching RotatingHint's existing pattern elsewhere
// in this file (see CvPlanTab). A poll-attempt cap (not a time-based one, and never shown to the
// user) guards against a genuinely stuck job — e.g. a server restart mid-generation — from polling
// forever, satisfying "no infinite loading state" without reintroducing a countdown.
const INTERVIEW_STAGE_INTERVAL_MS = 3200;
const INTERVIEW_STAGE_PCT = [22, 48, 72, 90];
const INTERVIEW_POLL_INTERVAL_MS = 1800;
const INTERVIEW_MAX_POLL_ATTEMPTS = 40;

function InterviewPlaybookTab({ id }: { id: string }) {
  const { t } = useLanguage();
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (prep || failed) return;
    const cycle = setInterval(() => setStageIndex((i) => (i + 1) % INTERVIEW_STAGE_PCT.length), INTERVIEW_STAGE_INTERVAL_MS);
    return () => clearInterval(cycle);
  }, [prep, failed]);

  useEffect(() => {
    if (prep) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function poll(attempt: number) {
      if (cancelled) return;
      try {
        const { status } = await getInterviewPrepStatus(id);
        if (cancelled) return;
        if (status === 'done') {
          const r = await getInterviewPrep(id);
          if (!cancelled) setPrep(r.prep);
          return;
        }
        if (status === 'failed' || attempt >= INTERVIEW_MAX_POLL_ATTEMPTS) {
          setFailed(true);
          return;
        }
        pollTimer = setTimeout(() => poll(attempt + 1), INTERVIEW_POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (attempt >= INTERVIEW_MAX_POLL_ATTEMPTS) {
          setFailed(true);
          return;
        }
        pollTimer = setTimeout(() => poll(attempt + 1), INTERVIEW_POLL_INTERVAL_MS);
      }
    }

    // Idempotent: safe to call on every mount (tab switch, page refresh) — the backend only
    // actually starts real work the first time, every later call just reports current status.
    startInterviewPrep(id)
      .then(() => poll(0))
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [id, prep]);

  if (!prep) {
    const L = t.workspace.interviewLoading;
    const pct = INTERVIEW_STAGE_PCT[stageIndex];
    return (
      <div className="py-10">
        <InterviewIllustration />
        <div className="max-w-[420px] mx-auto mt-6">
          {failed ? (
            <p className="text-center text-[13.5px] text-text2">{L.failureMessage}</p>
          ) : (
            <>
              <p className="text-center text-[14px] font-semibold text-navy mb-1">{L.title}</p>
              <p className="text-center text-[12px] text-text2 mb-4">{L.description}</p>
              <div className="h-2 rounded-full bg-bg2 overflow-hidden mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-teal transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
              </div>
              <p key={stageIndex} className="text-center text-[13px] text-info" style={{ animation: 'pm-rise .4s ease both' }}>
                {L.stages[stageIndex]}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const priorityRank: Record<string, number> = { veryLikely: 0, likely: 1, additional: 2 };
  const sortedByPriority = (items: InterviewQuestion[]) => [...items].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  const sections = [
    { key: 'hr', label: t.workspace.hrQuestionsLabel, items: sortedByPriority(prep.hrQuestions) },
    { key: 'situational', label: t.workspace.situationalLabel, items: sortedByPriority(prep.situational) },
    { key: 'technical', label: t.workspace.technicalLabel, items: sortedByPriority(prep.technical) },
  ];
  const allQuestions = [...prep.hrQuestions, ...prep.situational, ...prep.technical];
  const allQuestionIds = sections.flatMap((s) => s.items.map((_, i) => `${s.key}-${i}`));
  const reviewedCount = countReviewedQuestions(id, allQuestionIds);
  const priorityCounts: StatSegment[] = (['veryLikely', 'likely', 'additional'] as const).map((p) => ({
    key: p,
    value: allQuestions.filter((q) => q.priority === p).length,
    label: t.workspace.priorityLabel[p],
    colorClass: PRIORITY_COLOR[p],
  }));

  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13.5px] font-bold text-navy">{t.workspace.interviewSummaryTitle}</h3>
          <span className="text-[13px] font-semibold text-teal">
            {reviewedCount} / {allQuestionIds.length} {t.workspace.interviewPrepProgressSuffix}
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg2 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-teal transition-[width] duration-300"
            style={{ width: `${allQuestionIds.length ? (reviewedCount / allQuestionIds.length) * 100 : 0}%` }}
          />
        </div>
        <SegmentedStatBar segments={priorityCounts} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.strongestTopic}</div>
          <div className="text-[15px] font-bold">{prep.strongestTopic}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.biggestRisk}</div>
          <div className="text-[15px] font-bold">{prep.biggestRisk}</div>
        </Card>
      </div>

      <Card className="p-6 bg-success-bg border-success/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-bold">{t.workspace.tellMeAboutYourselfTitle}</h2>
          <button
            className="text-[12.5px] font-semibold text-teal flex items-center gap-1"
            onClick={() => {
              navigator.clipboard.writeText(prep.tellMeAboutYourself);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t.workspace.copiedText : t.workspace.copyShort}
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-text">{prep.tellMeAboutYourself}</p>
        <div className="flex items-center gap-1.5 text-[12px] text-text2 mt-3">
          <Clock className="w-3.5 h-3.5" /> {t.workspace.durationHint}
        </div>
      </Card>

      <Accordion
        defaultOpenKey="hr"
        items={sections.map((s) => ({
          key: s.key,
          title: s.label,
          meta: (
            <span className="text-[11.5px] font-semibold text-muted">
              {countReviewedQuestions(id, s.items.map((_, i) => `${s.key}-${i}`))}/{s.items.length}
            </span>
          ),
          content: (
            <div className="grid gap-3">
              {s.items.map((q, i) => (
                <QuestionCard key={i} q={q} analysisId={id} questionId={`${s.key}-${i}`} onChange={() => setTick((v) => v + 1)} />
              ))}
            </div>
          ),
        }))}
      /><span className="hidden">{tick}</span>

      {prep.criticalGapStrategies.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-bold mb-3">{t.workspace.criticalGapStrategiesTitle}</h2>
          <div className="grid gap-3">
            {prep.criticalGapStrategies.map((g, i) => (
              <div key={i} className="border border-border rounded-rk p-4">
                <div className="font-semibold text-[13.5px] mb-1">{g.requirement}</div>
                <Badge tone={g.situation === 'has_experience' ? 'success' : g.situation === 'similar_experience' ? 'warning' : 'neutral'} className="mb-2">
                  {t.workspace.situationLabel[g.situation]}
                </Badge>
                <p className="text-[13px] text-text2">{g.guidance}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {prep.starStories.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-bold mb-3">{t.workspace.starStoriesTitle}</h2>
          <div className="grid gap-4">
            {prep.starStories.map((s, i) => (
              <div key={i} className="border border-border rounded-rk p-4 grid gap-1.5">
                <div className="font-semibold text-[14px] mb-1">{s.title}</div>
                <p className="text-[13px] text-text2"><span className="font-semibold text-muted">{t.workspace.starLabels.situation}:</span> {s.situation}</p>
                <p className="text-[13px] text-text2"><span className="font-semibold text-muted">{t.workspace.starLabels.task}:</span> {s.task}</p>
                <p className="text-[13px] text-text2"><span className="font-semibold text-muted">{t.workspace.starLabels.action}:</span> {s.action}</p>
                <p className="text-[13px] text-text2"><span className="font-semibold text-muted">{t.workspace.starLabels.result}:</span> {s.result}</p>
                {s.missingDetail && (
                  <p className="text-[12.5px] text-warning"><span className="font-semibold">{t.workspace.starLabels.missingDetail}:</span> {s.missingDetail}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {prep.gapExplanations.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-bold mb-3">{t.workspace.gapExplanationsTitle}</h2>
          <ul className="grid gap-2">
            {prep.gapExplanations.map((g, i) => (
              <li key={i} className="text-[13.5px] text-text2">• {g}</li>
            ))}
          </ul>
        </Card>
      )}

      {prep.cvVerificationQuestions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-bold mb-3">{t.workspace.cvVerificationQuestionsTitle}</h2>
          <ul className="grid gap-2">
            {prep.cvVerificationQuestions.map((g, i) => (
              <li key={i} className="text-[13.5px] text-text2">• {g}</li>
            ))}
          </ul>
        </Card>
      )}

      {prep.questionsToAsk.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-bold mb-3">{t.workspace.questionsToAskTitle}</h2>
          <ul className="grid gap-2">
            {prep.questionsToAsk.map((g, i) => (
              <li key={i} className="text-[13.5px] text-text2">• {g}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

