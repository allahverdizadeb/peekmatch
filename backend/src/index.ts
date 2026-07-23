import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';
import { aiConfigured } from './lib/ai.js';
import { recordEvent } from './lib/analyticsIngest.js';
import { recomputeRecentRollups } from './lib/aggregation.js';
import { recordCleanupRun, recordRollupRun } from './lib/systemHealth.js';

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`PeekMatch backend listening on :${PORT}`);
  if (!aiConfigured()) {
    console.warn('[startup] OPENAI_API_KEY not set — matching analysis will use the offline fallback analyzer.');
  }
});

// Privacy promise: CVs, vacancy text, and results are auto-deleted after the retention period.
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(async () => {
  try {
    // findMany (not a direct deleteMany) so each row's lifecycle can be recorded as an analytics
    // event BEFORE it's hard-purged — this is the only place that transition can ever be observed,
    // since the row is gone immediately after. A row already user-soft-deleted (deletedAt set) was
    // already recorded as analysis_deleted at DELETE-time (see routes/analyses.ts), so it's skipped
    // here to avoid double counting.
    const expiring = await prisma.analysis.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, paidAt: true, deletedAt: true, anonymousSessionId: true },
    });
    for (const row of expiring) {
      if (row.deletedAt) continue;
      if (row.paidAt) {
        await recordEvent({ name: 'entitlement_expired', analysisId: row.id, visitorRef: row.anonymousSessionId, source: 'server' });
      } else {
        await recordEvent({
          name: 'analysis_deleted',
          analysisId: row.id,
          visitorRef: row.anonymousSessionId,
          metadata: { initiator: 'system' },
          source: 'server',
        });
      }
    }
    const { count } = await prisma.analysis.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (count > 0) console.log(`[cleanup] deleted ${count} expired analyses`);
    recordCleanupRun(count);
  } catch (err) {
    console.error('[cleanup]', err);
  }
}, CLEANUP_INTERVAL_MS).unref();

// Superadmin metric rollups — same cadence as the cleanup sweep above, deliberately not its own
// separate interval (this product runs one lightweight process; no need for a second timer).
setInterval(() => {
  recomputeRecentRollups()
    .then(recordRollupRun)
    .catch((err) => console.error('[rollup]', err));
}, CLEANUP_INTERVAL_MS).unref();
