import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { extractCvText, CvParseError, MAX_CV_BYTES, MIN_CV_TEXT_CHARS } from '../lib/cvParse.js';
import { extractVacancyFromUrl, VacancyExtractError, MIN_VACANCY_TEXT_CHARS } from '../lib/vacancyExtract.js';
import {
  analyzeMatch,
  generateCvChangePlan,
  generateInterviewPrep,
  AiError,
  type AiErrorCode,
  type MatchResult,
  type CvChangePlan,
  type CvChangeCard,
  type InterviewPrep,
  type SelfAttestedGap,
} from '../lib/ai.js';
import { highestOwnedPackage, ownedPackages, unlocksApplication, unlocksInterview } from '../lib/pricing.js';
import { resolveAnalysis, respondUnresolved, type AnalysisRow } from '../lib/analysisLifecycle.js';
import { sanitizeCvChangePlan, computeCvChangesSummary, computeInterviewRisksCount } from '../lib/scoring.js';
import { buildEvidenceChain } from '../lib/evidenceChain.js';

const upload = multer({ limits: { fileSize: MAX_CV_BYTES } });
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const analysesRouter = Router();

/** Maps an AiError's code to an HTTP status: 503 for transient provider issues worth retrying,
 * 502 for an upstream (AI provider) response problem that isn't the client's fault, 500 for
 * operator-side config/billing issues. */
function aiErrorStatus(code: AiErrorCode): number {
  switch (code) {
    case 'rate_limited':
    case 'timeout':
    case 'network_error':
      return 503;
    case 'model_unavailable':
    case 'refusal':
    case 'invalid_response':
      return 502;
    default:
      return 500;
  }
}

/** Shared error responder for every route that triggers an AI generation. AiError's .message is
 * already a safe, Azerbaijani, user-facing string (translated in ai.ts) with no request/response
 * internals or secrets — this only adds the right HTTP status and a machine-readable `code` on
 * top. Anything that isn't an AiError (a DB error, a bug, etc.) still gets the pre-existing
 * generic fallback so no unexpected exception ever leaks detail to the client. */
function respondAiError(res: import('express').Response, err: unknown, fallbackMessage: string): void {
  if (err instanceof AiError) {
    res.status(aiErrorStatus(err.code)).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: fallbackMessage });
}

function buildSelfAttestedGap(analysis: AnalysisRow, full: MatchResult): SelfAttestedGap {
  if (analysis.selfAttestedGapConfirmed == null) return null;
  return {
    requirement: full.mostImportantMissingRequirement,
    confirmed: analysis.selfAttestedGapConfirmed,
    details: analysis.selfAttestedGapDetails ?? undefined,
  };
}

// ---------- create analysis (CV upload) ----------
analysesRouter.post('/', upload.single('cvFile'), async (req, res) => {
  try {
    const cvMode = (req.body.cvMode as string) === 'text' ? 'text' : 'file';
    let cvText = '';
    let cvFileName: string | null = null;
    let cvMimeType: string | null = null;
    let cvSizeBytes: number | null = null;

    if (cvMode === 'text') {
      cvText = (req.body.cvText as string) || '';
      if (cvText.length < MIN_CV_TEXT_CHARS) {
        return res.status(400).json({ error: `Minimum ${MIN_CV_TEXT_CHARS} simvol tələb olunur.` });
      }
    } else {
      if (!req.file) return res.status(400).json({ error: 'CV faylı tapılmadı.' });
      try {
        cvText = await extractCvText(req.file.buffer, req.file.mimetype, req.file.originalname);
      } catch (err) {
        if (err instanceof CvParseError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        throw err;
      }
      cvFileName = req.file.originalname;
      cvMimeType = req.file.mimetype;
      cvSizeBytes = req.file.size;
    }

    const analysis = await prisma.analysis.create({
      data: {
        expiresAt: new Date(Date.now() + RETENTION_MS),
        anonymousSessionId: req.sessionId,
        cvMode,
        cvText,
        cvFileName,
        cvMimeType,
        cvSizeBytes,
      },
    });

    res.json({
      id: analysis.id,
      cvName: cvFileName || 'CV mətn kimi daxil edilib',
      cvSize: cvSizeBytes ? `${(cvSizeBytes / 1024).toFixed(0)} KB` : `${cvText.length} simvol`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xətası baş verdi.' });
  }
});

// ---------- vacancy: URL extraction ----------
analysesRouter.post('/:id/vacancy/url', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const url = (req.body.url as string) || '';

  await prisma.analysis.update({ where: { id: analysis.id }, data: { vacancyStatus: 'loading', vacancyUrl: url } });

  try {
    const result = await extractVacancyFromUrl(url);
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        vacancySource: 'url',
        vacancyStatus: 'success',
        vacancyTitle: result.title,
        vacancyCompany: result.company,
        vacancyLocation: result.location,
        vacancyDomain: result.domain,
        vacancyText: result.text,
        vacancyFailReason: null,
      },
    });
    res.json({ status: 'success', vacancy: result });
  } catch (err) {
    const message = err instanceof VacancyExtractError ? err.message : 'Vakansiya səhifəsi avtomatik oxuna bilmədi.';
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { vacancyStatus: 'failed', vacancyFailReason: message },
    });
    res.json({ status: 'failed', reason: message });
  }
});

