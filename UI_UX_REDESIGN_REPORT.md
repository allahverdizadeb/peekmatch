# PeekMatch UI/UX redesign — premium career-intelligence identity + real gamification

## Design direction

The previous UI was functionally solid but visually generic: one accent color, ad-hoc metric `<div>`s repeated across pages, no shared data-visualization language, and no sense of progress toward the user's actual goal (being ready to apply). This pass is **frontend-only** — backend scoring, AI prompts, payment logic, entitlement rules, package prices/IDs, and session/deletion logic were not touched (confirmed: `git status` shows zero changes under `backend/`, and the backend test suite — 93/93 — was re-run unchanged after the redesign).

The direction: **structured career-intelligence, not generic AI SaaS**. Concretely:
- A second typeface (Fraunces, an editorial serif) for display headings and large metric numerals only — Inter stays for all body/UI text. This one change does more to shift "generic SaaS" → "editorial/analytical" than any color change would.
- A secondary accent color (warm gold) reserved for gamification/achievement signals, kept visually distinct from the existing green "success/matched" status color so the two concepts (data status vs. progress/achievement) never collide.
- No new chart library. The app already hand-rolls SVG/CSS charts (`RadialGauge`, `CategoryBarChart`) with zero dependencies — every new chart in this pass extends that same pattern rather than introducing a dependency, and every chart pairs its visual with real DOM text (never color-only), which is what makes them cheaply accessible.
- A real, computed Application Readiness system (see Gamification below) — not a decorative progress bar.

## Design system changes

**`index.css` `@theme`** (additive only — nothing renamed, every existing utility class still resolves):
- `--font-display: "Fraunces"` (+ `index.html` Google Fonts link) and a `.font-display` utility.
- `--color-ink`/`--color-ink-2` — deeper-than-navy surfaces for dark "command centre" bands, distinct from `navy` (which stays the body-text color).
- `--color-accent`/`--color-accent-bg` — secondary gamification accent (warm gold).
- `--color-border-strong` — higher-contrast divider for dense tables/matrices.
- `--color-chart-1..5` — a neutral data-series palette for non-status charts (Strength Profile), kept separate from the status palette so a chart bar is never mistaken for a pass/fail signal.
- `--shadow-sh-xl` — one more elevation step for hero/readiness modules.
- `tabular-nums` applied to every metric numeral across the product (Results, Workspace, Pricing, Checkout) for a more analytical feel.

**Accessibility rule baked into the component, not left to call sites**: `Badge` (`components/ui.tsx`) now renders a default icon per tone (check/triangle/octagon/info/sparkle/circle) automatically — this alone fixes "don't use color alone for status" at every existing call site across the app with no per-page changes required.

## New/updated shared components

- `components/ui.tsx`: `Badge` extended (icon-by-tone); new `MetricCard`.
- `components/Stepper.tsx` (new): horizontal stepper (AnalysisForm) + vertical timeline variant (Processing).
- `components/EmptyState.tsx`, `components/Skeleton.tsx` (new, defined but not yet threaded through every loading spot — see limitations).
- `components/Tooltip.tsx` (new): keyboard-accessible (opens on focus, not just hover), `role="tooltip"` + `aria-describedby` — replaces a hand-rolled hover-only `useState` + absolute-div pattern that was previously inline in Results.tsx and unreachable by keyboard.
- `components/Accordion.tsx` (new): replaces three separate hand-rolled open/close implementations (Landing FAQ, Interview Playbook category sections) with one, adds `aria-expanded`/`aria-controls`.
- `components/PriorityChip.tsx`, `components/StatusDot.tsx` (new): priority/status indicators that always pair an icon with the color.
- `components/charts.tsx`: `RadialGauge` refined (drop shadow, tabular-nums, size-relative font); `CategoryBarChart` restyled with the new chart-color palette; new `SegmentedStatBar` (one generic "N items across K labeled buckets" primitive), `RequirementCoverageBar`, `ReadinessGauge`, `ImportanceMatrix`.
- `frontend/src/lib/readiness.ts` (new, pure, unit-tested): Application Readiness status, computed client-side from `compatibility` + `criticalGapsCount` (both already on the free `/result` response) — **not** a restoration of the removed CV Recheck feature; a fresh, standalone gamification utility.
- `frontend/src/lib/journeyState.ts` (new, localStorage-backed like the existing `localCardState.ts`, unit-tested): explicit "strengths reviewed" flag and per-question "reviewed" tracking, plus prefix-scanning helpers (`hasAnyCompletedCard`, `hasAnyReviewedQuestion`) so the Results page's readiness journey never needs to eagerly fetch paid content just to check progress.
- `components/CvChangeCard.tsx`: each `changeType` (rewrite/add/clarify/remove) now gets its own icon + left-border accent, on top of the existing text badge.
- `components/LockPanel.tsx`: accepts optional real `previewStats` (reuses the already-computed `cvChangesSummary`/`interviewRisksCount` from the free result) instead of a generic "unlock premium" message.

