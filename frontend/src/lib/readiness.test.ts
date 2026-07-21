import { describe, it, expect } from 'vitest';
import { computeApplicationReadiness } from './readiness';

describe('computeApplicationReadiness', () => {
  it('is "ready" only with zero critical gaps and a high compatibility', () => {
    expect(computeApplicationReadiness(80, 0)).toBe('ready');
    expect(computeApplicationReadiness(80, 1)).not.toBe('ready');
  });

  it('is "nearly_ready" with at most 1 critical gap and a decent compatibility', () => {
    expect(computeApplicationReadiness(65, 1)).toBe('nearly_ready');
    expect(computeApplicationReadiness(60, 0)).toBe('nearly_ready');
  });

  it('is "needs_improvement" for a moderate compatibility with more gaps', () => {
    expect(computeApplicationReadiness(45, 2)).toBe('needs_improvement');
  });

  it('is "not_ready" for a low compatibility regardless of gap count', () => {
    expect(computeApplicationReadiness(20, 0)).toBe('not_ready');
  });

  it('is deterministic — same inputs always produce the same output, with no notion of "owned package" in the signature', () => {
    expect(computeApplicationReadiness(50, 2)).toBe(computeApplicationReadiness(50, 2));
  });
});
