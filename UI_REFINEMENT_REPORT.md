# UI refinement — Requirement Priority Map, pricing card centering, price update

## Requirement-matrix changes

**Root cause of "too dense/abstract"**: the paid Report tab's "Əhəmiyyət matrisi" (`ImportanceMatrix`, from the previous redesign pass) rendered every requirement in a raw 3×4 importance/status grid with no grouping and no "what do I do" framing — logically correct, but read as a spreadsheet.

**Fix**: a new `components/RequirementPriorityMap.tsx` now replaces both the old "Tələb əhatəsi" coverage-bar card and the "Əhəmiyyət matrisi" grid card as the Report tab's default view (they were redundant with each other and with the new component's own top summary, so they were removed rather than kept alongside it):

- **Compact summary** at top reuses the existing `RequirementCoverageBar` primitive (already 4-state, already colorblind-safe — icon/text pairing, not color alone) with the new plain-language labels and real counts.
- **Three groups**, every requirement placed in exactly one:
  - **Təcili diqqət tələb edir** (urgent) — `kritik`/`əsas` importance, not yet `met`. Strong warning treatment, shown first in both DOM order and visual weight.
  - **Güclü uyğunluqlar** (strong matches) — `kritik`/`əsas` importance, `met`. Positive treatment.
  - **Əlavə üstünlüklər** (nice-to-haves) — `üstünlük` importance, any status — deliberately never competes visually with the urgent group, per the brief.
