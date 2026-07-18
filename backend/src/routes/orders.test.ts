import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';

const createdAnalysisIds: string[] = [];

async function makeDoneAnalysis() {
  const row = await prisma.analysis.create({
    data: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'done',
      cvText: 'x'.repeat(2100),
      vacancyText: 'y'.repeat(3100),
      consent: true,
      resultJson: JSON.stringify({ compatibility: 80 }),
    },
  });
  createdAnalysisIds.push(row.id);
  return row;
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { analysisId: { in: createdAnalysisIds } } });
  await prisma.analysis.deleteMany({ where: { id: { in: createdAnalysisIds } } });
  await prisma.$disconnect();
});

describe('POST /api/orders/:id/simulate — idempotency', () => {
  it('re-simulating an already-paid order with outcome:fail does NOT revoke the paid status', async () => {
    const analysis = await makeDoneAnalysis();
    const createRes = await request(app).post('/api/orders').send({ analysisId: analysis.id, package: 1 });
    expect(createRes.status).toBe(200);
    const orderId = createRes.body.id;

    // First simulate: success, and wait past the 1.4s async status-flip.
    await request(app).post(`/api/orders/${orderId}/simulate`).send({ outcome: 'success' });
    await new Promise((r) => setTimeout(r, 1600));
    const afterFirst = await request(app).get(`/api/orders/${orderId}`);
    expect(afterFirst.body.status).toBe('paid');

    // Second simulate on the now-paid order, with outcome:fail — must be a no-op, not a downgrade.
    const secondSimulate = await request(app).post(`/api/orders/${orderId}/simulate`).send({ outcome: 'fail' });
    expect(secondSimulate.body.status).toBe('paid'); // reported immediately, not 'processing'
    await new Promise((r) => setTimeout(r, 1600));
    const afterSecond = await request(app).get(`/api/orders/${orderId}`);
    expect(afterSecond.body.status, 'a paid order must stay paid — re-simulating must not revoke access').toBe('paid');
  }, 10_000);

  it('returns 404 for a nonexistent order id', async () => {
    const res = await request(app).post('/api/orders/00000000-0000-0000-0000-000000000000/simulate').send({ outcome: 'success' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/analyses/:id/start — idempotency', () => {
  it('calling start on an analysis already in "processing" status does not error and does not restart from procStage 1', async () => {
    const row = await prisma.analysis.create({
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'processing',
        procStage: 4,
        cvText: 'x'.repeat(2100),
        vacancyText: 'y'.repeat(3100),
        consent: true,
      },
    });
    createdAnalysisIds.push(row.id);

    const res = await request(app).post(`/api/analyses/${row.id}/start`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');

    // Must NOT have been reset back to procStage 1 by a second runAnalysis() kickoff.
    const after = await prisma.analysis.findUnique({ where: { id: row.id } });
    expect(after?.procStage).toBe(4);
  });

  it('calling start on an already-"done" analysis reports done rather than re-running the analysis', async () => {
    const analysis = await makeDoneAnalysis();
    const res = await request(app).post(`/api/analyses/${analysis.id}/start`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });
});

describe('Global error handler', () => {
  it('a malformed JSON body returns a clean 400, not a crash or an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
