import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';
import type { MatchResult, CvChangePlan } from '../lib/ai.js';

const createdAnalysisIds: string[] = [];

function makeRequirements(): MatchResult['requirements'] {
  return [
    { title: 'Excel', category: 'Texniki bacarıqlar', importance: 'kritik', status: 'met', evidence: 'CV-də qeyd olunub', explanation: '' },
    { title: 'Power BI', category: 'Texniki bacarıqlar', importance: 'kritik', status: 'missing', evidence: '', explanation: '' },
    { title: 'SQL', category: 'Texniki bacarıqlar', importance: 'əsas', status: 'partial', evidence: 'Qismən', explanation: '' },
    { title: 'Liderlik', category: 'İdarəetmə və əməkdaşlıq', importance: 'üstünlük', status: 'met', evidence: 'Komanda rəhbərliyi', explanation: '' },
  ];
}

function makeFullResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    vacancyTitle: 'Data Analyst',
    vacancyCompanyGuess: 'Test Company',
    compatibility: 72,
    compatibilityLabel: 'Yaxşı uyğunluq',
    cvPresentationScore: 48,
    cvPresentationLabel: 'CV zəif təqdim olunub',
    realCompatibility: 80,
    realCompatibilityGap: 'Bəzi təcrübə aydın göstərilməyib',
    mainRequirementsTotal: 4,
    mainRequirementsMet: 2,
    mainRequirementsPartial: 1,
    mainRequirementsMissing: 1,
    criticalGapsCount: 1,
    criticalGapSummary: 'Power BI çatışmır',
    hrScreeningEstimate: 55,
    reliability: 'orta',
    categoryScores: [{ category: 'Texniki bacarıqlar', score: 60 }],
    requirements: makeRequirements(),
    strengths: [],
    mostImportantMissingRequirement: 'Power BI',
    mostImportantMissingExplanation: 'Vakansiya Power BI tələb edir',
    recommendationStatus: 'CV-ni gücləndirin',
    recommendationTone: 'warning',
    recommendationReasons: [],
    recommendationNextAction: '',
    weakPresentation: [],
    improvementOpportunities: [],
    ...overrides,
  };
}

function makeCvChangePlan(): CvChangePlan {
  return {
    cards: [
      {
        section: 'Professional Summary',
        currentText: 'Experienced professional.',
        whatToChange: 'Rewrite this to be more specific.',
        problem: 'Too generic.',
        recommendedText: 'Data analyst with 3 years of Power BI dashboard experience.',
        relatedRequirements: ['Power BI'],
        evidenceFromCv: ['CV mentions dashboard work at Acme'],
        priority: 'kritik',
        changeType: 'rewrite',
      },
      {
        section: 'Skills',
        currentText: '',
        whatToChange: 'Add SQL to the Skills section.',
        problem: 'SQL experience buried in a bullet point.',
        recommendedText: 'Add "SQL" to the Skills section.',
        relatedRequirements: ['SQL'],
        evidenceFromCv: ['CV mentions writing SQL queries'],
        priority: 'əsas',
        changeType: 'add',
      },
      {
        section: 'Certifications',
        currentText: '',
        whatToChange: 'Confirm whether you hold this certification.',
        problem: 'Unclear whether candidate holds a relevant certification.',
        recommendedText: '',
        relatedRequirements: [],
        evidenceFromCv: [],
        priority: 'üstünlük',
        changeType: 'clarify',
      },
    ],
  };
}

async function makeAnalysis(opts: { cvChangePlan?: CvChangePlan } = {}) {
  const row = await prisma.analysis.create({
    data: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'done',
      cvText: 'x'.repeat(2100),
      vacancyText: 'y'.repeat(3100),
      consent: true,
      resultJson: JSON.stringify(makeFullResult()),
      cvChangePlanJson: opts.cvChangePlan ? JSON.stringify(opts.cvChangePlan) : undefined,
    },
  });
  createdAnalysisIds.push(row.id);
  return row;
}