// ---------- vacancy: manual text fallback ----------
analysesRouter.post('/:id/vacancy/manual', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const text = (req.body.text as string) || '';
  if (text.length < MIN_VACANCY_TEXT_CHARS) {
    return res.status(400).json({ error: `Minimum ${MIN_VACANCY_TEXT_CHARS} simvol tələb olunur.` });
  }
  await prisma.analysis.update({
    where: { id: analysis.id },
    data: { vacancySource: 'manual', vacancyStatus: 'success', vacancyText: text, vacancyFailReason: null },
  });
  res.json({ status: 'success' });
});

// ---------- settings (language, consent) ----------
const SUPPORTED_LANGUAGES = new Set(['az', 'en']);

/** Any value other than 'az'/'en' (missing, malformed, or a removed legacy language like 'tr'/'ru')
 * falls back to 'en' — PeekMatch targets the global market, so an unrecognized selection should
 * never silently keep/produce Azerbaijani content. */
function resolveOutputLanguage(value: unknown): string {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.has(value) ? value : 'en';
}

analysesRouter.patch('/:id/settings', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const data: { outputLanguage?: string; consent?: boolean } = {};
  if (typeof req.body.outputLanguage !== 'undefined') data.outputLanguage = resolveOutputLanguage(req.body.outputLanguage);
  if (typeof req.body.consent === 'boolean') data.consent = req.body.consent;
  await prisma.analysis.update({ where: { id: resolved.analysis.id }, data });
  res.json({ ok: true });
});

// ---------- self-attestation ("do you actually have this?" prompt, Truth Lock gate) ----------
analysesRouter.patch('/:id/self-attest', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  if (typeof req.body.confirmed !== 'boolean') return res.status(400).json({ error: 'Yanlış dəyər.' });
  const details = typeof req.body.details === 'string' ? req.body.details.slice(0, 2000) : null;
  const analysis = resolved.analysis;
  // If the CV Change Plan / interview prep were already generated with the old answer (or no
  // answer), invalidate the caches so the next fetch regenerates using the new one.
  const changed = analysis.selfAttestedGapConfirmed !== req.body.confirmed || analysis.selfAttestedGapDetails !== details;
  await prisma.analysis.update({
    where: { id: analysis.id },
    data: {
      selfAttestedGapConfirmed: req.body.confirmed,
      selfAttestedGapDetails: details,
      ...(changed ? { cvChangePlanJson: null, interviewPrepJson: null } : {}),
    },
  });
  res.json({ ok: true });
});

// ---------- delete (user-triggered, immediate) ----------
analysesRouter.delete('/:id', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  await prisma.analysis.update({
    where: { id: resolved.analysis.id },
    data: {
      deletedAt: new Date(),
      cvText: null,
      cvFileName: null,
      cvMimeType: null,
      cvSizeBytes: null,
      vacancyUrl: null,
      vacancyText: null,
      vacancyTitle: null,
      vacancyCompany: null,
      vacancyLocation: null,
      vacancyDomain: null,
      resultJson: null,
      reportJson: null,
      cvChangePlanJson: null,
      interviewPrepJson: null,
      interviewPrepStatus: 'idle',
      interviewPrepFailReason: null,
      selfAttestedGapDetails: null,
    },
  });
  res.json({ ok: true });
});

