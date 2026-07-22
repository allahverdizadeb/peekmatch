import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';
import { hashToken } from '../middleware/anonymousSession.js';
import { createRecoveryToken } from '../lib/recovery.js';

const createdAnalysisIds: string[] = [];
const createdSessionIds: string[] = [];

afterAll(async () => {
  await prisma.recoveryToken.deleteMany({ where: { analysisId: { in: createdAnalysisIds } } });
  await prisma.order.deleteMany({ where: { analysisId: { in: createdAnalysisIds } } });
  await prisma.analysis.deleteMany({ where: { id: { in: createdAnalysisIds } } });
  await prisma.anonymousSession.deleteMany({ where: { id: { in: createdSessionIds } } });
  await prisma.$disconnect();
});

/** Creates a CV via the real HTTP flow (not a direct Prisma insert) so the analysis actually gets
 * linked to the calling agent's session — exercising the exact path a real browser goes through. */
async function createAnalysisAs(agent: ReturnType<typeof request.agent>) {
  const res = await agent
    .post('/api/analyses')
    .field('cvMode', 'text')
    .field('cvText', 'x'.repeat(2100));
  expect(res.status).toBe(200);
  createdAnalysisIds.push(res.body.id);
  return res.body.id as string;
}

describe('anonymous session cookie', () => {
  it('a fresh caller with no cookie gets a pm_session cookie set on the first request', async () => {
    const res = await request(app).get('/api/session/current');
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie, 'attachSession must set a cookie for a brand-new caller').toBeDefined();
    expect(String(setCookie)).toMatch(/pm_session=/);
  });

  it('the same agent reuses its session across requests (no new cookie on the second call)', async () => {
    const agent = request.agent(app);
    const first = await agent.get('/api/session/current');
    const firstCookie = first.headers['set-cookie'];
    expect(firstCookie).toBeDefined();

    const second = await agent.get('/api/session/current');
    // supertest's agent persists+resends the cookie; the server should not need to issue a new one
    // (no Set-Cookie on the follow-up request from the same session).
    expect(second.headers['set-cookie']).toBeUndefined();
  });

  it('GET /api/session/current never creates an analysis and reports hasAnalysis:false for a brand-new session', async () => {
    const agent = request.agent(app);
    const res = await agent.get('/api/session/current');
    expect(res.status).toBe(200);
    expect(res.body.hasAnalysis).toBe(false);
    expect(res.body.analysisId).toBeUndefined();
  });
});

describe('session-scoped analysis linking + GET /api/session/current', () => {
  it('an analysis created by an agent is linked to that agent session and appears in /session/current', async () => {
    const agent = request.agent(app);
    const analysisId = await createAnalysisAs(agent);

    const current = await agent.get('/api/session/current');
    expect(current.body.hasAnalysis).toBe(true);
    expect(current.body.analysisId).toBe(analysisId);
    expect(current.body.status).toBe('draft');
  });

  it('/session/current returns the MOST RECENT analysis when an agent has created more than one', async () => {
    const agent = request.agent(app);
    await createAnalysisAs(agent);
    const second = await createAnalysisAs(agent);

    const current = await agent.get('/api/session/current');
    expect(current.body.analysisId).toBe(second);
  });

  it('a different agent (no cookie shared) sees no active analysis even after another session created one', async () => {
    const owner = request.agent(app);
    await createAnalysisAs(owner);

    const stranger = request.agent(app);
    const current = await stranger.get('/api/session/current');
    expect(current.body.hasAnalysis).toBe(false);
  });
});

