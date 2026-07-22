import { Router } from 'express';
import { prisma } from '../db.js';
import { highestOwnedPackage, ownedPackages } from '../lib/pricing.js';
import { isEntitlementActive } from '../lib/entitlement.js';

export const sessionRouter = Router();

// ---------- current session's most recent analysis (homepage resume state) ----------
// The session cookie/row itself is always created by attachSession (mounted globally in app.ts)
// before this handler ever runs — this route never creates a session or an analysis, and never
// returns CV/vacancy body text, only the minimal safe fields a resume card / route guard needs to
// decide what to show without an extra round trip.
sessionRouter.get('/current', async (req, res) => {
  if (!req.sessionId) return res.json({ hasAnalysis: false });

  const analysis = await prisma.analysis.findFirst({
    where: { anonymousSessionId: req.sessionId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  // A just-expired row can still physically exist for a few minutes until the cleanup cron sweeps
  // it — treated as gone here too, so the homepage never offers to resume something a direct link
  // would already 410 on.
  if (!analysis || analysis.expiresAt.getTime() < Date.now()) {
    return res.json({ hasAnalysis: false });
  }

  const owned = highestOwnedPackage(await ownedPackages(analysis.id));
  res.json({
    hasAnalysis: true,
    analysisId: analysis.id,
    status: analysis.status,
    failReason: analysis.failReason,
    ownedPackage: owned,
    paidAt: analysis.paidAt,
    entitlementExpiresAt: analysis.entitlementExpiresAt,
    entitlementActive: isEntitlementActive(analysis),
  });
});
