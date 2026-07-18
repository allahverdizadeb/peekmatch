# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PeekMatch — an AI-powered CV ↔ job-vacancy compatibility analysis platform for the Azerbaijani market. This repo is a working implementation of the **core user flow only**: landing → CV/vacancy analysis → free results dashboard → pricing → checkout → payment → paid report / tailored CV / cover letter / interview prep. Admin panel, legal pages, delete/expired states, and EN/TR/RU UI chrome from the original design are intentionally out of scope for this pass.

All user-facing copy and AI output is in Azerbaijani (error messages, prompts, schema enum values like `kritik`/`əsas`/`üstünlük`). Keep new user-facing strings in Azerbaijani unless working on the `outputLanguage` (az/en/ru) pipeline specifically.

There are two independent npm projects with no root package.json / workspace tooling: `backend/` and `frontend/`. Always `cd` into the relevant one before running npm commands.

The site UI is localized into Azerbaijani, English, Turkish, and Russian via `frontend/src/lib/i18n/` (`LanguageContext` + per-locale `Dict`-typed files under `locales/`, `LanguageSwitcher` in both headers). `az.ts` is the structural source of truth — `en.ts`/`tr.ts`/`ru.ts` are typed as `: Dict` so `tsc -b` fails the build if a key is added to one locale and not the others. The CV-analysis form's separate "AI result language" picker (`outputLanguage`, sent to the backend) seeds from the current UI language on mount but is user-overridable and not re-synced afterward.

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
| `ANTHROPIC_API_KEY` | Powers matching analysis, tailored CV, cover letter, interview prep via `claude-opus-4-8`. Without it, every AI-backed function silently falls back to a deterministic offline placeholder (see below) so the rest of the flow stays testable. |
| `PORT` | defaults to 4000 |

## Architecture

### Backend: stateful analysis pipeline, not CRUD

Everything hangs off one `Analysis` row (`backend/prisma/schema.prisma`). It's a single wide table used as a state machine, not normalized entities:

- `status`: `draft → processing → done/failed`, paired with `procStage` (0–6) that the frontend polls to drive a fake step-by-step progress UI (`Processing.tsx`).
- `vacancyStatus` is a **separate** state machine (`idle/loading/success/failed`) for vacancy URL extraction, independent of `status`.
- AI outputs are stored as opaque JSON strings (`resultJson`, `tailoredCvJson`, `coverLetterJson`, `interviewPrepJson`) and parsed/typed on read using the `MatchResult`/`TailoredCv`/`CoverLetter`/`InterviewPrep` types from `src/lib/anthropic.ts`. Note `reportJson` exists in the schema but is currently unused — the `/report` endpoint derives its response directly from `resultJson`.
- Records self-expire: `expiresAt` = createdAt + 24h. `getAnalysisOr404` in `analyses.ts` treats an expired-but-present row as 404. A background `setInterval` in `index.ts` hard-deletes expired rows every 15 minutes. Any new analysis-reading endpoint must go through `getAnalysisOr404`, not a raw `prisma.analysis.findUnique`.
- `runAnalysis()` in `analyses.ts` is fire-and-forget: `POST /:id/start` responds immediately, then a background async function sleeps through fake `procStage` increments before calling the real AI. The frontend polls `/status` and `/result` — there's no websocket/SSE.
- The `Order` model is separate and cumulative-tiered: package 3 implies ownership of 1 and 2 (`highestOwnedPackage` in `lib/pricing.ts`). Every paid endpoint re-derives "what's owned" from `Order` rows with `status: 'paid'` — ownership is never cached on `Analysis`.
- Paid content (tailored CV, cover letter, interview prep) is generated lazily and cached: each `ensureX()` helper in `analyses.ts` checks the JSON column first, only calls Anthropic if empty, then persists. Calling the same GET endpoint twice does not re-spend an API call.

### Payments are structurally real, financially fake

