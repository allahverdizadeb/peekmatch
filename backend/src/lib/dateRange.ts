// Baku-timezone date-range math for the Superadmin dashboard. Azerbaijan has been UTC+4 year-round
// since DST was abolished in 2016 — a fixed offset, not a calendar-library problem — so this is
// hand-rolled rather than pulling in a timezone dependency, consistent with this codebase's existing
// no-unnecessary-dependency pattern. All storage/query boundaries stay in UTC; only display and
// "what does 'today' mean" logic ever touches the Baku offset.
export const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/** The UTC instant corresponding to a given Baku wall-clock date/time (month is 0-indexed, matching
 * Date.UTC's convention, so callers can pass mo-1/mo+1 freely for month-boundary math). */
function bakuWallClockToUtc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(y, mo, d, h, mi, s, ms) - BAKU_OFFSET_MS);
}

/** Reads the Baku wall-clock Y/M/D/H for a given UTC instant via a shifted clone's UTC getters —
 * never the host machine's own local timezone, which may not be Baku. */
function bakuParts(utc: Date) {
  const shifted = new Date(utc.getTime() + BAKU_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
  };
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom';
export type ComparisonMode = 'previous_period' | 'previous_day' | 'previous_week' | 'previous_month' | 'none';
export type Granularity = 'hour' | 'day';

export interface ResolvedRange {
  startUtc: Date;
  endUtc: Date; // exclusive
  granularity: Granularity;
}

const MAX_CUSTOM_RANGE_DAYS = 366;

export function resolvePresetRange(preset: RangePreset, custom?: { from: string; to: string }): ResolvedRange {
  const now = bakuParts(new Date());
  switch (preset) {
    case 'today':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo, now.d), endUtc: bakuWallClockToUtc(now.y, now.mo, now.d + 1), granularity: 'hour' };
    case 'yesterday':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo, now.d - 1), endUtc: bakuWallClockToUtc(now.y, now.mo, now.d), granularity: 'hour' };
    case '7d':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo, now.d - 6), endUtc: bakuWallClockToUtc(now.y, now.mo, now.d + 1), granularity: 'day' };
    case '30d':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo, now.d - 29), endUtc: bakuWallClockToUtc(now.y, now.mo, now.d + 1), granularity: 'day' };
    case 'this_month':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo, 1), endUtc: bakuWallClockToUtc(now.y, now.mo + 1, 1), granularity: 'day' };
    case 'last_month':
      return { startUtc: bakuWallClockToUtc(now.y, now.mo - 1, 1), endUtc: bakuWallClockToUtc(now.y, now.mo, 1), granularity: 'day' };
    case 'custom': {
      if (!custom) throw new RangeError('Xüsusi tarix aralığı üçün from/to tələb olunur.');
      const from = parseIsoDate(custom.from);
      const to = parseIsoDate(custom.to);
      if (!from || !to || from.getTime() > to.getTime()) throw new RangeError('Tarix aralığı düzgün deyil.');
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days > MAX_CUSTOM_RANGE_DAYS) throw new RangeError('Tarix aralığı həddindən artıq böyükdür.');
      const start = bakuWallClockToUtc(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
      const end = bakuWallClockToUtc(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1);
      return { startUtc: start, endUtc: end, granularity: days <= 3 ? 'hour' : 'day' };
    }
  }
}

/** Same-length preceding period, or a specific preceding calendar unit — matches the global
 * Comparison selector (Əvvəlki dövr / Əvvəlki gün / Əvvəlki həftə / Əvvəlki ay / Yoxdur). */
export function comparisonRangeFor(range: ResolvedRange, mode: ComparisonMode): ResolvedRange | null {
  if (mode === 'none') return null;
  const durationMs = range.endUtc.getTime() - range.startUtc.getTime();
  if (mode === 'previous_period') {
    return { startUtc: new Date(range.startUtc.getTime() - durationMs), endUtc: new Date(range.startUtc.getTime()), granularity: range.granularity };
  }
  if (mode === 'previous_day') {
    const day = 86_400_000;
    return { startUtc: new Date(range.startUtc.getTime() - day), endUtc: new Date(range.endUtc.getTime() - day), granularity: range.granularity };
  }
  if (mode === 'previous_week') {
    const week = 7 * 86_400_000;
    return { startUtc: new Date(range.startUtc.getTime() - week), endUtc: new Date(range.endUtc.getTime() - week), granularity: range.granularity };
  }
  // previous_month: shift both boundaries back one Baku calendar month, preserving day-of-month.
  const sp = bakuParts(range.startUtc);
  const ep = bakuParts(new Date(range.endUtc.getTime() - 1));
  return {
    startUtc: bakuWallClockToUtc(sp.y, sp.mo - 1, sp.d),
    endUtc: bakuWallClockToUtc(ep.y, ep.mo - 1, ep.d + 1),
    granularity: range.granularity,
  };
}

const PRESETS: Record<string, RangePreset> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': '7d',
  '30d': '30d',
  this_month: 'this_month',
  last_month: 'last_month',
  custom: 'custom',
};
const COMPARISONS: Record<string, ComparisonMode> = {
  previous_period: 'previous_period',
  previous_day: 'previous_day',
  previous_week: 'previous_week',
  previous_month: 'previous_month',
  none: 'none',
};

/** Parses `?range=` (+ `?from=&to=` for custom) from a request query into a resolved UTC range.
 * Throws RangeError with an Azerbaijani message on anything invalid — callers map that to a 400. */
export function resolveRangeFromQuery(query: Record<string, unknown>): ResolvedRange {
  const raw = typeof query.range === 'string' ? query.range : '7d';
  const preset = PRESETS[raw];
  if (!preset) throw new RangeError('Naməlum tarix aralığı.');
  if (preset === 'custom') {
    const from = typeof query.from === 'string' ? query.from : '';
    const to = typeof query.to === 'string' ? query.to : '';
    return resolvePresetRange('custom', { from, to });
  }
  return resolvePresetRange(preset);
}

export function resolveComparisonFromQuery(query: Record<string, unknown>, range: ResolvedRange): ResolvedRange | null {
  const raw = typeof query.compare === 'string' ? query.compare : 'previous_period';
  const mode = COMPARISONS[raw] ?? 'previous_period';
  return comparisonRangeFor(range, mode);
}

/** One-call convenience for every admin route handler: parse `?range=&compare=(&from=&to=)` into
 * both the primary and comparison UTC ranges, or throw a RangeError with an Azerbaijani message a
 * caller can map straight to a 400. */
export function parseRangeAndComparison(query: Record<string, unknown>): { range: ResolvedRange; comparison: ResolvedRange | null } {
  const range = resolveRangeFromQuery(query);
  const comparison = resolveComparisonFromQuery(query, range);
  return { range, comparison };
}

export function enumerateBuckets(range: ResolvedRange): Date[] {
  const stepMs = range.granularity === 'hour' ? 3_600_000 : 86_400_000;
  const buckets: Date[] = [];
  for (let t = range.startUtc.getTime(); t < range.endUtc.getTime(); t += stepMs) buckets.push(new Date(t));
  return buckets;
}

/** "23 iyul, 14:32" — the one Superadmin-wide timestamp display format, always in Baku time
 * regardless of the server's own timezone. */
export function formatBakuDateTime(utc: Date): string {
  const p = bakuParts(utc);
  return `${p.d} ${AZ_MONTHS[p.mo]}, ${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

export function bakuDateKey(utc: Date): string {
  const p = bakuParts(utc);
  return `${p.y}-${String(p.mo + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function bakuHour(utc: Date): number {
  return bakuParts(utc).h;
}
