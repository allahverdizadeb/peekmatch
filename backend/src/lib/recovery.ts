import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { hashToken } from '../middleware/anonymousSession.js';

/** Generates a single-purpose "return to my paid analysis" recovery link token, hashing it before
 * storage — the raw token returned here is the only place the usable secret ever exists in
 * plaintext (see RecoveryToken's schema comment: reusable until the analysis's own entitlement
 * expires, not one-time-use, so it survives multiple devices/repeat opens).
 *
 * Not currently called from any live route: no checkout flow in this product collects an email
 * address to deliver the resulting link to (see ANONYMOUS_ACCESS_RESTORATION_REPORT.md's
 * "Email recovery" section — adding a mandatory email field to checkout was explicitly out of
 * scope). This exists as ready-to-use, tested plumbing for whenever email collection is added —
 * the consuming side (routes/recovery.ts's POST /consume) is already fully wired. */
export async function createRecoveryToken(analysisId: string, expiresAt: Date): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.recoveryToken.create({ data: { tokenHash: hashToken(token), analysisId, expiresAt } });
  return token;
}
