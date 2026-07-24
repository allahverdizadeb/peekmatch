// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { lockBodyScroll, unlockBodyScroll } from './bodyScrollLock';

afterEach(() => {
  // Drain any leftover locks between tests — module-level state persists across test cases.
  for (let i = 0; i < 5; i++) unlockBodyScroll();
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('bodyScrollLock', () => {
  it('locks body overflow on the first lock', () => {
    lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('unlocking once after one lock restores the original overflow', () => {
    document.body.style.overflow = 'auto';
    lockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('reference-counts: two locks require two unlocks before scroll is restored — the core fix for two dialogs closing out of order', () => {
    lockBodyScroll();
    lockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow, 'still locked — one outstanding lock remains').toBe('hidden');

    unlockBodyScroll();
    expect(document.body.style.overflow, 'now restored — last lock released').toBe('');
  });

  it('extra unlocks beyond the lock count do not go negative or throw', () => {
    lockBodyScroll();
    unlockBodyScroll();
    expect(() => unlockBodyScroll()).not.toThrow();
    expect(() => unlockBodyScroll()).not.toThrow();
  });
});
