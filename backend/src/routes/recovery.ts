import { Router } from 'express';
import { prisma } from '../db.js';
import { hashToken } from '../middleware/anonymousSession.js';

export const recoveryRouter = Router();

// ---------- consume a recovery link token ----------
// A caller (any browser — this is the whole point, e.g. a new device or a browser with cookies
// cleared) proves it holds a valid recovery token and, on success, that browser's own session
// becomes a valid owner of the linked analysis. This is what makes the resulting access survive
// normal ownership checks (resolveAnalysis()) afterward, with no separate "recovered" flag to
// track. Errors are deliberately generic and don't distinguish "no such token" from "expired" from
// "analysis gone" — same IDOR-style rationale as resolveAnalysis()'s 'forbidden'/'not_found' fold.
recoveryRouter.post('/consume', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token || !req.sessionId) {
    return res.status(400).json({ error: 'Keçid etibarsızdır.' });
  }

  try {
    const record = await prisma.recoveryToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      return res.status(404).json({ error: 'Keçid etibarsızdır və ya vaxtı bitib.' });
    }

    const analysis = await prisma.analysis.findUnique({ where: { id: record.analysisId } });
    if (!analysis || analysis.deletedAt || analysis.expiresAt.getTime() < Date.now()) {
      return res.status(404).json({ error: 'Keçid etibarsızdır və ya vaxtı bitib.' });
    }

    if (analysis.anonymousSessionId !== req.sessionId) {
      await prisma.analysis.update({ where: { id: analysis.id }, data: { anonymousSessionId: req.sessionId } });
    }

    res.json({ analysisId: analysis.id });
  } catch (err) {
    // Never log the token itself (raw or hashed) or any analysis content — only that consumption
    // failed, for operators to notice a spike without any secret ending up in logs.
    console.error('[recovery] consume failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Server xətası baş verdi.' });
  }
});
