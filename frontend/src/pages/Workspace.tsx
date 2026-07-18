import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Download, Copy, Check, FileText, ChevronDown, Clock } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { CategoryBarChart } from '../components/charts';
import { LifecycleState } from '../components/LifecycleState';
import { GeneratingIllustration } from '../components/GeneratingIllustration';
import { InterviewIllustration } from '../components/InterviewIllustration';
import { RotatingHint } from '../components/RotatingHint';
import { localizeCategoryName } from '../lib/categoryLabel';
import {
  getAnalysis,
  getReport,
  getTailoredCv,
  getCoverLetter,
  getInterviewPrep,
  type AnalysisInfo,
  type FullReport,
  type TailoredCv,
  type CoverLetter,
  type InterviewPrep,
} from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Dict } from '../lib/i18n/locales';

type Tab = 'report' | 'cv' | 'cover-letter' | 'interview';

function buildTabs(t: Dict): { key: Tab; label: string; minPkg: number }[] {
  return [
    { key: 'report', label: t.workspace.tabs.report, minPkg: 1 },
    { key: 'cv', label: t.workspace.tabs.cv, minPkg: 2 },
    { key: 'cover-letter', label: t.workspace.tabs.coverLetter, minPkg: 2 },
    { key: 'interview', label: t.workspace.tabs.interview, minPkg: 3 },
  ];
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  met: 'success',
  partial: 'warning',
  missing: 'danger',
  insufficient_info: 'neutral',
};

export default function Workspace() {
  const { id, tab } = useParams<{ id: string; tab: Tab }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [lifecycleCode, setLifecycleCode] = useState<'expired' | 'deleted' | null>(null);

  useEffect(() => {
    if (!id) return;
    getAnalysis(id)
      .then(setInfo)
      .catch((err) => {
        if (err.status === 410 && (err.code === 'expired' || err.code === 'deleted')) setLifecycleCode(err.code);
      });
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
      <AppHeader vacancyTitle={info.vacancyTitle} vacancyCompany={info.vacancyCompany} vacancyLocation={info.vacancyLocation} />
      <div className="max-w-[1080px] mx-auto px-6 py-8">
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
          (owned >= 1 ? <ReportTab id={id} /> : <LockPanel pkgName={t.workspace.lockPackageNames.report} price="0.49 USD" analysisId={id} pkgId={1} />)}
        {activeTab === 'cv' &&
          (owned >= 2 ? <CvTab id={id} /> : <LockPanel pkgName={t.workspace.lockPackageNames.cv} price="0.99 USD" analysisId={id} pkgId={2} />)}
        {activeTab === 'cover-letter' &&
          (owned >= 2 ? <CoverLetterTab id={id} /> : <LockPanel pkgName={t.workspace.lockPackageNames.coverLetter} price="0.99 USD" analysisId={id} pkgId={2} />)}
        {activeTab === 'interview' &&
          (owned >= 3 ? <InterviewTab id={id} /> : <LockPanel pkgName={t.workspace.lockPackageNames.interview} price="5.90 USD" analysisId={id} pkgId={3} />)}
      </div>
    </div>
  );
}

function LockPanel({ pkgName, price, analysisId, pkgId }: { pkgName: string; price: string; analysisId: string; pkgId: number }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Card className="p-10 text-center">
      <Lock className="w-8 h-8 text-premium mx-auto mb-4" />
      <h2 className="text-[18px] font-bold mb-1.5">{t.workspace.lockedTitle}</h2>
      <p className="text-[14px] text-text2 mb-6">
        <span className="font-semibold text-navy">{pkgName}</span> {t.workspace.lockedTextSuffix}
      </p>
      <Button variant="premium" onClick={() => navigate(`/checkout/${analysisId}/${pkgId}`)}>
        {t.workspace.unlockCtaPrefix} {price}
      </Button>
    </Card>
  );
}

