// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lockBackgroundInert, unlockBackgroundInert } from './backgroundInert';

beforeEach(() => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
});

afterEach(() => {
  // Drain any leftover locks between tests — module-level state persists across test cases.
  for (let i = 0; i < 5; i++) unlockBackgroundInert();
  document.getElementById('root')?.remove();
});

describe('backgroundInert', () => {
  it('marks #root inert on the first lock', () => {
    lockBackgroundInert();
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
  });

  it('removes inert once the single lock is released', () => {
    lockBackgroundInert();
    unlockBackgroundInert();
    expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  });

  it('reference-counts: two dialogs open at once both need to close before the background is reachable again', () => {
    lockBackgroundInert();
    lockBackgroundInert();
    unlockBackgroundInert();
    expect(document.getElementById('root')?.hasAttribute('inert'), 'still inert — one dialog still open').toBe(true);

    unlockBackgroundInert();
    expect(document.getElementById('root')?.hasAttribute('inert'), 'reachable again — both dialogs closed').toBe(false);
  });

  it('is a no-op (does not throw) if #root does not exist', () => {
    document.getElementById('root')?.remove();
    expect(() => lockBackgroundInert()).not.toThrow();
    expect(() => unlockBackgroundInert()).not.toThrow();
  });
});