async function payForPackage(analysisId: string, pkg: 1 | 2) {
  await prisma.order.create({ data: { analysisId, package: pkg, amountUsd: pkg === 1 ? 0.9 : 2.9, status: 'paid', paidAt: new Date() } });
}

/** Interview Playbook generation is now a fire-and-forget job (POST /:id/interview/generate ->
 * poll GET /:id/interview/status -> GET /:id/interview once done), matching runAnalysis()'s
 * pattern — this starts the job and polls status until it settles, then returns the final
 * GET /:id/interview response. The offline fallback (no OPENAI_API_KEY in the test env) resolves
 * near-instantly, so a handful of short polls is enough. */
async function waitForInterviewPrep(analysisId: string) {
  await request(app).post(`/api/analyses/${analysisId}/interview/generate`);
  for (let i = 0; i < 20; i++) {
    const status = await request(app).get(`/api/analyses/${analysisId}/interview/status`);
    if (status.body.status === 'done' || status.body.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  return request(app).get(`/api/analyses/${analysisId}/interview`);
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { analysisId: { in: createdAnalysisIds } } });
  await prisma.analysis.deleteMany({ where: { id: { in: createdAnalysisIds } } });
  await prisma.$disconnect();
});

describe('GET /api/analyses/:id/result — free tier', () => {
  it('keeps compatibility and cvPresentationScore as two separate numbers', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    const res = await request(app).get(`/api/analyses/${a.id}/result`);
    expect(res.status).toBe(200);
    expect(res.body.compatibility).toBe(72);
    expect(res.body.cvPresentationScore).toBe(48);
  });

  it('computes real cvChangesSummary and interviewRisksCount from the actual plan/requirements, never hardcoded', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    const res = await request(app).get(`/api/analyses/${a.id}/result`);
    expect(res.body.cvChangesSummary).toEqual({ critical: 1, important: 1, optional: 1 });
    // interview risk = kritik-or-əsas requirement not met: Power BI (kritik, missing) + SQL (əsas, partial)
    expect(res.body.interviewRisksCount).toBe(2);
  });

  it('exposes exactly one fully-populated example card, picking the highest-priority one first', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    const res = await request(app).get(`/api/analyses/${a.id}/result`);
    expect(res.body.exampleCard).toMatchObject({ section: 'Professional Summary', priority: 'kritik' });
  });

  it('does not leak the full requirements array or realCompatibilityGap — those stay report-gated', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    const res = await request(app).get(`/api/analyses/${a.id}/result`);
    expect(res.body.requirements).toBeUndefined();
    expect(res.body.realCompatibilityGap).toBeUndefined();
  });

  it('never blocks on generating the CV Change Plan — reports cvChangePlanReady: false with zeroed/null preview fields instead of triggering generation, when the plan is still in flight', async () => {
    // No cvChangePlan passed to makeAnalysis: cvChangePlanJson stays null, simulating the window
    // right after analyzeMatch finishes but before the background generateCvChangePlan call lands
    // (a real live test showed the old synchronous ensureCvChangePlan() call here turned an
    // instant free-result load into a 1-2 minute wait the first time /result was hit after "done").
    const a = await makeAnalysis();
    const res = await request(app).get(`/api/analyses/${a.id}/result`);
    expect(res.status).toBe(200);
    expect(res.body.cvChangePlanReady).toBe(false);
    expect(res.body.cvChangesSummary).toEqual({ critical: 0, important: 0, optional: 0 });
    expect(res.body.exampleCard).toBeNull();
    // Proves /result didn't trigger and persist a generation as a side effect.
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.cvChangePlanJson).toBeNull();
  });
});

