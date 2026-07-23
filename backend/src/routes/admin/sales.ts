import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { enumerateBuckets, formatBakuDateTime, type ResolvedRange } from '../../lib/dateRange.js';
import { buildMetric, grossRevenue, paidOrderCount, distinctPayingVisitors, getPackageMix, getOrderRows, financialDataAvailable } from '../../lib/adminMetrics.js';
import { formatAzn, formatCount, formatPercent, REAL_PAYMENT_PROVIDER } from '../../lib/kpi.js';
import { toPublicRef, maskReference } from '../../lib/masking.js';
import { PACKAGES } from '../../lib/pricing.js';

export const salesRouter = Router();

async function refundAmount(range: ResolvedRange): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { refundAmountUsd: true },
    where: { provider: REAL_PAYMENT_PROVIDER, refundedAt: { gte: range.startUtc, lt: range.endUtc } },
  });
  return agg._sum.refundAmountUsd ?? 0;
}

salesRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;

  const [revenue, orders, refunds, packages] = await Promise.all([
    buildMetric(grossRevenue, range, comparison, formatAzn, 'higher_is_better'),
    buildMetric(paidOrderCount, range, comparison, formatCount, 'higher_is_better'),
    buildMetric(refundAmount, range, comparison, formatAzn, 'lower_is_better'),
    getPackageMix(range, comparison),
  ]);

  const aov = orders.value && orders.value > 0 && revenue.value !== null ? revenue.value / orders.value : null;
  const payingVisitors = await distinctPayingVisitors(range);
  const arppuValue = payingVisitors > 0 && revenue.value !== null ? revenue.value / payingVisitors : null;
  const refundRateValue = orders.value && orders.value > 0 && refunds.value !== null ? (refunds.value > 0 ? (refunds.value / (revenue.value || 1)) * 100 : 0) : null;

  // Actual provider-fee data is never available today (Payriff not integrated) — Net Collected
  // Revenue must render as unavailable, never estimated from a public commission percentage.
  const netCollectedRevenue = {
    value: null as number | null,
    formatted: '—',
    missing: true,
    trackingStatus: 'Real provayder komissiyası məlumatı əlçatan deyil — heç vaxt təxmin edilmir.',
  };

  const revenueTrend: { bucket: string; value: number }[] = [];
  for (const bucketStart of enumerateBuckets(range)) {
    const stepMs = range.granularity === 'hour' ? 3_600_000 : 86_400_000;
    const bucketRange: ResolvedRange = { startUtc: bucketStart, endUtc: new Date(bucketStart.getTime() + stepMs), granularity: range.granularity };
    revenueTrend.push({ bucket: formatBakuDateTime(bucketStart), value: await grossRevenue(bucketRange) });
  }

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
    kpis: {
      grossRevenue: revenue,
      paidOrders: orders,
      averageOrderValue: { value: aov, formatted: aov === null ? '—' : formatAzn(aov), missing: aov === null },
      arppu: { value: arppuValue, formatted: arppuValue === null ? '—' : formatAzn(arppuValue), missing: arppuValue === null },
      refundAmount: refunds,
      refundRate: { value: refundRateValue, formatted: refundRateValue === null ? '—' : formatPercent(refundRateValue), missing: refundRateValue === null },
      netCollectedRevenue,
    },
    revenueTrend,
    revenueByPackage: packages,
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
        analysisRef: maskReference(toPublicRef('AN', o.analysisId)),
      })),
    },
  });
});
