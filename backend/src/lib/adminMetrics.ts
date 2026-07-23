import { prisma } from '../db.js';
import type { ResolvedRange } from './dateRange.js';
import { REAL_PAYMENT_PROVIDER, computeDelta, type DirectionRule, type Metric, metricFrom, formatAzn, formatCount, formatPercent } from './kpi.js';
import { PACKAGES, packageCode, type PackageId } from './pricing.js';
import { isPayriffConfigured } from './paymentProvider.js';

// ---------- shared range-scoped primitives ----------
// Every Superadmin financial figure (revenue, paid-order counts, package mix, payment ops) filters
// to `provider: REAL_PAYMENT_PROVIDER` ('payriff') ONLY — see schema.prisma's Order doc-comment and
// kpi.ts's REAL_PAYMENT_PROVIDER constant for the full rationale: demo/simulated orders (provider:
// null) never count as real revenue, so these figures read as a genuine zero/empty state until a
// real Payriff connection exists, regardless of what's already in the Order table.

export function financialDataAvailable(): boolean {
  return isPayriffConfigured();
}

export async function distinctVisitorCount(range: ResolvedRange): Promise<number> {
  const rows = await prisma.event.findMany({
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc }, visitorRef: { not: null } },
    distinct: ['visitorRef'],
    select: { visitorRef: true },
  });
  return rows.length;
}

export async function eventCount(name: string, range: ResolvedRange): Promise<number> {
  return prisma.event.count({ where: { name, createdAt: { gte: range.startUtc, lt: range.endUtc } } });
}

export async function paidOrderCount(range: ResolvedRange): Promise<number> {
  return prisma.order.count({ where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } } });
}

export async function grossRevenue(range: ResolvedRange): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { amountUsd: true },
    where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } },
  });
  return agg._sum.amountUsd ?? 0;
}

export async function distinctPayingVisitors(range: ResolvedRange): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } },
    select: { analysis: { select: { anonymousSessionId: true } } },
  });
  return new Set(orders.map((o) => o.analysis.anonymousSessionId).filter((v): v is string => Boolean(v))).size;
}

export async function checkoutStartedCount(range: ResolvedRange): Promise<number> {
  return prisma.order.count({ where: { checkoutStartedAt: { gte: range.startUtc, lt: range.endUtc } } });
}

/** Builds a full Metric (value + formatted + delta) from a same-shaped fetcher run over both the
 * primary and (optional) comparison range — the one repeated pattern behind every KPI card. */
export async function buildMetric(
  fetch: (range: ResolvedRange) => Promise<number>,
  range: ResolvedRange,
  comparison: ResolvedRange | null,
  format: (v: number) => string,
  rule: DirectionRule,
): Promise<Metric> {
  const current = await fetch(range);
  const previous = comparison ? await fetch(comparison) : null;
  return metricFrom(current, format, computeDelta(current, previous, rule));
}

export interface RatioMetric extends Metric {
  numerator: number;
  denominator: number;
}

export async function buildRatioMetric(
  fetchNumerator: (range: ResolvedRange) => Promise<number>,
  fetchDenominator: (range: ResolvedRange) => Promise<number>,
  range: ResolvedRange,
  comparison: ResolvedRange | null,
  rule: DirectionRule,
): Promise<RatioMetric> {
  const [num, den] = await Promise.all([fetchNumerator(range), fetchDenominator(range)]);
  const value = den > 0 ? (num / den) * 100 : null;
  let delta = null;
  if (comparison) {
    const [prevNum, prevDen] = await Promise.all([fetchNumerator(comparison), fetchDenominator(comparison)]);
    const prevValue = prevDen > 0 ? (prevNum / prevDen) * 100 : null;
    delta = value !== null ? computeDelta(value, prevValue, rule) : null;
  }
  const metric = metricFrom(value, formatPercent, delta, den === 0 ? 'Bu dövrdə məxrəc üçün kifayət qədər məlumat yoxdur.' : undefined);
  return { ...metric, numerator: num, denominator: den };
}

// ---------- package mix (real, provider-gated) ----------
export interface PackageMixRow {
  code: string;
  name: string;
  priceAzn: number;
  units: number;
  revenueAzn: number;
  orderSharePct: number;
  revenueSharePct: number;
  delta: ReturnType<typeof computeDelta>;
}

