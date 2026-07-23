import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { enumerateBuckets, formatBakuDateTime, bakuHour, type ResolvedRange } from '../../lib/dateRange.js';
import {
  buildMetric,
  buildRatioMetric,
  distinctVisitorCount,
  eventCount,
  paidOrderCount,
  grossRevenue,
  distinctPayingVisitors,
  getPackageMix,
  getOverviewFunnel,
  financialDataAvailable,
} from '../../lib/adminMetrics.js';
import { formatAzn, formatCount, REAL_PAYMENT_PROVIDER } from '../../lib/kpi.js';
import { toPublicRef, maskReference } from '../../lib/masking.js';
import { PACKAGES } from '../../lib/pricing.js';

export const overviewRouter = Router();

const TREND_METRICS = ['revenue', 'visitors', 'analyses', 'paid_orders', 'conversion'] as const;
type TrendMetric = (typeof TREND_METRICS)[number];

async function trendSeriesFor(metric: TrendMetric, range: ResolvedRange): Promise<{ bucket: string; value: number }[]> {
  const buckets = enumerateBuckets(range);
  const stepMs = range.granularity === 'hour' ? 3_600_000 : 86_400_000;
  const series: { bucket: string; value: number }[] = [];
  for (const bucketStart of buckets) {
    const bucketRange: ResolvedRange = { startUtc: bucketStart, endUtc: new Date(bucketStart.getTime() + stepMs), granularity: range.granularity };
    let value = 0;
    if (metric === 'revenue') value = await grossRevenue(bucketRange);
    else if (metric === 'visitors') value = await distinctVisitorCount(bucketRange);
    else if (metric === 'analyses') value = await eventCount('analysis_completed', bucketRange);
    else if (metric === 'paid_orders') value = await paidOrderCount(bucketRange);
    else if (metric === 'conversion') {
      const [paid, completed] = await Promise.all([paidOrderCount(bucketRange), eventCount('analysis_completed', bucketRange)]);
      value = completed > 0 ? (paid / completed) * 100 : 0;
    }
    series.push({ bucket: formatBakuDateTime(bucketStart), value });
  }
  return series;
}

overviewRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;
  const requestedMetric = TREND_METRICS.includes(req.query.metric as TrendMetric) ? (req.query.metric as TrendMetric) : 'revenue';

  const [uniqueVisitors, completedAnalyses, paidOrders, revenue, freeToPaid, arppuNumerator, arppuDenominator, trend, comparisonTrend, packages, funnel] =
    await Promise.all([
      buildMetric(distinctVisitorCount, range, comparison, formatCount, 'higher_is_better'),
      buildMetric((r) => eventCount('analysis_completed', r), range, comparison, formatCount, 'higher_is_better'),
      buildMetric(paidOrderCount, range, comparison, formatCount, 'higher_is_better'),
      buildMetric(grossRevenue, range, comparison, formatAzn, 'higher_is_better'),
      buildRatioMetric(paidOrderCount, (r) => eventCount('analysis_completed', r), range, comparison, 'higher_is_better'),
      grossRevenue(range),
      distinctPayingVisitors(range),
      trendSeriesFor(requestedMetric, range),
      comparison ? trendSeriesFor(requestedMetric, comparison) : Promise.resolve(null),
      getPackageMix(range, comparison),
      getOverviewFunnel(range),
    ]);

  const arppuValue = arppuDenominator > 0 ? arppuNumerator / arppuDenominator : null;
  const arppu = { value: arppuValue, formatted: arppuValue === null ? '—' : formatAzn(arppuValue), delta: null, missing: arppuValue === null };

  let hourly: { visitors: number[]; completedAnalyses: number[]; payments: number[] } | null = null;
  if (range.granularity === 'hour') {
    const buckets = enumerateBuckets(range);
    const visitors: number[] = Array.from({ length: 24 }, () => 0);
    const completed: number[] = Array.from({ length: 24 }, () => 0);
    const payments: number[] = Array.from({ length: 24 }, () => 0);
    for (const bucketStart of buckets) {
      const hour = bakuHour(bucketStart);
      const bucketRange: ResolvedRange = { startUtc: bucketStart, endUtc: new Date(bucketStart.getTime() + 3_600_000), granularity: 'hour' };
      const [v, c, p] = await Promise.all([distinctVisitorCount(bucketRange), eventCount('analysis_completed', bucketRange), paidOrderCount(bucketRange)]);
      visitors[hour] = v;
      completed[hour] = c;
      payments[hour] = p;
    }
    hourly = { visitors, completedAnalyses: completed, payments };
  }

  const recentOrders = await prisma.order.findMany({
    where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } },
    orderBy: { paidAt: 'desc' },
    take: 10,
    include: { analysis: { select: { id: true, vacancyDomain: true } } },
  });

  const recentSales = recentOrders.map((o) => ({
    time: formatBakuDateTime(o.paidAt ?? o.createdAt),
    packageCode: `package_${o.package}`,
    packageName: PACKAGES[o.package as 1 | 2]?.name ?? String(o.package),
    amountFormatted: formatAzn(o.amountUsd),
    status: o.status,
    provider: o.provider,
    analysisRef: maskReference(toPublicRef('AN', o.analysisId)),
  }));

  const financialAvailable = financialDataAvailable();

  // Deterministic, threshold-based alerts — no LLM, no speculative business explanations. Minimum
  // sample sizes avoid noisy alerts on near-zero volume.
  const alerts: { severity: 'negative' | 'warning' | 'positive'; title: string; body: string; link: string }[] = [];
  if (!financialAvailable) {
    alerts.push({
      severity: 'warning',
      title: 'Ödəniş provayderi qoşulmayıb',
      body: 'Payriff hələ qoşulmayıb — gəlir və ödəniş göstəriciləri real inteqrasiya aktiv olana qədər sıfır/əlçatan deyil kimi göstərilir.',
      link: '/superadmin/payments',
    });
  }
  if (uniqueVisitors.value !== null && uniqueVisitors.value >= 20 && paidOrders.value === 0 && financialAvailable) {
    alerts.push({
      severity: 'warning',
      title: 'Trafik var, satış yoxdur',
      body: `Bu dövrdə ${formatCount(uniqueVisitors.value)} unikal ziyarətçi olub, lakin heç bir ödənişli sifariş qeydə alınmayıb.`,
      link: '/superadmin/funnel',
    });
  }

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    refreshedAt: new Date().toISOString(),
    financialDataAvailable: financialAvailable,
    kpis: { uniqueVisitors, completedAnalyses, paidOrders, grossRevenue: revenue, freeToPaidConversion: freeToPaid, arppu },
    trend: { metric: requestedMetric, series: trend, comparisonSeries: comparisonTrend },
    packages,
    funnel,
    hourly,
    recentSales,
    alerts,
    insights: [],
  });
});
