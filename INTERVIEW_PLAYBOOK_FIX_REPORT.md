# Interview Playbook fix — root cause, performance, and loading-experience rewrite

## 1. Root cause (confirmed with real logs, not guessed)

Reproduced the exact reported symptom end-to-end (real UI: analysis → package 2 purchase → Interview Playbook tab) with safe timing instrumentation added to `ai.ts`/`analyses.ts` first, then captured real backend logs:

```
[ai:timing] openai_call 61021ms {"schema":"interview_prep_support","status":"completed"}
[ai:timing] openai_call_failed 75009ms {"schema":"interview_prep_core"}
[ai] APIConnectionTimeoutError: Request timed out.
    at async createStructured (.../ai.ts:184:22)
    at async Promise.all (index 0)
    at async generateInterviewPrep (.../ai.ts:902:27)
```

**Root cause**: the Interview Playbook's larger schema (`interview_prep_core` — up to 15 question items × 10 fields) hit its 75-second per-call timeout and failed outright; the smaller `interview_prep_support` call succeeded but still took 61s. This is exactly the reported failure (stuck loading, then "Müsahibə hazırlığını yaratmaq mümkün olmadı..."). It was not caused by a wrong ID, entitlement mismatch, wrong endpoint, malformed JSON, a swallowed exception, a race condition, or a frontend bug — the request/response/DB/entitlement plumbing was all correct; the AI generation was genuinely too slow for its own timeout.

**Why it was slow — isolated with controlled, real timed comparisons** (not assumed):
- `analyzeMatch` (a *different*, unrelated call) also took 69s and later 36s across two live runs at `reasoning: {effort:'medium'}` — evidence that reasoning effort is a major cost regardless of schema.
- A benchmark of the *exact* failing prompt/schema at `effort:'low'` still timed out at 93s. `effort:'minimal'` isn't supported by this model (`gpt-5.6-terra` only supports `none`/`low`/`medium`/`high`/`xhigh`).
- Trimming the prompt (dropping raw vacancy text, shrinking the CV excerpt) at `effort:'low'`/`'none'` *still* didn't complete within 45s each.
- A single category, slimmed to 9 combined items across 3 categories, completed in **30.4s**.
- A **single category alone** (3 items, slim fields) completed in **10.8s**.

Conclusion: **output size** (item count × fields per item) is the dominant latency driver for this model — more so than reasoning effort or prompt size alone, and the relationship is close to linear. The fix is to generate less per call, in more (still-parallel) calls.

## 2. Fix

