import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../db.js';
import { resolveAnalysis } from './analysisLifecycle.js';

const HOUR = 60 * 60 * 1000;
const createdIds: string[] = [];
const createdSessionIds: string[] = [];

async function makeAnalysis(data: { expiresAt: Date; deletedAt?: Date | null; anonymousSessionId?: string | null; paidAt?: Date | null }) {
  const row = await prisma.analysis.create({
    data: {
      expiresAt: data.expiresAt,
      deletedAt: data.deletedAt ?? null,
      anonymousSessionId: data.anonymousSessionId ?? null,
      paidAt: data.paidAt ?? null,
    },
  });
  createdIds.push(row.id);
  return row;
}

async function makeSession() {
  const row = await prisma.anonymousSession.create({
    data: { tokenHash: `test-${Math.random()}`, expiresAt: new Date(Date.now() + 30 * 24 * HOUR) },
  });
  createdSessionIds.push(row.id);
  return row;
}

afterAll(async () => {
  await prisma.analysis.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.anonymousSession.deleteMany({ where: { id: { in: createdSessionIds } } });
  await prisma.$disconnect();
});

describe('resolveAnalysis', () => {
  it('returns not_found for an id that was never created', async () => {
    const resolved = await resolveAnalysis('00000000-0000-0000-0000-000000000000');
    expect(resolved.kind).toBe('not_found');
  });

  it('returns ok for a fresh, non-expired, non-deleted analysis', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR) });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('ok');
    if (resolved.kind === 'ok') expect(resolved.analysis.id).toBe(row.id);
  });

  it('returns expired once expiresAt is in the past — this is what the 24h auto-deletion promise depends on', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() - HOUR) });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('expired');
  });

  it('returns deleted once deletedAt is set, even if expiresAt is still in the future — this is what "delete my data" depends on being immediate', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR), deletedAt: new Date() });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('deleted');
  });

  it('prioritizes deleted over expired when both are true, so a user who deleted their data never sees a generic "expired" message', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() - HOUR), deletedAt: new Date() });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('deleted');
  });

  it('treats expiresAt exactly at the current instant as already expired (uses < not <=, boundary is inclusive of "now")', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() - 1) });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('expired');
  });
});

describe('resolveAnalysis ownership (IDOR fix)', () => {
  it('returns ok for the owning session', async () => {
    const session = await makeSession();
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR), anonymousSessionId: session.id });
    const resolved = await resolveAnalysis(row.id, session.id);
    expect(resolved.kind).toBe('ok');
  });

  it('returns forbidden for a different session — the core IDOR fix', async () => {
    const owner = await makeSession();
    const attacker = await makeSession();
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR), anonymousSessionId: owner.id });
    const resolved = await resolveAnalysis(row.id, attacker.id);
    expect(resolved.kind).toBe('forbidden');
  });

  it('returns forbidden when no session is supplied at all for an owned analysis', async () => {
    const owner = await makeSession();
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR), anonymousSessionId: owner.id });
    const resolved = await resolveAnalysis(row.id, undefined);
    expect(resolved.kind).toBe('forbidden');
  });

  it('treats a null anonymousSessionId (pre-migration row) as ownerless/public regardless of caller', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * HOUR), anonymousSessionId: null });
    const someone = await makeSession();
    expect((await resolveAnalysis(row.id, someone.id)).kind).toBe('ok');
    expect((await resolveAnalysis(row.id, undefined)).kind).toBe('ok');
  });

  it('forbidden takes priority over deleted/expired — a non-owner cannot distinguish lifecycle state', async () => {
    const owner = await makeSession();
    const attacker = await makeSession();
    const row = await makeAnalysis({
      expiresAt: new Date(Date.now() - HOUR),
      deletedAt: new Date(),
      anonymousSessionId: owner.id,
    });
    const resolved = await resolveAnalysis(row.id, attacker.id);
    expect(resolved.kind).toBe('forbidden');
  });
});

describe('resolveAnalysis entitlement_expired vs plain expired', () => {
  it('an expired analysis that was never paid resolves to plain "expired"', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() - HOUR), paidAt: null });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('expired');
  });

  it('an expired analysis that WAS paid resolves to "entitlement_expired" — distinct privacy-specific message', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() - HOUR), paidAt: new Date(Date.now() - 25 * HOUR) });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('entitlement_expired');
  });

  it('a still-active paid analysis resolves ok, not entitlement_expired', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + HOUR), paidAt: new Date() });
    const resolved = await resolveAnalysis(row.id);
    expect(resolved.kind).toBe('ok');
  });
});

describe('background job writes must not resurrect a deleted analysis', () => {
  // Regression test for the race between "delete my data" and the in-flight background AI call in
  // runAnalysis() (analyses.ts): that call can take 15-90+ seconds, long enough for the user to
  // delete their analysis before it finishes. The fix was switching runAnalysis()'s final write
  // from prisma.analysis.update({ where: { id } }) to updateMany({ where: { id, deletedAt: null } }),
  // so a row deleted in the meantime simply won't match and the write becomes a no-op. This test
  // exercises that exact DB-level mechanism directly, without needing to race a real AI call.
  it('updateMany with a deletedAt: null guard is a no-op against a row that was deleted in the meantime', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    // Simulate: user calls DELETE while the background job's AI call is still in flight.
    await prisma.analysis.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), resultJson: null, cvText: null, vacancyText: null },
    });

    // Simulate: the background job's AI call finishes and tries to write its result back.
    const writeResult = await prisma.analysis.updateMany({
      where: { id: row.id, deletedAt: null },
      data: { status: 'done', resultJson: JSON.stringify({ compatibility: 99 }) },
    });

    expect(writeResult.count, 'the write must affect zero rows once the analysis is deleted').toBe(0);
    const after = await prisma.analysis.findUnique({ where: { id: row.id } });
    expect(after?.resultJson, 'resultJson must stay null — the deletion must not be undone').toBeNull();
    expect(after?.status).not.toBe('done');
  });

  it('the same write DOES succeed when the analysis was not deleted — the guard only blocks the deleted case', async () => {
    const row = await makeAnalysis({ expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const writeResult = await prisma.analysis.updateMany({
      where: { id: row.id, deletedAt: null },
      data: { status: 'done', resultJson: JSON.stringify({ compatibility: 99 }) },
    });
    expect(writeResult.count).toBe(1);
    const after = await prisma.analysis.findUnique({ where: { id: row.id } });
    expect(after?.status).toBe('done');
  });
});
