import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';
import { aiConfigured } from './lib/anthropic.js';

const PORT = Number(process.env.PORT) || 4000;

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
