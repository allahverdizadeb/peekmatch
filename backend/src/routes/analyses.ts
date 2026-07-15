import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { extractCvText, CvParseError, MAX_CV_BYTES, MIN_CV_TEXT_CHARS } from '../lib/cvParse.js';
import { extractVacancyFromUrl, VacancyExtractError, MIN_VACANCY_TEXT_CHARS } from '../lib/vacancyExtract.js';
import { analyzeMatch, generateTailoredCv, generateCoverLetter, generateInterviewPrep, type MatchResult } from '../lib/anthropic.js';
import { cvToDocx, cvToPdf, coverLetterToDocx, reportToPdf } from '../lib/docGen.js';
import { highestOwnedPackage, unlocksReport, unlocksCv, unlocksInterview } from '../lib/pricing.js';

const upload = multer({ limits: { fileSize: MAX_CV_BYTES } });
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const analysesRouter = Router();

async function getAnalysisOr404(id: string) {
  const a = await prisma.analysis.findUnique({ where: { id } });
  if (!a) return null;
  if (a.expiresAt.getTime() < Date.now()) return null;
  return a;
}

async function ownedPackages(analysisId: string): Promise<number[]> {
  const orders = await prisma.order.findMany({ where: { analysisId, status: 'paid' } });
  return orders.map((o) => o.package);
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
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
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
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
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
analysesRouter.patch('/:id/settings', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const data: { outputLanguage?: string; consent?: boolean } = {};
  if (typeof req.body.outputLanguage === 'string') data.outputLanguage = req.body.outputLanguage;
  if (typeof req.body.consent === 'boolean') data.consent = req.body.consent;
  await prisma.analysis.update({ where: { id: analysis.id }, data });
  res.json({ ok: true });
});

// ---------- start processing ----------
analysesRouter.post('/:id/start', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  if (!analysis.cvText || !analysis.vacancyText || !analysis.consent) {
    return res.status(400).json({ error: 'CV və vakansiya məlumatlarını tamamlayın.' });
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
    await prisma.analysis.update({
      where: { id },
      data: {
        status: 'done',
        procStage: 6,
        resultJson: JSON.stringify(result),
        vacancyTitle: analysis.vacancyTitle || result.vacancyTitle,
        vacancyCompany: analysis.vacancyCompany || result.vacancyCompanyGuess,
      },
    });
  } catch (err) {
    console.error('[analyzeMatch]', err);
    await prisma.analysis.update({ where: { id }, data: { status: 'failed', failReason: 'Analiz tamamlanmadı.' } });
  }
}

// ---------- status / result ----------
analysesRouter.get('/:id/status', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  res.json({ status: analysis.status, procStage: analysis.procStage, failReason: analysis.failReason });
});

analysesRouter.get('/:id', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
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
  });
});

analysesRouter.get('/:id/result', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  if (analysis.status !== 'done' || !analysis.resultJson) {
    return res.status(409).json({ error: 'Analiz hələ hazır deyil.' });
  }
  const full: MatchResult = JSON.parse(analysis.resultJson);
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  // Free dashboard: everything except the full requirement matrix / weak presentation / improvement ranking.
  res.json({
    vacancy: { title: analysis.vacancyTitle, company: analysis.vacancyCompany, location: analysis.vacancyLocation },
    compatibility: full.compatibility,
    compatibilityLabel: full.compatibilityLabel,
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
    ownedPackage: owned,
  });
});

