import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { eventCount, buildRatioMetric } from '../../lib/adminMetrics.js';
import { formatCount, formatPercent } from '../../lib/kpi.js';
import type { ResolvedRange } from '../../lib/dateRange.js';

export const analysisActivityRouter = Router();

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function processingDurations(range: ResolvedRange): Promise<number[]> {
  const events = await prisma.event.findMany({
    where: { name: 'analysis_completed', createdAt: { gte: range.startUtc, lt: range.endUtc } },
    select: { metadata: true },
  });
  const durations: number[] = [];
  for (const e of events) {
    if (!e.metadata) continue;
    try {
      const parsed = JSON.parse(e.metadata) as { processingMs?: number };
      if (typeof parsed.processingMs === 'number') durations.push(parsed.processingMs);
    } catch {
      // ignore malformed metadata
    }
  }
  return durations;
}

async function deletionSplit(range: ResolvedRange): Promise<{ manual: number; system: number }> {
  const events = await prisma.event.findMany({
    where: { name: 'analysis_deleted', createdAt: { gte: range.startUtc, lt: range.endUtc } },
    select: { metadata: true },
  });
  let manual = 0;
  let system = 0;
  for (const e of events) {
    try {
      const parsed = e.metadata ? (JSON.parse(e.metadata) as { initiator?: string }) : {};
      if (parsed.initiator === 'system') system++;
      else manual++;
    } catch {
      manual++;
    }
  }
  return { manual, system };
}

analysisActivityRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range, comparison } = parsed;

  const [started, completed, failed, completionRate, durations, deletions, entitlementExpired, paidResultViews, sessionRestorations] = await Promise.all([
    eventCount('analysis_started', range),
    eventCount('analysis_completed', range),
    eventCount('analysis_failed', range),
    buildRatioMetric((r) => eventCount('analysis_completed', r), (r) => eventCount('analysis_started', r), range, comparison, 'higher_is_better'),
    processingDurations(range),
    deletionSplit(range),
    eventCount('entitlement_expired', range),
    eventCount('paid_result_viewed', range),
    eventCount('active_analysis_restored', range),
  ]);

  const failureRatePct = started > 0 ? (failed / started) * 100 : null;
  const avgMs = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : null;
  const medianMs = median(durations);

  const languageRows = await prisma.analysis.groupBy({
    by: ['outputLanguage'],
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc } },
    _count: true,
  });
  const fileTypeRows = await prisma.analysis.groupBy({
    by: ['cvMimeType'],
    where: { createdAt: { gte: range.startUtc, lt: range.endUtc }, cvMode: 'file' },
    _count: true,
  });

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    comparison: comparison ? { startUtc: comparison.startUtc, endUtc: comparison.endUtc } : null,
    kpis: {
      started: { value: started, formatted: formatCount(started) },
      completed: { value: completed, formatted: formatCount(completed) },
      completionRate,
      avgProcessing: { value: avgMs, formatted: avgMs === null ? '—' : `${(avgMs / 1000).toFixed(1)}s`, missing: avgMs === null },
      medianProcessing: { value: medianMs, formatted: medianMs === null ? '—' : `${(medianMs / 1000).toFixed(1)}s`, missing: medianMs === null },
      failed: { value: failed, formatted: formatCount(failed) },
      failureRate: { value: failureRatePct, formatted: failureRatePct === null ? '—' : formatPercent(failureRatePct), missing: failureRatePct === null },
      retryRate: { value: null, formatted: '—', missing: true, trackingStatus: 'İnstrumentasiya tələb olunur' },
      paidResultViews: { value: paidResultViews, formatted: formatCount(paidResultViews) },
      sessionRestorations: { value: sessionRestorations, formatted: formatCount(sessionRestorations) },
      manualDeletions: { value: deletions.manual, formatted: formatCount(deletions.manual) },
      expiredAnalyses: { value: deletions.system + entitlementExpired, formatted: formatCount(deletions.system + entitlementExpired) },
    },
    languageBreakdown: languageRows.map((r) => ({ language: r.outputLanguage, count: r._count })),
    fileTypeBreakdown: fileTypeRows.map((r) => ({ fileType: r.cvMimeType ?? 'unknown', count: r._count })),
  });
});
