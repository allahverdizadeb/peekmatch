import { Router } from 'express';
import { recordEvent, deviceCategoryFromUserAgent, sanitizeReferrerDomain, sanitizePath } from '../lib/analyticsIngest.js';

// Minimal first-party product-analytics event log (no real analytics vendor is integrated — see
// CLAUDE.md). Deliberately a small, fixed allowlist of event names AND metadata keys per event,
// rather than accepting an arbitrary object: this is what actually enforces "never send CV/document
// content" — the endpoint cannot forward anything not on this list, no matter what the client sends.
//
// IMPORTANT: this is the CLIENT-facing allowlist only. Trust-sensitive events (payment outcomes,
// analysis completion, entitlement/deletion lifecycle) are deliberately NOT in this list — those are
// emitted exclusively via direct recordEvent() calls from trusted server-side business logic (see
// routes/orders.ts, routes/analyses.ts, index.ts's cleanup cron), so a browser can never fabricate a
// payment_succeeded/analysis_completed/etc. event no matter what it POSTs here.
const EVENT_METADATA_KEYS: Record<string, string[]> = {
  package_selected: ['package'],
  checkout_started: ['package', 'isUpgrade'],
  payment_completed: ['package'],
  cv_change_copied: ['changeType', 'priority'],
  // Anonymous-access-restoration events — presence/count only, no metadata.
  active_analysis_restored: [],
  resume_analysis_clicked: [],
  new_analysis_warning_shown: [],
  new_analysis_confirmed: [],
  new_analysis_cancelled: [],
  entitlement_restored: [],
  recovery_link_used: [],
  analysis_expired: [],
  duplicate_payment_prevented: [],
  // Superadmin analytics catalogue — genuinely browser-only moments (see SUPERADMIN_ANALYTICS_EVENTS.md).
  page_viewed: ['landingPage'],
  cv_upload_started: ['method'],
  cv_upload_completed: ['fileType', 'sizeBucket'],
  vacancy_added: ['method'],
  package_section_viewed: [],
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

const SUPPORTED_LANGUAGES = new Set(['az', 'en']);

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
  const language = typeof req.body.language === 'string' && SUPPORTED_LANGUAGES.has(req.body.language) ? req.body.language : null;
  const eventId = typeof req.body.eventId === 'string' ? req.body.eventId.slice(0, 64) : null;

  await recordEvent({
    name,
    analysisId,
    visitorRef: req.sessionId ?? null,
    language,
    deviceCategory: deviceCategoryFromUserAgent(req.headers['user-agent']),
    path: sanitizePath(typeof req.body.path === 'string' ? req.body.path : null),
    referrerDomain: sanitizeReferrerDomain(typeof req.body.referrer === 'string' ? req.body.referrer : null),
    utmSource: typeof req.body.utmSource === 'string' ? req.body.utmSource.slice(0, 100) : null,
    utmMedium: typeof req.body.utmMedium === 'string' ? req.body.utmMedium.slice(0, 100) : null,
    utmCampaign: typeof req.body.utmCampaign === 'string' ? req.body.utmCampaign.slice(0, 100) : null,
    metadata,
    eventId,
    source: 'client',
  });
  res.json({ ok: true });
});
