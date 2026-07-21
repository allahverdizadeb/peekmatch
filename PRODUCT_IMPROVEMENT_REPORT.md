# PeekMatch Premium Repositioning — Product Improvement Report

## What changed, in one paragraph

PeekMatch's premium tier previously read as "AI wrote you some documents" — a generic Tailored CV, a cover letter, and interview questions, sold across three packages priced in USD ($0.49 / $0.99 / $5.90). This pass repositions the product around **evidence-based traceability**: every recommendation now must trace back to the vacancy, the candidate's CV, or something the candidate explicitly confirmed. The centerpiece is a new **CV Change Plan** (structured, evidence-cited change cards, replacing the old silent-CV-rewrite), enforced by a **Truth Lock** mechanism implemented in application code (not just prompted), plus an **Evidence Chain** traceability view, a **CV Recheck** feature, an upgraded **Interview Playbook**, and a simplified 2-tier pricing structure ($4.90 Application Package / $9.90 Interview Ready Package).

## Previous features replaced or renamed

| Before | After |
|---|---|
| "Tailored CV" (silently generates a whole replacement CV) | **CV Change Plan** — a list of evidence-cited change cards (rewrite/add/clarify/remove) against the candidate's *existing* CV |
| 3 packages: Report ($0.49) / CV+Letter ($0.99) / Interview ($5.90) | 2 packages: **Application Package** ($4.90 — report + CV Change Plan + Cover Letter + 1 recheck) / **Interview Ready Package** ($9.90 — adds Interview Playbook + 1 more recheck) |
| "Interview Prep" (3-4 questions per category, question/why/answerFramework only) | **Interview Playbook** — 10-15 prioritized questions with 10 fields each, critical-gap response strategies, STAR story plans, CV-verification questions |
| Cover letter as a flat array of paragraph strings | Cover letter with a **tone selector** (professional/confident/short) + a `POST /regenerate` endpoint + per-paragraph purpose labels (intro/evidence/achievement/closing) |
| One `compatibility` score | Two independent, separately-labeled scores: `compatibility` (Candidate Fit) and `cvPresentationScore` (CV Presentation Quality) |
| Generic "unlock premium report" upsell with a blurred mock | Real, app-computed premium preview (`N kritik CV dəyişikliyi`, `N vacib CV dəyişikliyi`, `N könüllü təkmilləşdirmə`, `N müsahibə riski`) plus one fully-unlocked example card |
| — (didn't exist) | **Evidence Chain** (requirement → CV evidence → status → related CV change → related interview question) |
| — (didn't exist) | **CV Recheck** — upload an updated CV, get a real re-analysis + diff, capped by package tier |
| — (didn't exist) | Minimal first-party analytics event log (`Event` model, `POST /api/events`) |

## New product flow

**Free tier** (`GET /:id/result`): Candidate Fit + CV Presentation Quality (shown together, clearly separate), real-vs-visible match teaser, 3 strengths, the single most important gap with a Truth-Lock self-attestation prompt (Yes/No + optional free-text elaboration when "Yes"), an application recommendation, real premium-preview counts (`cvChangesSummary`, `interviewRisksCount` — computed by app code, never hardcoded), and one fully-unlocked CV Change Plan card as a concrete example.

**Application Package ($4.90)**: full CV Change Plan (grouped by rewrite/add/clarify/remove, each card with copy/mark-complete/edit/"this is incorrect" actions and a completion progress bar), the full report (now including Evidence Chain), a tone-selectable Cover Letter, and 1 CV Recheck.

**Interview Ready Package ($9.90, upgrade-priced from Application Package)**: everything above, plus the Interview Playbook (priority-grouped questions, critical-gap strategies, STAR story plans, 60-second introduction, CV-verification questions, questions to ask the interviewer), and a 2nd CV Recheck.

## Truth Lock — how it's actually enforced

The brief's central requirement — "never invent candidate experience" — is implemented as **deterministic application code**, not a prompt promise:

- `scoring.ts`'s `sanitizeCvChangePlan()` drops any `rewrite`/`add`/`remove` card whose `evidenceFromCv` array is empty. A concrete claim with zero cited evidence is exactly the fabrication risk Truth Lock exists to prevent. `clarify` cards are exempt, since citing no evidence is the entire point of asking the candidate to confirm something.
- This mirrors the pre-existing pattern in `analyzeMatch()`'s `applyScoringOverrides()`, which already downgrades unevidenced `'met'` claims — the same philosophy extended to the new feature.
- Verified live: a real `generateCvChangePlan()` call against a genuine CV/vacancy pair correctly produced honest "ask the candidate" `clarify` cards for ambiguous claims (e.g. "SQL — orta səviyyə") instead of inventing specifics, and cited real CV text for every `rewrite`/`add` card.

## AI prompt / schema changes

- `matchResultSchema`: added `cvPresentationScore` (integer) + `cvPresentationLabel` (string) — an independent quality axis from `compatibility`, with its own system-prompt instruction distinguishing the two ("compatibility measures fit; cvPresentationScore measures how well the CV *presents* that fit").
- Replaced `generateTailoredCv`/`cvDataSchema` with `generateCvChangePlan`/`cvChangePlanSchema` (`cards: CvChangeCard[]`).
- `generateCoverLetter`: added a `tone` parameter (`professional`/`confident`/`short`) threaded into the prompt; `body` changed from `string[]` to `{purpose, text}[]`.
- `generateInterviewPrep`/`interviewSchema`: each question gained `priority`, `relatedRequirement`, `relevantExperience`, `importantPoints[]`, `missingInformation`, `commonMistakes`, `likelyFollowUps[]`; added top-level `criticalGapStrategies[]`, `starStories[]`, `cvVerificationQuestions[]`.
- All offline fallbacks (used when `ANTHROPIC_API_KEY` is unset) updated to match the new shapes.

## Two real bugs found and fixed via live testing (not caught by unit tests)

Both were confirmed with real Anthropic API calls against a genuine CV/vacancy pair — this is exactly the kind of AI-integration issue a mocked test suite cannot catch, and matches this project's established pattern of verifying AI-adjacent changes live before trusting them:

1. **`generateCvChangePlan` truncation.** `max_tokens: 8000` was too small for 6-10 evidence-cited cards; a real call produced `Unterminated string in JSON`. Raised to 16000 (matching `analyzeMatch`'s prior fix for the identical class of bug).
2. **`generateInterviewPrep` runaway generation — the more serious of the two.** The original prompt said "10-15 questions" with no per-category cap. A real call **hung for ~58 minutes** before the Anthropic SDK's own connection timeout fired — not a truncation, a genuinely oversized generation. Fixed by making per-category limits explicit in the prompt ("3-5 HR sualı, 3-5 situasiya sualı, 3-5 texniki sual — CƏMİ 10-15, hər kateqoriyada ən çoxu 5", plus explicit caps on strategies/stories/questions) and lowering `max_tokens` to 14000 as a safety ceiling rather than the thing doing the bounding. Re-verified live: completed in ~192s with exactly 5+5+5 questions and correctly-capped extra sections.

A third, smaller issue was found the same way: **`computeRecheckDiff`'s exact-title matching silently dropped resolved gaps.** A real recheck showed a genuinely-improved requirement ("Power BI təcrübəsi (dashboard, DAX, Power Query)" → "...(minimum 2 il, dashboard, DAX, Power Query)") as absent from the diff, because `analyzeMatch` doesn't reproduce byte-identical requirement titles across two separate calls. Fixed with a fuzzy title matcher (exact → substring → parenthetical-stripped-core → majority word-overlap), shared conceptually with `evidenceChain.ts`'s existing fuzzy matching.

## Package structure implementation

- `PACKAGES` in `pricing.ts` collapsed from 3 keyed entries to 2 (`{1: 4.90, 2: 9.90}`).
- `highestOwnedPackage()` defensively caps any stale `package: 3` row (from real dev-database orders created before this restructure) down to the new top tier, rather than treating it as unrecognized.
- `unlocksReport`/`unlocksCv` (3 separate gates) collapsed to `unlocksApplication` (package 1+) and `unlocksInterview` (package 2 only).
- `upgradePriceUsd()` unchanged in shape — still computes the diff in integer cents server-side. Verified live: upgrading from package 1 to package 2 charged exactly `$9.90 − $4.90 = $5.00`.
- `POST /orders` never reads a client-supplied price — verified both by a new automated test and a live call that sent `amountUsd: 0.01` and still got charged `$4.90`.

## Files changed

**Backend:** `prisma/schema.prisma` (+migration: `tailoredCvJson`→`cvChangePlanJson` rename, +`selfAttestedGapDetails`/`recheckCvText`/`recheckResultJson`/`recheckCount`, +`Event` model), `lib/pricing.ts`, `lib/anthropic.ts`, `lib/scoring.ts` (+5 new pure functions), `lib/evidenceChain.ts` (new), `lib/docGen.ts` (removed the now-obsolete `cvToDocx`/`cvToPdf`, updated `coverLetterToDocx` for the new paragraph shape), `routes/analyses.ts`, `routes/events.ts` (new), `app.ts` (mount events route).

**Frontend:** `lib/api.ts`, `lib/analytics.ts` (new), `lib/localCardState.ts` (new), `components/CvChangeCard.tsx` (new), `components/LockPanel.tsx` (extracted from Workspace.tsx), `pages/Results.tsx`, `pages/Pricing.tsx`, `pages/Checkout.tsx`, `pages/Workspace.tsx` (CvPlanTab replaces CvTab; CoverLetterTab gets tone selector; InterviewTab→InterviewPlaybookTab; ReportTab gains Evidence Chain; new RecheckTab), `pages/Landing.tsx` (pricing preview section updated to 2 packages), `pages/PaymentStatus.tsx` (analytics event), `lib/i18n/locales/az.ts` + `en.ts` (new `cvChangePlan` section, extensive `workspace`/`results`/`pricing`/`checkout` additions, 9 dead keys removed from the old full-CV-document feature).

## Tests added

- `backend/src/lib/scoring.test.ts`: 15 new tests for `sanitizeCvChangePlan`, `computeCvChangesSummary`, `computeInterviewRisksCount`, `computeRecheckDiff` (including the fuzzy-title-match regression test for the exact bug found live), `computeApplicationReadiness`.
- `backend/src/lib/evidenceChain.test.ts` (new file, 5 tests): requirement-to-card linking, requirement-to-question linking, fuzzy matching, null-safety, field preservation.
- `backend/src/lib/pricing.test.ts`: rewritten for the 2-tier structure, including the stale-`package:3` capping behavior.
- `backend/src/routes/analyses.test.ts` (new file, 15 tests, supertest against the real Express app with Prisma fixtures, no live AI calls): free-result field separation (`compatibility` vs `cvPresentationScore`), real (non-hardcoded) premium-preview counts, example-card selection, report-gating leak checks, package-1-vs-package-2 entitlement gating, server-computed price integrity (client-supplied `amountUsd` ignored; unknown package rejected), self-attestation persistence + cache invalidation, recheck package-tier limits (1 for package 1, 2 for package 2) and 402/403 rejection paths.
- **Not claimed as automated**: AI-content quality (question specificity, gap-strategy tone, STAR-story honesty) — these were spot-checked via real live calls (documented above) but are inherently not something a deterministic test suite can assert on non-deterministic model output. This was a stated scope decision going in, not an oversight.

Final counts: **backend 94/94 tests passing** (was 58 before this pass), **frontend 4/4 passing**, both `npm run build`s clean.

## Commands executed

```
cd backend && npx prisma migrate deploy   # + a hand-written migration (non-interactive env, migrate dev unavailable)
cd backend && npx prisma generate
cd backend && npm run build && npm run test
cd frontend && npm run build && npm run lint && npm run test
```

Plus extensive live verification against the real Anthropic API (not mocked) using a realistic Azerbaijani CV/vacancy pair: full analysis → free result → package 1 purchase → CV Change Plan / Evidence Chain / Cover Letter (+ tone regenerate) → CV Recheck → package 2 upgrade → Interview Playbook. Also a Playwright-driven visual check of Results/Pricing/Workspace (cv-plan and report tabs) confirming zero console errors and correct rendering of every new UI element.

## Remaining limitations (stated up front in the plan, not discovered after the fact)

- **Missing-info flow is simplified**: the brief describes a full dynamic multi-question wizard (role/budget/responsibility/result follow-ups per gap). This implementation keeps the existing single-gate self-attestation (most important missing requirement only) and adds one free-text elaboration field — not a branching AI-driven question tree. Other "Clarify"-type CV Change Plan cards get the required per-card actions (mark-complete/incorrect) instead of individual AI-gated regeneration.
- **Analytics is a minimal first-party event log**, not a real analytics platform — no dashboards, no vendor integration. 5 of the brief's ~12 suggested events are wired (package_selected, checkout_started, payment_completed, cv_change_copied, recheck_completed); extending to the rest is a matter of adding entries to `events.ts`'s allowlist and calling `track()` at the new trigger points.
- **Card completion/edit/"incorrect" state is `localStorage`-only** — no backend entity per interaction exists, so this state doesn't sync across devices and resets if browser storage is cleared. The "incorrect" flag is a local visual marker only; it is not wired to the admin feedback system.
- **`generateInterviewPrep` still takes ~3 minutes** even correctly bounded (it's the largest schema in the app). It's purchase-gated and cached after first generation, and the existing loading-state UI (rotating hints) already accounts for a wait — but if this becomes a UX complaint, the fix is an async/pollable generation pattern (matching `runAnalysis()`'s existing fire-and-forget approach), not further prompt trimming.
- **`GET /:id/cv-plan` has no document-export endpoint** (no PDF/DOCX of "the whole plan"). The old `cvToDocx`/`cvToPdf` were removed since they were tied to the retired full-CV-document data shape; each card's "Copy" button covers the copy-ready-text requirement. A plan-wide export was not part of the approved plan.
- **AI-content quality claims (question specificity, honest gap-strategy tone, STAR-story non-fabrication)** are enforced by prompt instructions + the evidence-required schema fields, but are not independently fact-checked by automated tests, per the scope decision above.
- Carried over from the prior QA-audit pass (not re-touched here, still open): git history contains a historical `dev.db` leak requiring an explicit team decision on history rewriting; payments remain fully simulated (no real payment provider).

## Manual checks recommended before a real launch

1. Native-speaker Azerbaijani + English review of all new copy (CV Change Plan card labels, Interview Playbook section headers, tone-selector labels) — machine-verified for structural parity (`tsc -b` + `parity.test.ts`), not for tone/fluency.
2. A second live end-to-end run with `outputLanguage: 'en'` specifically for the CV Change Plan and Interview Playbook schemas (this pass verified Azerbaijani output live; the existing haiku/sonnet language-compliance split assumption carries over but wasn't independently re-verified for these two newly-expanded schemas in English).
3. Decide whether the ~3-minute Interview Playbook generation time is acceptable for a real launch, or whether to invest in the async/pollable pattern now rather than after a user complaint.
4. Confirm the `localStorage`-based card-completion UX (no sync, resets on storage clear) is acceptable, or prioritize a lightweight backend-backed version if user testing flags it.
