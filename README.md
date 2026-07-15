# PeekMatch
AI-powered CV ↔ job vacancy compatibility analysis platform (Azerbaijani-market product, implemented from the Claude Design handoff in `project/` — see `chats/` for the original design conversation).

This repo contains a working implementation of the **core user flow**: landing → CV/vacancy analysis → free results dashboard → pricing → checkout → payment → paid report / tailored CV / cover letter / interview prep. Admin panel, legal pages, delete/expired states, and EN/TR/RU UI chrome from the original design were intentionally left out of this pass — see `chats/chat1.md` and the design file for the full scope if you want to extend it.

## Stack

- **frontend/** — React + Vite + TypeScript + Tailwind CSS, mapped to the design's color/spacing/radius/shadow tokens.
- **backend/** — Node + TypeScript + Express + Prisma (SQLite), Anthropic SDK for the matching analysis, `docx` + Playwright/Chromium for document generation.

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
| `ANTHROPIC_API_KEY` | **for real AI analysis** | Powers the CV↔vacancy matching, tailored CV, cover letter, and interview prep generation via Claude (`claude-opus-4-8`). Without it, the backend logs a warning and falls back to a clearly-labeled offline placeholder analyzer so the rest of the product flow is still exercisable. |
| `PORT` | no (defaults to 4000) | Backend port |

Payments are real in structure (orders, gating, unlock logic) but the charge step itself is simulated — no live payment provider is wired up. Vacancy URL extraction attempts a real server-side fetch and falls back to the manual-paste flow when a site blocks it or the page is too thin.

## Data retention

Analyses (CV text, vacancy text, AI results) expire 24 hours after creation, matching the product's privacy promise. A background job purges expired rows every 15 minutes.
