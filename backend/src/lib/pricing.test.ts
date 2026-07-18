import { describe, it, expect } from 'vitest';
import { highestOwnedPackage, upgradePriceUsd, unlocksReport, unlocksCv, unlocksInterview, PACKAGES } from './pricing.js';

describe('highestOwnedPackage', () => {
  it('returns 0 when nothing is owned', () => {
    expect(highestOwnedPackage([])).toBe(0);
  });

  it('returns the single owned package', () => {
    expect(highestOwnedPackage([1])).toBe(1);
    expect(highestOwnedPackage([2])).toBe(2);
    expect(highestOwnedPackage([3])).toBe(3);
  });

  it('is cumulative: owning 3 implies 1 and 2, so the highest wins regardless of array order', () => {
    expect(highestOwnedPackage([1, 3])).toBe(3);
    expect(highestOwnedPackage([3, 1])).toBe(3);
    expect(highestOwnedPackage([2, 1])).toBe(2);
  });

  it('ignores duplicate/unknown package numbers rather than crashing', () => {
    expect(highestOwnedPackage([1, 1, 1])).toBe(1);
    expect(highestOwnedPackage([99])).toBe(0);
  });
});

describe('upgradePriceUsd', () => {
  it('charges full price when nothing is owned', () => {
    expect(upgradePriceUsd(1, 0)).toBeCloseTo(0.49, 5);
    expect(upgradePriceUsd(2, 0)).toBeCloseTo(0.99, 5);
    expect(upgradePriceUsd(3, 0)).toBeCloseTo(5.9, 5);
  });

  it('charges only the diff when upgrading — the exact float case documented in pricing.ts', () => {
    // 5.90 - 0.99 in raw JS floats is 4.909999999999999, not 4.91 — this must come out exact.
    expect(upgradePriceUsd(3, 2)).toBe(4.91);
  });

  it('never charges a negative amount for a same-or-lower "upgrade"', () => {
    expect(upgradePriceUsd(1, 2)).toBe(0);
    expect(upgradePriceUsd(2, 2)).toBe(0);
  });

  it('computes every pairwise upgrade path without float drift', () => {
    expect(upgradePriceUsd(2, 1)).toBe(0.5);
    expect(upgradePriceUsd(3, 1)).toBe(5.41);
  });
});

describe('unlocks* thresholds', () => {
  it('report unlocks at package 1+', () => {
    expect(unlocksReport(0)).toBe(false);
    expect(unlocksReport(1)).toBe(true);
    expect(unlocksReport(2)).toBe(true);
    expect(unlocksReport(3)).toBe(true);
  });

  it('CV/cover-letter unlocks at package 2+, not at 1', () => {
    expect(unlocksCv(1)).toBe(false);
    expect(unlocksCv(2)).toBe(true);
    expect(unlocksCv(3)).toBe(true);
  });

  it('interview prep unlocks only at package 3', () => {
    expect(unlocksInterview(2)).toBe(false);
    expect(unlocksInterview(3)).toBe(true);
  });
});

describe('PACKAGES catalog', () => {
  it('prices are strictly increasing by tier — a lower tier must never cost more than a higher one', () => {
    expect(PACKAGES[1].priceUsd).toBeLessThan(PACKAGES[2].priceUsd);
    expect(PACKAGES[2].priceUsd).toBeLessThan(PACKAGES[3].priceUsd);
  });
});
