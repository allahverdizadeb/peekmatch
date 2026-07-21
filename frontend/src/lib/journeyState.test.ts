import { describe, it, expect, beforeEach } from 'vitest';

// This project's vitest environment is plain Node (no jsdom dependency) — journeyState.ts guards
// every localStorage access behind `typeof window === 'undefined'`, so a minimal in-memory shim
// (no new dependency) is enough to exercise the real read/write logic here.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  clear() {
    this.store.clear();
  }
}

(globalThis as any).window = {};
(globalThis as any).localStorage = new MemoryStorage();

const { isQuestionReviewed, toggleQuestionReviewed, countReviewedQuestions } = await import('./journeyState');

beforeEach(() => {
  (globalThis.localStorage as unknown as MemoryStorage).clear();
});

describe('per-question reviewed tracking', () => {
  it('toggles independently per question id', () => {
    expect(isQuestionReviewed('a1', 'q1')).toBe(false);
    toggleQuestionReviewed('a1', 'q1');
    expect(isQuestionReviewed('a1', 'q1')).toBe(true);
    expect(isQuestionReviewed('a1', 'q2')).toBe(false);
    toggleQuestionReviewed('a1', 'q1');
    expect(isQuestionReviewed('a1', 'q1')).toBe(false);
  });

  it('countReviewedQuestions counts only the reviewed ones among the given ids', () => {
    toggleQuestionReviewed('a1', 'q1');
    toggleQuestionReviewed('a1', 'q3');
    expect(countReviewedQuestions('a1', ['q1', 'q2', 'q3'])).toBe(2);
  });
});