// ---------- start processing ----------
analysesRouter.post('/:id/start', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  if (!analysis.cvText || !analysis.vacancyText || !analysis.consent) {
    return res.status(400).json({ error: 'CV və vakansiya məlumatlarını tamamlayın.' });
  }
  // Without this guard, a double-click, network retry, or duplicate request would spawn a second
  // concurrent runAnalysis() background job for the same id — each making its own real AI call
  // (wasted cost) and racing to write resultJson, with whichever finishes last silently winning.
  // Idempotent: already processing/done just reports the current state instead of erroring.
  if (analysis.status === 'processing' || analysis.status === 'done') {
    return res.json({ status: analysis.status });
  }

  await prisma.analysis.update({ where: { id: analysis.id }, data: { status: 'processing', procStage: 1 } });
  res.json({ status: 'processing' });

  // Run in background; frontend polls /status and /result.
  runAnalysis(analysis.id).catch((err) => console.error('[runAnalysis]', err));
});

async function runAnalysis(id: string) {
  const stages = [1, 2, 3, 4, 5];
  for (const stage of stages) {
    await new Promise((r) => setTimeout(r, 550));
    await prisma.analysis.update({ where: { id }, data: { procStage: stage } }).catch(() => {});
  }
  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis || !analysis.cvText || !analysis.vacancyText) return;
  try {
    const result = await analyzeMatch(analysis.cvText, analysis.vacancyText, analysis.outputLanguage);

    // Mark the analysis 'done' as soon as analyzeMatch itself finishes — do NOT wait on the CV
    // Change Plan generation below first. A real live test showed the two AI calls run back to
    // back pushed the processing screen from ~30-60s to 2.5+ minutes, which is exactly the
    // "why is this stuck" complaint this was written to prevent. updateMany (not update) lets the
    // WHERE clause filter on deletedAt: a row deleted while the AI call was in flight simply won't
    // match, so this becomes a no-op instead of resurrecting content that was just nulled.
    await prisma.analysis.updateMany({
      where: { id, deletedAt: null },
      data: {
        status: 'done',
        procStage: 6,
        resultJson: JSON.stringify(result),
        vacancyTitle: analysis.vacancyTitle || result.vacancyTitle,
        vacancyCompany: analysis.vacancyCompany || result.vacancyCompanyGuess,
      },
    });

    // CV Change Plan generation happens AFTER the analysis is already marked 'done', in the same
    // background job but not blocking it — eagerly (for every analysis, not purchase-gated) so the
    // free result can show real change/risk counts, but asynchronously so it doesn't double the
    // user-visible wait. GET /:id/result reads cvChangePlanJson opportunistically (see below) and
    // reports cvChangePlanReady: false while this is still in flight rather than blocking on it.
    try {
      const fresh = await prisma.analysis.findUnique({ where: { id } });
      if (!fresh || fresh.deletedAt || !fresh.cvText || !fresh.vacancyText) return;
      const plan = await generateCvChangePlan(fresh.cvText, fresh.vacancyText, result, fresh.outputLanguage);
      await prisma.analysis.updateMany({
        where: { id, deletedAt: null },
        data: { cvChangePlanJson: JSON.stringify({ cards: sanitizeCvChangePlan(plan.cards) } satisfies CvChangePlan) },
      });
    } catch (planErr) {
      console.error('[generateCvChangePlan]', planErr);
    }
  } catch (err) {
    console.error('[analyzeMatch]', err);
    // AiError's .message is already a safe, Azerbaijani, user-facing string — surfacing it here
    // means the /status poll (and the frontend's failure state) can show *why* the analysis
    // failed (rate limited, model unavailable, etc.) instead of one opaque message for every case.
    const failReason = err instanceof AiError ? err.message : 'Analiz tamamlanmadı.';
    await prisma.analysis.updateMany({ where: { id, deletedAt: null }, data: { status: 'failed', failReason } });
  }
}