function ReportTab({ id }: { id: string }) {
  const { t, lang } = useLanguage();
  const [report, setReport] = useState<FullReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'met' | 'partial' | 'missing'>('all');

  useEffect(() => {
    getReport(id).then(setReport).catch(() => {});
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-[22px] font-extrabold text-navy">{report.compatibility}%</div>
          <div className="text-[12px] text-text2">{t.workspace.statCompat}</div>
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
              <div key={tier} className="flex items-center gap-2.5 px-2.5 py-2 bg-bg rounded-rk">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold border border-navy text-navy bg-white">
                  {t.workspace.importanceLabel[tier]} {t.workspace.weightMultipliers[tier]}
                </span>
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

      <Card className="p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-teal" />
          <div>
            <div className="font-semibold text-[14.5px]">{t.workspace.reportFileName}</div>
            <div className="text-[12px] text-text2">{t.workspace.pdfReportLabel}</div>
          </div>
        </div>
        <a href={`/api/analyses/${id}/report/download`} target="_blank" rel="noreferrer">
          <Button variant="secondary"><Download className="w-4 h-4" />{t.workspace.downloadCta}</Button>
        </a>
      </Card>
    </div>
  );
}

function CvTab({ id }: { id: string }) {
  const { t } = useLanguage();
  const [cv, setCv] = useState<TailoredCv | null>(null);
  useEffect(() => {
    getTailoredCv(id).then((r) => setCv(r.cv)).catch(() => {});
  }, [id]);
  if (!cv) {
    return (
      <div className="py-10">
        <GeneratingIllustration />
        <div className="text-center mt-5 h-5">
          <RotatingHint hints={t.workspace.cvGeneratingHints} className="text-[13px] text-info" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <Card className="p-8 font-serif">
        <h1 className="text-[22px] font-bold">{cv.name}</h1>
        <p className="text-teal font-semibold text-[14px] mb-1">{cv.title}</p>
        <p className="text-[12.5px] text-text2 mb-5">{cv.contact}</p>
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.summaryTitle}</h2>
        <p className="text-[13.5px] leading-relaxed mb-5">{cv.summary}</p>
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.skillsTitle}</h2>
        <p className="text-[13.5px] leading-relaxed mb-5">{cv.skills.join(' · ')}</p>
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.experienceTitle}</h2>
        {cv.experience.map((e, i) => (
          <div key={i} className="mb-4">
            <div className="font-semibold text-[13.5px]">{e.role}</div>
            <div className="text-[12px] text-muted italic mb-1.5">{e.dates}</div>
            <ul className="grid gap-1">
              {e.bullets.map((b, j) => (
                <li key={j} className="text-[13.5px] text-text2">• {b}</li>
              ))}
            </ul>
          </div>
        ))}
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.educationTitle}</h2>
        <p className="text-[13.5px] mb-5">{cv.education}</p>
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.certificationsTitle}</h2>
        <p className="text-[13.5px] mb-5">{cv.certifications}</p>
        <h2 className="text-[14px] font-bold text-teal border-b border-border pb-1 mb-2">{t.workspace.languagesTitle}</h2>
        <p className="text-[13.5px]">{cv.languages}</p>
      </Card>

      <div className="grid gap-4 content-start">
        <Card className="p-5">
          <h3 className="text-[14px] font-bold mb-3">{t.workspace.whatChangedTitle}</h3>
          <ul className="grid gap-2">
            {cv.changeExplanations.map((c, i) => (
              <li key={i} className="text-[13px] text-text2 flex gap-2">
                <Check className="w-3.5 h-3.5 text-teal flex-none mt-0.5" />
                {c}
              </li>
            ))}
          </ul>
        </Card>
        <a href={`/api/analyses/${id}/cv/download?format=docx`} target="_blank" rel="noreferrer">
          <Button variant="secondary" className="w-full"><Download className="w-4 h-4" />{t.workspace.downloadWordCv}</Button>
        </a>
        <a href={`/api/analyses/${id}/cv/download?format=pdf`} target="_blank" rel="noreferrer">
          <Button variant="secondary" className="w-full"><Download className="w-4 h-4" />{t.workspace.downloadPdfCv}</Button>
        </a>
      </div>
    </div>
  );
}

