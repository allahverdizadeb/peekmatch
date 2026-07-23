// Shared KPI formatting/delta primitives for the Superadmin dashboard — every page's route computes
// its own domain-specific Prisma aggregate queries, then formats results through these so every page
// shows numbers the exact same way (see SUPERADMIN_KPI_DICTIONARY.md's formatting rules) rather than
// re-deriving formatting logic per route.

export type Direction = 'pos' | 'neg' | 'neu';

/** Direction is contextual, never sign-based — e.g. a rise in refund rate is `neg` even though the
 * raw delta is positive. Every call site must pick the rule that matches the metric's real business
 * meaning; there is no safe universal default. */
export type DirectionRule = 'higher_is_better' | 'lower_is_better' | 'neutral';

export interface DeltaResult {
  absolute: number;
  percent: number | null; // null when the previous value was 0 (percent change is undefined)
  direction: Direction;
}

// Deltas smaller than this read as neutral/≈0%, not false precision from a near-zero movement.
const NEUTRAL_THRESHOLD_PCT = 0.5;

export function computeDelta(current: number, previous: number | null, rule: DirectionRule): DeltaResult | null {
  if (previous === null) return null;
  const absolute = current - previous;
  const percent = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : null;
  let direction: Direction = 'neu';
  const magnitude = percent === null ? Math.abs(absolute) : Math.abs(percent);
  if (rule !== 'neutral' && magnitude >= NEUTRAL_THRESHOLD_PCT) {
    const rose = absolute > 0;
    direction = rule === 'higher_is_better' ? (rose ? 'pos' : 'neg') : rose ? 'neg' : 'pos';
  }
  return { absolute, percent, direction };
}

export function formatAzn(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AZN`;
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function formatSignedPercent(delta: DeltaResult): string {
  if (delta.percent === null) return '—';
  if (Math.abs(delta.percent) < NEUTRAL_THRESHOLD_PCT) return '≈0%';
  const sign = delta.percent > 0 ? '+' : '−';
  return `${sign}${formatPercent(Math.abs(delta.percent))}`;
}

export function formatSignedPp(pointsDelta: number): string {
  const rounded = Math.round(pointsDelta * 10) / 10;
  if (Math.abs(rounded) < NEUTRAL_THRESHOLD_PCT) return '≈0pp';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded)}pp`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** A metric that may be genuinely untracked/unavailable — renders as the real value when known, or
 * `missing: true` (frontend shows "—" + a tooltip) when not. Never conflate "missing" with "zero". */
export interface Metric {
  value: number | null;
  formatted: string;
  delta: DeltaResult | null;
  missing: boolean;
  trackingStatus?: string;
}

export function metricFrom(value: number | null, format: (v: number) => string, delta: DeltaResult | null, trackingStatus?: string): Metric {
  if (value === null) return { value: null, formatted: '—', delta: null, missing: true, trackingStatus };
  return { value, formatted: format(value), delta, missing: false, trackingStatus };
}

/** Revenue/payment-ops KPIs must only ever count real, provider-confirmed payments. Demo/simulated
 * orders (`provider: null`, created via the pre-existing `/orders/:id/simulate` flow) are
 * deliberately excluded from every Superadmin financial metric — not merely badged — per product
 * decision: financial KPIs read as a real zero/empty state until a real payment provider is actually
 * connected, regardless of what already exists in the Order table. See schema.prisma's Order model
 * doc-comment for the same rule stated at the data layer. */
export const REAL_PAYMENT_PROVIDER = 'payriff';
