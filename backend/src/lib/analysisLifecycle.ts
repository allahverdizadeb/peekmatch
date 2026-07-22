import type { Response } from 'express';
import { prisma } from '../db.js';

export type AnalysisRow = NonNullable<Awaited<ReturnType<typeof prisma.analysis.findUnique>>>;
export type ResolvedAnalysis =
  | { kind: 'ok'; analysis: AnalysisRow }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'entitlement_expired' }
  | { kind: 'deleted' }
  | { kind: 'forbidden' };

/** Distinguishes "never existed" (404) from "existed but is now gone" (410, either auto-expired
 * or user-deleted) so the frontend can show the right lifecycle state instead of a generic
 * not-found. Every analysis-reading endpoint must go through this, not a raw prisma.analysis.findUnique.
 *
 * `callerSessionId` enables ownership enforcement (fixes a real, confirmed IDOR: analysis ids are
 * UUIDs but nothing previously checked who was asking). An analysis with a null
 * `anonymousSessionId` (any row created before this feature existed) is treated as ownerless/public
 * — matching its exact pre-migration behavior — so old links keep working. A session mismatch
 * resolves to the same 'forbidden' kind regardless of whether the analysis is otherwise fine,
 * expired, or deleted — checked first, before those — so a non-owner can't distinguish "not mine"
 * from "doesn't exist" from lifecycle state, which is exactly the generic-error IDOR mitigation
 * this exists to provide. */
export async function resolveAnalysis(id: string, callerSessionId?: string): Promise<ResolvedAnalysis> {
  const a = await prisma.analysis.findUnique({ where: { id } });
  if (!a) return { kind: 'not_found' };
  if (a.anonymousSessionId && a.anonymousSessionId !== callerSessionId) return { kind: 'forbidden' };
  if (a.deletedAt) return { kind: 'deleted' };
  if (a.expiresAt.getTime() < Date.now()) {
    // A paid analysis whose expiresAt has passed got there via the entitlement-window bump in
    // orders.ts (see ENTITLEMENT_WINDOW_MS) — distinguished from a plain never-purchased
    // data-retention expiry so the frontend can show the privacy-specific copy ("your data was
    // deleted per policy") instead of silently offering the payment screen again as if no
    // purchase had ever happened.
    return a.paidAt ? { kind: 'entitlement_expired' } : { kind: 'expired' };
  }
  return { kind: 'ok', analysis: a };
}

export function respondUnresolved(res: Response, resolved: Exclude<ResolvedAnalysis, { kind: 'ok' }>) {
  // 'forbidden' deliberately reuses the same 404 status + generic message as 'not_found' — never
  // confirming to a non-owner that the id exists at all (an IDOR mitigation, not an oversight).
  if (resolved.kind === 'not_found' || resolved.kind === 'forbidden') {
    return res.status(404).json({ error: 'Analiz tapılmadı.' });
  }
  if (resolved.kind === 'entitlement_expired') {
    return res.status(410).json({
      error: 'Bu analizin 24 saatlıq giriş müddəti başa çatıb və məlumatlar məxfilik qaydalarına uyğun silinib.',
      code: resolved.kind,
    });
  }
  const message = resolved.kind === 'expired' ? 'Bu analizin müddəti bitib.' : 'Bu analizin məlumatları silinib.';
  return res.status(410).json({ error: message, code: resolved.kind });
}
