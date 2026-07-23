// In-memory operational status for the System Health page — a single-process assumption consistent
// with the rest of this codebase (no shared cache/queue anywhere). Updated by index.ts's cron ticks,
// read by routes/admin/health.ts. Resets on server restart, which is fine: "no cleanup run yet since
// this process started" is itself an honest, real status, not a fabricated one.
interface HealthState {
  lastCleanupAt: Date | null;
  lastCleanupDeletedCount: number;
  lastRollupAt: Date | null;
}

const state: HealthState = { lastCleanupAt: null, lastCleanupDeletedCount: 0, lastRollupAt: null };

export function recordCleanupRun(deletedCount: number): void {
  state.lastCleanupAt = new Date();
  state.lastCleanupDeletedCount = deletedCount;
}

export function recordRollupRun(): void {
  state.lastRollupAt = new Date();
}

export function getHealthState(): HealthState {
  return { ...state };
}
