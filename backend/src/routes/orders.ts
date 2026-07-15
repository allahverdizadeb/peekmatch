import { Router } from 'express';
import { prisma } from '../db.js';
import { PACKAGES, type PackageId } from '../lib/pricing.js';

export const ordersRouter = Router();

ordersRouter.post('/', async (req, res) => {
  const analysisId = req.body.analysisId as string;
  const pkg = Number(req.body.package) as PackageId;
  if (!PACKAGES[pkg]) return res.status(400).json({ error: 'Naməlum paket.' });

  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) return res.status(404).json({ error: 'Analiz tapılmadı.' });
  if (analysis.status !== 'done') {
    return res.status(400).json({ error: 'Paket almaq üçün əvvəlcə pulsuz analiz edin.' });
  }

  const order = await prisma.order.create({
    data: { analysisId, package: pkg, amountUsd: PACKAGES[pkg].priceUsd, status: 'pending' },
  });
  res.json({ id: order.id, analysisId: order.analysisId, package: order.package, amountUsd: order.amountUsd, status: order.status });
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