describe('ownership enforcement (IDOR fix) over real HTTP', () => {
  it('a session that did not create the analysis gets 404 on GET /api/analyses/:id', async () => {
    const owner = request.agent(app);
    const analysisId = await createAnalysisAs(owner);

    const stranger = request.agent(app);
    const res = await stranger.get(`/api/analyses/${analysisId}`);
    expect(res.status).toBe(404);
  });

  it('the owning session can read its own analysis fine', async () => {
    const owner = request.agent(app);
    const analysisId = await createAnalysisAs(owner);

    const res = await owner.get(`/api/analyses/${analysisId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(analysisId);
  });

  it('a stranger cannot create an order against someone else\'s analysis', async () => {
    const owner = request.agent(app);
    const analysisId = await createAnalysisAs(owner);
    // Bring it to 'done' so it would otherwise be eligible for purchase.
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'done', resultJson: JSON.stringify({ compatibility: 1 }) } });

    const stranger = request.agent(app);
    const res = await stranger.post('/api/orders').send({ analysisId, package: 1 });
    expect(res.status).toBe(404);
  });
});

describe('entitlement window (24h from payment)', () => {
  async function makeDoneAnalysisAs(agent: ReturnType<typeof request.agent>) {
    const id = await createAnalysisAs(agent);
    await prisma.analysis.update({ where: { id }, data: { status: 'done', resultJson: JSON.stringify({ compatibility: 1 }) } });
    return id;
  }

  it('paying sets paidAt/entitlementExpiresAt exactly once and bumps expiresAt to match', async () => {
    const agent = request.agent(app);
    const analysisId = await makeDoneAnalysisAs(agent);

    const order = await agent.post('/api/orders').send({ analysisId, package: 1 });
    expect(order.status).toBe(200);
    await agent.post(`/api/orders/${order.body.id}/simulate`).send({ outcome: 'success' });
    await new Promise((r) => setTimeout(r, 1600));

    const after = await prisma.analysis.findUnique({ where: { id: analysisId } });
    expect(after?.paidAt, 'paidAt must be set once payment succeeds').not.toBeNull();
    expect(after?.entitlementExpiresAt).not.toBeNull();
    const windowMs = after!.entitlementExpiresAt!.getTime() - after!.paidAt!.getTime();
    expect(windowMs, 'entitlement window must be ~24h').toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(windowMs).toBeLessThan(24.1 * 60 * 60 * 1000);
    expect(after!.expiresAt.getTime(), 'expiresAt (retention clock) must be bumped to match entitlementExpiresAt').toBe(
      after!.entitlementExpiresAt!.getTime(),
    );
  }, 10_000);

  it('upgrading to package 2 after already owning package 1 does NOT reset paidAt (no free extension via upgrade)', async () => {
    const agent = request.agent(app);
    const analysisId = await makeDoneAnalysisAs(agent);

    const firstOrder = await agent.post('/api/orders').send({ analysisId, package: 1 });
    await agent.post(`/api/orders/${firstOrder.body.id}/simulate`).send({ outcome: 'success' });
    await new Promise((r) => setTimeout(r, 1600));
    const afterFirst = await prisma.analysis.findUnique({ where: { id: analysisId } });
    const firstPaidAt = afterFirst!.paidAt!.getTime();

    const secondOrder = await agent.post('/api/orders').send({ analysisId, package: 2 });
    expect(secondOrder.status).toBe(200);
    await agent.post(`/api/orders/${secondOrder.body.id}/simulate`).send({ outcome: 'success' });
    await new Promise((r) => setTimeout(r, 1600));
    const afterSecond = await prisma.analysis.findUnique({ where: { id: analysisId } });

    expect(afterSecond!.paidAt!.getTime(), 'an upgrade purchase must not reset the entitlement clock').toBe(firstPaidAt);
  }, 15_000);

  it('GET /api/analyses/:id exposes paidAt/entitlementExpiresAt to the owner', async () => {
    const agent = request.agent(app);
    const analysisId = await makeDoneAnalysisAs(agent);
    const order = await agent.post('/api/orders').send({ analysisId, package: 1 });
    await agent.post(`/api/orders/${order.body.id}/simulate`).send({ outcome: 'success' });
    await new Promise((r) => setTimeout(r, 1600));

    const res = await agent.get(`/api/analyses/${analysisId}`);
    expect(res.body.paidAt).toBeTruthy();
    expect(res.body.entitlementExpiresAt).toBeTruthy();
  }, 10_000);
});

describe('POST /api/recovery/consume', () => {
  it('rejects a bogus token with a generic 404', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/recovery/consume').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(404);
  });

  it('rejects an expired token', async () => {
    const analysis = await prisma.analysis.create({ data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    createdAnalysisIds.push(analysis.id);
    const raw = 'expired-test-token-' + Math.random();
    await prisma.recoveryToken.create({
      data: { tokenHash: hashToken(raw), analysisId: analysis.id, expiresAt: new Date(Date.now() - 1000) },
    });

    const agent = request.agent(app);
    const res = await agent.post('/api/recovery/consume').send({ token: raw });
    expect(res.status).toBe(404);
  });

  it('a valid token links the consuming session to the analysis, restoring access from a new browser', async () => {
    const originalOwner = request.agent(app);
    const analysisId = await createAnalysisAs(originalOwner);
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'done', resultJson: JSON.stringify({ compatibility: 1 }) } });

    const rawToken = await createRecoveryToken(analysisId, new Date(Date.now() + 60 * 60 * 1000));

    // A brand-new browser (no shared cookie) — must not have access yet.
    const newDevice = request.agent(app);
    const before = await newDevice.get(`/api/analyses/${analysisId}`);
    expect(before.status).toBe(404);

    const consume = await newDevice.post('/api/recovery/consume').send({ token: rawToken });
    expect(consume.status).toBe(200);
    expect(consume.body.analysisId).toBe(analysisId);

    // Now it must have access — the recovery link re-homed ownership to this session.
    const after = await newDevice.get(`/api/analyses/${analysisId}`);
    expect(after.status).toBe(200);
    expect(after.body.id).toBe(analysisId);
  });

  it('is reusable, not one-time-use — a second device can consume the same token too', async () => {
    const originalOwner = request.agent(app);
    const analysisId = await createAnalysisAs(originalOwner);

    const rawToken = await createRecoveryToken(analysisId, new Date(Date.now() + 60 * 60 * 1000));

    const deviceA = request.agent(app);
    const deviceB = request.agent(app);
    expect((await deviceA.post('/api/recovery/consume').send({ token: rawToken })).status).toBe(200);
    expect((await deviceB.post('/api/recovery/consume').send({ token: rawToken })).status).toBe(200);
  });
});
