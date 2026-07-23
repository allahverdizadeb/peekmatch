import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { SUPERADMIN_COOKIE, IDLE_TIMEOUT_MS, hashSessionToken, clearSuperadminCookie } from '../lib/superadminAuth.js';

// Only slide lastActivityAt/idleExpiresAt at most this often — avoids a DB write on every single
// request just to bump a timestamp, mirroring anonymousSession.ts's own REFRESH_THRESHOLD_MS idea.
const REFRESH_THRESHOLD_MS = 60 * 1000;

/** The real security boundary for every `/api/admin/*` data/export route — a client-side route guard
 * is UX only. Validates the session cookie, enforces BOTH idle (30 min) and absolute (12h) expiry,
 * and never lets idle-refresh push lastActivityAt past the absolute deadline. */
export async function requireSuperadminSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SUPERADMIN_COOKIE] as string | undefined;
  if (!token) return res.status(401).json({ error: 'Giriş tələb olunur.', code: 'unauthenticated' });

  const tokenHash = hashSessionToken(token);
  const session = await prisma.superadminSession.findUnique({ where: { tokenHash }, include: { superadminUser: true } });
  const now = Date.now();
  const invalid =
    !session ||
    session.revokedAt !== null ||
    session.idleExpiresAt.getTime() < now ||
    session.absoluteExpiresAt.getTime() < now ||
    !session.superadminUser.isActive;

  if (invalid) {
    clearSuperadminCookie(res);
    return res.status(401).json({ error: 'Sessiyanın müddəti bitib. Yenidən daxil olun.', code: 'session_expired' });
  }

  if (now - session.lastActivityAt.getTime() > REFRESH_THRESHOLD_MS) {
    const nextIdleExpiry = new Date(Math.min(now + IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()));
    await prisma.superadminSession
      .update({ where: { id: session.id }, data: { lastActivityAt: new Date(), idleExpiresAt: nextIdleExpiry } })
      .catch((err) => console.error('[superadminAuth] refresh failed', err instanceof Error ? err.message : err));
  }

  req.superadmin = { userId: session.superadminUserId, sessionId: session.id, csrfSecret: session.csrfSecret };
  next();
}
