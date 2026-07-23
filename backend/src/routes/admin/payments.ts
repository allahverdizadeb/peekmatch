import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { getOrderRows, financialDataAvailable } from '../../lib/adminMetrics.js';
import { formatAzn, formatCount, formatPercent, REAL_PAYMENT_PROVIDER } from '../../lib/kpi.js';
import { formatBakuDateTime } from '../../lib/dateRange.js';
import { toPublicRef, maskReference, ensureOrderPublicReference } from '../../lib/masking.js';
import { PACKAGES } from '../../lib/pricing.js';
import { getPaymentProviderStatus } from '../../lib/paymentProvider.js';
import { recordAudit } from '../../lib/auditLog.js';
import { maskRequestId } from '../../lib/superadminAuth.js';

export const paymentsRouter = Router();

paymentsRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;

  const [succeeded, failed, pending, refunded] = await Promise.all([
    prisma.order.count({ where: { provider: REAL_PAYMENT_PROVIDER, status: 'paid', paidAt: { gte: range.startUtc, lt: range.endUtc } } }),
    prisma.order.count({ where: { provider: REAL_PAYMENT_PROVIDER, status: 'failed', failedAt: { gte: range.startUtc, lt: range.endUtc } } }),
    prisma.order.count({ where: { provider: REAL_PAYMENT_PROVIDER, status: { in: ['pending', 'processing'] }, createdAt: { gte: range.startUtc, lt: range.endUtc } } }),
    prisma.order.count({ where: { provider: REAL_PAYMENT_PROVIDER, refundedAt: { gte: range.startUtc, lt: range.endUtc } } }),
  ]);
  const attempts = succeeded + failed;
  const successRatePct = attempts > 0 ? (succeeded / attempts) * 100 : null;

  const grossAgg = await prisma.order.aggregate({
    _sum: { amountUsd: true },
    where: { provider: REAL_PAYMENT_PROVIDER, status: 'paid', paidAt: { gte: range.startUtc, lt: range.endUtc } },
  });
  const feeAgg = await prisma.order.aggregate({
    _sum: { providerFeeAmount: true },
    _count: { providerFeeAmount: true },
    where: { provider: REAL_PAYMENT_PROVIDER, status: 'paid', paidAt: { gte: range.startUtc, lt: range.endUtc }, providerFeeAmount: { not: null } },
  });
  const feesKnownForAll = succeeded === 0 || feeAgg._count.providerFeeAmount === succeeded;
  const gross = grossAgg._sum.amountUsd ?? 0;
  const fees = feeAgg._sum.providerFeeAmount ?? 0;
  const netAvailable = feesKnownForAll && succeeded > 0;

  // Average confirmation time: paidAt - checkoutStartedAt, over orders with both timestamps.
  const confirmedOrders = await prisma.order.findMany({
    where: { provider: REAL_PAYMENT_PROVIDER, status: 'paid', paidAt: { gte: range.startUtc, lt: range.endUtc }, checkoutStartedAt: { not: null } },
    select: { paidAt: true, checkoutStartedAt: true },
  });
  const avgConfirmMs =
    confirmedOrders.length > 0
      ? confirmedOrders.reduce((sum, o) => sum + (o.paidAt!.getTime() - o.checkoutStartedAt!.getTime()), 0) / confirmedOrders.length
      : null;

  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 25;
  const pkgFilter = req.query.package === '1' ? 1 : req.query.package === '2' ? 2 : undefined;
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
  const providerFilter = req.query.provider === 'simulated' ? 'simulated' : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const { rows, total } = await getOrderRows(range, { package: pkgFilter, status: statusFilter, provider: providerFilter, search, page, pageSize });

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    financialDataAvailable: financialDataAvailable(),
    provider: getPaymentProviderStatus(),
    kpis: {
      succeeded: { value: succeeded, formatted: formatCount(succeeded) },
      failed: { value: failed, formatted: formatCount(failed) },
      pending: { value: pending, formatted: formatCount(pending) },
      refunded: { value: refunded, formatted: formatCount(refunded) },
      successRate: { value: successRatePct, formatted: successRatePct === null ? '—' : formatPercent(successRatePct), missing: successRatePct === null },
      grossAmount: { value: gross, formatted: formatAzn(gross) },
      providerFees: {
        value: netAvailable ? fees : null,
        formatted: netAvailable ? formatAzn(fees) : '—',
        missing: !netAvailable,
        trackingStatus: netAvailable ? undefined : 'Real provayder komissiyası məlumatı əlçatan deyil — heç vaxt təxmin edilmir.',
      },
      netCollected: {
        value: netAvailable ? gross - fees : null,
        formatted: netAvailable ? formatAzn(gross - fees) : '—',
        missing: !netAvailable,
        trackingStatus: netAvailable ? undefined : 'Komissiya məlumatı olmadan hesablana bilmir.',
      },
      avgConfirmationTime: {
        value: avgConfirmMs,
        formatted: avgConfirmMs === null ? '—' : `${(avgConfirmMs / 1000).toFixed(1)}s`,
        missing: avgConfirmMs === null,
      },
    },
    statusDistribution: [
      { status: 'paid', count: succeeded },
      { status: 'failed', count: failed },
      { status: 'pending', count: pending },
      { status: 'refunded', count: refunded },
    ],
    orders: {
      page,
      pageSize,
      total,
      rows: rows.map((o) => ({
        reference: o.publicReference,
        maskedReference: o.publicReference ? maskReference(o.publicReference) : '—',
        time: formatBakuDateTime(o.createdAt),
        packageCode: `package_${o.package}`,
        packageName: PACKAGES[o.package as 1 | 2]?.name ?? String(o.package),
        amountFormatted: formatAzn(o.amountUsd),
        status: o.status,
        provider: o.provider ?? 'simulated',
        confirmedAt: o.paidAt ? formatBakuDateTime(o.paidAt) : null,
      })),
    },
  });
});