## Pages redesigned

- **Landing**: editorial display type on all section headings; the hero's dark stat card gained a small real segmented coverage bar (met/partial/missing) alongside the existing gauge; FAQ moved onto the shared `Accordion`. The hero/comparison/how-it-works layouts were kept — they were already a structured card-based design, not the generic-gradient pattern the brief warns against, so this was a targeted enhancement rather than a rebuild.
- **AnalysisForm**: a real `Stepper` (CV → Vacancy → Language → Consent) driven by actual form state, not a static progress indicator; the vacancy step gained **explicit URL/paste-text tabs** (previously paste-text was only reachable after a URL check failed) with the failure notice now offering a direct switch to the paste tab; upload zone icon restyled.
- **Processing**: the stage list moved onto the `VerticalStepper` timeline variant with a real progress bar driven by the actual `procStage` (0–6) value already polled from the backend — not a fake percentage.
- **Results** (core redesign): new **Application Readiness card** at the top of the page — a `ReadinessGauge` (4 real zones) plus the **7-step Readiness Journey** checklist, both computed from real signals (see Gamification below); Candidate Fit card kept (already fixed for text/chart overlap in the prior pass) with editorial type; requirement coverage upgraded to the shared `RequirementCoverageBar` with an accessible legend; Strength Profile chart restyled; premium-preview stats restyled with tabular numerals and per-metric tone.
- **Workspace**: Report tab gained a `RequirementCoverageBar` (true 4-state, including the real `insufficient_info`/"Unknown" bucket only available once the full requirements array is loaded) and an `ImportanceMatrix` (importance × status grid on desktop, the same data reflowed to grouped lists on mobile — one responsive component, not two chart implementations); CV Change Plan tab gained a change-type summary bar; Interview Playbook tab gained a priority summary bar, moved onto the shared `Accordion` with per-category reviewed-count badges, and gained a per-question "mark reviewed" toggle plus an overall "X of Y prepared" progress bar; all three tabs' lock screens now show real preview numbers instead of a generic message.
- **Pricing/Checkout**: editorial type on headings, tabular-nums on all prices, "Most popular" restyled with the accent color and a top accent border instead of only a badge — package cards keep `items-stretch` equal-height alignment (no scale/size differentiation, so the visual hierarchy comes from color/border, not layout distortion). No structural, price, or ID changes.

## Gamification features added

