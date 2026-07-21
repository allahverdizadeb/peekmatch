# PeekMatch product update — language fix, Cover Letter removal, CV Recheck removal, package copy, Candidate Fit redesign

## Summary

Five changes, all scoped to the existing product surface (no redesign of unrelated pages):

1. **Full-language processing** — fixed the root cause of AI results not consistently following the selected language, added server-side language validation, and added a clear notice (instead of silent mixed-language output) when a language-mismatched analysis is viewed.
2. **Cover Letter removed** end-to-end (backend routes/AI/DB comments, frontend tab/API/i18n/legal copy).
3. **CV Recheck removed** end-to-end (same surfaces).
4. **Package copy updated** to reflect the smaller feature set, using the exact Azerbaijani copy from the spec plus a natural English translation.
5. **"Namizədin uyğunluğu" (Candidate Fit) redesigned** — fixed a real text/chart overlap bug and rebuilt the card as a responsive two-region layout.

No package IDs, prices ($4.90 / $9.90, USD — unchanged from the prior round), or unrelated functionality changed. No destructive migration was run.

## 1. Full-language processing

**Root causes found and fixed** (not previously working correctly):

- `AnalysisForm.tsx`'s "AI result language" pill row seeded once from the site UI language on mount and never resynced — switching the site language after landing on `/analyze` (but before submitting) silently left the analysis language frozen on the stale value. Fixed: the effective language is now `outputLanguageOverride ?? uiLang` — it tracks the live UI language until the user manually taps a pill, at which point it "pins" to their explicit choice.
- `PATCH /analyses/:id/settings` accepted `outputLanguage` with **zero validation** — any string could be persisted. Added `resolveOutputLanguage()`: only `'az'|'en'` pass through; anything else (missing, malformed, or a legacy `'tr'`/`'ru'` value) coerces to `'en'`.
- Unsupported-language fallbacks previously defaulted to **Azerbaijani** (`docGen.ts`'s `resolveDocLang`, and three inline `LANG_NAME[...] || 'Azərbaycan'` spots in `ai.ts`). Per the spec's explicit instruction ("unsupported language values fall back safely to English") these were flipped to default to **English**, and the three duplicated inline fallbacks in `ai.ts` were consolidated into one exported, unit-tested `resolveLangName()`.
- The **offline fallback content** (used when `OPENAI_API_KEY` is unset — `offlineAnalyze`, and the CV Change Plan / Interview Prep offline stubs) was hardcoded Azerbaijani regardless of `outputLanguage`. This is the one place "no Azerbaijani content in an English result" is fully deterministic and testable, so it was localized (`OFFLINE_COPY` lookup keyed by language in `ai.ts`).

**Existing-analysis language mismatch.** AI output in this app is almost entirely narrative free text (evidence strings, explanations, recommended replacement text) — there is no language-neutral structured layer to translate labels over, and re-translating already-generated content would itself require a new, unrequested AI call. Per the spec's own explicitly-authorized fallback ("if the data model doesn't allow this safely, require a new analysis in the selected language and clearly inform the user"), a new `LanguageMismatchNotice` component was added: `Results.tsx` and `Workspace.tsx` compare `info.outputLanguage` to the current UI language and, on mismatch, show an inline banner naming the analysis's language and linking to `/analyze` to start a fresh one — rather than silently mixing languages or attempting an unrequested translation pass.

**Tests added** (`backend/src/lib/ai.test.ts`, new): `resolveLangName` valid + unsupported-fallback cases; offline-fallback content differs correctly between `az`/`en` for `analyzeMatch`, `generateCvChangePlan`, and `generateInterviewPrep`, with an explicit assertion that no Azerbaijani-specific substring leaks into the English offline result. `backend/src/routes/analyses.test.ts` (extended): `PATCH /settings` persists valid languages and coerces invalid ones to `en`; `GET /:id` echoes the stored language back (persistence after refresh).

**Not done, and why:** automatically re-verifying live (non-offline) English AI output end-to-end for all three generation functions was out of scope for this pass's test budget — this was previously spot-checked live for `analyzeMatch` during the OpenAI provider migration (see `CLAUDE.md`), but not re-verified here for `generateCvChangePlan`/`generateInterviewPrep`. The manual-check list below covers this.

## 2. Cover Letter — removed

Removed, not stubbed, across:

- **Backend**: `generateCoverLetter` + its schema/types/`TONE_INSTRUCTION` (`ai.ts`); `GET/POST /:id/cover-letter`, `/cover-letter/regenerate`, `/cover-letter/download`, `ensureCoverLetter()`, `COVER_LETTER_TONES` (`analyses.ts`); `coverLetterToDocx` + the `coverLetter` filename kind (`docGen.ts`); the now-unused `docx` npm dependency.
- **Frontend**: `CoverLetterTab`, its Workspace tab entry, `TONES` const (`Workspace.tsx`); `getCoverLetter`/`regenerateCoverLetter`/`CoverLetter`/`CoverLetterTone`/`CoverLetterParagraph` (`api.ts`); every cover-letter-only i18n key in both locales (tone selector, paragraph-purpose labels, generating hints, download/copy labels — `copiedText`/`copyShort` were kept, since the Interview Playbook tab's copy button reuses them).
- **Data model**: `Analysis.coverLetterJson` is **kept** in `schema.prisma`, marked `@deprecated` via comment — not dropped, per the explicit "do not delete production data destructively" instruction. No application code reads or writes it anymore.
- **Legal/marketing copy**: `frontend/src/lib/legalContent/{az,en}.ts` (privacy policy, terms, data-deletion page) referenced "cover letter" / "tailored CV" in three places each (the "how we use your data" purpose list, the service-description list, and the automatic-deletion list) — updated to describe the CV Change Plan instead, and the "last updated" date was bumped. `README.md`/`CLAUDE.md` updated to match.

## 3. CV Recheck — removed

Same treatment:

- **Backend**: `GET`/`POST /:id/recheck` (`analyses.ts`); `computeRecheckDiff`, `computeApplicationReadiness`, `RecheckDiff`/`ApplicationReadiness` types, and their private helpers (`titleMatches`, `wordOverlapRatio`, `STATUS_RANK`) in `scoring.ts` — Evidence Chain has its own separate, simpler `titleMatches()` local to `evidenceChain.ts` and was unaffected. `recheck_completed` removed from the `events.ts` allowlist.
- **Frontend**: `RecheckTab`, its Workspace tab entry, `READINESS_TONE` const (`Workspace.tsx`); `getRecheck`/`submitRecheckFromFile`/`submitRecheckFromText`/`RecheckState`/`RecheckOutcome`/`RecheckNewResult`/`RecheckDiff`/`ApplicationReadiness` (`api.ts`); `recheck_completed` removed from `analytics.ts`'s event union; every recheck-only i18n key in both locales.
- **Data model**: `Analysis.recheckCvText`/`recheckResultJson`/`recheckCount` kept, marked `@deprecated`, same non-destructive rationale as above.

**Note on naming collision avoided:** the new Interview-Ready package copy includes "CV yoxlama sualları" (CV-verification questions) — this is the existing `cvVerificationQuestions` field inside the Interview Playbook (questions an interviewer might ask to verify CV claims), unrelated to and not affected by the CV Recheck feature removal. Worth flagging since the names are easy to conflate.

## 4. Package copy

`pricing.freeTier.features`, `pricing.packages['1'/'2'].features`, `pricing.comparisonRows`, and `checkout.packages['1'/'2'].features` were updated in both `az.ts` (verbatim from the spec) and `en.ts` (natural translation, not literal) to drop every Cover Letter/Recheck mention and reflect the smaller, still-real feature set (CV Change Plan, Evidence Chain, completion checklist, Interview Playbook). `Pricing.tsx`'s `COMPARISON_MATRIX` needed **no code change** — the new 9-row comparison table happens to keep the same 5-shared / 4-package-2-only split as before, just with different row labels. Prices are unchanged (USD $4.90 / $9.90, server-authoritative — `pricing.ts`'s `PACKAGES` map and `POST /orders`'s server-side price computation were not touched).

## 5. "Namizədin uyğunluğu" (Candidate Fit) redesign

**Confirmed root cause**: `RadialGauge` (`components/charts.tsx`) rendered its optional `label` text *inside* the 132px circle via `absolute inset-0` positioning with only `px-2` padding — a long or translated `compatibilityLabel` string genuinely overlapped/clipped against the ring, exactly as described. It had exactly one caller (`Results.tsx`'s compatibility gauge); the HR-estimate gauge never passed `label` and was unaffected.

**Fix**: `RadialGauge` no longer accepts a `label` prop at all — it renders the score only, per the spec's "reduce internal text to essential score, move labels outside." The Candidate Fit card was pulled out of the 4-column KPI grid into its **own full-width card**, laid out `flex flex-col md:flex-row` — gauge on the left (desktop) / top (mobile), a `flex-1 min-w-0` text column (title, compatibility label, CV-presentation line, presentation-gap message, real-match teaser) on the right (desktop) / below (mobile). No absolute positioning, no fixed heights, `min-w-0` lets long AZ/EN text wrap instead of clip. The remaining 3 KPI cards moved to a `grid-cols-1 sm:grid-cols-3` grid (was 4-column, now 3 since Candidate Fit has its own row).

**One incidental fix in the same component**: `Landing.tsx`'s example-result mockup also passed `label` to `RadialGauge` (compile error after the prop was removed) — moved that text to sit below the gauge instead, matching the new pattern.

## Files changed (this pass)

Backend: `ai.ts`, `ai.test.ts` (new), `analyses.ts`, `analyses.test.ts`, `docGen.ts`, `scoring.ts`, `scoring.test.ts`, `pricing.ts`, `pricing.test.ts`, `events.ts`, `schema.prisma`, `package.json`.
Frontend: `api.ts`, `analytics.ts`, `charts.tsx`, `categoryLabel.ts` (bug found + fixed during live verification, see below), `AnalysisForm.tsx`, `Results.tsx`, `Workspace.tsx`, `Landing.tsx`, `LanguageMismatchNotice.tsx` (new), `GeneratingIllustration.tsx`, `LockPanel.tsx` (comment only), `locales/az.ts`, `locales/en.ts`, `locales/parity.test.ts`, `legalContent/az.ts`, `legalContent/en.ts`.
Docs: `CLAUDE.md`, `README.md`.

## Tests executed

- `cd backend && npm run build` — clean.
- `cd backend && npm run test` — **93/93 passing** (includes the new `ai.test.ts` language tests and the updated `analyses.test.ts`/`scoring.test.ts`/`pricing.test.ts`).
- `cd frontend && npm run build` — clean (`tsc -b && vite build`).
- `cd frontend && npm run test` — **4/4 passing** (i18n structural-parity + no-unintentional-empties + content-parity heuristic — automatically covers every key removed/added in both locales).
- `cd frontend && npm run lint` — clean (only pre-existing, unrelated `react-hooks/exhaustive-deps` warnings in files this pass didn't touch or only touched incidentally).
- `npx prisma generate` — regenerated client from the comment-only schema change; confirmed no migration was generated (the column set and types are unchanged, only comments/position moved).

## Manual verification (live, not simulated)

Both dev servers were actually started (`backend` :4000, `frontend` :5175) with a real `OPENAI_API_KEY` configured, and driven end-to-end with a Playwright script (not just unit tests) through: switch UI to English on the landing page → `/analyze` → fill CV/vacancy → submit → wait for a real `analyzeMatch` + `generateCvChangePlan` call → inspect the free Results page at 1366px, then 320px/375px/768px → switch the UI language back to Azerbaijani while viewing that English-generated analysis → visit `/pricing/:id` → visit `/workspace/:id/report`.

Findings:

- **Candidate Fit card**: at 1366px the gauge sits left of a text column carrying a genuinely long label ("Moderate match with several important capability gaps") — wraps across two lines with zero overlap with the ring. At 320px/375px the layout stacks (gauge centered, text below) with no horizontal overflow or clipping. At 768px it's still side-by-side (crosses the `md:` breakpoint), also clean. This is a real long string from a live AI response, not a synthetic test case.
- **Language pipeline, live AI**: every AI-generated string on the English-run Results page (compatibility label, CV-presentation label, requirement explanations, strengths, "most important requirement" text and self-attestation question, recommendation reasons, category names, and later the CV Change Plan's example card) came back in fluent, natural English — not a literal/awkward translation.
- **Language-mismatch banner**: confirmed live — after switching the UI to Azerbaijani while viewing the English-generated analysis, the banner rendered correctly ("Diqqət: bu analizin nəticələri **English** dilində hazırlanıb...") and every UI-chrome string (headings, labels, buttons) switched to Azerbaijani while the AI content itself correctly stayed in English (not re-translated), exactly as designed.
- **Cover Letter / CV Recheck fully gone**: `/workspace/:id/report` (unpaid) shows exactly 3 tabs — "Tam hesabat", "CV Dəyişiklik Planı", "Müsahibə Playbook" — confirmed via DOM text extraction, not just visual inspection. `/pricing/:id` shows no Cover Letter/Recheck mention anywhere in either package's feature list or the comparison table.
- **A real bug was found and fixed by this live test**: `frontend/src/lib/categoryLabel.ts`'s English→Azerbaijani reverse-lookup table used guessed category-name strings ("Software & Tools", "Languages", "Management & Collaboration") that didn't match what the AI actually generates ("Software and Tools", "Language Skills", "Management and Collaboration") — so those 3 of 7 categories silently failed to re-localize and stayed in English when viewing a language-mismatched analysis (visible in the Azerbaijani-UI screenshot: "İş təcrübəsi", "Texniki bacarıqlar" translated correctly, but "Software and Tools" didn't). Fixed by normalizing "&"/"and" and updating the dictionary to the AI's actual phrasing; re-verified live afterward — all 7 categories now re-localize correctly. This wasn't something introduced by this pass's own changes (the mismatch banner is new, but the category-name lookup table predates it) — it was undetectable without a real AI response to test against, so it's included here as a concrete "this is why the live pass mattered" finding, not a hypothetical.
- After the fix, full backend (`93/93`) and frontend (`4/4`) test suites plus `build`/`lint` were re-run clean.

## Remaining limitations / manual checks still recommended

- Live (non-offline) AI-output language correctness was directly verified end-to-end in this pass (see above) for `analyzeMatch` and `generateCvChangePlan` on a real English run. `generateInterviewPrep` (Interview Playbook) was not live-spot-checked in English in this pass — same "real end-to-end run, not a same-language test" standard `CLAUDE.md` already documents for the analysis pipeline should be applied there before an English-market push.
- The language-mismatch banner's fix path is "start a new analysis" (per the spec's explicitly-authorized fallback for a data model with no language-neutral structured layer) — it does not offer in-place regeneration of an existing paid analysis into a new language. If that becomes a real user complaint, the next lever is a dedicated regenerate-in-place endpoint that nulls the cached JSON columns and re-runs the same background pipeline against a new `outputLanguage`, preserving the existing `Order` entitlements.
- `coverLetterJson`/`recheckCvText`/`recheckResultJson`/`recheckCount` remain as unused, `@deprecated`-commented columns in `schema.prisma` rather than being dropped (explicit non-destructive-migration instruction). A follow-up cleanup migration to actually drop them is safe to do later, once the team is comfortable — every row self-expires within 24h regardless, so there's no real historical-data risk either way.
- No visual-regression tooling (Storybook/Chromatic/Percy) exists in this repo, so the Candidate Fit layout was checked via live Playwright screenshots at the specified breakpoints rather than an automated pixel-diff suite.
- `categoryLabel.ts`'s reverse lookup is still exact-match-after-normalization, not fuzzy — if the AI ever phrases a category substantially differently (not just "&" vs "and"), it will again silently fall through untranslated in the mismatch-viewing case. Low risk (7 fixed concepts, stable prompt), but worth knowing.
