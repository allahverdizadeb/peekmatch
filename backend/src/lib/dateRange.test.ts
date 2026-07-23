import { describe, it, expect } from 'vitest';
import { resolvePresetRange, comparisonRangeFor, resolveRangeFromQuery, formatBakuDateTime, bakuDateKey, enumerateBuckets } from './dateRange.js';

describe('resolvePresetRange', () => {
  it('"today" spans exactly 24h in Baku time, starting at Baku midnight (UTC-4h offset)', () => {
    const range = resolvePresetRange('today');
    expect(range.endUtc.getTime() - range.startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
    // Baku midnight (00:00 UTC+4) is 20:00 UTC the previous calendar day.
    expect(range.startUtc.getUTCHours()).toBe(20);
    expect(range.granularity).toBe('hour');
  });

  it('"7d" covers exactly 7 full days ending at the next Baku midnight, daily granularity', () => {
    const range = resolvePresetRange('7d');
    expect(range.endUtc.getTime() - range.startUtc.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(range.granularity).toBe('day');
  });

  it('"this_month"/"last_month" produce adjacent, non-overlapping ranges', () => {
    const thisMonth = resolvePresetRange('this_month');
    const lastMonth = resolvePresetRange('last_month');
    expect(lastMonth.endUtc.getTime()).toBe(thisMonth.startUtc.getTime());
  });

  it('a valid custom range resolves inclusively (from day 00:00 Baku to the day after `to`)', () => {
    const range = resolvePresetRange('custom', { from: '2026-01-01', to: '2026-01-03' });
    expect(range.endUtc.getTime() - range.startUtc.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('rejects an inverted custom range (from after to)', () => {
    expect(() => resolvePresetRange('custom', { from: '2026-02-01', to: '2026-01-01' })).toThrow(RangeError);
  });

  it('rejects a malformed custom date string', () => {
    expect(() => resolvePresetRange('custom', { from: 'not-a-date', to: '2026-01-01' })).toThrow(RangeError);
  });

  it('rejects a custom range longer than 366 days', () => {
    expect(() => resolvePresetRange('custom', { from: '2020-01-01', to: '2026-01-01' })).toThrow(RangeError);
  });
});

describe('comparisonRangeFor', () => {
  it('"none" returns null', () => {
    const range = resolvePresetRange('7d');
    expect(comparisonRangeFor(range, 'none')).toBeNull();
  });

  it('"previous_period" is the same-length, immediately-preceding window', () => {
    const range = resolvePresetRange('7d');
    const comparison = comparisonRangeFor(range, 'previous_period')!;
    expect(comparison.endUtc.getTime()).toBe(range.startUtc.getTime());
    expect(comparison.endUtc.getTime() - comparison.startUtc.getTime()).toBe(range.endUtc.getTime() - range.startUtc.getTime());
  });

  it('"previous_day" shifts both boundaries back exactly 24h', () => {
    const range = resolvePresetRange('today');
    const comparison = comparisonRangeFor(range, 'previous_day')!;
    expect(range.startUtc.getTime() - comparison.startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('resolveRangeFromQuery', () => {
  it('defaults to "7d" when no range is given', () => {
    const range = resolveRangeFromQuery({});
    expect(range.granularity).toBe('day');
  });

  it('rejects an unknown preset name', () => {
    expect(() => resolveRangeFromQuery({ range: 'nonsense' })).toThrow(RangeError);
  });
});

describe('formatBakuDateTime / bakuDateKey', () => {
  it('formats a known UTC instant in Baku local time (AZ month name, 24h clock)', () => {
    // 2026-01-01T10:00:00Z -> Baku is UTC+4 -> 14:00 local, same calendar day.
    const d = new Date('2026-01-01T10:00:00.000Z');
    expect(formatBakuDateTime(d)).toBe('1 yanvar, 14:00');
    expect(bakuDateKey(d)).toBe('2026-01-01');
  });

  it('rolls over to the next Baku calendar day near UTC midnight', () => {
    // 2026-01-01T21:00:00Z -> +4h -> 2026-01-02T01:00 local.
    const d = new Date('2026-01-01T21:00:00.000Z');
    expect(bakuDateKey(d)).toBe('2026-01-02');
  });
});

describe('enumerateBuckets', () => {
  it('produces exactly N daily buckets for an N-day range', () => {
    const range = resolvePresetRange('7d');
    expect(enumerateBuckets(range)).toHaveLength(7);
  });

  it('produces exactly 24 hourly buckets for "today"', () => {
    const range = resolvePresetRange('today');
    expect(enumerateBuckets(range)).toHaveLength(24);
  });
});
