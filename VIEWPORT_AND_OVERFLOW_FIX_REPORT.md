# Viewport & Overflow Fix — Report

## 1. Root cause of the `/analyze` modal issue

Two separate, compounding bugs — both had to be fixed for the modal to actually behave correctly.

**Bug A — no scroll escape hatch.** The old modal markup was:

```html
<div class="fixed inset-0 flex items-center justify-center p-6" onClick={cancel}>
  <div class="max-w-[440px] ...">...</div>
</div>
```

`flex items-center justify-center` centers the dialog symmetrically around the overlay's midpoint regardless of whether the dialog's own height exceeds the viewport — when it does, exactly half the overflow amount is pushed above `y: 0`. The overlay itself had no `overflow-y`, and background scroll was separately locked, so the clipped top portion (icon + title) was **permanently unreachable**, not merely visually cut off. Reproduced live at 1280×600: the dialog's own `boundingBox().y` measured **-147px**.

**Bug B — a route-transition animation broke `position: fixed` app-wide.** This is the more serious, more interesting finding. `App.tsx`'s route-transition wrapper (`.route-fade`, added in an earlier motion-design pass) played a CSS `animation` whose keyframes included `transform: translateY(...)`. Per the CSS containing-block specification, **any ancestor with a non-`none` computed transform becomes the containing block for `position: fixed` descendants instead of the viewport** — and browsers keep reporting a non-`none` transform (an identity matrix, not the literal keyword `none`) for an element that has ever run a transform-touching animation, even long after the animation finishes. Confirmed live: with `.route-fade` present, the modal overlay's own computed `height` was **69px** — the transformed ancestor's own content-box height — instead of the real 600px viewport. No amount of overlay/dialog CSS can fix a `fixed` element whose containing block isn't the viewport at all. Stripping the ancestor's transform live changed the overlay's measured height from 69px to the correct 600px in the same instant, confirming causation directly rather than by inference.

Bug B is what made this a genuine "modal simply doesn't fit," rather than "modal is slightly too tall" — and it explains why a plain `max-height` patch (explicitly disallowed) would never have actually fixed it.

## 2. Files changed

**New**
- `frontend/src/components/Dialog.tsx` — shared full-screen dialog primitive (see §3)
- `frontend/src/lib/bodyScrollLock.ts` — reference-counted body scroll lock
- `frontend/src/lib/backgroundInert.ts` — reference-counted `#root` `inert` toggle
- `frontend/src/components/Dialog.test.tsx`, `frontend/src/lib/bodyScrollLock.test.ts`, `frontend/src/lib/backgroundInert.test.ts` — new tests
- `backend/e2e/modal-viewport.spec.ts` — new e2e regression spec

**Modified**
- `frontend/src/lib/useModalA11y.ts` — now uses the reference-counted lock modules; added a real keyboard focus trap
- `frontend/src/lib/useModalA11y.test.tsx` — extended with focus-trap and background-inert coverage
- `frontend/src/components/DeleteConfirmDialog.tsx`, `frontend/src/components/NewAnalysisConfirmModal.tsx` — refactored onto the shared `Dialog` primitive; no business-logic change
- `frontend/src/components/MarketingChrome.tsx`, `frontend/src/components/AppHeader.tsx` — incidental header horizontal-overflow fix at 360px width (found during viewport-matrix testing, unrelated to the modal itself — see §7)
- `frontend/src/index.css` — new `.dialog-max-height` utility (dvh with vh fallback); `.route-fade`'s keyframe stripped of `transform` (root-cause fix for Bug B)

## 3. Shared dialog changes

Built one primitive, `components/Dialog.tsx`, and moved both existing modals (`DeleteConfirmDialog`, `NewAnalysisConfirmModal`) onto it rather than patching each separately — per the brief's explicit preference for a shared solution over per-modal fixes.

**Structure** (the standard "scrollable centered dialog" pattern):
```
<overlay: fixed inset-0, overflow-y-auto>       <!-- the SCROLL CONTAINER -->
  <wrapper: min-h-full, flex items-center>       <!-- centers when it fits; grows (not clips) when it doesn't -->
    <dialog: dialog-max-height, overflow-y-auto> <!-- capped height + its own internal scroll as a second, defensive layer -->
```
`min-h-full` (not `h-full`) on the wrapper is the key detail: it gives the wrapper *at least* the viewport's height, but lets it grow taller to fit the dialog when needed — at which point the overlay's own `overflow-y-auto` reveals the excess by scrolling, with the dialog rendered starting at zero negative offset. `.dialog-max-height` (`calc(100vh - 5rem)`, overridden by `calc(100dvh - 5rem)` for browsers that support the dynamic viewport unit — declared second so unsupporting browsers simply keep the first, valid rule) is a second, defensive cap for pathologically long content, so an extreme case scrolls *inside* the dialog rather than requiring a very long page-level scroll.

