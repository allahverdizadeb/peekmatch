import crypto from 'node:crypto';
import { prisma } from '../db.js';

const WEB_SESSION_INACTIVITY_MS = 30 * 60 * 1000;

export interface RecordEventInput {
  name: string;
  visitorRef?: string | null;
  analysisId?: string | null;
  packageCode?: string | null;
  language?: string | null;
  deviceCategory?: string | null;
  path?: string | null;
  referrerDomain?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  metadata?: Record<string, string | number | boolean> | null;
  eventId?: string | null;
  source: 'client' | 'server';
}

/** Reuses the visitor's existing web-session grouping id if their most recent event was within the
 * 30-minute inactivity window (the analytics session definition — see SUPERADMIN_ANALYTICS_EVENTS.md),
 * mints a fresh one otherwise. Visitor-less events (no cookie yet) get no session grouping — never
 * fabricated. */
async function resolveWebSessionRef(visitorRef: string | null | undefined): Promise<string | null> {
  if (!visitorRef) return null;
  const last = await prisma.event.findFirst({
    where: { visitorRef },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, webSessionRef: true },
  });
  if (last?.webSessionRef && Date.now() - last.createdAt.getTime() < WEB_SESSION_INACTIVITY_MS) return last.webSessionRef;
  return crypto.randomUUID();
}

/** Shared event-recording path used both by the HTTP ingestion endpoint (routes/events.ts, for
 * client-only events like page_viewed) and directly by trusted server-side business logic (for
 * authoritative events like payment_succeeded/analysis_completed) — callers already trusted bypass
 * the HTTP allowlist layer since they construct this input themselves, never from raw client JSON.
 * Analytics failure must never surface to the caller — every error is swallowed after logging,
 * except a duplicate eventId (idempotent retry), which is a silent, expected no-op. */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const webSessionRef = await resolveWebSessionRef(input.visitorRef);
    await prisma.event.create({
      data: {
        name: input.name,
        analysisId: input.analysisId ?? null,
        visitorRef: input.visitorRef ?? null,
        webSessionRef,
        packageCode: input.packageCode ?? null,
        language: input.language ?? null,
        deviceCategory: input.deviceCategory ?? null,
        path: input.path ?? null,
        referrerDomain: input.referrerDomain ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        metadata: input.metadata && Object.keys(input.metadata).length ? JSON.stringify(input.metadata) : null,
        eventId: input.eventId ?? null,
        source: input.source,
      },
    });
  } catch (err) {
    const isDuplicateEventId = err instanceof Error && (err as { code?: string }).code === 'P2002';
    if (!isDuplicateEventId) console.error('[analyticsIngest] record failed', err instanceof Error ? err.message : err);
  }
}

export function deviceCategoryFromUserAgent(ua: string | undefined): 'desktop' | 'mobile' | 'tablet' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android(?!.*Tablet)|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function sanitizeReferrerDomain(referrer: string | undefined | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

export function sanitizePath(path: string | undefined | null): string | null {
  if (!path) return null;
  return path.split('?')[0].slice(0, 200);
}
