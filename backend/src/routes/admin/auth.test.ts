import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../db.js';
import { hashPassword } from '../../lib/superadminAuth.js';
import { _resetRateLimitStateForTests } from '../../lib/rateLimit.js';

const EMAIL = 'test-superadmin@peekmatch.test';
const PASSWORD = 'CorrectHorseBatteryStaple9';

beforeAll(async () => {
  await prisma.superadminUser.deleteMany({ where: { email: EMAIL } });
  await prisma.superadminUser.create({ data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD) } });
});

afterAll(async () => {
  await prisma.superadminSession.deleteMany({ where: { superadminUser: { email: EMAIL } } });
  await prisma.superadminUser.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

beforeEach(() => {
  _resetRateLimitStateForTests();
});

describe('POST /api/admin/auth/login', () => {
  it('rejects a wrong password with a generic message (no user-enumeration signal)', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email və ya şifrə yanlışdır.');
  });

  it('rejects an unknown email with the exact same generic message', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: 'nobody@nowhere.test', password: 'whatever12345' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email və ya şifrə yanlışdır.');
  });

  it('accepts the correct password and returns a csrfToken', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
    expect(cookies.some((c: string) => c.includes('pm_admin_session_dev'))).toBe(true);
  });

  it('rejects further attempts after repeated failures from the same source, even with the correct password', async () => {
    const email = 'lockout-test@peekmatch.test';
    await prisma.superadminUser.deleteMany({ where: { email } });
    await prisma.superadminUser.create({ data: { email, passwordHash: await hashPassword(PASSWORD) } });

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/admin/auth/login').send({ email, password: 'wrong' });
    }
    // With 5 failures already recorded (both the per-account lock and the per-request-identifier
    // limiter share the same threshold), the very next attempt is rejected outright — even a
    // correct password must not succeed once a source has been this persistently wrong.
    const res = await request(app).post('/api/admin/auth/login').send({ email, password: PASSWORD });
    expect([401, 429]).toContain(res.status);
    expect(res.body.error).not.toMatch(/^Server/);

    await prisma.superadminSession.deleteMany({ where: { superadminUser: { email } } });
    await prisma.superadminUser.deleteMany({ where: { email } });
  });
});

describe('Authenticated session flow', () => {
  it('GET /auth/me is 401 without a session cookie', async () => {
    const res = await request(app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthenticated');
  });

  it('login -> /me -> state-changing request requires CSRF -> logout invalidates the session', async () => {
    const agent = request.agent(app);

    const login = await agent.post('/api/admin/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    const csrfToken = login.body.csrfToken as string;

    const me = await agent.get('/api/admin/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(EMAIL);

    // A state-changing admin request without the CSRF header must be rejected — SameSite alone is
    // not trusted as the only defense (see lib/csrf.ts).
    const withoutCsrf = await agent.post('/api/admin/auth/sessions/revoke-others');
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.code).toBe('csrf_invalid');

    const withCsrf = await agent.post('/api/admin/auth/sessions/revoke-others').set('x-superadmin-csrf', csrfToken);
    expect(withCsrf.status).toBe(200);

    const logout = await agent.post('/api/admin/auth/logout').set('x-superadmin-csrf', csrfToken);
    expect(logout.status).toBe(200);

    const afterLogout = await agent.get('/api/admin/auth/me');
    expect(afterLogout.status).toBe(401);
  });
});

describe('Admin data routes require a real session', () => {
  it('GET /api/admin/overview is 401 without authentication — a client-side guard is not the real boundary', async () => {
    const res = await request(app).get('/api/admin/overview?range=7d');
    expect(res.status).toBe(401);
  });

  it('an authenticated request succeeds and returns a well-formed range', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/auth/login').send({ email: EMAIL, password: PASSWORD });
    const res = await agent.get('/api/admin/overview?range=7d');
    expect(res.status).toBe(200);
    expect(res.body.kpis.uniqueVisitors).toBeDefined();
  });

  it('rejects an invalid range with a 400, not a 500', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/auth/login').send({ email: EMAIL, password: PASSWORD });
    const res = await agent.get('/api/admin/overview?range=not-a-real-range');
    expect(res.status).toBe(400);
  });
});
