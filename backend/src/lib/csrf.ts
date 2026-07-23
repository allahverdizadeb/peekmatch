import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const CSRF_HEADER = 'x-superadmin-csrf';

/** Derives the per-session CSRF token a client must echo back on every state-changing request — a
 * double-submit scheme, so the token is stateless to verify (no separate CSRF table) yet still tied
 * to a real, already-authenticated session secret the client cannot forge. */
export function csrfTokenFor(sessionCsrfSecret: string): string {
  return crypto.createHmac('sha256', sessionCsrfSecret).update('superadmin-csrf').digest('hex');
}

/** Defense-in-depth on top of SameSite=Strict — not a replacement for it. Must run AFTER
 * requireSuperadminSession (needs req.superadmin). Read-only methods are exempt. */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const provided = req.header(CSRF_HEADER);
  const expected = req.superadmin ? csrfTokenFor(req.superadmin.csrfSecret) : null;
  if (!provided || !expected || provided !== expected) {
    return res.status(403).json({ error: 'CSRF yoxlaması uğursuz oldu.', code: 'csrf_invalid' });
  }
  next();
}

/** Explicit allowlist of frontend origins this API accepts admin requests from, e.g.
 * `https://peek-match.com,https://www.peek-match.com` — set in production. Comparing `Origin`
 * against `req.headers.host` (an earlier version of this check did) is unsound behind ANY reverse
 * proxy that rewrites the Host header when forwarding (Vite's dev proxy with `changeOrigin: true`
 * does exactly this, and so do most production proxies/load balancers) — the browser's `Origin`
 * reflects the public-facing address the user is actually on, while `Host` becomes whatever the
 * proxy rewrote it to, so the two legitimately differ on every real request, not just attacks. */
function allowedOrigins(): string[] | null {
  const raw = process.env.ADMIN_ALLOWED_ORIGINS;
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/** Same-origin check for state-changing admin requests — browsers always send an Origin header on
 * cross-site state-changing fetches, so an absent header (same-origin navigations, curl, tests) is
 * allowed through. A present Origin is checked against `ADMIN_ALLOWED_ORIGINS` when configured;
 * without it (local dev), any plain-http localhost/127.0.0.1 origin is accepted — production
 * deployments should always set the allowlist explicitly rather than rely on this fallback. */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.header('origin');
  if (origin) {
    const configured = allowedOrigins();
    const allowed = configured ? configured.includes(origin) : isLocalDevOrigin(origin);
    if (!allowed) {
      return res.status(403).json({ error: 'Cross-origin sorğuya icazə verilmir.', code: 'cross_origin_blocked' });
    }
  }
  next();
}