`orders.ts` implements real order records, gating, and a real pending→processing→paid/failed transition — but `POST /orders/:id/simulate` just waits 1.4s and flips status based on a client-supplied `outcome` field. There is no live payment provider. Don't assume a webhook or provider SDK exists anywhere.

### AI integration (`backend/src/lib/anthropic.ts`)

All four generation functions (`analyzeMatch`, `generateTailoredCv`, `generateCoverLetter`, `generateInterviewPrep`) follow the same shape: build a system+user prompt in Azerbaijani, call `anthropic.messages.create` with `output_config: { format: { type: 'json_schema', schema } }` against a hand-written JSON Schema, and parse the returned text block as JSON. When adding a new AI-generated artifact, follow this pattern rather than free-text parsing.

Every function has a matching offline fallback (`offlineAnalyze`, or inline stub objects) used when `getClient()` returns null (no API key). These fallbacks must stay wired up — they're what makes the whole flow demoable without a key, and they're clearly labeled as placeholders in the returned copy (e.g. `criticalGapSummary: 'AI konfiqurasiya olunmayıb...'`).

Free vs. paid content is a **field-level split on the same `MatchResult`**, not separate AI calls: `GET /:id/result` returns a curated subset of fields (compatibility score, category scores, strengths, a 2-item requirements preview); `GET /:id/report` returns the full `requirements` array plus `weakPresentation`/`improvementOpportunities`, gated by `unlocksReport(owned)`. When changing `matchResultSchema`, check both response shapers in `analyses.ts` for what needs to move across the free/paid line.

### Document generation (`backend/src/lib/docGen.ts`)

DOCX via the `docx` library (pure JS, no external deps). PDF via Playwright/Chromium rendering hand-built HTML strings, with a **hardcoded Chromium executable path** (`/opt/pw-browsers/chromium`) — this assumes a specific container/deploy image layout and will need adjusting for local development on a machine without that path.

### CV/vacancy extraction

- `lib/cvParse.ts`: PDF via `pdf-parse`, DOCX via `mammoth`. Rejects non-PDF/DOCX and PDFs with no text layer (scanned docs) below `MIN_EXTRACTED_TEXT_CHARS`.
- `lib/vacancyExtract.ts`: server-side `fetch` + `cheerio` scrape of a vacancy URL, with UA spoofing and a 12s timeout. Falls back to manual paste (`POST /:id/vacancy/manual`, min 3000 chars) when a site blocks scraping or returns too little text — this fallback path is a first-class part of the product, not an error state to eliminate.

### Prisma setup specifics

Uses Prisma 7's `prisma-client` generator (not the classic `prisma-client-js`) with a custom `output` into `backend/src/generated/prisma/` — that directory is generated code, checked into `src/` but not meant for manual edits. The client is instantiated via `@prisma/adapter-better-sqlite3` in `db.ts` rather than the default driver. `prisma.config.ts` (not `schema.prisma`'s `datasource` block) is where the migrations path and datasource URL are configured — check there first if migrations behave unexpectedly.

### Frontend: linear wizard over React Router

Routes in `App.tsx` mirror the product funnel in order: `/` (Landing) → `/analyze` (AnalysisForm: CV upload/paste + vacancy URL/paste + language/consent) → `/processing/:id` (polls status) → `/results/:id` (free dashboard) → `/pricing/:id` → `/checkout/:id/:pkg` → `/payment/:orderId` → `/workspace/:id/:tab` (paid deliverables: report/cv/cover-letter/interview, tab-routed).

`frontend/src/lib/api.ts` is the single fetch client — every backend response shape has a matching TypeScript interface here that mirrors the backend's hand-shaped JSON (not auto-generated from Prisma or an OpenAPI spec). When a backend response shape changes, update the corresponding interface here by hand.

Styling is Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — v4 uses CSS-based config, check `index.css` for `@theme`/token definitions) mapped to the original design's color/spacing/radius/shadow tokens. Linting is `oxlint`, not ESLint — don't add `.eslintrc`.
