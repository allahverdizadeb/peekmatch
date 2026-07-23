// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedUnmount } from './useDelayedUnmount';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useDelayedUnmount', () => {
  it('renders immediately when open starts true', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useDelayedUnmount(true, 240));
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.dataState).toBe('open');
  });

  it('stays mounted for `duration` ms after open flips to false, then unmounts — this is what gives the CSS exit animation time to play', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const { result, rerender } = renderHook(({ open }) => useDelayedUnmount(open, 240), { initialProps: { open: true } });

    rerender({ open: false });
    // Immediately after close: still rendered (mid-exit-animation), but data-state already flipped
    // so the CSS exit keyframe is the one currently driving it.
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.dataState).toBe('closed');

    act(() => vi.advanceTimersByTime(239));
    expect(result.current.shouldRender, 'must not unmount a moment early').toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.shouldRender, 'must unmount once the exit duration has fully elapsed').toBe(false);
  });

  it('unmounts immediately (no wait) under reduced motion — nothing to wait for since the CSS animation is already ~0 duration', () => {
    vi.useFakeTimers();
    mockMatchMedia(true);
    const { result, rerender } = renderHook(({ open }) => useDelayedUnmount(open, 240), { initialProps: { open: true } });

    rerender({ open: false });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.shouldRender).toBe(false);
  });

  it('re-opening before the exit timer fires cancels the pending unmount', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const { result, rerender } = renderHook(({ open }) => useDelayedUnmount(open, 240), { initialProps: { open: true } });

    rerender({ open: false });
    act(() => vi.advanceTimersByTime(100));
    rerender({ open: true });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current.shouldRender, 're-opening must cancel the scheduled unmount').toBe(true);
    expect(result.current.dataState).toBe('open');
  });
});