- **Application Readiness** (`Not Ready` / `Needs Improvement` / `Nearly Ready` / `Ready to Apply`): a real status, computed purely from `compatibility` and `criticalGapsCount` — same threshold judgment the product already validated in an earlier (now-removed) backend utility, reimplemented as a standalone frontend function with no dependency on the removed CV Recheck feature or any new backend field.
- **7-step Readiness Journey**, every step backed by a real signal, none fakeable by simply loading a page:
  1. CV uploaded — always true once on this page.
  2. Vacancy analysed — `analysis.status === 'done'`.
  3. Strengths reviewed — explicit "I've reviewed this" action, persisted client-side.
  4. Critical gap reviewed — reuses the existing, already-server-persisted `selfAttestedGapConfirmed !== null` signal (Truth Lock's self-attestation question).
  5. CV changes prepared — package owned **and** at least one CV Change Plan card marked completed (works whether that's the one free-tier example card or a card in the full paid plan, via a localStorage prefix scan rather than needing the full card count).
  6. Interview preparation completed — package owned **and** at least one interview question marked reviewed (tracked in Workspace, read back on Results via the same prefix-scan approach — deliberately never fetches the interview questions from the free Results page itself, since that would risk eagerly triggering the slow first-time Interview Playbook generation just from viewing a free page).
  7. Ready to apply — the computed readiness status itself reaching `ready`.
- **Milestones**: the brief's milestone examples ("all critical CV changes reviewed", "interview prep opened", "application plan completed") overlap heavily with journey steps 4–6 by design — rather than build a second, redundant progress-signal system, the journey checklist *is* the milestone system here (each checked step is a milestone marker). Stated as a deliberate consolidation, not an omission.
- **Priority system**: `PriorityChip` (icon + label + left-border accent) applied to CV Change Plan cards; interview-question priority and requirement importance already had text badges and now inherit the same icon-pairing rule via `Badge`'s per-tone default icon.

## Accessibility improvements

- Every chart pairs its visual with real, already-localized text (segmented-bar legends, matrix cell titles, gauge zone labels) — verified against "no status communicated by color alone" by construction, not by audit.
- `Badge` bakes in a default icon per tone everywhere it's already used app-wide.
- New `Tooltip` is keyboard-reachable (`onFocus`/`onBlur`, not just hover) with proper `role="tooltip"`/`aria-describedby` wiring — the previous inline implementation in Results.tsx was hover-only.
- New `Accordion` sets `aria-expanded`/`aria-controls` on every trigger.
- `prefers-reduced-motion` was already handled globally in `index.css` (`animation-duration: 0.001ms !important` override) — nothing new needed here, and no new motion was added that isn't already covered by that rule.
- `Stepper`/`VerticalStepper` use `aria-current="step"` and real list semantics (`<ol>`/`<li>`).

## Responsive improvements

- `ImportanceMatrix` is one component with two CSS-only layouts (grid from `md:` up, stacked grouped lists below) rather than two different chart implementations swapped by JS.
- Candidate Fit's chart/text overlap fix from the previous pass was preserved and re-verified live with real (long) AI-generated label text at 320/375/768/1366px.
- All new chart components (`SegmentedStatBar`-derived bars, `ReadinessGauge`) use percentage-based/flex/grid sizing with no fixed pixel widths that could overflow narrow viewports.

## Files changed

New: `components/{Stepper,EmptyState,Skeleton,Tooltip,Accordion,PriorityChip,StatusDot}.tsx`, `lib/{readiness,journeyState}.ts` + their `.test.ts` files.
Updated: `index.html`, `index.css`, `components/{ui,charts,CvChangeCard,LockPanel}.tsx`, `lib/categoryLabel.ts`, `lib/i18n/locales/{az,en}.ts`, `pages/{AnalysisForm,Processing,Results,Workspace,Landing,Pricing,Checkout}.tsx`.
Backend: no files changed.

## Tests executed

- `cd frontend && npm run build` — clean.
- `cd frontend && npm run test` — **13/13 passing** (i18n structural parity + no-unintentional-empties + content-parity heuristic, `readiness.test.ts`, `journeyState.test.ts`).
- `cd frontend && npm run lint` — clean (only pre-existing `react-hooks/exhaustive-deps` warnings in files this pass didn't materially touch).
- `cd backend && npm run build && npm run test` — unchanged, **93/93 passing**, confirming zero backend impact.
- Live verification: both dev servers run for real, driven end-to-end via Playwright (backend's existing install) — Landing/AnalysisForm/Processing/Results/Workspace screenshotted at 320/375/768/1366px in Azerbaijani, including a real analysis run through to completion, a readiness-journey interaction (marking strengths reviewed), and the Workspace lock screen's real preview stats.

## Remaining limitations / manual checks recommended

- English-language and 1440px/1024px breakpoints were not separately screenshotted in this pass (the previous language-fix pass already established the AZ/EN pipeline works correctly end-to-end with real AI output at the breakpoints that mattered for that fix; this pass's new components use the same responsive/i18n patterns but haven't been independently re-screenshotted in English). Recommended before shipping: repeat the same live pass with the UI switched to English.
- `EmptyState`/`Skeleton` were built as reusable primitives but not yet threaded through every existing ad-hoc loading/empty state in the app (several pages still show plain `"Yüklənir..."` text) — a mechanical follow-up, not a design gap.
- 200% browser zoom and full keyboard-only navigation were not separately verified via automated screenshots in this pass; the components were built with keyboard/focus support (Tooltip, Accordion, existing `.focus-ring` utility on all new interactive elements) but this should get a manual pass before shipping.
- No visual-regression tooling exists in this repo (same limitation noted in the previous pass's report) — verification here is live Playwright screenshots at the required breakpoints, not an automated pixel-diff suite.
- The Readiness Journey's "milestones" are intentionally the same signal set as the journey steps (see Gamification section) rather than a second parallel system — flagged here in case product wants a genuinely distinct, separate milestone concept later.
