# PeekMatch
AI-powered CV ↔ job vacancy compatibility analysis platform (Azerbaijani-market product, implemented from the Claude Design handoff in `project/` — see `chats/` for the original design conversation).

This repo contains a working implementation of the **full user flow**: landing → CV/vacancy analysis → free results dashboard (incl. real-vs-CV-visible match teaser and a self-attestation prompt for the top missing requirement) → pricing (incl. free tier + comparison table) → checkout (incl. upgrade-diff pricing) → payment → paid report / CV Change Plan / Interview Playbook → delete/expired lifecycle states, plus legal pages (privacy/terms/data-deletion) and a shared-secret-gated admin panel for reviewing user feedback.

The UI is fully localized into Azerbaijani and English via a header language switcher (`frontend/src/lib/i18n/`); the CV-analysis AI result language tracks the site language live until the user manually overrides it on the analysis form, and is stored per-analysis so results stay in the language they were generated in even if the site language changes afterward.

## Stack

- **frontend/** — React + Vite + TypeScript + Tailwind CSS, mapped to the design's color/spacing/radius/shadow tokens.
- **backend/** — Node + TypeScript + Express + Prisma (SQLite), OpenAI SDK (Responses API) for the matching analysis, `docx` + Playwright/Chromium for document generation.

## Running locally

```bash
# backend
cd backend
npm install
npx prisma migrate deploy   # first time only
npm run dev                 # http://localhost:4000

# frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

### Environment variables (backend/.env)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (defaults to `file:./dev.db`) | SQLite database path |
| `OPENAI_API_KEY` | **for real AI analysis** | Powers the CV↔vacancy matching, CV Change Plan, and Interview Playbook generation via OpenAI's Responses API. Without it, the backend logs a warning and falls back to a clearly-labeled offline placeholder analyzer so the rest of the product flow is still exercisable. |
| `OPENAI_MODEL` | no (defaults to `gpt-5.6-terra`) | Model ID used for every AI-backed function. |
| `PORT` | no (defaults to 4000) | Backend port |
| `ADMIN_KEY` | **for the admin panel** | Shared secret gating `GET /api/suggestions` and the `/admin`/`/admin/insights` frontend pages — not a real auth system, just a header/query-param check (`x-admin-key`). Without it set, admin endpoints always 401. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Feedback-widget submissions (`POST /api/suggestions`) are always saved to the database; if `SMTP_HOST` is set, a copy is also emailed to `support@peeky.az` via `nodemailer`. Without it, the backend logs a warning and skips sending — submissions are never lost. |

Payments are real in structure (orders, gating, unlock logic) but the charge step itself is simulated — no live payment provider is wired up. Vacancy URL extraction attempts a real server-side fetch and falls back to the manual-paste flow when a site blocks it or the page is too thin.

## Data retention

Analyses (CV text, vacancy text, AI results) expire 24 hours after creation, matching the product's privacy promise. A background job purges expired rows every 15 minutes.
