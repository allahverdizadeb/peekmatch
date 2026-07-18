import { Router } from 'express';
import { prisma } from '../db.js';
import { PACKAGES, highestOwnedPackage, ownedPackages, upgradePriceUsd, type PackageId } from '../lib/pricing.js';
import { resolveAnalysis, respondUnresolved } from '../lib/analysisLifecycle.js';

export const ordersRouter = Router();

ordersRouter.post('/', async (req, res) => {
  const analysisId = req.body.analysisId as string;
  const pkg = Number(req.body.package) as PackageId;
  if (!PACKAGES[pkg]) return res.status(400).json({ error: 'Naməlum paket.' });

  const resolved = await resolveAnalysis(analysisId);
  if (resolved.kind !== 'ok') return respondUnresolved(res, resolved);
  const analysis = resolved.analysis;
  if (analysis.status !== 'done') {
    return res.status(400).json({ error: 'Paket almaq üçün əvvəlcə pulsuz analiz edin.' });
  }

  const owned = highestOwnedPackage(await ownedPackages(analysisId));
  if (owned >= pkg) return res.status(400).json({ error: 'Bu paket artıq alınıb.' });

  const amountUsd = upgradePriceUsd(pkg, owned);
  const order = await prisma.order.create({
    data: { analysisId, package: pkg, amountUsd, status: 'pending' },
  });
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

ordersRouter.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Sifariş tapılmadı.' });
  res.json({ id: order.id, analysisId: order.analysisId, package: order.package, amountUsd: order.amountUsd, status: order.status });
});

// Simulated payment execution: the checkout/redirect/pending/success/failed flow is real
// (real order records, real unlock logic), but the actual charge step is simulated —
// no live payment provider is wired up.
ordersRouter.post('/:id/simulate', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Sifariş tapılmadı.' });
  // Without this guard, re-calling simulate on an already-'paid' order with outcome:'fail' would
  // flip it to 'failed' — since ownedPackages() only counts status:'paid' rows, this would revoke
  // previously-granted paid access on a real, already-completed purchase. Idempotent: an
  // already-resolved order just reports its current status instead of re-processing.
  if (order.status !== 'pending') {
    return res.json({ status: order.status });
  }
  const outcome = req.body.outcome === 'fail' ? 'fail' : 'success';

  await prisma.order.update({ where: { id: order.id }, data: { status: 'processing' } });
  res.json({ status: 'processing' });

  setTimeout(async () => {
    await prisma.order
      .update({
        where: { id: order.id },
        data: outcome === 'success' ? { status: 'paid', paidAt: new Date() } : { status: 'failed' },
      })
      .catch(() => {});
  }, 1400);
});
