import { describe, it, expect } from 'vitest';
import {
  computeCompatibility,
  computeCategoryScores,
  computeRequirementCounts,
  computeCriticalGapsCount,
  applyScoringOverrides,
  sanitizeCvChangePlan,
  computeCvChangesSummary,
  computeInterviewRisksCount,
  type ScoredRequirement,
} from './scoring.js';

const req = (importance: ScoredRequirement['importance'], status: ScoredRequirement['status'], category = 'Texniki bacarıqlar'): ScoredRequirement => ({
  category,
  importance,
  status,
});

describe('computeCompatibility', () => {
  it('returns 0 for an empty requirements array rather than throwing or dividing by zero', () => {
    expect(computeCompatibility([])).toBe(0);
  });

  it('returns 100 when every requirement is fully met, regardless of weight mix', () => {
    expect(computeCompatibility([req('kritik', 'met'), req('əsas', 'met'), req('üstünlük', 'met')])).toBe(100);
  });

  it('returns 0 when everything is missing', () => {
    expect(computeCompatibility([req('kritik', 'missing'), req('əsas', 'missing')])).toBe(0);
  });

  it('weights kritik requirements 5x as heavily as üstünlük — a missed critical requirement must drag the score down hard', () => {
    // One met üstünlük (weight 1) + one missing kritik (weight 5): (1*1 + 5*0) / 6 = 16.67% -> 17
    const withMissingCritical = computeCompatibility([req('üstünlük', 'met'), req('kritik', 'missing')]);
    // Same but the missing one is üstünlük instead: (1*0 + 5*1) / 6 = 83.33% -> 83
    const withMissingNiceToHave = computeCompatibility([req('üstünlük', 'missing'), req('kritik', 'met')]);
    expect(withMissingCritical).toBeLessThan(30);
    expect(withMissingNiceToHave).toBeGreaterThan(70);
  });

  it('treats partial and insufficient_info as half-credit, distinct from missing (0) and met (full)', () => {
    const partial = computeCompatibility([req('əsas', 'partial')]);
    const insufficient = computeCompatibility([req('əsas', 'insufficient_info')]);
    const missing = computeCompatibility([req('əsas', 'missing')]);
    const met = computeCompatibility([req('əsas', 'met')]);
    expect(partial).toBe(50);
    expect(insufficient).toBe(50);
    expect(missing).toBe(0);
    expect(met).toBe(100);
  });

  it('matches the exact worked example: 2 kritik met, 1 kritik missing, 1 əsas partial, 1 üstünlük met', () => {
    // weights: 5,5,5,3,1 = 19 total. scores: 1,1,0,0.5,1 -> weighted sum = 5+5+0+1.5+1 = 12.5
    // 12.5 / 19 = 65.789...% -> rounds to 66
    const reqs = [
      req('kritik', 'met'),
      req('kritik', 'met'),
      req('kritik', 'missing'),
      req('əsas', 'partial'),
      req('üstünlük', 'met'),
    ];
    expect(computeCompatibility(reqs)).toBe(66);
  });
});

describe('computeCategoryScores', () => {
  it('computes a real score for a category that has matching requirements, ignoring the AI-supplied fallback', () => {
    const requirements = [req('kritik', 'met', 'Texniki bacarıqlar'), req('kritik', 'missing', 'Texniki bacarıqlar')];
    const result = computeCategoryScores(requirements, [{ category: 'Texniki bacarıqlar', score: 99 }]);
    expect(result).toEqual([{ category: 'Texniki bacarıqlar', score: 50 }]);
  });

  it('falls back to the AI-supplied score for a category with zero matching requirements — no signal to compute from', () => {
    const requirements = [req('kritik', 'met', 'Texniki bacarıqlar')];
    const result = computeCategoryScores(requirements, [{ category: 'Təhsil', score: 77 }]);
    expect(result).toEqual([{ category: 'Təhsil', score: 77 }]);
  });

  it('preserves the AI category list and order even when recomputing scores', () => {
    const requirements = [req('kritik', 'met', 'A'), req('kritik', 'met', 'B')];
    const result = computeCategoryScores(requirements, [
      { category: 'A', score: 1 },
      { category: 'B', score: 2 },
      { category: 'C', score: 3 },
    ]);
    expect(result.map((r) => r.category)).toEqual(['A', 'B', 'C']);
  });
});