/** Read-or-generate for the CV Change Plan, used as: (a) a fallback when the eager generation in
 * runAnalysis() failed or hasn't run yet, and (b) the regeneration path after a self-attestation
 * answer changes (which nulls cvChangePlanJson). Always returns the Truth-Lock-sanitized plan. */
async function ensureCvChangePlan(analysisId: string): Promise<CvChangePlan> {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new Error('not found');
  if (analysis.cvChangePlanJson) return JSON.parse(analysis.cvChangePlanJson);
  const full: MatchResult = JSON.parse(analysis.resultJson!);
  const plan = await generateCvChangePlan(
    analysis.cvText!,
    analysis.vacancyText!,
    full,
    analysis.outputLanguage,
    buildSelfAttestedGap(analysis, full),
  );
  const sanitized: CvChangePlan = { cards: sanitizeCvChangePlan(plan.cards) };
  await prisma.analysis.update({ where: { id: analysisId }, data: { cvChangePlanJson: JSON.stringify(sanitized) } });
  return sanitized;
}

function pickExampleCard(cards: CvChangeCard[]): CvChangeCard | null {
  return cards.find((c) => c.priority === 'kritik') ?? cards.find((c) => c.changeType === 'rewrite') ?? cards[0] ?? null;
}

// ---------- status / result ----------
analysesRouter.get('/:id/status', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  res.json({ status: analysis.status, procStage: analysis.procStage, failReason: analysis.failReason });
});

analysesRouter.get('/:id', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  res.json({
    id: analysis.id,
    status: analysis.status,
    cvMode: analysis.cvMode,
    cvName: analysis.cvFileName,
    vacancyStatus: analysis.vacancyStatus,
    vacancyTitle: analysis.vacancyTitle,
    vacancyCompany: analysis.vacancyCompany,
    vacancyLocation: analysis.vacancyLocation,
    vacancyDomain: analysis.vacancyDomain,
    outputLanguage: analysis.outputLanguage,
    consent: analysis.consent,
    createdAt: analysis.createdAt,
    expiresAt: analysis.expiresAt,
    ownedPackage: owned,
    selfAttestedGapConfirmed: analysis.selfAttestedGapConfirmed,
    paidAt: analysis.paidAt,
    entitlementExpiresAt: analysis.entitlementExpiresAt,
  });
});

analysesRouter.get('/:id/result', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  if (analysis.status !== 'done' || !analysis.resultJson) {
    return res.status(409).json({ error: 'Analiz hələ hazır deyil.' });
  }
  const full: MatchResult = JSON.parse(analysis.resultJson);
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));

  // Real, non-hardcoded premium-preview counts — never a static "unlock premium" message. Reads
  // cvChangePlanJson opportunistically rather than generating it here: this endpoint must never
  // block on an AI call (a live test showed that turned an instant free-result load into a
  // 1-2 minute wait the first time it was hit after "done"). The plan is generated in the
  // background by runAnalysis() right after analyzeMatch finishes; while it's still in flight this
  // reports cvChangePlanReady: false with zero counts, and the frontend polls again shortly.
  let cvChangesSummary = { critical: 0, important: 0, optional: 0 };
  let exampleCard: CvChangeCard | null = null;
  let cvChangePlanReady = false;
  if (analysis.cvChangePlanJson) {
    const plan: CvChangePlan = JSON.parse(analysis.cvChangePlanJson);
    cvChangesSummary = computeCvChangesSummary(plan.cards);
    exampleCard = pickExampleCard(plan.cards);
    cvChangePlanReady = true;
  }

  // Free dashboard: everything except the full requirement matrix / weak presentation / improvement ranking.
  // realCompatibility ships here as an upsell teaser; realCompatibilityGap (the "why") stays gated.
  res.json({
    vacancy: { title: analysis.vacancyTitle, company: analysis.vacancyCompany, location: analysis.vacancyLocation },
    compatibility: full.compatibility,
    compatibilityLabel: full.compatibilityLabel,
    cvPresentationScore: full.cvPresentationScore,
    cvPresentationLabel: full.cvPresentationLabel,
    realCompatibility: full.realCompatibility,
    mainRequirementsTotal: full.mainRequirementsTotal,
    mainRequirementsMet: full.mainRequirementsMet,
    mainRequirementsPartial: full.mainRequirementsPartial,
    mainRequirementsMissing: full.mainRequirementsMissing,
    criticalGapsCount: full.criticalGapsCount,
    criticalGapSummary: full.criticalGapSummary,
    hrScreeningEstimate: full.hrScreeningEstimate,
    reliability: full.reliability,
    categoryScores: full.categoryScores,
    strengths: full.strengths,
    mostImportantMissingRequirement: full.mostImportantMissingRequirement,
    mostImportantMissingExplanation: full.mostImportantMissingExplanation,
    recommendationStatus: full.recommendationStatus,
    recommendationTone: full.recommendationTone,
    recommendationReasons: full.recommendationReasons,
    recommendationNextAction: full.recommendationNextAction,
    requirementsPreview: full.requirements.slice(0, 2),
    cvChangesSummary,
    interviewRisksCount: computeInterviewRisksCount(full.requirements),
    exampleCard,
    cvChangePlanReady,
    ownedPackage: owned,
    selfAttestedGapConfirmed: analysis.selfAttestedGapConfirmed,
  });
});

