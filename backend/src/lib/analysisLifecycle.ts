import type { Response } from 'express';
import { prisma } from '../db.js';

export type AnalysisRow = NonNullable<Awaited<ReturnType<typeof prisma.analysis.findUnique>>>;
export type ResolvedAnalysis =
  | { kind: 'ok'; analysis: AnalysisRow }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'deleted' };

/** Distinguishes "never existed" (404) from "existed but is now gone" (410, either auto-expired
 * or user-deleted) so the frontend can show the right lifecycle state instead of a generic
 * not-found. Every analysis-reading endpoint must go through this, not a raw prisma.analysis.findUnique. */
export async function resolveAnalysis(id: string): Promise<ResolvedAnalysis> {
  const a = await prisma.analysis.findUnique({ where: { id } });
  if (!a) return { kind: 'not_found' };
  if (a.deletedAt) return { kind: 'deleted' };
  if (a.expiresAt.getTime() < Date.now()) return { kind: 'expired' };
  return { kind: 'ok', analysis: a };
}

export function respondUnresolved(res: Response, resolved: Exclude<ResolvedAnalysis, { kind: 'ok' }>) {
  if (resolved.kind === 'not_found') return res.status(404).json({ error: 'Analiz tapılmadı.' });
  const message = resolved.kind === 'expired' ? 'Bu analizin müddəti bitib.' : 'Bu analizin məlumatları silinib.';
  return res.status(410).json({ error: message, code: resolved.kind });
}