describe('computeRequirementCounts', () => {
  it('counts sum exactly to the total, with insufficient_info conservatively bucketed as missing', () => {
    const requirements = [
      { status: 'met' as const },
      { status: 'met' as const },
      { status: 'partial' as const },
      { status: 'missing' as const },
      { status: 'insufficient_info' as const },
    ];
    const counts = computeRequirementCounts(requirements);
    expect(counts).toEqual({
      mainRequirementsTotal: 5,
      mainRequirementsMet: 2,
      mainRequirementsPartial: 1,
      mainRequirementsMissing: 2,
    });
    expect(counts.mainRequirementsMet + counts.mainRequirementsPartial + counts.mainRequirementsMissing).toBe(
      counts.mainRequirementsTotal,
    );
  });

  it('handles an empty array without error', () => {
    expect(computeRequirementCounts([])).toEqual({
      mainRequirementsTotal: 0,
      mainRequirementsMet: 0,
      mainRequirementsPartial: 0,
      mainRequirementsMissing: 0,
    });
  });
});

describe('computeCriticalGapsCount', () => {
  it('counts only kritik-importance requirements that are not met', () => {
    const requirements = [
      req('kritik', 'met'),
      req('kritik', 'partial'),
      req('kritik', 'missing'),
      req('əsas', 'missing'), // not kritik — must not count
      req('üstünlük', 'missing'), // not kritik — must not count
    ];
    expect(computeCriticalGapsCount(requirements)).toBe(2);
  });

  it('is zero when every kritik requirement is met, even if lower-tier ones are missing', () => {
    const requirements = [req('kritik', 'met'), req('əsas', 'missing'), req('üstünlük', 'missing')];
    expect(computeCriticalGapsCount(requirements)).toBe(0);
  });
});

function fixture(requirements: (ScoredRequirement & { evidence: string })[]) {
  return {
    compatibility: 0,
    realCompatibility: 0,
    categoryScores: [{ category: 'Texniki bacarıqlar', score: 0 }],
    requirements,
    mainRequirementsTotal: 0,
    mainRequirementsMet: 0,
    mainRequirementsPartial: 0,
    mainRequirementsMissing: 0,
    criticalGapsCount: 0,
  };
}

describe('applyScoringOverrides', () => {
  it('downgrades a "met" requirement with no evidence to insufficient_info before scoring — "every confirmed match must have valid CV evidence" (product rule)', () => {
    const result = fixture([{ ...req('kritik', 'met'), evidence: '' }]);
    const applied = applyScoringOverrides(result);
    expect(applied.requirements[0].status).toBe('insufficient_info');
    // A downgraded requirement scores 0.5, not the 1.0 it would have gotten as a bare "met" claim —
    // proving the correction actually flows into the score, not just a status-label cosmetic fix.
    expect(applied.compatibility).toBe(50);
  });

  it('downgrades a "met" requirement whose evidence is whitespace-only, not just literally empty', () => {
    const result = fixture([{ ...req('əsas', 'met'), evidence: '   ' }]);
    expect(applyScoringOverrides(result).requirements[0].status).toBe('insufficient_info');
  });

  it('leaves a "met" requirement with real evidence untouched', () => {
    const result = fixture([{ ...req('kritik', 'met'), evidence: 'CV states 5 years of Node.js experience.' }]);
    const applied = applyScoringOverrides(result);
    expect(applied.requirements[0].status).toBe('met');
    expect(applied.compatibility).toBe(100);
  });

  it('never leaves realCompatibility below the freshly-recomputed compatibility, even if the AI supplied a lower realCompatibility than its own (now-overridden) compatibility', () => {
    const result = fixture([{ ...req('kritik', 'met'), evidence: 'real evidence' }]);
    result.realCompatibility = 10; // AI proposed a nonsensical value below its own compatibility
    const applied = applyScoringOverrides(result);
    expect(applied.realCompatibility).toBeGreaterThanOrEqual(applied.compatibility);
  });

  it('mutates and returns the same object (in-place), matching how analyzeMatch consumes it', () => {
    const result = fixture([{ ...req('kritik', 'met'), evidence: 'evidence' }]);
    expect(applyScoringOverrides(result)).toBe(result);
  });
});

const card = (
  priority: ScoredRequirement['importance'],
  changeType: 'rewrite' | 'add' | 'clarify' | 'remove',
  evidenceFromCv: string[] = [],
  overrides: Partial<{ whatToChange: string; problem: string; recommendedText: string }> = {},
) => ({
  priority,
  changeType,
  evidenceFromCv,
  whatToChange: overrides.whatToChange ?? 'Bu mətni daha konkret yazın.',
  problem: overrides.problem ?? 'Vakansiyada bu təcrübə vacibdir.',
  recommendedText: overrides.recommendedText ?? 'Nümunə tövsiyə mətni.',
});

