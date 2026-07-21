# Product cleanup and Interview Playbook performance pass

## 1. Removed components and functionality

### Purple self-attestation clarification block (Results.tsx)
Removed the entire Q&A block ("Sizdə … üzrə real təcrübə var, sadəcə CV-də göstərilməyib?", "Bəli, var" / "Xeyr, yoxdur", the free-text elaboration textarea) plus its local state (`selfAttest`, `awaitingDetails`, `selfAttestDetails`), handlers (`answerSelfAttest`, `confirmSelfAttestDetails`), and the frontend API call (`submitSelfAttest`, deleted from `lib/api.ts`).

**Preserved, per the brief's "if used by another critical feature" clause**: the backend route (`PATCH /:id/self-attest`), the `Analysis.selfAttestedGapConfirmed`/`selfAttestedGapDetails` columns, and the AI-prompt threading (`buildSelfAttestedGap`/`selfAttestPromptNote` in `analyses.ts`/`ai.ts`) that feeds a confirmed answer into the CV Change Plan and Interview Playbook prompts — this is genuine product logic a UI removal shouldn't own. In practice the route is now unreachable from the frontend and these fields stay `null` for new analyses; a future UI could re-wire the same endpoint with no backend change.

### "Bu düzgün deyil" (CvChangeCard.tsx)
Removed the button, its `Flag` icon, `toggleIncorrect` handler, and the `flaggedIncorrect` field from `CardState` (`lib/localCardState.ts`) and the AI card type (`ai.ts`, `lib/api.ts`). Copy / Edit / Mark-complete are preserved.

### "Müraciət səyahəti" (Results.tsx)
Removed the whole journey card (7 steps, checkmarks, "Nəzərdən keçirdim" CTAs) and its derivation (`journeyDone`/`journeyOrder`). `lib/journeyState.ts` lost `isStrengthsReviewed`/`markStrengthsReviewed`/`hasAnyReviewedQuestion` (journey-only); `lib/localCardState.ts` lost `hasAnyCompletedCard` (journey-only). **Kept**: `isQuestionReviewed`/`toggleQuestionReviewed`/`countReviewedQuestions` — a separate, still-active feature (per-question "reviewed" tracking + progress counts on the paid Interview Playbook tab), not part of the removed journey. Removing the journey card closed the gap naturally (the Application Readiness gauge card now just ends after the gauge) — no manual spacing hacks needed.