// ---------- paid: full report ----------
analysesRouter.get('/:id/report', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksApplication(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  if (!analysis.resultJson) return res.status(409).json({ error: 'Analiz hazır deyil.' });
  const full: MatchResult = JSON.parse(analysis.resultJson);
  res.json({
    vacancy: { title: analysis.vacancyTitle, company: analysis.vacancyCompany, location: analysis.vacancyLocation },
    compatibility: full.compatibility,
    cvPresentationScore: full.cvPresentationScore,
    realCompatibility: full.realCompatibility,
    realCompatibilityGap: full.realCompatibilityGap,
    mainRequirementsTotal: full.mainRequirementsTotal,
    mainRequirementsMet: full.mainRequirementsMet,
    criticalGapsCount: full.criticalGapsCount,
    hrScreeningEstimate: full.hrScreeningEstimate,
    recommendationStatus: full.recommendationStatus,
    requirements: full.requirements,
    categoryScores: full.categoryScores,
    weakPresentation: full.weakPresentation,
    improvementOpportunities: full.improvementOpportunities,
    ownedPackage: owned,
  });
});

// ---------- paid: CV Change Plan ----------
analysesRouter.get('/:id/cv-plan', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksApplication(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  try {
    const plan = await ensureCvChangePlan(analysis.id);
    res.json({ cards: plan.cards, ownedPackage: owned });
  } catch (err) {
    respondAiError(res, err, 'CV Dəyişiklik Planı hazırlanarkən xəta baş verdi.');
  }
});

// ---------- paid: Interview Playbook ----------
// Fire-and-forget job with a persisted, DB-backed status (idle -> processing -> done | failed),
// matching runAnalysis()'s established pattern instead of one long-lived blocking request. This is
// what makes "one generation job per analysis" a real, atomic guarantee rather than an in-memory
// convention: the claim below is a single WHERE-guarded UPDATE, so even two genuinely concurrent
// requests (double-click, a second tab, a page refresh mid-generation) can't both start real work —
// exactly one of them will match the WHERE clause and flip idle/failed -> processing; the other
// gets count: 0 and just reports the (now 'processing') status back. This also survives a server
// restart cleanly: status is a real column, not a Map that resets on every deploy.
function safeTimingLog(label: string, ms: number, extra?: Record<string, string | number>) {
  console.log(`[interview-prep:timing] ${label} ${ms}ms${extra ? ' ' + JSON.stringify(extra) : ''}`);
}

