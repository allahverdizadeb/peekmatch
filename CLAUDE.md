# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PeekMatch — an AI-powered CV ↔ job-vacancy compatibility analysis platform for the Azerbaijani market, built to full parity with the original Claude Design prototype: landing → CV/vacancy analysis → free results dashboard (real-vs-CV-visible match teaser, self-attestation prompt) → pricing (free tier + comparison table) → checkout (upgrade-diff pricing) → payment → paid report / tailored CV / cover letter / interview prep → delete/expired lifecycle, plus legal pages and a shared-secret-gated admin feedback panel.

All user-facing copy and AI output is in Azerbaijani (error messages, prompts, schema enum values like `kritik`/`əsas`/`üstünlük`). Keep new user-facing strings in Azerbaijani unless working on the `outputLanguage` (az/en/ru) pipeline specifically.

There are two independent npm projects with no root package.json / workspace tooling: `backend/` and `frontend/`. Always `cd` into the relevant one before running npm commands.

The site UI is localized into Azerbaijani and English via `frontend/src/lib/i18n/` (`LanguageContext` + per-locale `Dict`-typed files under `locales/`, `LanguageSwitcher` in both headers). `az.ts` is the structural source of truth — `en.ts` is typed as `: Dict` so `tsc -b` fails the build if a key is added to one locale and not the other. The CV-analysis form's separate "AI result language" picker (`outputLanguage`, sent to the backend) seeds from the current UI language on mount but is user-overridable and not re-synced afterward. (Turkish and Russian were previously supported site-wide but were removed at the user's request — `outputLanguage`/UI language are now `'az' | 'en'` only. Existing `Analysis` rows with a stale `outputLanguage` of `'tr'`/`'ru'` fall back to Azerbaijani via `docGen.ts`'s `resolveDocLang()`/`anthropic.ts`'s `LANG_NAME` lookup, both of which default to `az` for any unrecognized value.)

## Commands

```bash
# backend (from backend/)
npm install
npx prisma generate          # regenerate Prisma client after schema.prisma changes
npx prisma migrate dev       # create + apply a new migration during development
npx prisma migrate deploy    # apply existing migrations only (first-time/prod setup)
npm run dev                  # tsx watch, http://localhost:4000
npm run build                # tsc -p tsconfig.json -> dist/
npm start                    # node dist/index.js

# frontend (from frontend/)
npm install
npm run dev                  # vite, http://localhost:5173, proxies /api -> :4000
npm run build                # tsc -b && vite build
npm run lint                 # oxlint (NOT eslint)
npm run preview
```

There is no test suite in either project — don't invent test commands or assume Jest/Vitest exists.

### Environment (`backend/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path, defaults to `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Powers matching analysis, tailored CV, cover letter, interview prep, and OCR. Split across two model tiers (see `lib/anthropic.ts`'s `MODEL`/`ANALYSIS_MODEL` constants) — do not collapse back to one constant without re-reading the comment there. Without it, every AI-backed function silently falls back to a deterministic offline placeholder (see below) so the rest of the flow stays testable. |
| `PORT` | defaults to 4000 |
| `ADMIN_KEY` | Shared secret gating `GET /api/suggestions` and the frontend `/admin`/`/admin/insights` pages (`x-admin-key` header/`adminKey` query param check via `middleware/adminAuth.ts`) — not real auth, just a low-stakes gate. |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | Optional. Without `SMTP_HOST`, `lib/mailer.ts` skips sending feedback-widget emails (logs a warning) — the `Suggestion` row is still saved regardless. |
| `PLAYWRIGHT_CHROMIUM_PATH` | Optional. Overrides the Chromium executable path used by `docGen.ts` for PDF generation — set this in container/deploy images with a fixed browser location. Unset, it falls back to Playwright's own auto-detected local install. |

## Architecture

### Backend: stateful analysis pipeline, not CRUD

Everything hangs off one `Analysis` row (`backend/prisma/schema.prisma`). It's a single wide table used as a state machine, not normalized entities:

