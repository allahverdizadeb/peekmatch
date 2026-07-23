// In-memory sliding-window login rate limiter — a single-process assumption that matches the rest of
// this codebase (no horizontal scaling, no shared cache anywhere). Keyed independently by account
// (email) and by a masked per-request identifier (see superadminAuth.ts's maskRequestId), so a
// distributed attempt across many source addresses is still throttled per-account, and a single
// source hammering many accounts is still throttled per-source.

interface Attempt {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const attemptsByKey = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;

function backoffMs(failureCount: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, failureCount - MAX_ATTEMPTS_BEFORE_LOCKOUT));
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const entry = attemptsByKey.get(key);
  const now = Date.now();
  if (entry?.lockedUntil && entry.lockedUntil > now) return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  if (!entry || now - entry.firstAt > WINDOW_MS) return { allowed: true, retryAfterMs: 0 };
  if (entry.count >= MAX_ATTEMPTS_BEFORE_LOCKOUT) return { allowed: false, retryAfterMs: backoffMs(entry.count) };
  return { allowed: true, retryAfterMs: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = attemptsByKey.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attemptsByKey.set(key, { count: 1, firstAt: now });
    return;
  }
  const count = entry.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS_BEFORE_LOCKOUT ? now + backoffMs(count) : undefined;
  attemptsByKey.set(key, { count, firstAt: entry.firstAt, lockedUntil });
}

export function recordLoginSuccess(key: string): void {
  attemptsByKey.delete(key);
}

// Test-only reset — vitest runs many login-flow tests against the same in-memory map otherwise.
export function _resetRateLimitStateForTests(): void {
  attemptsByKey.clear();
}
