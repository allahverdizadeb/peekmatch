import { describe, it, expect } from 'vitest';
import { staggerDelay, STAGGER } from './motion';

describe('staggerDelay', () => {
  it('is index * increment for small indices', () => {
    expect(staggerDelay(0, STAGGER.cards)).toBe(0);
    expect(staggerDelay(1, STAGGER.cards)).toBe(STAGGER.cards);
    expect(staggerDelay(3, STAGGER.cards)).toBe(STAGGER.cards * 3);
  });

  it('caps the delay so a long list does not take seconds to finish revealing', () => {
    const uncapped = 50 * STAGGER.cards;
    const capped = staggerDelay(50, STAGGER.cards);
    expect(capped).toBeLessThan(uncapped);
    expect(capped).toBeLessThanOrEqual(480);
  });

  it('never returns a negative delay for index 0', () => {
    expect(staggerDelay(0, STAGGER.sections)).toBe(0);
  });
});
