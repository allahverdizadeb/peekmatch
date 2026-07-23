// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useInView } from './useInView';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as typeof window.matchMedia;
}

let observedCallback: IntersectionObserverCallback | null = null;
let disconnected = false;

class FakeIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    observedCallback = cb;
  }
  observe() {}
  disconnect() {
    disconnected = true;
  }
  unobserve() {}
}

function TestComp({ once }: { once?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>({ once });
  return <div ref={ref}>{inView ? 'visible' : 'hidden'}</div>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  observedCallback = null;
  disconnected = false;
});

describe('useInView', () => {
  it('starts hidden, then flips to visible once IntersectionObserver reports intersection', () => {
    mockMatchMedia(false);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    const { container } = render(<TestComp />);
    expect(container.textContent).toBe('hidden');

    act(() => {
      observedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(container.textContent).toBe('visible');
  });

  it('disconnects the observer once visible when `once` (default) — never re-hides on scrolling away', () => {
    mockMatchMedia(false);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    render(<TestComp />);
    act(() => {
      observedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(disconnected, 'observer must disconnect after the one-time reveal fires').toBe(true);
  });

  it('is visible immediately under reduced motion — no observer needed, nothing to reveal', () => {
    mockMatchMedia(true);
    const { container } = render(<TestComp />);
    expect(container.textContent).toBe('visible');
  });
});
