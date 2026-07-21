import { describe, it, expect } from 'vitest';
import { highestOwnedPackage, upgradePriceUsd, unlocksApplication, unlocksInterview, PACKAGES } from './pricing.js';

describe('highestOwnedPackage', () => {
  it('returns 0 when nothing is owned', () => {
    expect(highestOwnedPackage([])).toBe(0);
  });

  it('returns the single owned package', () => {
    expect(highestOwnedPackage([1])).toBe(1);
    expect(highestOwnedPackage([2])).toBe(2);
  });

  it('is cumulative: owning 2 implies 1, so the highest wins regardless of array order', () => {
    expect(highestOwnedPackage([1, 2])).toBe(2);
    expect(highestOwnedPackage([2, 1])).toBe(2);
  });

  it('ignores duplicate/unknown package numbers rather than crashing', () => {
    expect(highestOwnedPackage([1, 1, 1])).toBe(1);
    expect(highestOwnedPackage([99])).toBe(0);
  });

  it('caps a stale package:3 row (from before the 3-tier -> 2-tier restructure) to the new top tier', () => {
    expect(highestOwnedPackage([3])).toBe(2);
    expect(highestOwnedPackage([1, 3])).toBe(2);
  });
});

describe('upgradePriceUsd', () => {
  it('charges full price when nothing is owned', () => {
    expect(upgradePriceUsd(1, 0)).toBeCloseTo(0.9, 5);
    expect(upgradePriceUsd(2, 0)).toBeCloseTo(2.9, 5);
  });

  it('charges only the diff when upgrading from package 1 to package 2', () => {
    expect(upgradePriceUsd(2, 1)).toBe(2);
  });

  it('never charges a negative amount for a same-or-lower "upgrade"', () => {
    expect(upgradePriceUsd(1, 1)).toBe(0);
    expect(upgradePriceUsd(1, 2)).toBe(0);
  });
});

describe('unlocks* thresholds', () => {
  it('the Application Package (report, CV Change Plan, Evidence Chain) unlocks at package 1+', () => {
    expect(unlocksApplication(0)).toBe(false);
    expect(unlocksApplication(1)).toBe(true);
    expect(unlocksApplication(2)).toBe(true);
  });

  it('the Interview Playbook unlocks only at package 2', () => {
    expect(unlocksInterview(1)).toBe(false);
    expect(unlocksInterview(2)).toBe(true);
  });
});

describe('PACKAGES catalog', () => {
  it('prices are strictly increasing by tier — a lower tier must never cost more than a higher one', () => {
    expect(PACKAGES[1].priceUsd).toBeLessThan(PACKAGES[2].priceUsd);
  });
});