export async function getPackageMix(range: ResolvedRange, comparison: ResolvedRange | null): Promise<PackageMixRow[]> {
  const ids: PackageId[] = [1, 2];
  const currentByPkg = await Promise.all(
    ids.map((pkg) =>
      prisma.order.aggregate({
        _count: true,
        _sum: { amountUsd: true },
        where: { package: pkg, status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } },
      }),
    ),
  );
  const previousByPkg = comparison
    ? await Promise.all(
        ids.map((pkg) =>
          prisma.order.aggregate({
            _count: true,
            _sum: { amountUsd: true },
            where: { package: pkg, status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: comparison.startUtc, lt: comparison.endUtc } },
          }),
        ),
      )
    : null;

  const totalUnits = currentByPkg.reduce((s, r) => s + r._count, 0) || 1;
  const totalRevenue = currentByPkg.reduce((s, r) => s + (r._sum.amountUsd ?? 0), 0) || 1;

  return ids.map((pkg, i) => {
    const cur = currentByPkg[i];
    const revenue = cur._sum.amountUsd ?? 0;
    const prevRevenue = previousByPkg ? (previousByPkg[i]._sum.amountUsd ?? 0) : null;
    return {
      code: packageCode(pkg),
      name: PACKAGES[pkg].name,
      priceAzn: PACKAGES[pkg].priceUsd,
      units: cur._count,
      revenueAzn: revenue,
      orderSharePct: (cur._count / totalUnits) * 100,
      revenueSharePct: (revenue / totalRevenue) * 100,
      delta: computeDelta(revenue, prevRevenue, 'higher_is_better'),
    };
  });
}

// ---------- overview funnel ----------
export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  stepConversionPct: number | null;
  topConversionPct: number | null;
  dropPct: number | null;
  worst: boolean;
}

function buildFunnelStages(counts: number[], keys: string[], labels: string[]): FunnelStage[] {
  const top = counts[0] || 0;
  const stages: FunnelStage[] = counts.map((count, i) => {
    const prev = i > 0 ? counts[i - 1] : null;
    const stepConversionPct = prev && prev > 0 ? (count / prev) * 100 : null;
    const topConversionPct = top > 0 ? (count / top) * 100 : null;
    const dropPct = prev && prev > 0 ? 100 - (count / prev) * 100 : null;
    return { key: keys[i], label: labels[i], count, stepConversionPct, topConversionPct, dropPct, worst: false };
  });
  let worstIndex = -1;
  let worstDrop = -1;
  for (let i = 1; i < stages.length; i++) {
    const drop = stages[i].dropPct;
    if (drop !== null && drop > worstDrop) {
      worstDrop = drop;
      worstIndex = i;
    }
  }
  if (worstIndex >= 0) stages[worstIndex].worst = true;
  return stages;
}

export async function getOverviewFunnel(range: ResolvedRange): Promise<FunnelStage[]> {
  const [visitors, started, completed, viewed, checkout, paid] = await Promise.all([
    distinctVisitorCount(range),
    eventCount('analysis_started', range),
    eventCount('analysis_completed', range),
    eventCount('package_section_viewed', range),
    checkoutStartedCount(range),
    paidOrderCount(range),
  ]);
  return buildFunnelStages(
    [visitors, started, completed, viewed, checkout, paid],
    ['visitor', 'analysis_started', 'analysis_completed', 'package_viewed', 'checkout_started', 'payment_successful'],
    ['Unikal ziyarətçi', 'Analiz başladı', 'Analiz tamamlandı', 'Paket baxışı', 'Ödəniş başladı', 'Uğurlu ödəniş'],
  );
}

export async function getFullFunnel(range: ResolvedRange): Promise<FunnelStage[]> {
  const [visitors, cvUploaded, vacancyAdded, started, completed, viewed, selected, checkout, paid] = await Promise.all([
    distinctVisitorCount(range),
    eventCount('cv_upload_completed', range),
    eventCount('vacancy_added', range),
    eventCount('analysis_started', range),
    eventCount('analysis_completed', range),
    eventCount('package_section_viewed', range),
    eventCount('package_selected', range),
    checkoutStartedCount(range),
    paidOrderCount(range),
  ]);
  return buildFunnelStages(
    [visitors, cvUploaded, vacancyAdded, started, completed, viewed, selected, checkout, paid],
    ['visitor', 'cv_uploaded', 'vacancy_added', 'analysis_started', 'analysis_completed', 'package_viewed', 'package_selected', 'checkout_started', 'payment_successful'],
    [
      'Unikal ziyarətçi',
      'CV yükləndi',
      'Vakansiya əlavə edildi',
      'Analiz başladı',
      'Analiz tamamlandı',
      'Paket baxışı',
      'Paket seçildi',
      'Checkout başladı',
      'Uğurlu ödəniş',
    ],
  );
}

// ---------- paginated order rows (Sales / Payments / CSV export share this) ----------
export interface OrderFilters {
  package?: 1 | 2;
  status?: string;
  provider?: 'payriff' | 'simulated';
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Defaults to real Payriff-provider orders only, matching every other Superadmin financial figure —
 * `provider=simulated` is an explicit, opt-in filter for founder debugging/transparency, never the
 * default view, so the page's default state stays consistent with "zero/empty until connected." */
export async function getOrderRows(range: ResolvedRange, filters: OrderFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const providerFilter = filters.provider === 'simulated' ? null : REAL_PAYMENT_PROVIDER;

  const where = {
    createdAt: { gte: range.startUtc, lt: range.endUtc },
    provider: providerFilter,
    ...(filters.package ? { package: filters.package } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { OR: [{ publicReference: { contains: filters.search } }, { analysisId: { contains: filters.search } }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { analysis: { select: { id: true, vacancyDomain: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export { formatAzn, formatCount, formatPercent };