- `status`: `draft → processing → done/failed`, paired with `procStage` (0–6) that the frontend polls to drive a fake step-by-step progress UI (`Processing.tsx`).
- `vacancyStatus` is a **separate** state machine (`idle/loading/success/failed`) for vacancy URL extraction, independent of `status`.
- AI outputs are stored as opaque JSON strings (`resultJson`, `tailoredCvJson`, `coverLetterJson`, `interviewPrepJson`) and parsed/typed on read using the `MatchResult`/`TailoredCv`/`CoverLetter`/`InterviewPrep` types from `src/lib/anthropic.ts`. Note `reportJson` exists in the schema but is currently unused — the `/report` endpoint derives its response directly from `resultJson`.
- Records self-expire: `expiresAt` = createdAt + 24h. `resolveAnalysis()` (in `lib/analysisLifecycle.ts`, shared by `analyses.ts` and `orders.ts`) returns a 3-way discriminated union (`{kind: 'ok'|'not_found'|'expired'|'deleted'}`) — `not_found` maps to 404, `expired`/`deleted` map to 410 with `{code}` so the frontend can render the right lifecycle state. `deletedAt` is a soft-delete tombstone set by `DELETE /:id` (user-triggered "delete my data") which also nulls every content field immediately but leaves `status` untouched (still `'done'`) — the row itself is still hard-purged later by the same 15-minute `setInterval` in `index.ts` once `expiresAt` passes, there's no separate retention policy for deleted rows. Any analysis-reading endpoint must go through `resolveAnalysis()`, not a raw `prisma.analysis.findUnique` — `orders.ts`'s `POST /` originally didn't, which meant a deleted analysis (content nulled, `status` still `'done'`) could still pass its `status !== 'done'` check and let a user "buy" already-wiped content; fixed by routing it through the shared resolver too. On the frontend, `err.status === 410` (with `err.code`) renders the shared `LifecycleState` component (`Results.tsx`, `Workspace.tsx`, `Checkout.tsx`); a plain 404 gets a simpler inline "not found, start a new analysis" state instead — `Pricing.tsx` is the one page that still silently swallows analysis-fetch errors (`.catch(() => {})`) since it can render its package grid without the analysis loaded.
- `runAnalysis()` in `analyses.ts` is fire-and-forget: `POST /:id/start` responds immediately, then a background async function sleeps through fake `procStage` increments before calling the real AI. The frontend polls `/status` and `/result` — there's no websocket/SSE.
- The `Order` model is separate and cumulative-tiered: package 3 implies ownership of 1 and 2 (`highestOwnedPackage` in `lib/pricing.ts`). Every paid endpoint re-derives "what's owned" from `Order` rows with `status: 'paid'` (via the shared `ownedPackages()` helper, also in `lib/pricing.ts`) — ownership is never cached on `Analysis`. Buying a higher tier while already owning a lower one charges only the difference (`upgradePriceUsd()`, computed server-side in integer cents in `POST /orders` — never trust a client-supplied amount).
- Paid content (tailored CV, cover letter, interview prep) is generated lazily and cached: each `ensureX()` helper in `analyses.ts` checks the JSON column first, only calls Anthropic if empty, then persists. Calling the same GET endpoint twice does not re-spend an API call. `ensureTailoredCv`/`ensureInterviewPrep` also thread `Analysis.selfAttestedGapConfirmed` (the user's yes/no answer to "do you actually have this experience?" for `mostImportantMissingRequirement`, captured on the free Results page via `PATCH /:id/self-attest`) into the AI prompt — changing that answer after generation nulls the cached JSON columns so the next fetch regenerates with the new answer.

### Payments are structurally real, financially fake

`orders.ts` implements real order records, gating, and a real pending→processing→paid/failed transition — but `POST /orders/:id/simulate` just waits 1.4s and flips status based on a client-supplied `outcome` field. There is no live payment provider. Don't assume a webhook or provider SDK exists anywhere.

### AI integration (`backend/src/lib/anthropic.ts`)

All four generation functions (`analyzeMatch`, `generateTailoredCv`, `generateCoverLetter`, `generateInterviewPrep`) follow the same shape: build a system+user prompt in Azerbaijani, call `anthropic.messages.create` with `output_config: { format: { type: 'json_schema', schema } }` against a hand-written JSON Schema, and parse the returned text block as JSON. When adding a new AI-generated artifact, follow this pattern rather than free-text parsing.

Two model constants, not one: `MODEL` (`claude-haiku-4-5`, cheapest tier) powers `generateTailoredCv`/`generateCoverLetter`/`ocrDocumentImages`; `ANALYSIS_MODEL` (`claude-sonnet-5`) powers `analyzeMatch`/`generateInterviewPrep`. This split exists because of a verified, reproducible bug, not a style preference: `analyzeMatch`'s `requirements[]` and `generateInterviewPrep`'s `hrQuestions[]`/`situational[]`/`technical[]` are large arrays of objects with multiple free-text fields per item, and on `MODEL` (haiku) those nested fields kept coming back in Azerbaijani regardless of `outputLanguage` — confirmed on fresh, uncached test runs, and *not* fixed by rewriting the system prompt to explicitly name every nested field. `generateTailoredCv`/`generateCoverLetter` have flatter schemas and were verified to correctly follow `outputLanguage` on `MODEL`. If cost pressure ever pushes to move `analyzeMatch`/`generateInterviewPrep` back to `MODEL`, re-verify nested-field language compliance with a real non-Azerbaijani end-to-end run (generate a fresh analysis with `outputLanguage: 'ru'` or similar and inspect `requirements[].title`/`.evidence` in the actual response) before assuming it's fine — a same-language (Azerbaijani) test won't catch this class of bug at all.

Every function has a matching offline fallback (`offlineAnalyze`, or inline stub objects) used when `getClient()` returns null (no API key). These fallbacks must stay wired up — they're what makes the whole flow demoable without a key, and they're clearly labeled as placeholders in the returned copy (e.g. `criticalGapSummary: 'AI konfiqurasiya olunmayıb...'`).

Free vs. paid content is a **field-level split on the same `MatchResult`**, not separate AI calls: `GET /:id/result` returns a curated subset of fields (compatibility score, `realCompatibility` number, category scores, strengths, a 2-item requirements preview); `GET /:id/report` returns the full `requirements` array plus `weakPresentation`/`improvementOpportunities`/`realCompatibilityGap` (the *explanation* of the real-vs-visible gap — the number is a free teaser, the why is report-gated), gated by `unlocksReport(owned)`. When changing `matchResultSchema`, check both response shapers in `analyses.ts` for what needs to move across the free/paid line. `realCompatibility` is defensively clamped to `>= compatibility` right after parsing the AI response, since nothing in JSON-schema output enforces that inequality.

### Admin panel (`backend/src/routes/suggestions.ts`, `middleware/adminAuth.ts`)

Standalone `Suggestion` model (no relation to `Analysis`/`Order`, no expiry; requires `category`/`text`/`email`) fed by a public `POST /api/suggestions` (the frontend's floating feedback widget, bottom-left on every page) and read by an `ADMIN_KEY`-gated `GET /api/suggestions`. The admin frontend's "AI structuring" (theme/sentiment/priority tagging) is deliberately fake — deterministic keyword matching (`frontend/src/lib/suggestionClassifier.ts`), not a real Anthropic call — matching the original design; don't assume it's an LLM classifier.

Submitting feedback always saves the row first, then fire-and-forgets an email to `support@peeky.az` via `lib/mailer.ts` (`nodemailer`, gated on `SMTP_HOST` being set — same "offline fallback" convention as `anthropic.ts`: no SMTP config means the email is skipped with a logged warning, not an error, and the suggestion is never lost).

### Document generation (`backend/src/lib/docGen.ts`)

DOCX via the `docx` library (pure JS, no external deps). PDF via Playwright/Chromium rendering hand-built HTML strings. The Chromium executable path is overridable via `PLAYWRIGHT_CHROMIUM_PATH` (for container/deploy images with a fixed browser location); unset, it falls back to Playwright's own auto-detected install (`chromium.executablePath()`), which is what local development uses.

### CV/vacancy extraction

- `lib/cvParse.ts`: PDF via `pdfjs-dist` (direct dependency — do not reintroduce `pdf-parse`; it bundles its own older nested `pdfjs-dist` whose worker collides with ours the moment both run in the same process, throwing "API version does not match Worker version"), DOCX via `mammoth`. When a PDF's extracted text falls below `MIN_EXTRACTED_TEXT_CHARS`, it's not immediately rejected — each page is rasterized via `pdfjs-dist` + `@napi-rs/canvas` (at viewport scale 2 — benchmarked lower scales against a real image-only resume and confirmed they degrade OCR accuracy, e.g. dropped/garbled words, so don't lower this to chase speed) and sent through `anthropic.ts`'s `ocrDocumentImages()` (vision OCR, same `ANTHROPIC_API_KEY`/offline-fallback convention as the rest of the AI pipeline) before falling back to the `scanned_pdf` rejection. This is what makes image-only PDFs — resumes exported as a rasterized page by design tools (Canva, Figma, browser print-to-PDF of a styled template) rather than real text — work despite having zero extractable text layer. Only then does it reject non-PDF/DOCX and genuinely-empty documents (below `MIN_EXTRACTED_TEXT_CHARS` even after OCR). `ocrDocumentImages()` uses `OCR_MODEL`, an alias for `MODEL` (`claude-haiku-4-5` — see the "AI integration" section above for the full model-split rationale; OCR is a bounded transcription task, verified fine on the cheap tier, unlike `analyzeMatch`/`generateInterviewPrep`). This is a blocking ~10s+ request on `POST /api/analyses` for image-only PDFs specifically (normal digital-text PDFs are near-instant, no OCR involved) — if upload latency becomes a complaint again, the next lever is making the upload itself async/pollable (matching the `runAnalysis()` fire-and-forget pattern).
- `lib/vacancyExtract.ts`: renders the vacancy URL with a real headless browser (`playwright`'s `chromium.launch()`, same `PLAYWRIGHT_CHROMIUM_PATH`-overridable pattern as `docGen.ts`), then `cheerio` scrapes the rendered DOM. This is not a raw `fetch()` — it was originally, but that only ever saw the pre-hydration HTML shell on JS-rendered (SPA) job boards, silently returning site-navigation/category-listing noise instead of the actual posting (confirmed live against jobsearch.az: the AI itself correctly flagged the input as "not a specific vacancy," which is what led to finding this). A headless browser executes the page's JS like a real user's browser would, so this works for both server-rendered and client-rendered sites. UA spoofing carries over; `page.waitForTimeout(1500)` after `domcontentloaded` gives SPA hydration a moment before scraping. SSRF protection (see `ssrfGuard.ts`) is enforced via `page.route()` intercepting every navigation request (initial URL and every redirect hop) and resolving+checking its host before Playwright is allowed to connect — this is stricter than a plain `fetch()` could give you, not weaker, despite the browser-based rewrite. Because rendering noisy pages can produce a much longer vacancy text than a plain fetch would (nav chrome, "similar postings" widgets, etc., all get scraped alongside the real content — there's no site-specific content-isolation, by design, to stay general), `analyzeMatch()`'s `max_tokens` was raised from 8000 to 16000 after a real noisy page pushed a response past the old budget and truncated the JSON mid-string; if that happens again on some other page, the fix is tighter vacancy-text extraction, not another `max_tokens` bump. Falls back to manual paste (`POST /:id/vacancy/manual`, min 3000 chars) when a site blocks scraping or returns too little text — this fallback path is a first-class part of the product, not an error state to eliminate.

### Prisma setup specifics

Uses Prisma 7's `prisma-client` generator (not the classic `prisma-client-js`) with a custom `output` into `backend/src/generated/prisma/` — that directory is generated code, checked into `src/` but not meant for manual edits. The client is instantiated via `@prisma/adapter-better-sqlite3` in `db.ts` rather than the default driver. `prisma.config.ts` (not `schema.prisma`'s `datasource` block) is where the migrations path and datasource URL are configured — check there first if migrations behave unexpectedly.

### Frontend: linear wizard over React Router

Routes in `App.tsx` mirror the product funnel in order: `/` (Landing) → `/analyze` (AnalysisForm: CV upload/paste + vacancy URL/paste + language/consent) → `/processing/:id` (polls status) → `/results/:id` (free dashboard) → `/pricing/:id` → `/checkout/:id/:pkg` → `/payment/:orderId` → `/workspace/:id/:tab` (paid deliverables: report/cv/cover-letter/interview, tab-routed), plus standalone `/privacy` `/terms` `/deletion` (legal, lazy-loaded) and `/admin` `/admin/insights` (key-gated, see below).

Analysis lifecycle 410s (`expired`/`deleted`, see backend section) surface inline via a shared `LifecycleState` component wherever `api.ts`'s `req()` wrapper detects `err.status === 410` — there are no dedicated `/expired` or `/deleted` routes; "delete my data" is a confirm modal on Results/Workspace, not a separate page. This is a deliberate simplification over the original design's per-state screens.

Admin pages (`Admin.tsx`, `AdminInsights.tsx`) are wrapped in `AdminGate.tsx`, which prompts for the `ADMIN_KEY` client-side, validates it by calling `GET /api/suggestions`, and caches it in `sessionStorage` (not `localStorage`) so it doesn't linger across browser sessions. `lib/adminApi.ts` attaches the stored key to admin requests automatically.

`frontend/src/lib/api.ts` is the single fetch client — every backend response shape has a matching TypeScript interface here that mirrors the backend's hand-shaped JSON (not auto-generated from Prisma or an OpenAPI spec). When a backend response shape changes, update the corresponding interface here by hand.

Styling is Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — v4 uses CSS-based config, check `index.css` for `@theme`/token definitions) mapped to the original design's color/spacing/radius/shadow tokens. Linting is `oxlint`, not ESLint — don't add `.eslintrc`.
