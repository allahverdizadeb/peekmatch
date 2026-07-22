# Anonymous Access Restoration — Report

## 1. Root cause (reproduced before writing any code)

Confirmed by direct code inspection, not assumption, across `schema.prisma`, `analysisLifecycle.ts`, `orders.ts`, `index.ts`, `app.ts`, and `AppHeader.tsx`:

1. **Primary cause: no session/cookie infrastructure existed at all.** The `Analysis` row and its `Order`/entitlement data always persisted correctly server-side — a refresh worked fine *as long as the URL still contained the analysis id*. What was actually missing was any way for the browser to **rediscover** that id once the URL was lost (homepage click, closed tab, new browser window). There was no cookie, and grepping confirmed `localStorage` was never used for this purpose either. The logo click itself was already non-destructive (`navigate('/')`, no state cleared) — the bug was "the homepage has no way to show you your previous analysis," not "something deletes your data."
2. **Independent, real bug: `expiresAt` was creation-time-based, not payment-time-based.** It was set once at analysis creation (`createdAt + 24h`) and never adjusted on payment. There was **no enforcement of "24 hours from payment"** anywhere — a user paying near the end of their upload-based window could have just-purchased content hard-deleted by the 15-minute cleanup cron within minutes of paying.
3. **Confirmed latent IDOR vulnerability.** `resolveAnalysis(id)` and `POST /orders` did a pure UUID lookup with **zero ownership check**. Anyone who saw or guessed an analysis id could view its report or purchase a package against it. This is fixed as a direct consequence of adding session-based ownership.

## 2. New session architecture

- **`AnonymousSession` model** (new): `id`, `tokenHash` (unique), `createdAt`, `lastSeenAt`, `expiresAt`. No user registration is added — this identifies "this browser," not a person.
- **Cookie**: name `pm_session`, `HttpOnly`, `secure` in production only, `SameSite=Lax`, `path=/`, 30-day sliding expiry (refreshed at most once per hour of activity, not on every request). The raw token (`crypto.randomBytes(32)`, base64url) exists only in the cookie and in transit; only its SHA-256 hash is ever stored (`middleware/anonymousSession.ts`).
- **`attachSession` middleware**, mounted globally in `app.ts` before all routes: resolves an existing session from its cookie, or creates a new one transparently on first visit. **Fails closed on ownership, not closed on availability** — if session resolution itself errors (DB hiccup), `req.sessionId` is simply left `undefined`; downstream ownership checks then treat "no session" as "doesn't own anything" rather than taking the whole API down.
- **CORS**: `cors({ origin: true, credentials: true })` (was bare `cors()`), needed for the cookie to survive a deployed frontend/backend split across origins. Same-origin dev via Vite's proxy already worked without it.
- **Frontend**: `lib/api.ts`'s shared `req()` wrapper now sends `credentials: 'include'` on every call.

## 3. Database changes