describe('entitlement gating — Application Package ($0.90) vs Interview Ready Package ($2.90)', () => {
  it('CV Change Plan and Evidence Chain are hidden without any purchase', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    expect((await request(app).get(`/api/analyses/${a.id}/cv-plan`)).status).toBe(402);
    expect((await request(app).get(`/api/analyses/${a.id}/evidence-chain`)).status).toBe(402);
  });

  it('package 1 unlocks the CV Change Plan, but not the Interview Playbook', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 1);
    const cvPlanRes = await request(app).get(`/api/analyses/${a.id}/cv-plan`);
    expect(cvPlanRes.status).toBe(200);
    expect(cvPlanRes.body.cards).toHaveLength(3);
    expect((await request(app).get(`/api/analyses/${a.id}/interview`)).status).toBe(402);
  });

  it('package 2 unlocks the Interview Playbook too', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 2);
    const prep = await waitForInterviewPrep(a.id);
    expect(prep.status).toBe(200);
  }, 15000);

  it('evidence-chain stays reachable for a paid analysis — the underlying route/logic is preserved for RequirementPriorityMap even though the dedicated "Sübut Zənciri" UI section was removed', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 1);
    const res = await request(app).get(`/api/analyses/${a.id}/evidence-chain`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.chain)).toBe(true);
    expect(res.body.chain.find((c: { requirement: string }) => c.requirement === 'Power BI')?.relatedChangeSection).toBe('Professional Summary');
  });
});

describe('Interview Playbook job status flow (idle -> processing -> done | failed)', () => {
  it('POST /generate and GET /status are entitlement-gated the same as GET /interview', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    expect((await request(app).post(`/api/analyses/${a.id}/interview/generate`)).status).toBe(402);
    expect((await request(app).get(`/api/analyses/${a.id}/interview/status`)).status).toBe(402);
  });

  it('starts idle, moves to processing immediately after POST /generate, then done — GET /interview 409s until then, never silently returning stale/partial data', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 2);

    expect((await request(app).get(`/api/analyses/${a.id}/interview/status`)).body.status).toBe('idle');
    expect((await request(app).get(`/api/analyses/${a.id}/interview`)).status).toBe(409);

    const genRes = await request(app).post(`/api/analyses/${a.id}/interview/generate`);
    expect(genRes.status).toBe(200);
    expect(['processing', 'done']).toContain(genRes.body.status);

    const prep = await waitForInterviewPrep(a.id);
    expect(prep.status).toBe(200);
    expect(prep.body.prep.hrQuestions).toBeDefined();

    const finalStatus = await request(app).get(`/api/analyses/${a.id}/interview/status`);
    expect(finalStatus.body.status).toBe('done');
    expect(finalStatus.body.failReason).toBeNull();
  }, 15000);

  it('an already-completed Playbook opens immediately from GET /interview without a new POST /generate call being required', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 2);
    await waitForInterviewPrep(a.id);

    // No POST /generate here — GET /interview alone must already serve the cached result.
    const res = await request(app).get(`/api/analyses/${a.id}/interview`);
    expect(res.status).toBe(200);
    expect(res.body.prep.hrQuestions).toBeDefined();
  }, 15000);

  it('repeated/concurrent POST /generate calls never leave the job in a broken state — one clean done, not a corrupted or stuck status', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await payForPackage(a.id, 2);

    // Simulates a double-click / refresh-mid-generation: several near-simultaneous starts.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(`/api/analyses/${a.id}/interview/generate`)),
    );
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(['processing', 'done']).toContain(r.body.status);
    }

    const prep = await waitForInterviewPrep(a.id);
    expect(prep.status).toBe(200);

    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.interviewPrepStatus).toBe('done');
    expect(() => JSON.parse(row?.interviewPrepJson ?? '')).not.toThrow();
  }, 15000);

  it('a job that fails (missing analysis data) lands in a real "failed" status with a safe reason — not stuck processing, not silently 200', async () => {
    const broken = await prisma.analysis.create({
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'done',
        // cvText/resultJson deliberately omitted — runInterviewPrepGeneration's defensive guard
        // must catch this and fail the job cleanly rather than throwing an unhandled rejection.
        consent: true,
      },
    });
    createdAnalysisIds.push(broken.id);
    await payForPackage(broken.id, 2);

    await request(app).post(`/api/analyses/${broken.id}/interview/generate`);
    let statusBody: { status: string; failReason: string | null } = { status: 'processing', failReason: null };
    for (let i = 0; i < 20; i++) {
      statusBody = (await request(app).get(`/api/analyses/${broken.id}/interview/status`)).body;
      if (statusBody.status === 'done' || statusBody.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(statusBody.status).toBe('failed');
    expect(typeof statusBody.failReason).toBe('string');
    expect((await request(app).get(`/api/analyses/${broken.id}/interview`)).status).toBe(409);
  });
});