paymentsRouter.get('/:reference', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { publicReference: req.params.reference }, include: { analysis: true } });
  if (!order) return res.status(404).json({ error: 'Ödəniş tapılmadı.' });

  await recordAudit({
    action: 'payment_detail_viewed',
    status: 'success',
    actorId: req.superadmin?.userId,
    requestIdHash: maskRequestId(req),
    metadata: { reference: order.publicReference ?? (await ensureOrderPublicReference(order)) },
  });

  const history: { status: string; at: string }[] = [];
  history.push({ status: 'checkout_started', at: formatBakuDateTime(order.checkoutStartedAt ?? order.createdAt) });
  if (order.paidAt) history.push({ status: 'paid', at: formatBakuDateTime(order.paidAt) });
  if (order.failedAt) history.push({ status: 'failed', at: formatBakuDateTime(order.failedAt) });
  if (order.refundedAt) history.push({ status: 'refunded', at: formatBakuDateTime(order.refundedAt) });

  res.json({
    reference: order.publicReference,
    provider: order.provider ?? 'simulated',
    providerTransactionRef: order.providerTransactionRef,
    packageCode: `package_${order.package}`,
    packageName: PACKAGES[order.package as 1 | 2]?.name ?? String(order.package),
    amountFormatted: formatAzn(order.amountUsd),
    status: order.status,
    statusHistory: history,
    checkoutStartedAt: order.checkoutStartedAt ? formatBakuDateTime(order.checkoutStartedAt) : null,
    confirmedAt: order.paidAt ? formatBakuDateTime(order.paidAt) : null,
    failedAt: order.failedAt ? formatBakuDateTime(order.failedAt) : null,
    refundedAt: order.refundedAt ? formatBakuDateTime(order.refundedAt) : null,
    refundAmountFormatted: order.refundAmountUsd > 0 ? formatAzn(order.refundAmountUsd) : null,
    failureCode: order.failureCode,
    analysisRef: maskReference(toPublicRef('AN', order.analysisId)),
    entitlementStatus: order.status === 'paid' ? 'active' : 'not_active',
    providerFeeFormatted: order.providerFeeAmount !== null ? formatAzn(order.providerFeeAmount) : null,
  });
});