### Backend performance (`backend/src/lib/ai.ts`)
- Split `generateInterviewPrep` from **2 parallel calls** (core + support) into **4 parallel calls**: `interview_hr` (hrQuestions + strongestTopic/biggestRisk/tellMeAboutYourself), `interview_situational`, `interview_technical`, `interview_prep_support` (unchanged content, just optimized like the others below).
- Slimmer question schema: dropped `importantPoints`/`missingInformation`/`commonMistakes` — not part of the product's explicit required content list (question, why, answerFramework, relatedRequirement, relevantExperience, likelyFollowUps, priority are).
- Condensed prompt: dropped the complete raw vacancy text entirely (the already-extracted `match.requirements`/`vacancyTitle`/`vacancyCompanyGuess` already encode what the vacancy needs); CV excerpt cut from 12,000 → 5,000 chars for question calls (7,000 for the support call, which needs more narrative depth for STAR stories); match requirements filtered to critical/core only and capped.
- `reasoning.effort` lowered from `'medium'` to `'low'` for all 4 calls.
- Per-call timeout lowered from 75s → **28s** (`INTERVIEW_CALL_TIMEOUT_MS`, exported and guarded by a test so it can't silently regress).
- Safe timing logs added to `createStructured()` (`[ai:timing] openai_call/validate <ms> {schema}`) and to the job runner (`[interview-prep:timing] db_load/db_save/total <ms>`) — durations and schema names only, never CV/vacancy content, prompts, AI output text, or the API key.

### Backend job flow (`backend/src/routes/analyses.ts`)
Replaced the old design (one long-lived `GET /:id/interview` request that blocked for up to ~75-150s, with an in-memory `Map` for de-dup) with a persisted, DB-backed job — matching `runAnalysis()`'s established fire-and-forget pattern:
- **`Analysis.interviewPrepStatus`** (`idle | processing | done | failed`) + **`interviewPrepFailReason`** — new columns, migration `20260721121942_interview_prep_job_status` (additive, non-destructive).
- **`POST /:id/interview/generate`** — idempotent start. Claims the job via a single WHERE-guarded `updateMany` (`interviewPrepStatus IN ('idle','failed')` → `'processing'`); only the request that actually flips it starts real work. This is atomic at the database level, so it correctly prevents duplicate jobs even under true concurrency (verified with 5 simultaneous calls in a test) — not just within one Node process like the old in-memory Map, and it survives a server restart (a real status column, not memory that resets on deploy).
- **`GET /:id/interview/status`** — lightweight poll target, no DB write, no AI call.
- **`GET /:id/interview`** — now returns the finished result only (409 until `done`); an already-completed Playbook still returns immediately with no extra work.
- `DELETE /:id` resets the two new fields alongside the existing content-nulling.

### Frontend loading experience (`frontend/src/pages/Workspace.tsx`)
Removed completely: all elapsed-time state, the `formatMmSs` helper, the "Keçən vaxt" / "Təxminən N saniyə qalıb" countdown, the stage-thresholds-by-elapsed-seconds model, the client-side `AbortController` timeout, and the old error+retry UI.

New design: on mount, call `POST /interview/generate` (idempotent) then poll `GET /interview/status` every 1.8s. A **decorative** stage label + progress-bar position cycle on a fixed interval — carrying no timing information at all (a 12s generation and a 25s one look identical while in progress) — purely so the wait doesn't feel frozen, matching the existing `RotatingHint` pattern already used elsewhere on this same page (`CvPlanTab`). Real completion is detected only via the polled `status`, never by elapsed time. A poll-attempt cap (not time-based, never shown to the user) guards against a genuinely stuck job (e.g. a server restart mid-generation) without reintroducing a countdown. On `failed`, shows one calm sentence with **no retry button and no user action requested** — the effect's own dependencies never auto-restart, and a page refresh/tab-switch remount safely re-calls the idempotent start endpoint.

### Copy (both locales)
- Title/description now match the brief's suggested copy exactly (AZ: "Müsahibə hazırlığınız yaradılır" / "Bir az gözləyin. Hazır olan kimi nəticə avtomatik açılacaq."; EN: "Your interview preparation is being created" / "Please wait. Your results will open automatically when ready.").
- Stages: the 4 suggested stages (AZ/EN).
- Failure message updated to the new refresh-oriented wording: "Müsahibə hazırlığını yaratmaq mümkün olmadı. Səhifəni yeniləyib bir daha yoxlayın."
- Removed keys: `typicalTime`, `elapsedLabel`, `estimatedRemainingPrefix/Suffix`, `waitingTitle/Description`, `almostDoneTitle/Description`, and the now-orphaned `importantPointsLabel`/`missingInfoLabel`/`commonMistakesLabel` (their fields were dropped from the schema).

## 3. Backend performance — before / after (measured, same environment, real API key)

| Stage | Before | After |
|---|---|---|
| `interview_prep_core` (large combined schema) | **FAILED at 75.0s** (timeout) | *(replaced — no longer exists)* |
| `interview_prep_support` | 61.0s | 18.7s |
| `interview_hr` | *(new)* | 18.9s |
| `interview_situational` | *(new)* | 16.4s |
| `interview_technical` | *(new)* | 18.1s |
| Backend total (job start → DB save, all 4 parallel) | **failure** | **18.9s** |
| Frontend-measured total (tab open → Playbook rendered) | stuck / eventual failure message | **21.1s** |

Both are real, single live measurements (not averages — see §7 limitations). The **20-second target** was met on the backend side (18.9s); the **30-second acceptable maximum** was met with real margin end-to-end (21.1s including network/poll overhead).

## 4. OpenAI request count — before / after

- **Before**: 2 parallel calls per generation.
- **After**: 4 parallel calls per generation.

This is a real increase, explicitly traded for the latency win: smaller per-call output size is what actually got generation under the 20-30s budget (verified — reasoning-effort/prompt-trimming alone were not sufficient on their own).

## 5. Files changed

**Backend**: `lib/ai.ts` (schema split, slim fields, condensed prompt, effort/timeout, timing logs), `routes/analyses.ts` (job-status flow replacing the in-memory-Map design, timing logs, DELETE route update), `prisma/schema.prisma` + `prisma/migrations/20260721121942_interview_prep_job_status/`, `lib/ai.test.ts`, `routes/analyses.test.ts`.

**Frontend**: `lib/api.ts` (`InterviewQuestion` trimmed, new `startInterviewPrep`/`getInterviewPrepStatus`/`InterviewPrepStatus`), `pages/Workspace.tsx` (`InterviewPlaybookTab` rewritten, `QuestionCard` trimmed), `lib/i18n/locales/az.ts`, `lib/i18n/locales/en.ts`.

## 6. Tests added / updated

- `ai.test.ts`: fixed the `generateInterviewPrep` call signature (dropped the now-unused `vacancyText` param); new test asserting `INTERVIEW_CALL_TIMEOUT_MS <= 30_000` so the budget can't silently regress.
- `analyses.test.ts`:
  - Updated the existing "package 2 unlocks the Interview Playbook" test for the new generate→poll→fetch flow.
  - New: `POST /generate` and `GET /status` are entitlement-gated the same as `GET /interview`.
  - New: full status lifecycle (`idle` → `processing` → `done`), confirming `GET /interview` 409s until `done` rather than ever returning stale/partial data.
  - New: an already-completed Playbook opens immediately via `GET /interview` with no new `POST /generate` needed.
  - New: 5 concurrent `POST /generate` calls never corrupt state — job settles cleanly to `done` with valid JSON (duplicate-job guard).
  - New: a job with missing analysis data lands in a real `failed` status with a safe reason, not stuck `processing` and not a silent 200.

Not added (documented, not silently skipped): a mocked-OpenAI-client unit test for malformed JSON / refusal / rate-limit scenarios. That validation logic (`parseStructuredResponse`, `toAiError`) is unchanged by this fix, already covered by the codebase's existing design, and was independently confirmed live during diagnosis (a real `APIConnectionTimeoutError` was correctly caught and mapped to `AiError('timeout', ...)`). This codebase has no existing pattern for mocking the OpenAI client in tests; introducing one was judged out of scope for this fix.

## 7. Commands executed

```
cd backend && npm run build && npm run test   # 10 files, 109 tests passing
cd backend && npx prisma migrate dev          # applied 20260721121942_interview_prep_job_status
cd frontend && npm run build && npm run test && npm run lint   # 3 files, 11 tests; build clean; lint: only pre-existing unrelated warnings
```

Live verification: real dev servers, real `OPENAI_API_KEY`, Playwright driving the actual UI (analysis → purchase → Interview Playbook tab), confirming: no seconds/countdown text anywhere, no retry button, new title/description/stage copy renders, generation completes and the Playbook displays automatically (~21s), and the failure state (independently triggered by omitting `cvText`/`resultJson` in a test analysis) shows the new calm message with no button.

## 8. Remaining limitations

- Timing numbers above are **single real measurements**, not statistical averages — external AI provider latency varies run to run. They are representative (multiple runs during diagnosis clustered in the 15-30s range for individual calls) but not a guaranteed constant.
- 4 concurrent OpenAI requests per generation (up from 2) is a real cost/rate-limit tradeoff, not free — flagged for awareness, not hidden.
- No mid-generation cancellation exists: if an analysis is deleted or the server restarts while the 4 calls are in flight, they still run to completion server-side (consuming tokens) even though the result is discarded (`deletedAt: null` guards the DB write) — this is the same class of limitation `runAnalysis()`'s own fire-and-forget design already has, not something newly introduced.
- No new mocked-provider test infrastructure was added (see §6) — genuine timeout/malformed-response paths are exercised live, not in an isolated unit test.
