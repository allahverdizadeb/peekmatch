import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdminKey } from '../middleware/adminAuth.js';
import { sendFeedbackEmail } from '../lib/mailer.js';

const CATEGORIES = ['Funksionallıq', 'Dizayn', 'Qiymət', 'Digər'];
const MIN_TEXT_CHARS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const suggestionsRouter = Router();

// Public: anyone can submit feedback via the floating widget.
suggestionsRouter.post('/', async (req, res) => {
  const category = req.body.category as string;
  const text = ((req.body.text as string) || '').trim();
  const email = ((req.body.email as string) || '').trim();
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Naməlum kateqoriya.' });
  if (text.length < MIN_TEXT_CHARS) return res.status(400).json({ error: `Minimum ${MIN_TEXT_CHARS} simvol tələb olunur.` });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Düzgün e-poçt ünvanı daxil edin.' });

  await prisma.suggestion.create({ data: { category, text, email } });
  res.json({ ok: true });

  // Fire-and-forget: the suggestion is already saved regardless of email delivery outcome.
  sendFeedbackEmail({ category, text, email }).catch((err) => console.error('[suggestions] sendFeedbackEmail', err));
});

// Admin-only: list all feedback.
suggestionsRouter.get('/', requireAdminKey, async (_req, res) => {
  const list = await prisma.suggestion.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
});
