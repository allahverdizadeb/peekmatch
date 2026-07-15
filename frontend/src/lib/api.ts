const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
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
}

export function getAnalysis(id: string) {
  return req<AnalysisInfo>(`/analyses/${id}`);
}

export interface FreeResult {
  vacancy: { title: string; company: string; location: string };
  compatibility: number;
  compatibilityLabel: string;
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
  ownedPackage: number;
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

export interface TailoredCv {
  name: string;
  title: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: { role: string; dates: string; bullets: string[] }[];
  education: string;
  certifications: string;
  languages: string;
  changeExplanations: string[];
}

export function getTailoredCv(id: string) {
  return req<{ cv: TailoredCv; ownedPackage: number }>(`/analyses/${id}/cv`);
}

export interface CoverLetter {
  greeting: string;
  body: string[];
  closing: string;
  basedOn: string[];
}

export function getCoverLetter(id: string) {
  return req<{ letter: CoverLetter; ownedPackage: number }>(`/analyses/${id}/cover-letter`);
}

export interface InterviewPrep {
  strongestTopic: string;
  biggestRisk: string;
  tellMeAboutYourself: string;
  hrQuestions: { question: string; why: string; answerFramework: string }[];
  situational: { question: string; why: string; answerFramework: string }[];
  technical: { question: string; why: string; answerFramework: string }[];
  gapExplanations: string[];
  questionsToAsk: string[];
}

export function getInterviewPrep(id: string) {
  return req<{ prep: InterviewPrep; ownedPackage: number }>(`/analyses/${id}/interview`);
}

// ---------- orders ----------

export interface Order {
  id: string;
  analysisId: string;
  package: number;
  amountUsd: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
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

export { req as apiRequest };