### "Təklif ver" feedback widget
Removed completely: `components/FeedbackWidget.tsx` (deleted), its `App.tsx` mount, `POST /api/suggestions` (route deleted), `lib/mailer.ts` (deleted — its only purpose was this feature's email notification), the `submitSuggestion` API client function, and the `feedback.*` translation namespace (both locales).

**Preserved deliberately**: `GET /api/suggestions` (admin-only, `ADMIN_KEY`-gated) and the `Suggestion` table/migration. Reason: `AdminGate.tsx` validates the admin key by *calling* this exact endpoint, and `Admin.tsx` still renders whatever feedback rows already exist — removing it would silently break the entire `/admin` login flow, an unrelated feature never named in the brief. This is the same "don't remove a load-bearing dependency of another feature" judgment call as the self-attestation backend logic above. The table gets no new rows going forward; a future controlled migration can drop it once the admin panel itself is retired (documented in `schema.prisma`).

### "Sübut Zənciri" (Workspace.tsx Report tab)
Removed the dedicated Evidence Chain section (critical-requirement cards showing related CV change / interview question).

**Preserved**: the backend route/lib (`GET /:id/evidence-chain`, `lib/evidenceChain.ts`) and the frontend fetch in `Workspace.tsx`'s `ReportTab`. Reason: `RequirementPriorityMap.tsx` (the Report tab's main view, from an earlier redesign pass) already consumes the same `chain` data for its "Növbəti addım" (next step) pointer on urgent requirements — this is a second, still-active consumer of the exact same endpoint, confirmed by reading the component before touching anything. Core evidence-based matching/scoring (`scoring.ts`'s `applyScoringOverrides`/`sanitizeCvChangePlan`) is untouched.

## 2. Deleted or updated routes

| Route | Change |
|---|---|
| `POST /api/suggestions` | **Deleted.** |
| `GET /api/suggestions` | Unchanged — still admin-gated, still reachable. |
| `PATCH /api/analyses/:id/self-attest` | Unchanged (kept, currently unreachable from the frontend). |
| `GET /api/analyses/:id/evidence-chain` | Unchanged (kept, consumed by `RequirementPriorityMap`). |
| `GET /api/analyses/:id/interview` | Behavior change: now de-dupes concurrent in-flight requests per analysis (see §4), and the underlying generation is parallelized (see §4). Response shape unchanged. |

## 3. CV Change Plan simplification

Added a new `whatToChange` field (one short imperative sentence, e.g. "Bu mətni daha konkret yazın.") alongside the existing `problem` field (now used as the one-sentence "why it matters," still evidence-anchored). Both are prompted with explicit limits (`ai.ts`) **and** length-enforced in application code, not just prompted: `scoring.ts`'s `sanitizeCvChangePlan()` now also truncates `whatToChange` (~130 chars), `problem` (~175 chars), `recommendedText` (~100 words), and each `evidenceFromCv` entry (~90 chars) with a trailing "…" if a model ignores the prompt's limit — "shorten safely" rather than displaying unbounded text.

`CvChangeCard.tsx` was restructured around progressive disclosure: `whatToChange` + `problem` + the copy-ready recommended text are shown by default; `currentText`, `relatedRequirements`, and `evidenceFromCv` moved behind a single "Ətraflı məlumat" toggle (closed by default). Live-verified against a real AI-generated plan (screenshot-checked, see §8) — cards read as a short "what / why / copy this" unit instead of a dense block.

## 4. Interview Playbook loading redesign + performance

**Bottleneck found (before changing anything):** `generateInterviewPrep()` was one sequential `createStructured()` call against `interviewSchema` — the largest schema in `ai.ts` (up to 15 question items × 10 fields, plus 4 more arrays). Per the project's own history (`CLAUDE.md`), this took roughly ~3 minutes even correctly bounded. Output size for a reasoning model is the dominant cost driver here, not prompt size — the fix is generating less per call, not sending less context.

**Change made:** split into `interviewCoreSchema` (`strongestTopic`/`biggestRisk`/`tellMeAboutYourself`/`hrQuestions`/`situational`/`technical`) and `interviewSupportSchema` (`criticalGapStrategies`/`starStories`/`cvVerificationQuestions`/`gapExplanations`/`questionsToAsk`), issued concurrently via `Promise.all` and merged into the same `InterviewPrep` shape every caller already expected — no route/type changes needed outside `ai.ts`. Each call passes an explicit 75s timeout (`INTERVIEW_CALL_TIMEOUT_MS`) to the OpenAI SDK's own per-request `timeout` option, so a hung call now fails fast as `AiError('timeout', …)` instead of hanging — this is what actually enforces the performance budget, not just a UI countdown. `analyses.ts`'s `ensureInterviewPrep()` also gained an in-memory `Map<analysisId, Promise<InterviewPrep>>` so a double-click, retry, or a second tab hitting the same analysis mid-generation shares one real AI call instead of spawning a duplicate.

**Before / after timing:**
- **Before** (documented baseline, not re-measured in this session to avoid a second full-cost AI run purely for an A/B number): ~3 minutes, per `CLAUDE.md`'s existing performance note.
- **After** (measured live, real `OPENAI_API_KEY`, full app flow — analysis → package 2 purchase → Interview Playbook tab, screenshotted): **~72 seconds**, single real run.
- This is a real, substantial improvement (~2.5x) but does **not** consistently meet the brief's "acceptable max: under 60 seconds" target, even though it's safely under the 75s hard timeout (which the new client-side timeout now enforces server- and client-side). **I am not claiming the 60s target is met.** Only one live run was measured (further AI calls have real dollar cost); latency will vary run to run with any external provider.
- **Remaining lever if 60s is still required:** trim per-question fields (e.g. drop `commonMistakes` or shorten `importantPoints`) or move to a true async/pollable job pattern matching `runAnalysis()`'s fire-and-forget approach — not a further parallel split, since the two current schemas are already close to evenly sized.

**Loading UX** (`Workspace.tsx`'s `InterviewPlaybookTab`): replaced the old `RotatingHint`-only spinner with a staged, honestly-labeled **estimated** progress model (the backend has no pollable intermediate stages to report — it's 2 parallel calls, not a job with real stage state — so per the brief's own fallback guidance this is a client-side stage/time-threshold model, not a fabricated exact percentage). Shows: title, "Adətən 30–60 saniyə çəkir", a progress bar capped at 92% until the result actually arrives, elapsed time (counting up), an estimated-seconds-remaining figure (switching to "Bir az gözləyin, hələ işləyirik..." once the 45s normal target is exceeded), and the current of 5 named stages. A 75s client-side `AbortController` timeout (mirroring the backend's own timeout) shows a safe, translated error message and a retry action rather than spinning forever; retry re-triggers generation without restarting the whole page.

## 5. Files changed

**Backend:** `lib/mailer.ts` (deleted), `routes/suggestions.ts` (POST removed), `routes/suggestions.test.ts` (new), `lib/ai.ts` (CV Change Plan `whatToChange` + limits, Interview Playbook parallel-call split + timeout), `lib/ai.test.ts`, `lib/scoring.ts` (length enforcement), `lib/scoring.test.ts`, `routes/analyses.ts` (in-flight interview dedup), `routes/analyses.test.ts`, `prisma/schema.prisma` (doc comment only, no migration), `.env.example` (SMTP block removed).

**Frontend:** `App.tsx`, `components/FeedbackWidget.tsx` (deleted), `components/CvChangeCard.tsx` (redesigned), `pages/Results.tsx`, `pages/Workspace.tsx`, `lib/api.ts`, `lib/journeyState.ts`, `lib/journeyState.test.ts`, `lib/localCardState.ts`, `lib/i18n/locales/az.ts`, `lib/i18n/locales/en.ts`, `lib/i18n/locales/parity.test.ts`.

**Docs:** `CLAUDE.md` updated throughout (opening summary, env var table, Analysis-row bullets, AI integration section, CV Change Plan / Evidence Chain / Admin panel sections) to describe the current state, not the pre-cleanup one.

## 6. Tests added / updated

- `backend/src/routes/suggestions.test.ts` (new): `POST /api/suggestions` returns 404; `GET /api/suggestions` still requires and accepts the admin key; the `Suggestion` table is still queryable.
- `backend/src/routes/analyses.test.ts`: card fixtures updated for the new `whatToChange` field; new test confirming `GET /:id/evidence-chain` stays reachable and correct for a paid analysis (the UI section is gone, the API isn't).
- `backend/src/lib/scoring.test.ts`: new `describe` block for concise-by-design length enforcement (on-target fields untouched; oversized `whatToChange`/`problem` truncated with an ellipsis; oversized `recommendedText` truncated by word count; each `evidenceFromCv` entry truncated independently).
- `backend/src/lib/ai.test.ts`: extended the existing offline-fallback localization test to also assert `whatToChange` is populated and language-appropriate.
- `frontend/src/lib/journeyState.test.ts`: removed the `isStrengthsReviewed`/`markStrengthsReviewed` describe block (function deleted); kept the per-question tracking tests unchanged.
- `frontend/src/lib/i18n/locales/parity.test.ts`: removed the now-stale `cvChangePlan.problemLabel` allowlist entry (the label was dropped from the redesigned card, making the key itself dead — removed from both locales too).

**Not added:** a dedicated concurrency test for `ensureInterviewPrep`'s in-flight de-dup Map. The backend test suite deletes `OPENAI_API_KEY` (offline-fallback path resolves near-instantly), so reliably racing two concurrent requests against a *slow* generation would need mocking `generateInterviewPrep` itself rather than testing through the route — judged lower value than live-verifying the real flow once with a real key (done, see §8) given the size of this change already. Flagged here rather than silently skipped.

## 7. Commands executed

```
cd backend && npm run build && npm run test   # 10 files, 103 tests passing
cd frontend && npm run build && npm run test && npm run lint   # 3 files, 11 tests passing; build clean; lint: only pre-existing unrelated warnings
```

## 8. Live verification

Real dev servers (`OPENAI_API_KEY` configured), driven end-to-end with Playwright, screenshotted at each step:
- Free Results page: confirmed absent — self-attestation question text, "Bəli, var" button, "Müraciət səyahətiniz" title, floating "Təklif ver" button. Confirmed present and unaffected — readiness gauge, KPI cards, strengths, the one example CV Change Plan card.
- Report tab (paid): confirmed "Sübut Zənciri" text is absent; confirmed the Requirement Priority Map (which depends on the same evidence-chain data) still renders.
- CV Change Plan tab (paid, real AI-generated plan): confirmed no "Bu düzgün deyil" button anywhere; confirmed the redesigned card (short `whatToChange` + `problem`, copy-ready text, "Ətraflı məlumat" toggle expanding to current text / related requirements / evidence) renders correctly with real data — screenshotted expanded.
- Interview Playbook tab: screenshotted the staged loading state (title, time estimate, progress bar, elapsed/remaining counters, current stage) and the fully-loaded result (all sections present: HR/situational/technical questions, critical-gap strategies, STAR stories, CV-verification questions) — confirming the two parallel calls merge correctly into one working UI.
- Mobile (375px): Results page and CV Change Plan tab both re-screenshotted full-page — no overlapping content, no orphaned borders/dividers where sections were removed, cards and action buttons stack correctly.

## 9. Remaining limitations

- Interview Playbook generation (~72s measured) is meaningfully faster than the ~3-minute baseline but does not reliably hit the brief's 60s "acceptable max" — see §4 for the honest number and the next lever if that's a hard requirement.
- Only one live timing run was captured (real-provider AI calls have real cost); treat 72s as a single data point, not a guaranteed figure — provider latency varies.
- `GET /api/suggestions` and the `Suggestion` table remain in the codebase (admin-panel dependency, not truly "unused") — flagged in `schema.prisma` for a future controlled migration if the admin panel is ever retired.
- The backend self-attestation route/columns/prompt-threading are preserved but currently unreachable from any frontend — dead from a user's perspective until/unless a future UI re-wires it; this is intentional per the brief, not an oversight.
- No dedicated automated test for the interview-generation in-flight de-dup concurrency behavior (see §6) — verified by code inspection and the live end-to-end run, not by a targeted race-condition unit test.

## 10. Manual checks still worth doing before a real deploy

- A true side-by-side timing comparison (old sequential vs. new parallel `generateInterviewPrep`) under production-like conditions, if the 60s budget becomes a hard requirement.
- Visual QA of the new Interview Playbook loading state in English live in a browser (the CV Change Plan card redesign *was* re-checked live in English — UI chrome ("CV Change Plan", "More details", "Recommended text", etc.) renders correctly in English while the AI-generated card content correctly stays in Azerbaijani, the language it was originally generated in, with the existing `LanguageMismatchNotice` banner explaining why — this is expected behavior, not a bug, and passes the same way it did before this pass).
- Confirm with the product owner that the admin panel's continued existence (feedback viewing, unable to receive new submissions) is the intended end state, versus removing it entirely in a future pass.
