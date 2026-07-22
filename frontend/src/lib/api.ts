const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // Required for the pm_session HttpOnly cookie to be sent/received — this is what lets the
    // backend recognize "this browser" across requests without any registration. Same-origin dev
    // (Vite's /api proxy) already worked without this; 'include' also covers a deployed frontend/
    // backend split across origins, paired with the backend's cors({ credentials: true }).
    credentials: 'include',
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Sorğu uğursuz oldu (${res.status})`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data.code;
    (err as any).payload = data;
    throw err;
  }
  return data as T;
}

// ---------- analyses ----------

export function createAnalysisFromFile(file: File) {
  const fd = new FormData();
  fd.append('cvMode', 'file');
  fd.append('cvFile', file);
  return req<{ id: string; cvName: string; cvSize: string }>('/analyses', { method: 'POST', body: fd });
}

export function createAnalysisFromText(text: string) {
  const fd = new FormData();
  fd.append('cvMode', 'text');
  fd.append('cvText', text);
  return req<{ id: string; cvName: string; cvSize: string }>('/analyses', { method: 'POST', body: fd });
}

export interface VacancyPreview {
  title: string;
  company: string;
  location: string;
  domain: string;
  text: string;
}

export function checkVacancyUrl(id: string, url: string) {
  return req<{ status: 'success' | 'failed'; vacancy?: VacancyPreview; reason?: string }>(
    `/analyses/${id}/vacancy/url`,
    { method: 'POST', body: JSON.stringify({ url }) },
  );
}

export function submitVacancyText(id: string, text: string) {
  return req<{ status: 'success' }>(`/analyses/${id}/vacancy/manual`, { method: 'POST', body: JSON.stringify({ text }) });
}

export function updateSettings(id: string, data: { outputLanguage?: string; consent?: boolean }) {
  return req<{ ok: true }>(`/analyses/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function startAnalysis(id: string) {
  return req<{ status: string }>(`/analyses/${id}/start`, { method: 'POST' });
}

export function getStatus(id: string) {
  return req<{ status: string; procStage: number; failReason: string | null }>(`/analyses/${id}/status`);
}

export interface AnalysisInfo {
  id: string;
  status: string;
  vacancyTitle: string | null;
  vacancyCompany: string | null;
  vacancyLocation: string | null;
  outputLanguage: string;
  createdAt: string;
  expiresAt: string;
  ownedPackage: number;
  selfAttestedGapConfirmed: boolean | null;
  paidAt: string | null;
  entitlementExpiresAt: string | null;
}

export function getAnalysis(id: string) {
  return req<AnalysisInfo>(`/analyses/${id}`);
}

export function deleteAnalysis(id: string) {
  return req<{ ok: true }>(`/analyses/${id}`, { method: 'DELETE' });
}

export interface CvChangesSummary {
  critical: number;
  important: number;
  optional: number;
}

export interface FreeResult {
  vacancy: { title: string; company: string; location: string };
  compatibility: number;
  compatibilityLabel: string;
  /** Independent quality axis from `compatibility` — how well the CV's writing sells the real experience. */
  cvPresentationScore: number;
  cvPresentationLabel: string;
  /** Candidate's true underlying fit if experience were fully reflected in the CV — always >= compatibility. */
  realCompatibility: number;
  mainRequirementsTotal: number;
  mainRequirementsMet: number;
  mainRequirementsPartial: number;
  mainRequirementsMissing: number;
  criticalGapsCount: number;
  criticalGapSummary: string;
  hrScreeningEstimate: number;
  reliability: string;
  categoryScores: { category: string; score: number }[];
  strengths: { title: string; text: string; evidenceFound: boolean; relatedRequirement: string }[];
  mostImportantMissingRequirement: string;
  mostImportantMissingExplanation: string;
  recommendationStatus: string;
  recommendationTone: 'positive' | 'warning' | 'negative';
  recommendationReasons: string[];
  recommendationNextAction: string;
  /** Real, app-computed counts for the premium-conversion preview — never hardcoded. */
  cvChangesSummary: CvChangesSummary;
  interviewRisksCount: number;
  /** One fully-populated CV Change Plan card, unlocked for free as a concrete example. */
  exampleCard: CvChangeCard | null;
  /** False while the CV Change Plan is still generating in the background (cvChangesSummary/
   * exampleCard are zeroed/null until then) — poll again shortly rather than treating as final. */
  cvChangePlanReady: boolean;
  ownedPackage: number;
  selfAttestedGapConfirmed: boolean | null;
}

export function getResult(id: string) {
  return req<FreeResult>(`/analyses/${id}/result`);
}

export interface RequirementRow {
  title: string;
  category: string;
  importance: 'kritik' | 'əsas' | 'üstünlük';
  status: 'met' | 'partial' | 'missing' | 'insufficient_info';
  evidence: string;
  explanation: string;
}

export interface FullReport {
  vacancy: { title: string; company: string; location: string };
  compatibility: number;
  cvPresentationScore: number;
  realCompatibility: number;
  realCompatibilityGap: string;
  mainRequirementsTotal: number;
  mainRequirementsMet: number;
  criticalGapsCount: number;
  hrScreeningEstimate: number;
  recommendationStatus: string;
  requirements: RequirementRow[];
  categoryScores: { category: string; score: number }[];
  weakPresentation: { original: string; issue: string; suggestion: string }[];
  improvementOpportunities: { title: string; impact: string }[];
  ownedPackage: number;
}

