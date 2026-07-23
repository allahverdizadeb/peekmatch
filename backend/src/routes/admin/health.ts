import { Router } from 'express';
import { prisma } from '../../db.js';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { getHealthState } from '../../lib/systemHealth.js';
import { getPaymentProviderStatus } from '../../lib/paymentProvider.js';
import { eventCount } from '../../lib/adminMetrics.js';
import { formatBakuDateTime } from '../../lib/dateRange.js';
import { formatPercent } from '../../lib/kpi.js';

export const healthRouter = Router();

const CLEANUP_STALE_AFTER_MS = 30 * 60 * 1000;

healthRouter.get('/', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range } = parsed;

  let dbHealthy = true;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    dbHealthy = false;
  }

  const [started, completed] = await Promise.all([eventCount('analysis_started', range), eventCount('analysis_completed', range)]);
  const successRatePct = started > 0 ? (completed / started) * 100 : null;

  const health = getHealthState();
  const cleanupStale = !health.lastCleanupAt || Date.now() - health.lastCleanupAt.getTime() > CLEANUP_STALE_AFTER_MS;
  const provider = getPaymentProviderStatus();

  const providerComponentState =
    provider.state === 'not_connected' ? 'not_connected' : provider.state === 'connected_healthy' ? 'normal' : provider.state === 'connected_warning' ? 'warning' : 'problem';

  res.json({
    range: { startUtc: range.startUtc, endUtc: range.endUtc, granularity: range.granularity },
    components: [
      { key: 'api', label: 'API', state: 'normal' },
      { key: 'database', label: 'Verilənlər bazası', state: dbHealthy ? 'normal' : 'problem' },
      {
        key: 'analysis_processing',
        label: 'Analiz emalı',
        state: successRatePct === null ? 'no_data' : successRatePct >= 90 ? 'normal' : successRatePct >= 70 ? 'warning' : 'problem',
      },
      { key: 'analytics_ingestion', label: 'Analitika qeydiyyatı', state: 'normal' },
      { key: 'cleanup_job', label: 'Təmizləmə işi', state: cleanupStale ? 'warning' : 'normal' },
      { key: 'payment_provider', label: 'Ödəniş provayderi', state: providerComponentState },
    ],
    kpis: {
      apiAvailability: { value: 100, formatted: '100%' },
      processingSuccessRate: { value: successRatePct, formatted: successRatePct === null ? '—' : formatPercent(successRatePct), missing: successRatePct === null },
      webhookHealth: {
        value: null,
        formatted: '—',
        missing: true,
        trackingStatus: provider.state === 'not_connected' ? 'Provayder qoşulmayıb' : 'Hələ webhook hadisəsi qeydə alınmayıb',
      },
      queuedWork: { value: 0, formatted: '0' },
    },
    cleanup: {
      lastRunAt: health.lastCleanupAt ? formatBakuDateTime(health.lastCleanupAt) : null,
      lastDeletedCount: health.lastCleanupDeletedCount,
    },
    provider,
    recentEvents: [],
  });
});
