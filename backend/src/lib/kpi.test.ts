import { describe, it, expect } from 'vitest';
import { computeDelta, formatAzn, formatPercent, formatSignedPercent, formatCount, metricFrom } from './kpi.js';

describe('computeDelta — direction is contextual, never sign-based', () => {
  it('higher_is_better: an increase is positive', () => {
    expect(computeDelta(120, 100, 'higher_is_better')!.direction).toBe('pos');
  });

  it('higher_is_better: a decrease is negative', () => {
    expect(computeDelta(80, 100, 'higher_is_better')!.direction).toBe('neg');
  });

  it('lower_is_better: an INCREASE in a bad metric (e.g. refund rate) is negative, even though the raw delta is positive', () => {
    expect(computeDelta(5, 2, 'lower_is_better')!.direction).toBe('neg');
  });

  it('lower_is_better: a decrease in a bad metric is positive', () => {
    expect(computeDelta(2, 5, 'lower_is_better')!.direction).toBe('pos');
  });

  it('neutral rule never assigns pos/neg regardless of magnitude', () => {
    expect(computeDelta(200, 100, 'neutral')!.direction).toBe('neu');
  });

  it('returns null when there is no comparison value (never fabricates a delta)', () => {
    expect(computeDelta(100, null, 'higher_is_better')).toBeNull();
  });

  it('a sub-threshold change reads as neutral, not a false-precision pos/neg', () => {
    // 100.2 vs 100 is a 0.2% change — below the 0.5% neutral threshold.
    expect(computeDelta(100.2, 100, 'higher_is_better')!.direction).toBe('neu');
  });

  it('percent is null when the previous value was exactly 0 (percent change undefined)', () => {
    expect(computeDelta(10, 0, 'higher_is_better')!.percent).toBeNull();
  });
});

describe('number formatting', () => {
  it('formatAzn always shows 2 decimals with the AZN suffix', () => {
    expect(formatAzn(903.8)).toBe('903.80 AZN');
    expect(formatAzn(0)).toBe('0.00 AZN');
  });

  it('formatPercent caps at 1 decimal and drops a trailing .0', () => {
    expect(formatPercent(7.44)).toBe('7.4%');
    expect(formatPercent(65)).toBe('65%');
  });

  it('formatCount uses thousands separators', () => {
    expect(formatCount(1248)).toBe('1,248');
  });

  it('formatSignedPercent uses a real minus glyph and an explicit + sign', () => {
    const up = computeDelta(112, 100, 'higher_is_better')!;
    const down = computeDelta(88, 100, 'higher_is_better')!;
    expect(formatSignedPercent(up)).toMatch(/^\+/);
    expect(formatSignedPercent(down)).toContain('−');
  });
});

describe('metricFrom', () => {
  it('a null value renders as missing, formatted "—", never a fabricated zero', () => {
    const m = metricFrom(null, formatCount, null);
    expect(m.missing).toBe(true);
    expect(m.formatted).toBe('—');
    expect(m.value).toBeNull();
  });

  it('a real zero renders as "0", not "—"', () => {
    const m = metricFrom(0, formatCount, null);
    expect(m.missing).toBe(false);
    expect(m.formatted).toBe('0');
  });
});
