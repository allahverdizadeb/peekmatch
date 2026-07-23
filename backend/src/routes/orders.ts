import { Router } from 'express';
import { prisma } from '../db.js';
import { PACKAGES, highestOwnedPackage, ownedPackages, upgradePriceUsd, packageCode, type PackageId } from '../lib/pricing.js';
import { resolveAnalysis, respondUnresolved } from '../lib/analysisLifecycle.js';
import { ENTITLEMENT_WINDOW_MS } from '../lib/entitlement.js';
import { recordEvent } from '../lib/analyticsIngest.js';
import { generateUniqueReference } from '../lib/masking.js';

export const ordersRouter = Router();

ordersRouter.post('/', async (req, res) => {
  const analysisId = req.body.analysisId as string;
  const pkg = Number(req.body.package) as PackageId;
  if (!PACKAGES[pkg]) return res.status(400).json({ error: 'Naməlum paket.' });

  const resolved = await resolveAnalysis(analysisId, req.sessionId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  if (analysis.status !== 'done') {
    return res.status(400).json({ error: 'Paket almaq üçün əvvəlcə pulsuz analiz edin.' });
  }

  const owned = highestOwnedPackage(await ownedPackages(analysisId));
  if (owned >= pkg) return res.status(400).json({ error: 'Bu paket artıq alınıb.' });

  const amountUsd = upgradePriceUsd(pkg, owned);
  const publicReference = await generateUniqueReference('PM', async (candidate) => {
    const existing = await prisma.order.findUnique({ where: { publicReference: candidate } });
    return existing !== null;
  });
  const order = await prisma.order.create({
    data: { analysisId, package: pkg, amountUsd, status: 'pending', publicReference, checkoutStartedAt: new Date() },
  });

  // Server-authoritative: fires only once a real Order row actually exists, not on a page view.
  recordEvent({
    name: 'checkout_started',
    analysisId,
    visitorRef: req.sessionId ?? null,
    packageCode: packageCode(pkg),
    metadata: { isUpgrade: owned > 0 },
    source: 'server',
  }).catch(() => {});

  res.json({
    id: order.id,
    analysisId: order.analysisId,
    package: order.package,
    amountUsd: order.amountUsd,
    status: order.status,
    basePriceUsd: PACKAGES[pkg].priceUsd,
    creditUsd: owned === 0 ? 0 : PACKAGES[owned].priceUsd,
  });
});

/** Loads an order and verifies the CALLER's session owns the analysis it belongs to — same IDOR
 * protection as resolveAnalysis(), applied here too since an order id is a second UUID that could
 * otherwise be guessed/enumerated independently of its analysis id. Returns null (after already
 * responding 404) when not found or not owned — deliberately the same generic 404 for both, for
 * the same reason resolveAnalysis() folds 'forbidden' into 'not_found'. */
async function loadOwnedOrder(req: import('express').Request<{ id: string }>, res: import('express').Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    res.status(404).json({ error: 'Sifariş tapılmadı.' });
    return null;
  }
  const analysis = await prisma.analysis.findUnique({ where: { id: order.analysisId } });
  if (!analysis || (analysis.anonymousSessionId && analysis.anonymousSessionId !== req.sessionId)) {
    res.status(404).json({ error: 'Sifariş tapılmadı.' });
    return null;
  }
  return { order, analysis };
}

ordersRouter.get('/:id', async (req, res) => {
  const loaded = await loadOwnedOrder(req, res);
  if (!loaded) return;
  const { order } = loaded;
  res.json({ id: order.id, analysisId: order.analysisId, package: order.package, amountUsd: order.amountUsd, status: order.status });
});

// Simulated payment execution: the checkout/redirect/pending/success/failed flow is real
// (real order records, real unlock logic), but the actual charge step is simulated —
// no live payment provider is wired up.
ordersRouter.post('/:id/simulate', async (req, res) => {
  const loaded = await loadOwnedOrder(req, res);
  if (!loaded) return;
  const { order } = loaded;
  // Without this guard, re-calling simulate on an already-'paid' order with outcome:'fail' would
  // flip it to 'failed' — since ownedPackages() only counts status:'paid' rows, this would revoke
  // previously-granted paid access on a real, already-completed purchase. Idempotent: an
  // already-resolved order just reports its current status instead of re-processing. This is also
  // what makes a duplicated/replayed webhook-style call safe — a second call for the same order
  // can never grant a second entitlement window or a second charge.
  if (order.status !== 'pending') {
    return res.json({ status: order.status });
  }
  const outcome = req.body.outcome === 'fail' ? 'fail' : 'success';

  await prisma.order.update({ where: { id: order.id }, data: { status: 'processing' } });
  res.json({ status: 'processing' });

  setTimeout(async () => {
    if (outcome !== 'success') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'failed', failedAt: new Date() } }).catch(() => {});
      recordEvent({
        name: 'payment_failed',
        analysisId: order.analysisId,
        packageCode: packageCode(order.package as PackageId),
        metadata: { failureCategory: 'simulated_failure' },
        source: 'server',
      }).catch(() => {});
      return;
    }
    const paidAt = new Date();
    await prisma.order.update({ where: { id: order.id }, data: { status: 'paid', paidAt } }).catch(() => {});
    // provider stays null here (this is the pre-existing demo simulation, not a real Payriff charge)
    // — Superadmin financial KPIs deliberately only ever count provider:'payriff' rows, so this event
    // is recorded for catalogue completeness but never counted as real revenue. See kpi.ts.
    recordEvent({
      name: 'payment_succeeded',
      analysisId: order.analysisId,
      packageCode: packageCode(order.package as PackageId),
      metadata: { amount: order.amountUsd, provider: 'simulated' },
      source: 'server',
    }).catch(() => {});

    // Entitlement window is anchored to the FIRST successful order for this analysis — an upgrade
    // purchase (package 2 after already owning 1) must not reset the clock, or a user could keep
    // extending their own access forever by repeatedly "upgrading." updateMany's WHERE guards this
    // atomically: only fires if paidAt is still null, so a second concurrent/duplicate payment for
    // the same analysis is a no-op here even if it raced past the order-status guard above.
    const entitlementExpiresAt = new Date(paidAt.getTime() + ENTITLEMENT_WINDOW_MS);
    const analysis = await prisma.analysis.findUnique({ where: { id: order.analysisId } });
    if (!analysis) return;
    await prisma.analysis
      .updateMany({
        where: { id: order.analysisId, paidAt: null },
        data: {
          paidAt,
          entitlementExpiresAt,
          // Bump the data-retention clock to match, so a just-paid analysis isn't hard-deleted by
          // the creation-time-based cleanup cron while its entitlement is still active. Never
          // shortens it — only extends if the entitlement window is later than the current value.
          ...(entitlementExpiresAt.getTime() > analysis.expiresAt.getTime() ? { expiresAt: entitlementExpiresAt } : {}),
        },
      })
      .catch((err) => console.error('[orders] entitlement grant failed', err instanceof Error ? err.message : err));
  }, 1400);
});
