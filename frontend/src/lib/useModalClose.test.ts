// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalClose } from './useModalClose';

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

describe('useModalClose', () => {
  it('does not call onClose synchronously — the caller gets time to play an exit animation first', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const onClose = vi.fn();
    const { result } = renderHook(() => useModalClose(onClose, 240));

    act(() => result.current.requestClose());
    expect(onClose, 'onClose must not fire before the exit animation has had time to play').not.toHaveBeenCalled();
    expect(result.current.closing).toBe(true);
  });

  it('calls onClose exactly once, after the configured duration', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const onClose = vi.fn();
    const { result } = renderHook(() => useModalClose(onClose, 240));

    act(() => result.current.requestClose());
    act(() => vi.advanceTimersByTime(240));
    expect(onClose).toHaveBeenCalledTimes(1);

    // A second requestClose (e.g. a duplicate Escape press or double-click) must not double-fire.
    act(() => result.current.requestClose());
    act(() => vi.advanceTimersByTime(240));
    expect(onClose, 'requestClose must be a no-op once already closing').toHaveBeenCalledTimes(1);
  });

  it('closes immediately under reduced motion — no exit animation to wait for', () => {
    mockMatchMedia(true);
    const onClose = vi.fn();
    const { result } = renderHook(() => useModalClose(onClose, 240));

    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
