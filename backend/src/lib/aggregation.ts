import { prisma } from '../db.js';
import { resolvePresetRange } from './dateRange.js';
import { REAL_PAYMENT_PROVIDER } from './kpi.js';

async function upsertRollup(granularity: 'hour' | 'day', bucketStart: Date, metricKey: string, value: number, dimension = '') {
  await prisma.metricRollup.upsert({
    where: { granularity_bucketStart_metricKey_dimension: { granularity, bucketStart, metricKey, dimension } },
    update: { value },
    create: { granularity, bucketStart, metricKey, dimension, value },
  });
}

async function computeBucket(startUtc: Date, endUtc: Date, granularity: 'hour' | 'day'): Promise<void> {
  const [visitorRows, analysesStarted, analysesCompleted, paidOrders, grossRevenue] = await Promise.all([
    prisma.event.findMany({
      where: { createdAt: { gte: startUtc, lt: endUtc }, visitorRef: { not: null } },
      distinct: ['visitorRef'],
      select: { visitorRef: true },
    }),
    prisma.event.count({ where: { name: 'analysis_started', createdAt: { gte: startUtc, lt: endUtc } } }),
    prisma.event.count({ where: { name: 'analysis_completed', createdAt: { gte: startUtc, lt: endUtc } } }),
    prisma.order.count({ where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: startUtc, lt: endUtc } } }),
    prisma.order.aggregate({ _sum: { amountUsd: true }, where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: startUtc, lt: endUtc } } }),
  ]);

  await Promise.all([
    upsertRollup(granularity, startUtc, 'unique_visitors', visitorRows.length),
    upsertRollup(granularity, startUtc, 'analyses_started', analysesStarted),
    upsertRollup(granularity, startUtc, 'analyses_completed', analysesCompleted),
    upsertRollup(granularity, startUtc, 'paid_orders', paidOrders),
    upsertRollup(granularity, startUtc, 'gross_revenue_azn', grossRevenue._sum.amountUsd ?? 0),
  ]);
}

/** Recomputes the current + previous hour bucket (cheap; the previous-hour pass catches events that
 * arrived just after that bucket's own tick) and today's Baku-aligned day bucket, on every cleanup
 * cron tick. Each call is a full, idempotent overwrite of the targeted bucket's rows — never
 * incremental — so a crash mid-tick, a retry, or a redeploy just recomputes the same window safely,
 * with no double-counting risk. The KPI service (lib/kpi.ts) currently reads live tables directly
 * rather than this table at this product's current volume — see aggregation strategy notes — so this
 * runs in parallel as real, functioning infrastructure ready to switch reads onto once volume grows. */
export async function recomputeRecentRollups(): Promise<void> {
  const now = Date.now();
  const hourMs = 3_600_000;
  const currentHourStart = new Date(Math.floor(now / hourMs) * hourMs);
  const previousHourStart = new Date(currentHourStart.getTime() - hourMs);
  await computeBucket(previousHourStart, currentHourStart, 'hour');
  await computeBucket(currentHourStart, new Date(currentHourStart.getTime() + hourMs), 'hour');

  const today = resolvePresetRange('today');
  await computeBucket(today.startUtc, today.endUtc, 'day');
}
