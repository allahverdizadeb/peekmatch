// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

/** Minimal matchMedia mock — `matches` starts at the given value and is only ever updated by
 * calling the stored `change` listener, exactly like a real MediaQueryList firing a real event. */
function mockMatchMedia(initialMatches: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mql = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    fireChange(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReducedMotion', () => {
  it('reflects the OS preference at mount — false when not requested', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('reflects the OS preference at mount — true when requested', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates live if the OS preference changes while mounted (no page reload required)', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.fireChange(true));
    expect(result.current).toBe(true);

    act(() => media.fireChange(false));
    expect(result.current).toBe(false);
  });
});
