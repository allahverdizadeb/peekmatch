import { Router } from 'express';
import { prisma } from '../../db.js';
import {
  verifyPasswordTimingSafe,
  hashPassword,
  createSuperadminSession,
  revokeSuperadminSession,
  revokeOtherSuperadminSessions,
  clearSuperadminCookie,
  maskRequestId,
} from '../../lib/superadminAuth.js';
import { requireSuperadminSession } from '../../middleware/superadminAuth.js';
import { requireCsrf, requireSameOrigin, csrfTokenFor } from '../../lib/csrf.js';
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from '../../lib/rateLimit.js';
import { recordAudit } from '../../lib/auditLog.js';

export const adminAuthRouter = Router();

const GENERIC_LOGIN_ERROR = 'Email və ya şifrə yanlışdır.';
const RATE_LIMIT_ERROR = 'Həddindən çox cəhd edildi. Bir az sonra yenidən cəhd edin.';
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

adminAuthRouter.use(requireSameOrigin);

// No CSRF token on /login — there is no session yet to derive one from. Protected instead by
// SameSite=Strict, requireSameOrigin above, and the rate limiting below.
adminAuthRouter.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const requestId = maskRequestId(req);

  const ipCheck = checkLoginRateLimit(`ip:${requestId}`);
  if (!ipCheck.allowed) {
    await recordAudit({ action: 'login_failed', status: 'failure', actorEmail: email || null, requestIdHash: requestId, metadata: { reason: 'rate_limited' } });
    return res.status(429).json({ error: RATE_LIMIT_ERROR, code: 'rate_limited' });
  }
  if (!email || !password) {
    recordLoginFailure(`ip:${requestId}`);
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR, code: 'invalid_credentials' });
  }

  const user = await prisma.superadminUser.findUnique({ where: { email } });
  const locked = Boolean(user?.lockedUntil && user.lockedUntil.getTime() > Date.now());
  // Always run a real bcrypt compare, even for an unknown email or a currently-locked account, so
  // response timing never signals which case occurred (see verifyPasswordTimingSafe's doc-comment).
  const passwordOk = !locked && (await verifyPasswordTimingSafe(password, user?.passwordHash ?? null));

  if (!user || !user.isActive || locked || !passwordOk) {
    recordLoginFailure(`ip:${requestId}`);
    if (user && !locked) {
      const nextCount = user.failedLoginCount + 1;
      await prisma.superadminUser.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextCount,
          lockedUntil: nextCount >= ACCOUNT_LOCK_THRESHOLD ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null,
        },
      });
    }
    await recordAudit({
      action: 'login_failed',
      status: 'failure',
      actorEmail: email,
      requestIdHash: requestId,
      metadata: { reason: locked ? 'locked' : 'invalid_credentials' },
    });
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR, code: 'invalid_credentials' });
  }

  recordLoginSuccess(`ip:${requestId}`);
  await prisma.superadminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const session = await createSuperadminSession(req, res, user.id);
  await recordAudit({ action: 'login_succeeded', status: 'success', actorId: user.id, actorEmail: user.email, requestIdHash: requestId });

  res.json({ email: user.email, csrfToken: csrfTokenFor(session.csrfSecret), lastLoginAt: user.lastLoginAt });
});

adminAuthRouter.post('/logout', requireSuperadminSession, requireCsrf, async (req, res) => {
  await revokeSuperadminSession(req.superadmin!.sessionId);
  clearSuperadminCookie(res);
  await recordAudit({ action: 'logout', status: 'success', actorId: req.superadmin!.userId, requestIdHash: maskRequestId(req) });
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireSuperadminSession, async (req, res) => {
  const user = await prisma.superadminUser.findUnique({ where: { id: req.superadmin!.userId } });
  if (!user) return res.status(401).json({ error: 'Sessiya etibarsızdır.', code: 'unauthenticated' });
  res.json({
    email: user.email,
    lastLoginAt: user.lastLoginAt,
    passwordChangedAt: user.passwordChangedAt,
    csrfToken: csrfTokenFor(req.superadmin!.csrfSecret),
  });
});

adminAuthRouter.post('/change-password', requireSuperadminSession, requireCsrf, async (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Yeni şifrə ən azı 12 simvol olmalıdır.', code: 'weak_password' });
  }
  const user = await prisma.superadminUser.findUnique({ where: { id: req.superadmin!.userId } });
  if (!user) return res.status(401).json({ error: 'Sessiya etibarsızdır.', code: 'unauthenticated' });

  const ok = await verifyPasswordTimingSafe(currentPassword, user.passwordHash);
  if (!ok) {
    await recordAudit({ action: 'password_changed', status: 'failure', actorId: user.id, actorEmail: user.email, requestIdHash: maskRequestId(req) });
    return res.status(401).json({ error: 'Mövcud şifrə yanlışdır.', code: 'invalid_current_password' });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.superadminUser.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
  const revokedCount = await revokeOtherSuperadminSessions(user.id, req.superadmin!.sessionId);
  await recordAudit({ action: 'password_changed', status: 'success', actorId: user.id, actorEmail: user.email, requestIdHash: maskRequestId(req) });
  if (revokedCount > 0) {
    await recordAudit({
      action: 'sessions_revoked',
      status: 'success',
      actorId: user.id,
      actorEmail: user.email,
      requestIdHash: maskRequestId(req),
      metadata: { count: revokedCount },
    });
  }
  res.json({ ok: true, revokedSessions: revokedCount });
});

adminAuthRouter.get('/sessions', requireSuperadminSession, async (req, res) => {
  const sessions = await prisma.superadminSession.findMany({
    where: { superadminUserId: req.superadmin!.userId, revokedAt: null, absoluteExpiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
  });
  res.json(
    sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      idleExpiresAt: s.idleExpiresAt,
      absoluteExpiresAt: s.absoluteExpiresAt,
      userAgentSummary: s.userAgentSummary,
      current: s.id === req.superadmin!.sessionId,
    })),
  );
});

adminAuthRouter.post('/sessions/revoke-others', requireSuperadminSession, requireCsrf, async (req, res) => {
  const count = await revokeOtherSuperadminSessions(req.superadmin!.userId, req.superadmin!.sessionId);
  await recordAudit({ action: 'sessions_revoked', status: 'success', actorId: req.superadmin!.userId, requestIdHash: maskRequestId(req), metadata: { count } });
  res.json({ ok: true, revokedSessions: count });
});
