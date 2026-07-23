import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { prisma } from '../db.js';

const BCRYPT_ROUNDS = 12;
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// __Host- cookies are browser-spec-required to be Secure + no Domain + Path=/ ALWAYS — they will
// silently fail to be set at all over plain http://localhost. Branch the cookie NAME (not just the
// Secure flag) on environment, same idea as anonymousSession.ts's `secure: NODE_ENV==='production'`
// but taken one step further since __Host- itself refuses to apply over insecure transport.
export const SUPERADMIN_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-pm_admin_session' : 'pm_admin_session_dev';

declare module 'express-serve-static-core' {
  interface Request {
    superadmin?: { userId: string; sessionId: string; csrfSecret: string };
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Computed once at module load (not per-request) so an unknown-email login attempt still pays a
// real bcrypt-compare cost against SOME hash — keeping response timing indistinguishable from a
// known-email/wrong-password attempt, which is what actually prevents email enumeration via timing.
const DUMMY_HASH = bcrypt.hashSync('pm-superadmin-timing-safe-dummy', BCRYPT_ROUNDS);

export async function verifyPasswordTimingSafe(password: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** One-way, truncated request identifier for audit/session rows — never a raw, complete IP address
 * (per the product brief's audit-log privacy requirement). */
export function maskRequestId(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/** A coarse browser/OS summary, never the raw full User-Agent string (which can be fingerprint-y and
 * is unnecessary detail for a security-session display). */
export function summarizeUserAgent(ua: string | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Digər';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Digər';
  return `${browser} · ${os}`;
}

function setSuperadminCookie(res: Response, token: string) {
  res.cookie(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS,
  });
}

export function clearSuperadminCookie(res: Response) {
  res.clearCookie(SUPERADMIN_COOKIE, { path: '/' });
}

export async function createSuperadminSession(req: Request, res: Response, userId: string) {
  const token = generateToken();
  const csrfSecret = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const session = await prisma.superadminSession.create({
    data: {
      superadminUserId: userId,
      tokenHash: hashSessionToken(token),
      csrfSecret,
      idleExpiresAt: new Date(now + IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_TIMEOUT_MS),
      userAgentSummary: summarizeUserAgent(req.headers['user-agent']),
      requestIdHash: maskRequestId(req),
    },
  });
  setSuperadminCookie(res, token);
  return session;
}

export async function revokeSuperadminSession(sessionId: string): Promise<void> {
  await prisma.superadminSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }).catch(() => {});
}

/** Used by "Revoke other sessions" (Settings) — keeps the caller's own current session alive. */
export async function revokeOtherSuperadminSessions(userId: string, keepSessionId: string): Promise<number> {
  const result = await prisma.superadminSession.updateMany({
    where: { superadminUserId: userId, id: { not: keepSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
