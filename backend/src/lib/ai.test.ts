import { describe, it, expect } from 'vitest';
import { resolveLangName, analyzeMatch, generateCvChangePlan, generateInterviewPrep, INTERVIEW_CALL_TIMEOUT_MS } from './ai.js';

// vitest.setup.ts deletes OPENAI_API_KEY globally, so every call in this file exercises the
// offline fallback path (getClient() returns null) — no live API calls, deterministic output.

describe('resolveLangName', () => {
  it('resolves supported languages to their prompt name', () => {
    expect(resolveLangName('az')).toBe('Azərbaycan');
    expect(resolveLangName('en')).toBe('English');
  });

  it('falls back to English for unsupported/legacy values, not Azerbaijani — PeekMatch targets the global market', () => {
    expect(resolveLangName('tr')).toBe('English');
    expect(resolveLangName('ru')).toBe('English');
    expect(resolveLangName('')).toBe('English');
    expect(resolveLangName('bogus')).toBe('English');
  });
});

describe('offline fallback content follows outputLanguage (no Azerbaijani leakage into an English result, or vice versa)', () => {
  it('analyzeMatch offline fallback returns Azerbaijani placeholder copy for outputLanguage=az', async () => {
    const result = await analyzeMatch('CV mətni'.repeat(300), 'Vakansiya mətni'.repeat(300), 'az');
    expect(result.vacancyTitle).toBe('Vakansiya');
    expect(result.mostImportantMissingRequirement).toBe('OPENAI_API_KEY konfiqurasiya olunmayıb');
  });

  it('analyzeMatch offline fallback returns English placeholder copy for outputLanguage=en', async () => {
    const result = await analyzeMatch('CV text'.repeat(300), 'Vacancy text'.repeat(300), 'en');
    expect(result.vacancyTitle).toBe('Vacancy');
    expect(result.mostImportantMissingRequirement).toBe('OPENAI_API_KEY is not configured');
    // No Azerbaijani placeholder strings should leak into an English-selected result.
    expect(result.compatibilityLabel).not.toMatch(/uyğunluq/i);
    expect(result.criticalGapSummary).not.toMatch(/konfiqurasiya/i);
  });

  it('analyzeMatch offline fallback falls back to Azerbaijani copy for an unrecognized outputLanguage (offline path only distinguishes en vs. everything else)', async () => {
    const result = await analyzeMatch('CV mətni'.repeat(300), 'Vakansiya mətni'.repeat(300), 'tr');
    expect(result.vacancyTitle).toBe('Vakansiya');
  });

  it('generateCvChangePlan offline stub is localized', async () => {
    const az = await generateCvChangePlan('cv', 'vacancy', { compatibility: 50, cvPresentationScore: 50, requirements: [], weakPresentation: [] } as any, 'az');
    const en = await generateCvChangePlan('cv', 'vacancy', { compatibility: 50, cvPresentationScore: 50, requirements: [], weakPresentation: [] } as any, 'en');
    expect(az.cards[0].section).toBe('CV Dəyişiklik Planı');
    expect(en.cards[0].section).toBe('CV Change Plan');
    // whatToChange (the short "what to do" field, added alongside the concise-card redesign) must
    // follow outputLanguage the same as every other free-text field on the card.
    expect(az.cards[0].whatToChange).not.toBe('');
    expect(en.cards[0].whatToChange).not.toBe('');
    expect(az.cards[0].whatToChange).not.toBe(en.cards[0].whatToChange);
  });

  it('generateInterviewPrep offline stub is localized', async () => {
    const az = await generateInterviewPrep('cv', { requirements: [], strengths: [] } as any, 'az');
    const en = await generateInterviewPrep('cv', { requirements: [], strengths: [] } as any, 'en');
    expect(az.tellMeAboutYourself).toBe('OPENAI_API_KEY konfiqurasiya olunmayıb.');
    expect(en.tellMeAboutYourself).toBe('OPENAI_API_KEY is not configured.');
  });
});

describe('Interview Playbook performance budget', () => {
  it('per-call timeout never silently regresses past the documented 30s job deadline', () => {
    // Guards against a future edit accidentally bumping this back toward the old 75s value —
    // the whole point of the fix was a real, enforced <=30s budget (see
    // INTERVIEW_PLAYBOOK_FIX_REPORT.md for the measured before/after).
    expect(INTERVIEW_CALL_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
