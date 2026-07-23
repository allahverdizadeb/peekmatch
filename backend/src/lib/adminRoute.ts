import type { Request, Response } from 'express';
import { parseRangeAndComparison, type ResolvedRange } from './dateRange.js';

/** Shared range-parsing boilerplate for every /api/admin/* data route — responds 400 itself on an
 * invalid range/comparison/custom-date and returns null so the caller can `if (!parsed) return;`. */
export function parseRangeOrRespond(req: Request, res: Response): { range: ResolvedRange; comparison: ResolvedRange | null } | null {
  try {
    return parseRangeAndComparison(req.query as Record<string, unknown>);
  } catch (err) {
    res.status(400).json({ error: err instanceof RangeError ? err.message : 'Yanlış tarix aralığı.' });
    return null;
  }
}