One migration: `backend/prisma/migrations/20260722083751_anonymous_session_entitlement_recovery/` — reviewed with `--create-only` before applying, confirmed additive-only (new tables + new nullable columns via SQLite's standard table-rebuild pattern, zero data loss risk, zero NOT NULL violations possible).

- `Analysis.anonymousSessionId` (nullable FK → `AnonymousSession`) — nullable so every pre-migration row is treated as ownerless/public, preserving old links exactly as before.
- `Analysis.paidAt` / `Analysis.entitlementExpiresAt` (nullable `DateTime`) — the paid-entitlement window, separate from `expiresAt` (the data-retention clock).
- New `AnonymousSession` model (above).
- New `RecoveryToken` model: `id`, `tokenHash` (unique), `analysisId` (FK, cascade delete), `createdAt`, `expiresAt`. Deliberately **not** one-time-use (no `consumedAt`) — it's a bounded-lifetime bookmark valid until the linked analysis's own entitlement expires, so it survives being opened from multiple devices or more than once.

No existing table was duplicated. `Order` remains the sole payment record; entitlement is derived from it, not stored as a separate `Payment`/`Entitlement` table.

## 4. Payment → entitlement logic

In `orders.ts`'s `POST /:id/simulate` (the existing simulated-payment endpoint), once an order transitions to `'paid'`:

```
entitlementExpiresAt = paidAt + 24h
```

set via `updateMany({ where: { id, paidAt: null }, ... })` — the `paidAt: null` guard makes this **atomic and idempotent**: it only fires the *first* time any order for that analysis is paid. A second order (an upgrade from package 1 → 2) matches zero rows and leaves the original window untouched — **upgrading never extends or resets the entitlement clock**, closing an obvious "keep re-buying to stay entitled forever" abuse path. The same guard means a duplicated/replayed "webhook" call (calling `/simulate` twice) can never grant a second window or double-charge — this reuses the endpoint's pre-existing `status !== 'pending'` guard for the order itself, plus the new `paidAt: null` guard for the entitlement grant specifically.

`Analysis.expiresAt` (the data-retention/hard-delete clock) is bumped to match `entitlementExpiresAt` whenever that's later — so a just-paid analysis isn't swept up by the existing 15-minute cleanup cron while its paid access is still active. This means the **existing cron requires zero changes** and now double-duties as entitlement-expiry cleanup for paid rows too — no new scheduled job was needed.

`lib/entitlement.ts` adds `isEntitlementActive()` for building response payloads (`GET /session/current`, `GET /:id`) — it is **not** an additional route gate, because the `expiresAt` bump already makes `resolveAnalysis()`'s existing expiry check double as the entitlement check for paid rows.

## 5. Ownership + expiry, unified in one place

`analysisLifecycle.ts`'s `resolveAnalysis(id, callerSessionId)` — the single choke point every analysis-reading route already went through — now does session → ownership → deletion → expiry validation in one pass, returning a 5-way result: `ok | not_found | forbidden | deleted | expired | entitlement_expired`.

- **`forbidden`** (session mismatch) intentionally maps to the **same 404 + generic message** as `not_found` — a non-owner can never learn whether an id exists at all (a real IDOR mitigation, not an oversight). This meant **no new frontend error-handling was needed** for the IDOR fix: the existing "plain 404 → simple inline message" pattern already in Results/Workspace/Checkout/Pricing covers it automatically.
- **`entitlement_expired`** is a new, distinct 410 from plain `expired` — used only when the analysis being resolved has a non-null `paidAt`. It carries the exact required copy ("Bu analizin 24 saatlıq giriş müddəti başa çatıb...") instead of the generic expiry message, so a returning paid user is told *why*, not silently shown a payment screen as if nothing had ever been bought.
- All 15 `resolveAnalysis()` call sites in `analyses.ts`, plus `orders.ts`'s order-creation and a new `loadOwnedOrder()` helper (for `GET /:id` and `/:id/simulate`, since an order id is a second UUID that could otherwise be enumerated independently of its analysis), now thread `req.sessionId` through.

## 6. New-CV reset behavior

- **Confirmation modal** (`components/NewAnalysisConfirmModal.tsx`), exact required AZ/EN copy, wired into two entry points:
  - `AppHeader`'s "Yeni analiz"/"New analysis" button (now takes an optional `analysisId`; every page that renders `AppHeader` with one already has a real loaded analysis, so the button is never a no-op).
  - `AnalysisForm.tsx` (`/analyze`) on mount: if the calling session already owns a real (non-draft) analysis, the entire upload wizard is blocked behind the modal — not just disabled, actually not rendered — so there's no race where an upload could start before the user resolves the prompt.
- **Cancel** navigates the user back into their existing analysis (routed by its own status: processing → `/processing/:id`, done+unpaid → `/results/:id`, done+paid → `/workspace/:id/report`) and does **not** touch the old analysis.
- **Confirm** reuses the **existing** `DELETE /:id` route — no new deletion logic was written. It already did exactly the right thing: nulls CV/vacancy content, sets `deletedAt`, and — critically — **never touches `Order` rows**, so financial records are preserved exactly as the requirement demands. The old analysis then resolves as `deleted` (410) on any further access; the new analysis is created fresh and automatically linked to the same session by `POST /api/analyses` (unchanged endpoint, now just reads `req.sessionId`).
- Package/entitlement never transfers: a brand-new `Analysis` row has `paidAt`/`entitlementExpiresAt` both `null` regardless of what the previous analysis under the same session had purchased.

## 7. Email recovery — implemented as infrastructure, not wired to email (documented limitation)

`Checkout.tsx` was inspected directly: **no step in the checkout flow collects an email address**, and no live mailer exists anywhere in `src/` (only a stale compiled `dist/lib/mailer.js` survives from a feature removed in an earlier product pass — confirmed via grep). Per the explicit fallback instruction in the brief, **no new mandatory email field was added to checkout**.

What was built instead, fully working and tested:
- `lib/recovery.ts`'s `createRecoveryToken(analysisId, expiresAt)` — generates a token, stores only its hash, returns the raw token once.
- `POST /api/recovery/consume` (`routes/recovery.ts`) — validates a token (generic 404 for invalid/expired, same IDOR-style non-disclosure as above) and, on success, re-homes the analysis's `anonymousSessionId` to the *consuming* browser's session. This is the mechanism that makes a recovery link actually restore access on a new device: afterward, the normal ownership check in `resolveAnalysis()` passes for that browser with no special-case code.
- Verified end-to-end in `session.test.ts` and live via Playwright: a token created directly (simulating "what would happen if an email were sent") is consumed from a completely different browser context with no prior cookie, and access is restored; a second, different device consuming the *same* token also succeeds (reusable, not one-time, per its schema design).

**Limitation**: nothing currently *generates and emails* a recovery link during real checkout, because there is no address to send it to. Wiring this up is a small, scoped follow-up (add an optional email field to `Checkout.tsx`, call `createRecoveryToken()` after payment success, send it via a mailer) but was deliberately not built speculatively per the brief's own instruction.

## 8. Security protections

| Threat | Mitigation |
|---|---|
| IDOR (view/buy someone else's analysis) | `resolveAnalysis()`/`loadOwnedOrder()` ownership check on every route; folded into the same 404 as not-found |
| Session fixation/hijacking | `HttpOnly`, `SameSite=Lax`, `secure` in prod; token is 256 bits of `crypto.randomBytes`, never logged, only its hash stored |
| Replayed recovery links | Consume validates hash + expiry each time; reusability is a deliberate, documented product choice (not one-time-use), not a security gap — the token itself is still a high-entropy secret with a bounded lifetime |
| Forged payment-success params | `/simulate` never trusts client-supplied amounts or status beyond `outcome`; price is always server-computed (`upgradePriceUsd`, pre-existing) |
| Entitlement manipulation | `paidAt`/`entitlementExpiresAt` are set only server-side, inside the atomic `paidAt: null`-guarded update; never accepted from the client |
| Expired-token reuse | Checked on every consume call (`expiresAt.getTime() < Date.now()`) |
| Cross-analysis access | Session ownership check, independent of package/entitlement checks |
| Duplicate webhook/payment processing | Two independent idempotency guards: the pre-existing `status !== 'pending'` order guard, and the new `paidAt: null` entitlement guard — tested explicitly in `session.test.ts` |
| Log hygiene | All new error logging (`session` middleware, `recovery` route, `orders` entitlement grant) logs only `err.message`/error class, never CV text, vacancy text, tokens (raw or hashed), or session ids |

No browser fingerprinting was added anywhere — ownership is entirely cookie/session-based.

## 9. Frontend states

`lib/useCurrentSession.ts` derives one of six explicit states from `GET /session/current`, never an ambiguous boolean combination: `restoring | noActiveAnalysis | processing | failed | unpaidAnalysis | paidActiveAnalysis`. (`draft` collapses into `noActiveAnalysis` — an unfinished upload wizard has nothing meaningful to resume.) This single hook drives both the homepage resume card and the new-CV confirmation gate.

## 10. Endpoints — reused vs. new

Per the brief's own "reuse existing routes when they already serve these purposes":

- `GET /api/session/current` — **new** (`routes/session.ts`). Never creates a session (that's `attachSession`, already run beforehand) or an analysis; never returns CV/vacancy content.
- `GET /api/analyses/:analysisId` — **reused**, extended with `paidAt`/`entitlementExpiresAt`.
- `GET /api/analyses/:analysisId/entitlement` — **not added as a separate route**; its data is already on the extended `GET /:id` above. Adding a second endpoint for the same two fields would have violated "do not create duplicate APIs."
- `POST /api/analyses/:analysisId/start-new` — **not added**; the confirmation modal's confirm action reuses the existing `DELETE /:id`, and a genuinely new analysis is created through the existing `POST /api/analyses`. No mutable "active analysis pointer" is stored anywhere — `GET /session/current` always derives it fresh (`ORDER BY createdAt DESC`).
- `POST /api/recovery/consume` — **new** (`routes/recovery.ts`), as specified.

## 11. Analytics

All nine required events (`active_analysis_restored`, `resume_analysis_clicked`, `new_analysis_warning_shown`, `new_analysis_confirmed`, `new_analysis_cancelled`, `entitlement_restored`, `recovery_link_used`, `analysis_expired`, `duplicate_payment_prevented`) are declared in `lib/analytics.ts`'s existing typed allowlist and `routes/events.ts`'s existing fixed metadata-key map — no metadata, presence/count only. `active_analysis_restored`/`resume_analysis_clicked`/`new_analysis_warning_shown`/`new_analysis_confirmed`/`new_analysis_cancelled` are wired to real UI events (`ResumeAnalysisCard.tsx`, `NewAnalysisConfirmModal.tsx`, `AnalysisForm.tsx`); `entitlement_restored`, `recovery_link_used`, `analysis_expired`, and `duplicate_payment_prevented` are declared and available on the allowlist but not yet fired from a live call site (recovery-link email isn't wired to a UI flow — see §7 — and the other two would need a dedicated recovery-landing page and an expiry-detection hook respectively, both out of scope for this pass). Noted here rather than silently left out.

## 12. Files changed

**Backend**
- `prisma/schema.prisma`, `prisma/migrations/20260722083751_anonymous_session_entitlement_recovery/migration.sql` (new)
- `src/middleware/anonymousSession.ts` (new)
- `src/lib/entitlement.ts` (new), `src/lib/recovery.ts` (new)
- `src/routes/session.ts` (new), `src/routes/recovery.ts` (new)
- `src/lib/analysisLifecycle.ts`, `src/routes/analyses.ts`, `src/routes/orders.ts`, `src/routes/events.ts`, `src/app.ts` (modified)
- `package.json`/`package-lock.json` — added `cookie-parser` + `@types/cookie-parser`
- `src/lib/analysisLifecycle.test.ts` (extended), `src/routes/session.test.ts` (new)

**Frontend**
- `src/lib/api.ts`, `src/lib/analytics.ts` (modified)
- `src/lib/useCurrentSession.ts` (new)
- `src/components/ResumeAnalysisCard.tsx` (new), `src/components/NewAnalysisConfirmModal.tsx` (new)
- `src/components/AppHeader.tsx`, `src/components/LifecycleState.tsx` (modified)
- `src/pages/AnalysisForm.tsx`, `src/pages/Landing.tsx`, `src/pages/Results.tsx`, `src/pages/Workspace.tsx`, `src/pages/Checkout.tsx`, `src/pages/Pricing.tsx` (modified)
- `src/lib/i18n/locales/az.ts`, `src/lib/i18n/locales/en.ts` — new `resumeCard`, `newAnalysisConfirm` blocks + `lifecycle.entitlementExpired*` keys, AZ/EN parity maintained (`Dict` typing + `parity.test.ts` both still pass)

## 13. Tests added

`backend/src/lib/analysisLifecycle.test.ts` (+11 cases): ownership ok/forbidden (with and without a session), null-`anonymousSessionId` treated as public, forbidden-over-deleted/expired priority, `entitlement_expired` vs plain `expired` derivation.

`backend/src/routes/session.test.ts` (new, 16 cases, real HTTP via `supertest` agents so cookies flow exactly as a browser would):
- Cookie issued on first request, reused (no second `Set-Cookie`) on the next
- `GET /session/current` never creates an analysis; returns the most recent one; isolated per session
- Cross-session `GET /:id` → 404; owning session → 200
- Cross-session order creation → 404 (IDOR on the order-creation path)
- Paying sets `paidAt`/`entitlementExpiresAt` exactly once and bumps `expiresAt` to match
- Upgrading does **not** reset `paidAt` (duplicate-payment/free-extension prevention)
- `GET /:id` exposes the new entitlement fields
- Recovery: bogus token → 404, expired token → 404, valid token re-homes ownership to a new session, and is reusable across a second device

## 14. Commands executed

```
backend: npx prisma migrate dev / npx prisma generate / npm install cookie-parser @types/cookie-parser
backend: npm run typecheck · npm run lint · npm run test (133/133 passed) · npm run build
frontend: npx tsc -b · npm run lint · npm run test (11/11 passed) · npm run build
```

## 15. Manual/live verification (real dev servers, Playwright — not mocked)

All of the following were driven against the actual running app (`:4000`/`:5173`), not just unit-tested:

- **Refresh**: created + paid for an analysis, opened the paid Workspace, hard-reloaded — content stayed accessible, no re-payment prompt.
- **Logo click → homepage resume card**: clicked the header logo from inside the paid workspace, landed on `/`, and the exact required "Son analiziniz hazırdır" card rendered with the entitlement-expiry line and a working "Analizə davam et" button that returns to the same workspace.
- **New browser context reusing only the `pm_session` cookie** (restart simulation): extracted the cookie, opened a fresh Playwright context with only that cookie set, confirmed `HttpOnly` is set, and confirmed the resume card + direct workspace URL both work — full restoration with zero other state carried over.
- **IDOR check**: a fresh context with no cookie at all gets `404` on the same analysis id, not the real data.
- **New-CV confirmation modal**: revisiting `/analyze` with an active analysis shows the modal; Cancel returns to the existing analysis and leaves it untouched (verified via a follow-up `GET` still returning 200); Confirm deletes the old one (verified it now resolves `410`/`code:'deleted'`) and lets a genuinely new upload proceed.
- **Entitlement expiry**: backdated `entitlementExpiresAt`/`expiresAt` directly in the database (simulating real time passing) and confirmed the workspace shows the exact required "Giriş müddəti başa çatıb" / 24h privacy message — not a payment screen, and with no pricing text on the page.
- **Processing-state resume card**: caught an analysis mid-processing, visited the homepage, confirmed the exact "Analiziniz hazırlanır" / "Analizə qayıt" variant.

Screenshots captured for the paid resume card, the processing resume card, the new-CV confirmation modal, and the entitlement-expired state.

## 16. Confirmed unaffected

Full backend (133 tests) and frontend (11 tests, including the AZ/EN i18n parity test) suites pass unmodified in their pre-existing coverage; both production builds succeed. CV upload/parsing, vacancy analysis, scoring, Evidence Chain, free results, pricing, the simulated payment provider, CV Change Plan, Interview Playbook, and the existing immediate-delete flow were not touched beyond the ownership-check threading described above, and all their existing tests still pass.

## 17. Remaining limitations

1. **Recovery-link email delivery is not wired up** — see §7. The token infrastructure and consume endpoint are complete and tested; nothing currently triggers sending one, because checkout collects no email address.
2. **`entitlement_restored`, `recovery_link_used`, `analysis_expired`, `duplicate_payment_prevented`** analytics events are declared but not yet fired from a live call site (see §11) — each needs a UI trigger point that doesn't exist yet in this pass (a recovery-landing page, an expiry-detection moment, and a duplicate-payment UI path respectively).
3. The `entitlement_expired`-specific 410 message is only guaranteed for the window between an analysis's expiry and the next 15-minute cleanup cron sweep; after the row is hard-deleted, a direct link to it degrades to a plain generic 404 rather than the privacy-specific message. This still satisfies "never expose expired data" and "never silently show a payment screen," just with less specific copy after that window.
