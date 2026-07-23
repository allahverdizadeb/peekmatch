import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { eventCount, getPackageMix, financialDataAvailable } from '../../lib/adminMetrics.js';
import { formatPercent, REAL_PAYMENT_PROVIDER } from '../../lib/kpi.js';
import { PACKAGES, packageCode, type PackageId } from '../../lib/pricing.js';
import type { ResolvedRange } from '../../lib/dateRange.js';

export const packagesRouter = Router();

async function packageSelectedCount(pkg: PackageId, range: ResolvedRange): Promise<number> {
  return prisma.event.count({
    where: { name: 'package_selected', createdAt: { gte: range.startUtc, lt: range.endUtc }, packageCode: packageCode(pkg) },
  });
}

async function packagePurchaseCount(pkg: PackageId, range: ResolvedRange): Promise<number> {
  return prisma.order.count({
    where: { package: pkg, status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } },
  });
}

async function packagePaymentAttempts(pkg: PackageId, range: ResolvedRange): Promise<{ succeeded: number; failed: number }> {
  const [succeeded, failed] = await Promise.all([
    prisma.order.count({ where: { package: pkg, status: 'paid', provider: REAL_PAYMENT_PROVIDER, paidAt: { gte: range.startUtc, lt: range.endUtc } } }),
    prisma.order.count({ where: { package: pkg, status: 'failed', provider: REAL_PAYMENT_PROVIDER, failedAt: { gte: range.startUtc, lt: range.endUtc } } }),
  ]);
  return { succeeded, failed };
}

packagesRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;
  const ids: PackageId[] = [1, 2];

  const mix = await getPackageMix(range, comparison);

  const rows = await Promise.all(
    ids.map(async (pkg) => {
      const [views, selections, purchases, attempts] = await Promise.all([
        eventCount('package_section_viewed', range),
        packageSelectedCount(pkg, range),
        packagePurchaseCount(pkg, range),
        packagePaymentAttempts(pkg, range),
      ]);
      const mixRow = mix.find((m) => m.code === packageCode(pkg))!;
      const selectionToPurchasePct = selections > 0 ? (purchases / selections) * 100 : null;
      const paymentSuccessRatePct = attempts.succeeded + attempts.failed > 0 ? (attempts.succeeded / (attempts.succeeded + attempts.failed)) * 100 : null;
      return {
        code: packageCode(pkg),
        name: PACKAGES[pkg].name,
        priceAzn: PACKAGES[pkg].priceUsd,
        sectionViews: views,
        selections,
        checkoutStarts: null as number | null, // per-package checkout-start split not separately tracked yet
        purchases,
        failedPayments: attempts.failed,
        revenueAzn: mixRow.revenueAzn,
        revenueSharePct: mixRow.revenueSharePct,
        orderSharePct: mixRow.orderSharePct,
        selectionToPurchase: { value: selectionToPurchasePct, formatted: selectionToPurchasePct === null ? '—' : formatPercent(selectionToPurchasePct) },
        paymentSuccessRate: { value: paymentSuccessRatePct, formatted: paymentSuccessRatePct === null ? '—' : formatPercent(paymentSuccessRatePct) },
        delta: mixRow.delta,
      };
    }),
  );

  // Comparative labels — every one names its own criterion, never a bare "best".
  const labels: { code: string; label: string; criterion: string }[] = [];
  const bySelections = [...rows].sort((a, b) => b.selections - a.selections)[0];
  const byRevenue = [...rows].sort((a, b) => b.revenueAzn - a.revenueAzn)[0];
  if (bySelections && bySelections.selections > 0) labels.push({ code: bySelections.code, label: 'Daha çox seçilir', criterion: 'paket seçimi sayı' });
  if (byRevenue && byRevenue.revenueAzn > 0) labels.push({ code: byRevenue.code, label: 'Daha çox gəlir yaradır', criterion: 'gəlir (AZN)' });
  const byConversion = [...rows].filter((r) => r.selectionToPurchase.value !== null).sort((a, b) => (b.selectionToPurchase.value ?? 0) - (a.selectionToPurchase.value ?? 0))[0];
  if (byConversion) labels.push({ code: byConversion.code, label: 'Daha yüksək konversiya', criterion: 'seçim→alış nisbəti' });

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    financialDataAvailable: financialDataAvailable(),
    packages: rows,
    labels,
  });
});
