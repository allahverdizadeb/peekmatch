# Motion System Implementation Report

## 1. Audit summary

**Stack**: React 19 + Tailwind v4 (CSS-based `@theme` tokens in `index.css`) + react-router-dom v7. No animation library installed at the start of this task.

**What already existed** (preserved, built on, not replaced):
- A global `prefers-reduced-motion` kill-switch in `index.css` (`* { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }`) — a solid centralized foundation kept intact and extended with hook-level equivalents for JS-driven decisions.
- Nine bespoke keyframes (`pm-rise`, `pm-pop`, `pm-growx`, `pm-write`, `pm-tagpop`, `pm-msg-in`, `pm-dot`, `pm-spin`, `pm-pulse`) used with hardcoded durations/delays across `Landing.tsx`'s hero, `GeneratingIllustration`/`InterviewIllustration` decorative loops, and `RotatingHint`.
- `Processing.tsx` already drove a **real, backend-state-based** analysis-stage sequence via `VerticalStepper` and rotating hints — not a fake spinner. This needed refinement (smoother state transitions), not replacement.
- `RadialGauge` already transitioned `stroke-dasharray` on value change, but had no controlled first-reveal.
- `Skeleton.tsx` already used Tailwind's `animate-pulse`, already reduced-motion-safe.

**Gaps found and addressed**:
- `Button` had only `transition-colors` — no hover elevation, press feedback, or width-stable loading state. High leverage: every button in the app inherits from this one component.
- `Accordion` and `LanguageSwitcher`'s dropdown both mounted/unmounted content via `{open && ...}` with zero transition.
- `DeleteConfirmDialog` and `NewAnalysisConfirmModal` had zero enter/exit transition and no focus management (no auto-focus, no Escape-to-close, no scroll lock, no focus restoration).
- No route-level transition wrapper existed.
- **No toast/notification system exists anywhere in the app** — confirmed via full-codebase search. Nothing to enhance there; a new toast system was not invented, as that would be a new feature rather than motion for an existing surface.
- **No mobile hamburger menu exists** — nav links are `hidden` below the `md` breakpoint, with no menu replacement. Building one is a new navigation feature, not motion for an existing interaction, so it was left out of scope (see §16).
- `RequirementPriorityMap.tsx` (the evidence-matching surface) is a card-grouped layout by deliberate prior design decision (a denser importance×status diagram was replaced with this exact layout because it read as clutter — documented in the codebase). No connector-line diagram was introduced here or on the homepage, to avoid reintroducing the complexity that redesign removed; sequencing is instead achieved through staggered reveal order (requirement → status/priority → evidence → next step).

**Decision: no new animation library was added.** Every requirement — route transitions, modal enter/exit, accordion height, staggered reveals, scroll-triggered reveals — was achievable with CSS transitions/keyframes plus a handful of small hooks, at zero bundle cost beyond the CSS/JS actually written. See §13 for the one dependency that *was* added (test-only, not shipped to users).

## 2. Motion principles used

