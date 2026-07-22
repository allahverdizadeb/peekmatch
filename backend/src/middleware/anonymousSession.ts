import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db.js';

export const SESSION_COOKIE = 'pm_session';
// Deliberately longer-lived than any single analysis's 24h entitlement window — this represents
// "this returning browser," not one purchase. Sliding: refreshed on use (see attachSession below).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Avoids a DB write on every single request just to bump lastSeenAt/expiresAt — only refresh once
// the session hasn't been touched in a while.
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

declare module 'express-serve-static-core' {
  interface Request {
    sessionId?: string;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

async function createSession(res: Response): Promise<string> {
  const token = generateToken();
  const session = await prisma.anonymousSession.create({
    data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  setSessionCookie(res, token);
  return session.id;
}

/** Identifies "this browser" without registration — attaches req.sessionId for every request,
 * creating a fresh AnonymousSession (+ HttpOnly cookie) on a caller's first visit, or resolving
 * an existing one from its cookie. This is what ownership checks (analysisLifecycle.ts) key off
 * of — nothing else in this codebase identifies a caller across requests.
 *
 * Fails closed on ownership, not closed on availability: if session resolution itself errors (a
 * DB hiccup), req.sessionId is simply left undefined rather than the request being rejected —
 * downstream ownership checks then treat "no session" as "doesn't own anything," which is the
 * safe default, instead of taking the whole API down over a transient DB error. */
export async function attachSession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const tokenHash = hashToken(token);
      const existing = await prisma.anonymousSession.findUnique({ where: { tokenHash } });
      if (existing && existing.expiresAt.getTime() > Date.now()) {
        req.sessionId = existing.id;
        if (Date.now() - existing.lastSeenAt.getTime() > REFRESH_THRESHOLD_MS) {
          await prisma.anonymousSession
            .update({
              where: { id: existing.id },
              data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
            })
            .catch((err) => console.error('[session] refresh failed', err instanceof Error ? err.message : err));
        }
        return next();
      }
    }
    req.sessionId = await createSession(res);
    next();
  } catch (err) {
    console.error('[session] attach failed', err instanceof Error ? err.message : err);
    next();
  }
}
