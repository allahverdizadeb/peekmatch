import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import { analysesRouter } from './routes/analyses.js';
import { ordersRouter } from './routes/orders.js';
import { aiConfigured } from './lib/anthropic.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: aiConfigured() }));
app.use('/api/analyses', analysesRouter);
app.use('/api/orders', ordersRouter);

app.listen(PORT, () => {
  console.log(`PeekMatch backend listening on :${PORT}`);
  if (!aiConfigured()) {
    console.warn('[startup] ANTHROPIC_API_KEY not set — matching analysis will use the offline fallback analyzer.');
  }
});

// Privacy promise: CVs, vacancy text, and results are auto-deleted after the retention period.
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(async () => {
  try {
    const { count } = await prisma.analysis.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    if (count > 0) console.log(`[cleanup] deleted ${count} expired analyses`);
  } catch (err) {
    console.error('[cleanup]', err);
  }
}, CLEANUP_INTERVAL_MS).unref();