// ---------- paid: full report ----------
analysesRouter.get('/:id/report', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksReport(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  if (!analysis.resultJson) return res.status(409).json({ error: 'Analiz hazır deyil.' });
  const full: MatchResult = JSON.parse(analysis.resultJson);
  res.json({
    vacancy: { title: analysis.vacancyTitle, company: analysis.vacancyCompany, location: analysis.vacancyLocation },
    compatibility: full.compatibility,
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

analysesRouter.get('/:id/report/download', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksReport(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.' });
  if (!analysis.resultJson) return res.status(409).json({ error: 'Analiz hazır deyil.' });
  const full: MatchResult = JSON.parse(analysis.resultJson);
  const rows = full.requirements
    .map(
      (r) =>
        `<tr><td>${r.title}</td><td>${r.category}</td><td>${r.importance}</td><td>${r.status}</td><td>${r.evidence || '—'}</td></tr>`,
    )
    .join('');
  const html = `<h2>Uyğunluq: ${full.compatibility}% · ${full.mainRequirementsMet}/${full.mainRequirementsTotal} əsas tələb</h2>
    <p>${full.recommendationStatus}</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:11px">
      <tr><th>Tələb</th><th>Kateqoriya</th><th>Vaciblik</th><th>Status</th><th>Sübut</th></tr>${rows}
    </table>`;
  const pdf = await reportToPdf(analysis.vacancyTitle || 'Vakansiya', analysis.vacancyCompany || '', html);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Uygunluq_Hesabati.pdf"');
  res.send(pdf);
});

// ---------- paid: tailored CV ----------
async function ensureTailoredCv(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new Error('not found');
  if (analysis.tailoredCvJson) return JSON.parse(analysis.tailoredCvJson);
  const full: MatchResult = JSON.parse(analysis.resultJson!);
  const cv = await generateTailoredCv(analysis.cvText!, analysis.vacancyText!, full, analysis.outputLanguage);
  await prisma.analysis.update({ where: { id: analysisId }, data: { tailoredCvJson: JSON.stringify(cv) } });
  return cv;
}

analysesRouter.get('/:id/cv', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksCv(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  try {
    const cv = await ensureTailoredCv(analysis.id);
    res.json({ cv, ownedPackage: owned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CV hazırlanarkən xəta baş verdi.' });
  }
});

analysesRouter.get('/:id/cv/download', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksCv(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.' });
  const cv = await ensureTailoredCv(analysis.id);
  const format = req.query.format === 'pdf' ? 'pdf' : 'docx';
  if (format === 'pdf') {
    const pdf = await cvToPdf(cv);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="CV_Uygunlasdirilmis.pdf"');
    res.send(pdf);
  } else {
    const docx = await cvToDocx(cv);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="CV_Uygunlasdirilmis.docx"');
    res.send(docx);
  }
});

// ---------- paid: cover letter ----------
async function ensureCoverLetter(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new Error('not found');
  if (analysis.coverLetterJson) return JSON.parse(analysis.coverLetterJson);
  const full: MatchResult = JSON.parse(analysis.resultJson!);
  const letter = await generateCoverLetter(analysis.cvText!, analysis.vacancyText!, full, analysis.outputLanguage);
  await prisma.analysis.update({ where: { id: analysisId }, data: { coverLetterJson: JSON.stringify(letter) } });
  return letter;
}

analysesRouter.get('/:id/cover-letter', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksCv(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  try {
    const letter = await ensureCoverLetter(analysis.id);
    res.json({ letter, ownedPackage: owned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cover letter hazırlanarkən xəta baş verdi.' });
  }
});

analysesRouter.get('/:id/cover-letter/download', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksCv(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.' });
  const letter = await ensureCoverLetter(analysis.id);
  const docx = await coverLetterToDocx(letter, analysis.vacancyTitle || '', analysis.vacancyCompany || '');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="Cover_Letter.docx"');
  res.send(docx);
});

// ---------- paid: interview prep ----------
async function ensureInterviewPrep(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new Error('not found');
  if (analysis.interviewPrepJson) return JSON.parse(analysis.interviewPrepJson);
  const full: MatchResult = JSON.parse(analysis.resultJson!);
  const prep = await generateInterviewPrep(analysis.cvText!, analysis.vacancyText!, full, analysis.outputLanguage);
  await prisma.analysis.update({ where: { id: analysisId }, data: { interviewPrepJson: JSON.stringify(prep) } });
  return prep;
}

analysesRouter.get('/:id/interview', async (req, res) => {
  const analysis = await getAnalysisOr404(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  if (!unlocksInterview(owned)) return res.status(402).json({ error: 'Bu paket alınmayıb.', ownedPackage: owned });
  try {
    const prep = await ensureInterviewPrep(analysis.id);
    res.json({ prep, ownedPackage: owned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Müsahibə hazırlığı hazırlanarkən xəta baş verdi.' });
  }
});