describe('sanitizeCvChangePlan — Truth Lock enforcement in code, not just prompt', () => {
  it('drops a rewrite/add/remove card that cites zero CV evidence — an unevidenced concrete claim is exactly the fabrication risk Truth Lock exists to prevent', () => {
    const cards = [card('kritik', 'rewrite', []), card('əsas', 'add', []), card('üstünlük', 'remove', [])];
    expect(sanitizeCvChangePlan(cards)).toEqual([]);
  });

  it('keeps a rewrite/add/remove card that cites at least one piece of evidence', () => {
    const cards = [card('kritik', 'rewrite', ['CV mentions 5 years at Acme'])];
    expect(sanitizeCvChangePlan(cards)).toHaveLength(1);
  });

  it('keeps a "clarify" card even with zero evidence — citing nothing is the whole point of asking the candidate to confirm', () => {
    const cards = [card('əsas', 'clarify', [])];
    expect(sanitizeCvChangePlan(cards)).toHaveLength(1);
  });

  it('treats whitespace-only evidence strings as no evidence', () => {
    const cards = [card('kritik', 'rewrite', ['   ', ''])];
    expect(sanitizeCvChangePlan(cards)).toEqual([]);
  });
});

describe('sanitizeCvChangePlan — concise-by-design length enforcement', () => {
  it('leaves on-target short fields untouched', () => {
    const cards = [card('kritik', 'rewrite', ['evidence'])];
    const [sanitized] = sanitizeCvChangePlan(cards);
    expect(sanitized.whatToChange).toBe('Bu mətni daha konkret yazın.');
    expect(sanitized.problem).toBe('Vakansiyada bu təcrübə vacibdir.');
    expect(sanitized.recommendedText).toBe('Nümunə tövsiyə mətni.');
  });

  it('truncates an oversized whatToChange/problem to a bounded character length with an ellipsis', () => {
    const cards = [
      card('kritik', 'rewrite', ['evidence'], { whatToChange: 'x'.repeat(300), problem: 'y'.repeat(300) }),
    ];
    const [sanitized] = sanitizeCvChangePlan(cards);
    expect(sanitized.whatToChange.length).toBeLessThan(300);
    expect(sanitized.whatToChange.endsWith('…')).toBe(true);
    expect(sanitized.problem.length).toBeLessThan(300);
    expect(sanitized.problem.endsWith('…')).toBe(true);
  });

  it('truncates an oversized recommendedText to a bounded word count rather than an unbounded paragraph', () => {
    const longText = Array.from({ length: 200 }, (_, i) => `söz${i}`).join(' ');
    const cards = [card('kritik', 'rewrite', ['evidence'], { recommendedText: longText })];
    const [sanitized] = sanitizeCvChangePlan(cards);
    const wordCount = sanitized.recommendedText.replace('…', '').trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(100);
    expect(sanitized.recommendedText.endsWith('…')).toBe(true);
  });

  it('truncates each oversized evidence reference independently rather than dropping the card', () => {
    const cards = [card('kritik', 'rewrite', ['e'.repeat(200), 'short one'])];
    const [sanitized] = sanitizeCvChangePlan(cards);
    expect(sanitized.evidenceFromCv[0].length).toBeLessThan(200);
    expect(sanitized.evidenceFromCv[1]).toBe('short one');
  });
});

describe('computeCvChangesSummary', () => {
  it('counts cards by priority tier, matching the free-tier premium-preview numbers', () => {
    const cards = [{ priority: 'kritik' as const }, { priority: 'kritik' as const }, { priority: 'əsas' as const }, { priority: 'üstünlük' as const }];
    expect(computeCvChangesSummary(cards)).toEqual({ critical: 2, important: 1, optional: 1 });
  });

  it('returns all zeros for an empty plan rather than throwing', () => {
    expect(computeCvChangesSummary([])).toEqual({ critical: 0, important: 0, optional: 0 });
  });
});

describe('computeInterviewRisksCount', () => {
  it('counts kritik OR əsas requirements that are not met — broader than criticalGapsCount (kritik only)', () => {
    const requirements = [
      req('kritik', 'missing'),
      req('əsas', 'partial'),
      req('əsas', 'met'), // met — not a risk
      req('üstünlük', 'missing'), // üstünlük — never counted as an interview risk
    ];
    expect(computeInterviewRisksCount(requirements)).toBe(2);
    expect(computeInterviewRisksCount(requirements)).not.toBe(computeCriticalGapsCount(requirements));
  });
});