async function runInterviewPrepGeneration(analysisId: string): Promise<void> {
  const jobStartedAt = Date.now();
  const loadStartedAt = Date.now();
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  safeTimingLog('db_load', Date.now() - loadStartedAt);

  if (!analysis || analysis.deletedAt || !analysis.cvText || !analysis.resultJson) {
    await prisma.analysis.updateMany({
      where: { id: analysisId, deletedAt: null },
      data: { interviewPrepStatus: 'failed', interviewPrepFailReason: 'Analiz məlumatları tapılmadı.' },
    });
    return;
  }

  try {
    const full: MatchResult = JSON.parse(analysis.resultJson);
    const prep = await generateInterviewPrep(analysis.cvText, full, analysis.outputLanguage, buildSelfAttestedGap(analysis, full));

    const saveStartedAt = Date.now();
    await prisma.analysis.updateMany({
      where: { id: analysisId, deletedAt: null },
      data: { interviewPrepJson: JSON.stringify(prep), interviewPrepStatus: 'done', interviewPrepFailReason: null },
    });
    safeTimingLog('db_save', Date.now() - saveStartedAt);
    safeTimingLog('total', Date.now() - jobStartedAt);
  } catch (err) {
    // Never log CV/vacancy content, prompts, AI output text, or the API key — AiError.message is
    // already a safe, pre-sanitized user-facing string (see ai.ts); anything else is a
    // non-AiError bug, logged via console.error's normal object formatting (stack trace + message
    // only, no request/response body attached).
    console.error('[interview-prep] generation failed', err);
    const failReason = err instanceof AiError ? err.message : 'Müsahibə hazırlığı yaradıla bilmədi.';
    await prisma.analysis.updateMany({
      where: { id: analysisId, deletedAt: null },
      data: { interviewPrepStatus: 'failed', interviewPrepFailReason: failReason },
    });
    safeTimingLog('total_failed', Date.now() - jobStartedAt);
  }
}

// Starts generation (idempotently — see above) and returns immediately with the current status.
// Never blocks on the AI call, unlike the old GET /:id/interview.
analysesRouter.post('/:id/interview/generate', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksInterview(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });

  if (analysis.interviewPrepJson) return res.json({ status: 'done' });

  const claim = await prisma.analysis.updateMany({
    where: { id: analysis.id, interviewPrepStatus: { in: ['idle', 'failed'] } },
    data: { interviewPrepStatus: 'processing', interviewPrepFailReason: null },
  });
  if (claim.count === 1) {
    runInterviewPrepGeneration(analysis.id).catch((err) => console.error('[interview-prep] unhandled', err));
  }
  res.json({ status: 'processing' });
});

// Lightweight poll target — no DB write, no AI call, just the current persisted status.
analysesRouter.get('/:id/interview/status', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksInterview(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  res.json({ status: analysis.interviewPrepStatus, failReason: analysis.interviewPrepFailReason });
});

// Returns the finished result only — callers should poll /status until 'done' first (an existing
// completed Playbook still returns immediately here with no extra work, same as before).
analysesRouter.get('/:id/interview', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksInterview(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  if (!analysis.interviewPrepJson) return res.status(409).json({ error: 'Müsahibə hazırlığı hələ hazır deyil.' });
  res.json({ prep: JSON.parse(analysis.interviewPrepJson) as InterviewPrep, ownedPackage: owned });
});

// ---------- paid: Evidence Chain ----------
// Pure derived view — no AI call, just cross-references requirement titles already present across
// resultJson / cvChangePlanJson / interviewPrepJson (see lib/evidenceChain.ts).
analysesRouter.get('/:id/evidence-chain', async (req, res) => {
  const resolved = await resolveAnalysis(req.params.id, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksApplication(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  if (!analysis.resultJson) return res.status(409).json({ error: 'Analiz hazır deyil.' });
  const full: MatchResult = JSON.parse(analysis.resultJson);
  const plan: CvChangePlan = analysis.cvChangePlanJson ? JSON.parse(analysis.cvChangePlanJson) : { cards: [] };
  const interview: InterviewPrep | null = analysis.interviewPrepJson ? JSON.parse(analysis.interviewPrepJson) : null;
  const questions = interview ? [...interview.hrQuestions, ...interview.situational, ...interview.technical] : [];
  res.json({ chain: buildEvidenceChain(full.requirements, plan.cards, questions) });
});

