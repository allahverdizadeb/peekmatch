import { Router } from 'express';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { getFullFunnel, buildRatioMetric, eventCount, paidOrderCount, distinctVisitorCount, checkoutStartedCount } from '../../lib/adminMetrics.js';
import { formatPercent } from '../../lib/kpi.js';

export const funnelRouter = Router();

funnelRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;

  const [stages, overallConversion, completionRate, checkoutConversion] = await Promise.all([
    getFullFunnel(range),
    buildRatioMetric(paidOrderCount, distinctVisitorCount, range, comparison, 'higher_is_better'),
    buildRatioMetric((r) => eventCount('analysis_completed', r), (r) => eventCount('analysis_started', r), range, comparison, 'higher_is_better'),
    buildRatioMetric(paidOrderCount, checkoutStartedCount, range, comparison, 'higher_is_better'),
  ]);

  const worst = stages.find((s) => s.worst) ?? null;

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    kpis: {
      overallConversion: { ...overallConversion, formatted: overallConversion.missing ? '—' : formatPercent(overallConversion.value ?? 0) },
      biggestDropStage: worst ? { label: worst.label, dropPct: worst.dropPct } : null,
      completionRate,
      checkoutConversion,
    },
    stages,
    biggestDrop: worst,
  });
});