describe('POST /api/orders — server-computed price integrity', () => {
  it('ignores a client-supplied amountUsd and charges the real package price', async () => {
    const a = await makeAnalysis();
    const res = await request(app).post('/api/orders').send({ analysisId: a.id, package: 1, amountUsd: 0.01 });
    expect(res.status).toBe(200);
    expect(res.body.amountUsd).toBe(0.9);
  });

  it('rejects an unknown package number (e.g. the retired package 3 from the old 3-tier structure)', async () => {
    const a = await makeAnalysis();
    const res = await request(app).post('/api/orders').send({ analysisId: a.id, package: 3 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/analyses/:id/self-attest — Truth Lock confirmation', () => {
  it('persists the optional free-text elaboration and invalidates cached paid content when the answer changes', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await prisma.analysis.update({
      where: { id: a.id },
      data: { interviewPrepJson: JSON.stringify({ cached: true }) },
    });
    const res = await request(app)
      .patch(`/api/analyses/${a.id}/self-attest`)
      .send({ confirmed: true, details: 'Built Power BI dashboards for 6 months at Acme.' });
    expect(res.status).toBe(200);
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.selfAttestedGapConfirmed).toBe(true);
    expect(row?.selfAttestedGapDetails).toBe('Built Power BI dashboards for 6 months at Acme.');
    expect(row?.cvChangePlanJson).toBeNull();
    expect(row?.interviewPrepJson).toBeNull();
  });

  it('does not invalidate caches when re-submitting the same answer and details unchanged', async () => {
    const a = await makeAnalysis({ cvChangePlan: makeCvChangePlan() });
    await request(app).patch(`/api/analyses/${a.id}/self-attest`).send({ confirmed: false });
    await prisma.analysis.update({ where: { id: a.id }, data: { interviewPrepJson: JSON.stringify({ cached: true }) } });
    await request(app).patch(`/api/analyses/${a.id}/self-attest`).send({ confirmed: false });
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.interviewPrepJson).toBe(JSON.stringify({ cached: true }));
  });
});

describe('PATCH /api/analyses/:id/settings — outputLanguage validation', () => {
  it('persists a supported language as given', async () => {
    const a = await makeAnalysis();
    await request(app).patch(`/api/analyses/${a.id}/settings`).send({ outputLanguage: 'az' });
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.outputLanguage).toBe('az');
  });

  it('coerces an unsupported/legacy language value to English rather than storing it verbatim or defaulting to Azerbaijani', async () => {
    const a = await makeAnalysis();
    await request(app).patch(`/api/analyses/${a.id}/settings`).send({ outputLanguage: 'tr' });
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.outputLanguage).toBe('en');
  });

  it('coerces a missing/malformed value to English', async () => {
    const a = await makeAnalysis();
    await request(app).patch(`/api/analyses/${a.id}/settings`).send({ outputLanguage: 123 });
    const row = await prisma.analysis.findUnique({ where: { id: a.id } });
    expect(row?.outputLanguage).toBe('en');
  });

  it('persists after a refresh — GET /:id echoes the stored outputLanguage back', async () => {
    const a = await makeAnalysis();
    await request(app).patch(`/api/analyses/${a.id}/settings`).send({ outputLanguage: 'en' });
    const res = await request(app).get(`/api/analyses/${a.id}`);
    expect(res.body.outputLanguage).toBe('en');
  });
});