function CoverLetterTab({ id }: { id: string }) {
  const { t } = useLanguage();
  const [letter, setLetter] = useState<CoverLetter | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    getCoverLetter(id).then((r) => setLetter(r.letter)).catch(() => {});
  }, [id]);
  if (!letter) {
    return (
      <div className="py-10">
        <GeneratingIllustration />
        <div className="text-center mt-5 h-5">
          <RotatingHint hints={t.workspace.coverLetterGeneratingHints} className="text-[13px] text-info" />
        </div>
      </div>
    );
  }

  const fullText = [letter.greeting, ...letter.body, letter.closing].join('\n\n');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <Card className="p-8">
        <h1 className="text-[19px] font-bold mb-5">{t.workspace.coverLetterTitle}</h1>
        <p className="text-[14px] mb-4">{letter.greeting}</p>
        {letter.body.map((p, i) => (
          <p key={i} className="text-[14px] leading-relaxed mb-4 text-text2">{p}</p>
        ))}
        <p className="text-[14px]">{letter.closing}</p>
      </Card>
      <div className="grid gap-4 content-start">
        <Card className="p-5">
          <h3 className="text-[14px] font-bold mb-3">{t.workspace.basedOnTitle}</h3>
          <ul className="grid gap-2">
            {letter.basedOn.map((b, i) => (
              <li key={i} className="text-[13px] text-text2 flex gap-2">
                <Check className="w-3.5 h-3.5 text-teal flex-none mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </Card>
        <a href={`/api/analyses/${id}/cover-letter/download`} target="_blank" rel="noreferrer">
          <Button variant="secondary" className="w-full"><Download className="w-4 h-4" />{t.workspace.downloadWordLetter}</Button>
        </a>
        <Button
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t.workspace.copiedText : t.workspace.copyText}
        </Button>
      </div>
    </div>
  );
}

function InterviewTab({ id }: { id: string }) {
  const { t } = useLanguage();
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [openSection, setOpenSection] = useState<string>('hr');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    getInterviewPrep(id).then((r) => setPrep(r.prep)).catch(() => {});
  }, [id]);
  if (!prep) {
    return (
      <div className="py-10">
        <InterviewIllustration />
        <div className="text-center mt-5 h-5">
          <RotatingHint hints={t.workspace.interviewGeneratingHints} className="text-[13px] text-info" />
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'hr', label: t.workspace.hrQuestionsLabel, items: prep.hrQuestions },
    { key: 'situational', label: t.workspace.situationalLabel, items: prep.situational },
    { key: 'technical', label: t.workspace.technicalLabel, items: prep.technical },
  ];

  return (
    <div className="grid gap-6">
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

      {sections.map((s) => (
        <Card key={s.key} className="overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left"
            onClick={() => setOpenSection(openSection === s.key ? '' : s.key)}
          >
            <span className="text-[15px] font-bold">{s.label}</span>
            <ChevronDown className={'w-4 h-4 transition-transform ' + (openSection === s.key ? 'rotate-180' : '')} />
          </button>
          {openSection === s.key && (
            <div className="px-6 pb-6 grid gap-3">
              {s.items.map((q, i) => (
                <div key={i} className="border border-border rounded-rk p-4">
                  <div className="font-semibold text-[14px] mb-2">{q.question}</div>
                  <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.whyAsked}</div>
                  <p className="text-[13px] text-text2 mb-2">{q.why}</p>
                  <div className="text-[12px] font-semibold text-muted mb-1">{t.workspace.answerFramework}</div>
                  <p className="text-[13px] text-text2">{q.answerFramework}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

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