- **Each card**: full requirement title (never truncated), one status badge + one importance chip (icon+text, reusing `PriorityChip`/`StatusDot` from the previous pass), a "Niyə vacibdir" line (reuses the AI's real `explanation` field — already exactly that framing, no backend/AI change needed), and for the urgent group only, a "Növbəti addım" line.
- **"Next step" text**: the Report tab already fetches Evidence Chain data, which links each requirement to a `relatedChangeSection` in the CV Change Plan. When one exists, the next step points directly there ("CV Dəyişiklik Planında '…' bölməsinə baxın") instead of a generic instruction. Only falls back to one of three short, deterministic, status-keyed templates (never inventing anything about the candidate) when no related change exists — this is real, already-computed data, not a new AI field.
- **Advanced view**: the original `ImportanceMatrix` grid survives, moved behind a collapsed "Ətraflı uyğunluq xəritəsi" toggle (closed by default, `aria-expanded`/`aria-controls` wired), so power users can still get the full table.
- **Responsive**: each group uses `grid-cols-1 lg:grid-cols-2` (two columns only where there's content to fill both), single column below `lg:`, urgent group always first so it's first on mobile too. No text truncation anywhere in the cards, so nothing to overlap or clip.

## Terminology simplified

New copy lives in its own `t.workspace.priorityMap.*` namespace (both locales) rather than editing the shared `t.workspace.statusLabel`/`importanceLabel` maps, which are still used elsewhere (the CV Change Plan cards, Evidence Chain, and the pre-existing detailed requirement table) and were explicitly out of scope for this task. Applied exactly the requested replacements within the new namespace: "Kritik boşluq" → "Təcili diqqət tələb edir", "Qismən uyğundur" → "Qismən uyğun", "Uyğundur" → "Güclü uyğunluq", "Məlumat kifayət deyil" → "Məlumat çatmır", "Əsas" → "Əsas tələb", "Üstünlük" → "Əlavə üstünlük". Section eyebrow/heading/subtitle use the exact suggested copy ("TƏLƏBLƏRƏ UYĞUNLUQ" / "Ən vacib tələblərdə vəziyyətiniz" / …). English mirror uses natural equivalents, not literal translations.

## Pricing card centering fix (Landing.tsx)

**Root cause, confirmed by inspection, not guessed**: the pricing row wraps exactly 3 cards (free tier + 2 paid packages) inside `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5` — a **4-column** grid definition for **3** actual cards. At the `lg:` breakpoint the row only fills 3 of 4 tracks, so the 3 real cards sit left-aligned within a 4-wide row instead of centering as a group — exactly the reported "shifted to the left" symptom. The outer `max-w-[1200px] mx-auto` container was already correctly centering the *grid itself*; the bug was purely the grid's own internal track count.

**Fix**: `lg:grid-cols-4` → `lg:grid-cols-3` — one class change, no padding/margin hacks, no wrapper changes. Card internals were already correct for the rest of the checklist (`flex flex-col` + `flex-1` on the feature list already pushes every button to the bottom consistently; `items-stretch` on the grid already balances card heights) — confirmed live rather than assumed. Tablet keeps the existing `md:grid-cols-2` wrap (2-then-1); mobile already stacked full-width with consistent margins.

## Price update ($4.90 → $0.90, $9.90 → $2.90)

Server remains the sole source of truth — `backend/src/lib/pricing.ts`'s `PACKAGES` map is the only place a price is actually decided; every other file listed below is a **display mirror** or a **test assertion**, matching the architecture that already existed (frontend never controlled the charge amount; `POST /orders` already ignored client-supplied amounts before this change, confirmed by an existing, still-passing test). Updated: `backend/src/lib/pricing.ts` (source of truth + a stale doc comment), `backend/src/lib/pricing.test.ts`, `backend/src/routes/analyses.test.ts` (fixture helper, assertions, one describe-block label), `frontend/src/pages/{Checkout,Pricing,Landing,Workspace}.tsx` (display strings only). A full repo grep for `4.90`/`9.90`/`4.9`/`9.9` after the change returned zero remaining matches. No AZN references existed anywhere in the repo to begin with (confirmed by grep) — nothing to remove there. Package IDs (1, 2) and all entitlement/gating logic (`unlocksApplication`/`unlocksInterview`/`highestOwnedPackage`) are untouched, since they key off package ID, not price.

## Files changed

Backend: `pricing.ts`, `pricing.test.ts`, `analyses.test.ts`.
Frontend: `components/RequirementPriorityMap.tsx` (new), `pages/{Workspace,Landing,Pricing,Checkout}.tsx`, `lib/i18n/locales/{az,en}.ts`.
No other files touched — the previous pass's design system (tokens, `RequirementCoverageBar`, `ImportanceMatrix`, `PriorityChip`, `StatusDot`, `Badge`) was reused as-is, per "reuse existing design tokens" / "avoid unnecessary dependencies."

## Tests executed

- `cd backend && npm run build && npm run test` — clean, **93/93 passing** (price assertions updated and passing).
- `cd frontend && npm run build && npm run test && npm run lint` — clean, **13/13 passing**, only pre-existing unrelated warnings.
- Live verification (real dev servers, Playwright): Landing pricing row screenshotted at 1366/768/320px — desktop shows all 3 cards in one fully centered row with equal widths and bottom-aligned buttons; tablet wraps to 2-then-1; mobile stacks full-width. The standalone `/pricing` page and its comparison table both confirmed showing exactly "Ödənişsiz" / "0.90 USD" / "2.90 USD". A real analysis was run end-to-end, package 1 purchased (via the same order+simulate endpoints the real checkout flow uses), and the paid Report tab screenshotted to confirm the Requirement Priority Map renders as the default view (urgent group first) with the advanced matrix collapsed behind its toggle.

## Remaining limitations

- The tablet breakpoint's odd-card-out (3 cards in a 2-column grid) lets the third card wrap to its own row, left-aligned under column 1 rather than centered on its own — standard CSS grid wrapping behavior. The brief asked for "a balanced two-column or stacked layout" on tablet, which this satisfies, but centering a lone wrapped item would need extra `nth-child`-style CSS; left as-is since it wasn't the reported bug (which was specifically about the desktop row).
- The Requirement Priority Map's "next step" text falls back to one of three fixed templates (by status) when no related CV Change Plan section exists for a requirement — this is deliberately generic/non-fabricated rather than AI-generated, so wording can feel repetitive across several urgent cards with no matching change card. Acceptable given "preserve existing analysis logic" (no new AI field was added), but worth revisiting if that repetition becomes a real complaint.
- English-language screenshots of the Requirement Priority Map were not separately captured in this pass (the Azerbaijani copy was the explicit focus of the brief); the `en.ts` mirror was written and passes the i18n parity test, but hasn't been independently eyeballed live.