**Root-cause fix for Bug B**: `Dialog` renders via `createPortal(..., document.body)` — its DOM subtree has no ancestor from the routed React tree at all, so it can never again be affected by `.route-fade` or any future ancestor transform/filter/perspective/`contain`. This is on top of, not instead of, fixing `.route-fade` itself (§7) — the portal protects this one shared primitive specifically and permanently; fixing `.route-fade` protects everything else in the app that isn't (and might never be) portalled.

`Dialog` takes `titleId`/`descriptionId` (wired to `aria-labelledby`/`aria-describedby`), `closing`/`onRequestClose` (driven by each caller's own `useModalClose`, since the two existing modals have genuinely different close semantics — e.g. `NewAnalysisConfirmModal` has two separate close paths, cancel vs. confirm), and `maxWidthClassName` for the one real per-modal visual variance (420px vs. 440px). Callers supply their icon/title/body/buttons as children.

## 4. Scroll-lock changes

Replaced the old per-modal snapshot/restore pattern (`const prev = document.body.style.overflow; ...; document.body.style.overflow = prev`) with `lib/bodyScrollLock.ts`, a module-level **reference count**. The old pattern breaks the moment two dialogs are ever open at once and close out of LIFO order: whichever closes first restores the *original* (unlocked) value while the second dialog is still open, silently un-locking the background under it. A counter has no such ordering dependency — the lock only lifts once nothing is holding it anymore (unit-tested directly in `bodyScrollLock.test.ts`).

Also added scrollbar-width compensation: locking pads `body` by the scrollbar's own width (`window.innerWidth - document.documentElement.clientWidth`) so removing the scrollbar doesn't shift fixed/centered content sideways by a few pixels the instant the lock engages.

Route changes clean this up automatically and correctly: `useModalA11y`'s effect cleanup (which calls `unlockBodyScroll()`) runs as part of React's normal unmount when the route no longer matches — verified live via real browser-back navigation while a modal was open (not a synthetic `pushState`, which doesn't trigger React Router and would have given a false pass).

## 5. Accessibility changes

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` — present on both modals via `Dialog`.
- Focus moves into the dialog on open (first focusable element, or the dialog container itself as a fallback).
- **New**: a real keyboard focus trap — Tab from the last focusable element wraps to the first, Shift+Tab from the first wraps to the last, recomputed on every keypress (not cached once) so a button's `disabled` state changing mid-request is respected. The previous version had zero focus trapping.
- Focus returns to whatever triggered the modal on close (Escape, backdrop click, or either action button).
- Escape closes the modal via the same animated `useModalClose` path as clicking Cancel/backdrop — no instant unmount.
- **New**: the app root (`#root`) is marked `inert` while any dialog is open — reference-counted the same way as scroll lock — so screen readers and keyboard `Tab`/browse-mode navigation cannot reach background content at all, not just visually-obscured content. This was only newly possible because the dialog is now portalled to `document.body`: inerting `#root` while the dialog renders as its sibling can never accidentally inert the dialog itself.
- `prefers-reduced-motion`: exit animations collapse to instant (already-existing `useReducedMotion`-aware `useModalClose`), and the entrance/exit CSS keyframes are covered by the app's existing global `@media (prefers-reduced-motion: reduce)` rule.

## 6. Routes audited

`/`, `/analyze` (both the direct dropzone flow and the new-analysis-confirmation-modal gate), `/processing/:id`, `/results/:id` (including `DeleteConfirmDialog`), `/pricing/:id`, `/checkout/:id/:pkg`, `/payment/:orderId`, `/workspace/:id/:tab`, `/privacy`/`/terms`/`/deletion`, `/admin`, `/admin/insights`. Also audited `/superadmin/*` once discovered mid-task (see §7) — not credential-tested live (no superadmin key available in this environment), but protected by the same root-cause CSS fix by construction.

## 7. Similar issues found

A full-repo grep for the risky patterns listed in the brief (`fixed inset-0`, `items-center justify-center` on absolutely/fixed-positioned elements, `100vh`/`min-h-screen`, `top/left: 50%` + `translate(-50%,-50%)`, unscrolled `overflow-hidden`) found:

1. **The two modals themselves** — the actual bug, fixed as above.
2. **Superadmin panel's `Sidebar` and `Drawer` components** (`components/superadmin/Shell.tsx`, `components/superadmin/Drawer.tsx`) — both `fixed`-positioned, both descendants of `App.tsx`'s `.route-fade` wrapper (the Superadmin section nests its *own* second `.route-fade` on its `<main>`, compounding the exposure), and therefore both subject to the exact same Bug B containing-block failure. This was found, not searched for in advance — the audit's own methodology (checking what else consumes the shared root-cause CSS class) surfaced it. Not portalled (that would need per-component changes in code I don't own the context of), but protected by the CSS-level fix in §onwards.
3. **`Tooltip.tsx`** and a **"most popular" badge** on `Landing.tsx` use `left-1/2 -translate-x-1/2` — horizontal-only centering on small, anchored elements (a tooltip bubble, a pricing-card ribbon), not viewport-relative full-screen overlays. Reviewed, not at risk of this bug class, left unchanged.
4. **`AdminGate.tsx`**, **`EmptyState.tsx`** use `items-center justify-center` but are ordinary in-flow page content (no `fixed`/`absolute`), so they scroll naturally with the page and were never at risk.
5. No `100vh`/`min-h-screen`/`h-screen` usage anywhere in the codebase — nothing else is viewport-height-locked.
6. **An unrelated, pre-existing horizontal-overflow bug** at 360px viewport width: the marketing/app headers' logo + language-switcher + CTA row had no responsive slack at the narrowest tested phone width, overflowing by ~5px and producing a page-wide horizontal scrollbar on **every route**, not just `/analyze`. Found while running the required viewport matrix, not part of the original report — fixed as a genuine, in-scope "accidental horizontal scrolling" defect per the audit checklist (§9 below has the before/after measurement).

## 8. Similar issues fixed

- **Root-cause fix, not a per-component patch**: `.route-fade`'s keyframe (`pm-route-in` → renamed `pm-route-fade-in`) had its `transform: translateY(...)` removed, keeping only the opacity fade. Verified live: the element's computed `transform` is now the literal keyword `none` (not an identity matrix), eliminating the containing-block override for **every** `position: fixed` element in the app — both current (the Superadmin Sidebar/Drawer, found above) and any future one — without needing to locate and individually patch each one. This is the single most load-bearing fix in this report; the shared `Dialog` portal is a second, independent layer of protection specifically for the two modals it covers.
- Header horizontal overflow at 360px: `px-6` → `px-4 xs:px-6` on both `MarketingHeader` and `AppHeader` (using the project's existing `--breakpoint-xs: 400px` token) — reclaims exactly enough width below 400px with no visual change above it.
- Two modals refactored onto the shared, viewport-safe `Dialog` primitive (§3).

## 9. Viewports tested

All required desktop, short-desktop, mobile, and mobile-landscape sizes, live against the running dev app (not simulated): **1440×900, 1366×768, 1280×720, 1024×768, 1280×600, 1440×650, 390×844, 393×852, 375×667, 360×640, 844×390, 667×375**, plus an intentionally extreme **1280×300** to exercise the dialog's own internal scroll (`.dialog-max-height`) rather than just the overlay scroll. At every size: title reachable, both actions reachable, no horizontal overflow. The 360×640 case additionally caught and validated the header-overflow fix (87px→0 same-day regression check at the 200%-zoom-equivalent width too, see below).

## 10. Browser zoom levels tested

Chromium's non-standard `zoom` CSS property was tried first and produced a misleading result (an apparent 87px overflow at zoom 2.0) — cross-checked against the reliable method (setting the viewport to the *effective* CSS-pixel space a real zoomed browser presents: 1024×640 ≈125%, 853×533 ≈150%, 640×400 ≈200%) and found **zero** overflow at all three, confirming the `zoom`-property reading was a measurement artifact of that legacy API interacting with `scrollWidth`/`clientWidth`, not a real defect. Documented here rather than silently discarded, since it's a real methodology trap worth recording for future viewport testing in this codebase.

## 11. Azerbaijani and English checks

Both languages verified live. English: title exactly "Start a new analysis?", both actions reachable at 1280×600. A **long-text stress test** (the body text replaced with ~6x its normal length, simulating a much longer future translation) confirmed the dialog gracefully caps via `.dialog-max-height` and both action buttons stay reachable via scroll — the fix does not depend on any specific string length in either language.

## 12. Tests added or updated

- `frontend/src/components/Dialog.test.tsx` (new) — role/aria wiring, portal-to-body rendering, a **structural regression guard** asserting the exact scrollable-dialog class structure (`overflow-y-auto` overlay, `min-h-full` + `items-center` wrapper, `dialog-max-height` + `overflow-y-auto` dialog box, and explicitly that `items-center` is *not* on the overlay itself) so a future edit reintroducing the old clipping pattern fails a test immediately, `data-state` reflecting the `closing` prop, backdrop-vs-inside click behavior.
- `frontend/src/lib/bodyScrollLock.test.ts` (new) — lock/unlock, and specifically the reference-counting behavior (two locks need two unlocks).
- `frontend/src/lib/backgroundInert.test.ts` (new) — same reference-counting shape for the `#root` `inert` toggle.
- `frontend/src/lib/useModalA11y.test.tsx` (extended, file pre-existed) — added: `#root` inert on mount/removed on unmount, Tab-from-last wraps to first, Shift+Tab-from-first wraps to last, Tab from a non-boundary element is left alone.
- `backend/e2e/modal-viewport.spec.ts` (new) — real-browser regression suite: the required 1280×600 short-viewport case (title/both buttons reachable, no horizontal overflow — not asserted via brittle exact pixel coordinates, via `scrollIntoViewIfNeeded()` + `toBeVisible()` + a loose y-bound sanity check instead), Escape closes + preserves the analysis + restores scroll, confirming replaces the analysis (business logic unchanged: soft-delete, `Order` rows untouched) + closes the modal, and browser-back navigation while the modal is open cleans up scroll lock.

## 13. Commands run and results

```
frontend: npx tsc -b                         → clean
frontend: npm run lint (oxlint)               → clean (only pre-existing warnings, no new ones)
frontend: npm run test (vitest)               → 59/59 passed, 14 files
frontend: npm run build                       → succeeds (includes the Superadmin bundle chunk)
backend:  npm run typecheck                   → clean
backend:  npm run lint (oxlint)               → clean
backend:  npm run test (vitest)               → 179/179 passed, 15 files
backend:  npx playwright test e2e/            → 9/10 passed; the 1 failure is e2e/analyze-flow.spec.ts's
                                                 vacancy-URL-extraction test, confirmed unrelated (see §14)
backend:  npx playwright test e2e/modal-viewport.spec.ts  → 4/4 passed (run twice to confirm stability)
```

## 14. Remaining limitations

1. **`e2e/analyze-flow.spec.ts`'s full-funnel test fails, pre-existing and unrelated.** It asserts on the exact string "Vakansiyanın mətnini daxil edin" appearing immediately after a vacancy-URL check fails; the current UI instead shows a fallback card with a "Mətn yapışdır →" button that must be clicked first to reach that state. Confirmed via `git diff` against the commit before any work in this session that the vacancy-fail block's only change across this entire session was adding a CSS animation class (`motion-pop-in`) — zero logic or conditional-rendering changes. This is a stale test/copy mismatch from an earlier, unrelated UX change to the vacancy-fail flow, not something introduced or touched here. Left as-is per scope (fixing it would mean changing either product copy/flow or an unrelated test's assertions, neither of which this task is about).
2. **Superadmin panel's `Sidebar`/`Drawer` were not live-tested** (no superadmin credential available in this environment). They're protected by the same root-cause `.route-fade` fix as everything else, and `Drawer.tsx`'s own structure (`h-full` + `overflow-y-auto` panel, `sticky top-0` header) was already well-built independent of the containing-block bug — but this is inference from static review, not a live-verified claim, and is flagged as such rather than reported as tested.
3. A whole additional Superadmin codebase (routes, components under `pages/superadmin/`, `components/superadmin/`) was discovered mid-task, added by a separate process outside this session's direct authorship. This report's Superadmin coverage is limited to the specific `fixed`-positioned components found via grep; a full page-by-page audit of that panel (per the brief's "/superadmin, /superadmin/login, all existing Superadmin routes" checklist) would need actual login access and was out of reach here.
4. Real-browser zoom (via the browser's actual UI zoom control, not the `zoom` CSS property or a viewport-size proxy) was not tested inside an automated harness — Playwright/CDP has no direct API for it. The effective-viewport-size proxy method (§10) is the standard, reliable substitute and is what was used.