export function getReport(id: string) {
  return req<FullReport>(`/analyses/${id}/report`);
}

// ---------- CV Change Plan (replaces the old "Tailored CV") ----------

export type ChangeType = 'rewrite' | 'add' | 'clarify' | 'remove';

export interface CvChangeCard {
  section: string;
  currentText: string;
  /** One short sentence: what to change (e.g. "Bu mətni daha konkret yazın."). */
  whatToChange: string;
  /** One short sentence: why it matters for this vacancy. */
  problem: string;
  recommendedText: string;
  relatedRequirements: string[];
  evidenceFromCv: string[];
  priority: 'kritik' | 'əsas' | 'üstünlük';
  changeType: ChangeType;
}

export function getCvChangePlan(id: string) {
  return req<{ cards: CvChangeCard[]; ownedPackage: number }>(`/analyses/${id}/cv-plan`);
}

// ---------- Interview Playbook ----------

export interface InterviewQuestion {
  question: string;
  why: string;
  answerFramework: string;
  priority: 'veryLikely' | 'likely' | 'additional';
  relatedRequirement: string;
  relevantExperience: string;
  likelyFollowUps: string[];
}

export interface CriticalGapStrategy {
  requirement: string;
  situation: 'has_experience' | 'similar_experience' | 'no_experience';
  guidance: string;
}

export interface StarStory {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  missingDetail: string;
}

export interface InterviewPrep {
  strongestTopic: string;
  biggestRisk: string;
  /** The "60-second introduction" framework. */
  tellMeAboutYourself: string;
  hrQuestions: InterviewQuestion[];
  situational: InterviewQuestion[];
  technical: InterviewQuestion[];
  criticalGapStrategies: CriticalGapStrategy[];
  starStories: StarStory[];
  cvVerificationQuestions: string[];
  gapExplanations: string[];
  questionsToAsk: string[];
}

export type InterviewPrepStatus = 'idle' | 'processing' | 'done' | 'failed';

/** Starts generation if not already running/done — idempotent, safe to call on every mount and on
 * retry; the backend atomically ensures only one real job runs per analysis. Returns immediately. */
export function startInterviewPrep(id: string, signal?: AbortSignal) {
  return req<{ status: InterviewPrepStatus }>(`/analyses/${id}/interview/generate`, { method: 'POST', signal });
}

export function getInterviewPrepStatus(id: string, signal?: AbortSignal) {
  return req<{ status: InterviewPrepStatus; failReason: string | null }>(`/analyses/${id}/interview/status`, { signal });
}

export function getInterviewPrep(id: string, signal?: AbortSignal) {
  return req<{ prep: InterviewPrep; ownedPackage: number }>(`/analyses/${id}/interview`, { signal });
}

// ---------- Evidence Chain ----------

export interface EvidenceChainLink {
  requirement: string;
  category: string;
  importance: 'kritik' | 'əsas' | 'üstünlük';
  status: 'met' | 'partial' | 'missing' | 'insufficient_info';
  evidence: string;
  relatedChangeSection: string | null;
  relatedInterviewQuestion: string | null;
}

export function getEvidenceChain(id: string) {
  return req<{ chain: EvidenceChainLink[] }>(`/analyses/${id}/evidence-chain`);
}

// ---------- orders ----------

export interface Order {
  id: string;
  analysisId: string;
  package: number;
  amountUsd: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  basePriceUsd?: number;
  creditUsd?: number;
}

export function createOrder(analysisId: string, pkg: number) {
  return req<Order>('/orders', { method: 'POST', body: JSON.stringify({ analysisId, package: pkg }) });
}

export function getOrder(id: string) {
  return req<Order>(`/orders/${id}`);
}

export function simulatePayment(id: string, outcome: 'success' | 'fail') {
  return req<{ status: string }>(`/orders/${id}/simulate`, { method: 'POST', body: JSON.stringify({ outcome }) });
}

// ---------- session (anonymous-browser access recovery, no registration) ----------

export interface SessionCurrent {
  hasAnalysis: boolean;
  analysisId?: string;
  status?: string;
  failReason?: string | null;
  ownedPackage?: number;
  paidAt?: string | null;
  entitlementExpiresAt?: string | null;
  entitlementActive?: boolean;
}

/** Reads (never creates) the calling browser's most recent analysis, if any — drives the homepage
 * resume card and any "is my paid access still valid" check. Never returns CV/vacancy content. */
export function getCurrentSession() {
  return req<SessionCurrent>('/session/current');
}

// ---------- recovery (email-link based access restoration; see backend lib/recovery.ts) ----------

export function consumeRecoveryToken(token: string) {
  return req<{ analysisId: string }>('/recovery/consume', { method: 'POST', body: JSON.stringify({ token }) });
}

// ---------- suggestions (admin read only — public submission widget was removed; see lib/adminApi.ts) ----------

export type SuggestionCategory = 'Funksionallıq' | 'Dizayn' | 'Qiymət' | 'Digər';

export { req as apiRequest };
