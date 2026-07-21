import { Router } from 'express';
import { prisma } from '../db.js';

// Minimal first-party product-analytics event log (no real analytics vendor is integrated — see
// CLAUDE.md). Deliberately a small, fixed allowlist of event names AND metadata keys per event,
// rather than accepting an arbitrary object: this is what actually enforces "never send CV/document
// content" — the endpoint cannot forward anything not on this list, no matter what the client sends.
const EVENT_METADATA_KEYS: Record<string, string[]> = {
  package_selected: ['package'],
  checkout_started: ['package', 'isUpgrade'],
  payment_completed: ['package'],
  cv_change_copied: ['changeType', 'priority'],
};

function sanitizeMetadata(name: string, raw: unknown): Record<string, string | number | boolean> {
  const allowedKeys = EVENT_METADATA_KEYS[name] ?? [];
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of allowedKeys) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export const eventsRouter = Router();

// Public, fire-and-forget from the frontend's lib/analytics.ts — always responds ok so a failure
// here never surfaces to the user or blocks the action being tracked.
eventsRouter.post('/', async (req, res) => {
  const name = req.body.name as string;
  if (!Object.prototype.hasOwnProperty.call(EVENT_METADATA_KEYS, name)) {
    return res.status(400).json({ error: 'Naməlum event.' });
  }
  const analysisId = typeof req.body.analysisId === 'string' ? req.body.analysisId.slice(0, 64) : null;
  const metadata = sanitizeMetadata(name, req.body.metadata);
  await prisma.event.create({
    data: { name, analysisId, metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : null },
  });
  res.json({ ok: true });
});
