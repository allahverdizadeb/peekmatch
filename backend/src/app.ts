import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { analysesRouter } from './routes/analyses.js';
import { ordersRouter } from './routes/orders.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { eventsRouter } from './routes/events.js';
import { sessionRouter } from './routes/session.js';
import { recoveryRouter } from './routes/recovery.js';
import { attachSession } from './middleware/anonymousSession.js';
import { aiConfigured } from './lib/ai.js';

/** The Express app itself, separate from index.ts's .listen()/cron wiring, so tests can exercise
 * real HTTP routes (via supertest) without a live server or the cleanup interval running. */
export const app = express();

// credentials: true (+ a non-wildcard origin reflection) is required for the pm_session cookie to
// reliably flow cross-origin — same-origin dev already worked without this via Vite's proxy, but a
// deployed frontend/backend on different origins would silently drop the cookie without it.
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(attachSession);

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: aiConfigured() }));
app.use('/api/session', sessionRouter);
app.use('/api/recovery', recoveryRouter);
app.use('/api/analyses', analysesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/events', eventsRouter);

// Global error handler: without this, an uncaught exception falls through to Express's default
// handler, which (outside NODE_ENV=production) renders an HTML page containing the full stack
// trace in the response body — a real information-disclosure risk if a production deploy ever
// runs without NODE_ENV set. This is defense-in-depth regardless of that env var.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  if (res.headersSent) return;
  // Respect a well-formed client-error status from upstream middleware (e.g. body-parser's 400 on
  // malformed JSON) instead of blanket-converting everything to 500 — only genuinely unexpected
  // server-side failures should read as 500.
  const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
  const message = status < 500 && status >= 400 ? 'Sorğu düzgün formatlanmayıb.' : 'Server xətası baş verdi.';
  res.status(status).json({ error: message });
});