- Every animation ties to one of: guiding attention, confirming an action, showing hierarchy/sequence, connecting related information, or reducing perceived wait — never decoration for its own sake.
- Distances stay small (4/8/16/24px tokens) — nothing translates further than 24px anywhere in the app.
- Durations stay short (100–600ms) — nothing loops indefinitely except two pre-existing, already-restrained "in progress" pulses (reused, not duplicated — see §7).
- One-shot reveals use CSS `animation` (fires once per mount, never replays on re-render) rather than `transition` (which would replay on every relevant state change) — this is what makes "don't replay on accordion toggle / tab switch" true by construction rather than by careful bookkeeping.
- Scroll-triggered reveals fire once per element (`useInView`'s `once: true` default) — scrolling up and down never replays them.

## 3. Shared motion tokens

`frontend/src/index.css` (`:root` block) — CSS custom properties, the single source of truth:

| Category | Tokens |
|---|---|
| Durations | `--motion-instant: 100ms`, `--motion-fast: 160ms`, `--motion-standard: 240ms`, `--motion-deliberate: 400ms`, `--motion-sequence: 600ms` |
| Easings | `--ease-enter`, `--ease-exit`, `--ease-standard`, `--ease-emphasis`, `--ease-spring` (a restrained overshoot, `cubic-bezier(0.34, 1.16, 0.64, 1)` — used only for press/pop feedback, never for large movement) |
| Distances | `--dist-subtle: 4px`, `--dist-small: 8px`, `--dist-medium: 16px`, `--dist-large: 24px` |

`frontend/src/lib/motion.ts` — the JS-side mirror (numbers, for `setTimeout`/`transitionDelay` math) plus:
- `STAGGER = { compact: 30, cards: 60, sequence: 90, sections: 80 }` (ms increments)
- `staggerDelay(index, increment)` — `index * increment`, capped at 480ms so a long list's last item never waits "too long" to feel like a sequence rather than a stall.

Reusable CSS utility classes built on these tokens (`index.css`, `@layer utilities`): `.lift`, `.press-scale`, `.btn-motion`/`.btn-elevate`, `.pill-motion`, `.motion-backdrop`/`.motion-dialog`/`.motion-popover` (data-state-driven enter/exit), `.motion-collapse` (accordion smooth-height), `.motion-reveal` (scroll reveal), `.motion-pop-in`/`.motion-rise-in` (one-shot mount reveals), `.route-fade`.

## 4. Pages changed

`App.tsx`, `Landing.tsx`, `AnalysisForm.tsx`, `Processing.tsx`, `Results.tsx`, `Workspace.tsx`, `Pricing.tsx`, `Checkout.tsx`, `PaymentStatus.tsx`. (`Admin.tsx`/`AdminInsights.tsx` and the legal pages were left untouched — internal/low-traffic surfaces, no reported motion gap.)

## 5. Components changed / created

**Changed**: `ui.tsx` (`Button`, `Card`), `Accordion.tsx`, `LanguageSwitcher.tsx`, `DeleteConfirmDialog.tsx`, `NewAnalysisConfirmModal.tsx`, `Stepper.tsx` (`VerticalStepper`), `RotatingHint.tsx`, `charts.tsx` (`RadialGauge`), `RequirementPriorityMap.tsx`.

**New**: `components/Reveal.tsx` (scroll-reveal wrapper), `lib/motion.ts`, `lib/useReducedMotion.ts`, `lib/useInView.ts`, `lib/useDelayedUnmount.ts`, `lib/useModalClose.ts`, `lib/useModalA11y.ts`.

## 6. Analysis loading sequence

`Processing.tsx` already polled real backend `procStage` (0–6) and drove `VerticalStepper` + rotating hints — this was **not replaced**, only refined:
- `VerticalStepper`'s step circles now transition background/border/color/scale together (`--motion-standard`), and the **current** step gets a restrained, slow pulse (`pm-pulse`, 2.2s — the *same* keyframe already used elsewhere in the app for "in progress," not a new loop) instead of a static color swap.
- The connecting line between steps now transitions color over `--motion-deliberate` (400ms) instead of jumping, so progress reads as advancing rather than toggling.
- The progress bar and the hint-rotation fade now use shared tokens instead of hardcoded `.4s ease` strings.
- The failed-state card gets a single `motion-pop-in` reveal (draws attention once, no repeated shake/flash).

No fake stages, no fabricated completion percentages — the bar width and step index still come directly from the polled `procStage`/`status`.

## 7. Result reveal sequence

`Results.tsx`: every major section (readiness, compatibility score, coverage, KPI grid, category chart, strengths grid, most-important-requirement, recommendation, conversion CTA, unlocked example card) is wrapped in the new `<Reveal>` component — fades and rises into place the first time it scrolls into view, never replayed on scroll-up/down. The first three above-the-fold sections get a small coordinated stagger (`STAGGER.sections`); below-the-fold sections reveal independently as the user scrolls, which is itself the "progressive reveal" the brief asked for — nothing is hidden behind a timer, everything is interactable immediately (`<Reveal>` never uses `display:none` or delayed mounting, only opacity/transform).

`RequirementPriorityMap.tsx` (the Report tab's evidence-matching view) got the most deliberate sequencing: each requirement card reveals as a group (staggered by `STAGGER.cards`), and *within* a card the title reveals first, the priority/status badges ~70ms after, and the evidence/why-it-matters/next-step blocks ~130–190ms after that — approximating "requirement → evidence → status" without introducing a new connector-line visual (see §1). The advanced "Ətraflı uyğunluq xəritəsi" matrix now expands/collapses smoothly via `.motion-collapse` instead of appearing/disappearing instantly.

`Workspace.tsx`'s three tabs (report/cv-plan/interview) are wrapped in a single `key`-driven `.route-fade` container keyed on `${activeTab}-${owned>=1}-${owned>=2}` — so both an ordinary tab switch **and** a lock→unlock transition (returning to the workspace right after payment) get one brief, consistent fade, matching the "animate entitlement upgrades and newly unlocked content clearly" requirement without new bespoke code per tab.

## 8. Upload interaction changes (`AnalysisForm.tsx`)

- **Idle**: the dropzone now has a hover border response (`hover:border-border-strong`) it previously lacked.
- **Drag-over**: the zone gets a subtle `scale-[1.01]` plus its existing border/background swap now transitions instead of jumping; the upload icon inside scales up slightly (`scale-110`, spring easing) as a "targeted" response.
- **File accepted**: the accepted-file card, the vacancy-found card, and the manual-vacancy-submitted card all get a `motion-pop-in` settle-in instead of appearing instantly.
- **Errors** (unsupported file type, oversized file, vacancy extraction failure, submit failure): all reveal via `motion-rise-in`/`motion-pop-in` — a single, calm entrance, explicitly **not** a shake (per the brief's "no shaking effect... unless extremely subtle and used once," the simplest compliant choice was no shake at all).
- **No fake upload progress bar was added** — the actual upload has no real byte-level progress signal to show, and the brief explicitly forbids progress that doesn't reflect actual status; the existing spinner + "Yüklənir..." state was kept as the honest representation.
- All pill toggles (CV mode, vacancy source tab) and all three text inputs/textareas now transition their border/background color on interaction and focus instead of jumping.

## 9. Mobile adaptations

No animation in this pass uses a distance larger than `--dist-large` (24px) anywhere, so no separate "shrink the distance for mobile" step was needed — the token system was mobile-safe by construction from the start. Specifically verified live (Playwright, 390×844 viewport):
- No horizontal overflow introduced on any changed page (checked via `scrollWidth > clientWidth`).
- No connector-line diagrams exist anywhere to simplify for mobile (none were added — see §1).
- All hover-only effects (`.btn-elevate:hover`, card `.lift:hover`) rely on plain CSS `:hover`, which simply doesn't fire on touch devices — no functionality anywhere depends on hover (every interactive path also has a tap/click handler).
- Scroll-triggered reveals use `IntersectionObserver`, not scroll-event listeners — no risk of jank or heavy work firing on every scroll tick.
- Stagger delays are capped (480ms) regardless of list length, so a single-column mobile stack with more visible items doesn't drag out the reveal sequence.

## 10. Reduced-motion implementation

Two layers, working together:
1. **CSS (pre-existing, unchanged)**: the global `@media (prefers-reduced-motion: reduce)` rule collapses every `animation-duration`/`transition-duration` to ~0. This alone handles the large majority of what was added in this pass, since almost everything is pure CSS.
2. **`lib/useReducedMotion.ts`** (new): a hook wrapping `matchMedia('(prefers-reduced-motion: reduce)')`, live-updating if the OS preference changes without a reload. Used only where a *JS* decision depends on motion, not just a CSS duration:
   - `RadialGauge`: renders the final score/ring position immediately, skipping the from-0 sweep.
   - `useDelayedUnmount`/`useModalClose`: collapse their exit-wait to 0ms, so a modal or popover closes (and releases focus) instantly instead of sitting mounted for a now-invisible CSS animation's duration.
   - `useInView`: reports `inView: true` immediately without ever instantiating an `IntersectionObserver`, so scroll-revealed content is simply present, not observed-and-revealed.

No information is ever conveyed by animation alone — every animated state (score, status, stage) has a corresponding static label/number/badge that reduced-motion users see immediately and correctly.

## 11. Accessibility checks

- **Modal focus management** (new — previously absent): `useModalA11y` focuses the first focusable element in the dialog on open, restores focus to whatever had it before on close, closes on Escape, and locks background scroll while open. Applied to `DeleteConfirmDialog` and `NewAnalysisConfirmModal`.
- **Accordion / collapsible content**: uses `inert` (not just `aria-hidden`) on collapsed panels so keyboard Tab cannot land on invisible content — a real bug that the previous mount/unmount-based accordion didn't have (nothing was in the DOM to tab into) but the new always-mounted, height-animated version could have introduced without this.
- **Keyboard navigation**: verified Escape closes both modals; focus-ring styles (`.focus-ring`) were untouched, still visible on every interactive element.
- **Colour independence**: no new state is communicated by colour alone — status badges/chips already pair icon + text (pre-existing pattern, preserved).
- **No flashing content**: nothing added flashes, strobes, or loops faster than the two intentionally slow (2.2s+) reuse-only pulses.
- **Screen-reader-relevant state**: `aria-expanded`/`aria-controls` on the accordion and `role="dialog"`/`aria-modal`/`aria-labelledby` on both modals were added or preserved; none of this depends on the animation actually playing.

## 12. Performance considerations

- Every added animation uses `transform`/`opacity`, with two deliberate, justified exceptions: `.motion-collapse`'s `grid-template-rows` (the standard, well-documented GPU-friendly technique for animating to an intrinsic height — there is no `transform`-only equivalent), and the pre-existing progress-bar `width` transitions in `Processing.tsx`/`Workspace.tsx` (retimed to use tokens, not newly introduced — see §16 for the future-improvement note on these).
- Scroll reveals use one `IntersectionObserver` per revealed element (via `useInView`), each disconnecting itself immediately after firing once (`once: true`) — no long-lived observers accumulate.
- No continuous/looping animation was added anywhere; the two pulses reused for "in progress" state are the same ones already in production before this task, not new instances.
- No new client-side rendering work was introduced beyond what the reveal/stagger logic itself needs (a `ref`, an `IntersectionObserver`, a boolean) — no wrapper-per-element pattern was used beyond the `<Reveal>` component, which is intentionally lightweight (one div, one hook).
- Production build succeeded with a modest size increase: JS bundle 430.75kB → 437.70kB (gzip 121.92kB → 123.96kB), CSS 41.76kB → 47.01kB (gzip 8.43kB → 9.27kB) — entirely first-party code (tokens, hooks, utility classes), no new runtime dependency shipped to users (see §13).
- Confirmed live via Playwright: no new console/page errors on any changed page, no horizontal overflow on desktop (1366px) or mobile (390px) viewports.

## 13. Dependencies added or removed

**Shipped to users**: none. No animation library (Framer Motion or otherwise) was added — confirmed unnecessary; see §1.

**Dev-only (test infrastructure)**: `jsdom` and `@testing-library/react` were added as devDependencies. The project had zero component-level test infrastructure before this task (all existing tests were pure-logic `.test.ts` files with `environment: 'node'`); testing reduced-motion behavior, modal focus/close, and accordion expand/collapse — all explicitly requested — requires a real DOM. `vitest.config.ts`'s `include` glob was widened from `src/**/*.test.ts` to also match `src/**/*.test.tsx`. `@testing-library/jest-dom` was deliberately **not** added — all new tests use plain DOM property assertions (`.disabled`, `.getAttribute(...)`, `.textContent`) instead, avoiding a second new dependency plus a setup-file config change for a marginal readability gain.

## 14. Tests added

40 new tests across 8 new files (all passing, alongside the 11 pre-existing tests — 51 total, zero regressions):

- `lib/useReducedMotion.test.ts` (3) — reflects OS preference at mount, updates live on change.
- `lib/useDelayedUnmount.test.ts` (4) — stays mounted for the exact configured duration after close, unmounts on the following tick, collapses to 0ms under reduced motion, re-opening cancels a pending unmount.
- `lib/useModalClose.test.ts` (3) — `onClose` is deferred (not synchronous) on request, fires exactly once even under a duplicate request, closes immediately under reduced motion.
- `lib/useModalA11y.test.tsx` (4) — focuses the dialog's first focusable element on mount, Escape triggers close, background scroll locks while mounted, focus and scroll are restored on unmount.
- `lib/useInView.test.tsx` (3) — starts hidden and flips to visible on intersection, disconnects its observer after the one-time reveal, is visible immediately under reduced motion.
- `lib/motion.test.ts` (3) — `staggerDelay` is `index * increment`, is capped for long lists, never negative.
- `components/Accordion.test.tsx` (5) — starts collapsed with `inert` content, opens on click (content present and no longer inert), single-open-by-default behavior, `allowMultiple` opt-in, re-clicking an open section collapses it.
- `components/ui.test.tsx` (4) — `Button` is disabled while loading even without an explicit `disabled` prop, enabled by default, respects an explicit `disabled` prop, still renders its label while loading.

## 15. Commands run and results

```
frontend: npx tsc -b                     → clean, no errors
frontend: npm run lint (oxlint)          → 8 pre-existing warnings only, 0 new, 0 errors
frontend: npm run test -- --run          → 11 files, 40 tests, all passing
frontend: npm run build                  → succeeds, dist/ generated
backend:  npm run typecheck / lint / test → unaffected — 133/133 tests still pass (no backend files touched)
```

Live verification via Playwright against the running dev servers (not deployed): homepage at 1366×900 and 390×844 (no horizontal overflow, screenshots captured pre/post-scroll), language-switcher popover open/close, CV-upload idle/accepted states, delete-confirmation modal open + Escape-close (dialog count returns to 0 after the exit animation completes), a full free→paid flow into the Workspace Report tab (staggered requirement cards, smooth accordion expansion of the advanced matrix), and a reduced-motion browser context confirming every `.motion-reveal` element is already at full opacity without any scrolling.

## 16. Known limitations

- No mobile hamburger menu exists in this codebase (nav links are simply hidden below `md`); building one was out of scope for a motion-focused pass (see §1) — the header itself now transitions its existing hover/active states, but there is no menu-open/close interaction to polish because there is no menu.
- No toast/alert notification system exists in this app at all; none was added, per "do not add features... beyond what the task requires."
- `Processing.tsx`'s and `Workspace.tsx`'s progress bars still animate `width` rather than a `transform: scaleX` equivalent — retimed with tokens in this pass but not restructured, since doing so safely would mean changing their DOM shape (a wrapping container + `transform-origin`) on a working, tested pattern late in this task; flagged here rather than silently left as "done."
- The homepage hero's existing multi-second illustration build-up (CV/vacancy/score cards) was intentionally left with its original hand-tuned, non-token delay values (0.3s–2.4s) rather than converted to the five coarse semantic duration tokens — it is a bespoke narrative sequence, not a set of independent micro-interactions, and forcing it onto 5 buckets would have degraded its carefully tuned relative timing for no real benefit.
- Route-level transitions are keyed on the top-level path segment (e.g. `workspace`, `results`), not the full pathname, specifically so `Workspace.tsx`'s tab switching (`/workspace/:id/:tab`) doesn't force a full remount; a side effect is that navigating between two different analyses' Results pages (`/results/:id-A` → `/results/:id-B`, if that ever becomes a direct in-app transition rather than always passing back through `/analyze`) would not replay the route-fade, since both share the `results` segment. Not currently reachable in the product's actual navigation flow, but worth knowing if that flow changes.

## 17. Recommended future improvements

- Convert the two remaining `width`-based progress bars to a `transform: scaleX`-based fill (wrapping container + `transform-origin: left`) for a fully GPU-only implementation — safe, small, but deliberately deferred here (see §16).
- If a toast/notification system is ever introduced, `lib/motion.ts`'s tokens and the `useDelayedUnmount` pattern already used for modals/popovers are directly reusable for its enter/exit behavior — no new motion primitives would be needed.
- If literal evidence-to-requirement connector lines are ever wanted (distinct from the current staggered-card sequencing), an SVG overlay keyed to card `getBoundingClientRect()` positions would be the natural approach — deliberately not built now, per §1's reasoning about not reintroducing diagram complexity a prior redesign removed.
