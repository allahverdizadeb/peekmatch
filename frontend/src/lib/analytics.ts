import { apiRequest } from './api';

// First-party, minimal event log (see backend/src/routes/events.ts) — not a real analytics vendor.
// Fire-and-forget: tracking must never block or break the action it's attached to, and the backend
// only accepts a small fixed allowlist of event names/metadata keys, so nothing sensitive (CV text,
// documents) can ever be sent through this even by mistake.
export type AnalyticsEvent =
  | { name: 'package_selected'; metadata: { package: number } }
  | { name: 'checkout_started'; metadata: { package: number; isUpgrade: boolean } }
  | { name: 'payment_completed'; metadata: { package: number } }
  | { name: 'cv_change_copied'; metadata: { changeType: string; priority: string } }
  // Anonymous-access-restoration events (see ANONYMOUS_ACCESS_RESTORATION_REPORT.md) — presence/
  // count signals only, no metadata, so nothing beyond "this happened" is ever sent.
  | { name: 'active_analysis_restored' }
  | { name: 'resume_analysis_clicked' }
  | { name: 'new_analysis_warning_shown' }
  | { name: 'new_analysis_confirmed' }
  | { name: 'new_analysis_cancelled' }
  | { name: 'entitlement_restored' }
  | { name: 'recovery_link_used' }
  | { name: 'analysis_expired' }
  | { name: 'duplicate_payment_prevented' }
  // Superadmin analytics catalogue — genuinely browser-only moments (see backend/src/routes/events.ts).
  | { name: 'page_viewed'; metadata: { landingPage: boolean } }
  | { name: 'cv_upload_started'; metadata: { method: 'file' | 'text' } }
  | { name: 'cv_upload_completed'; metadata: { fileType: string; sizeBucket: string } }
  | { name: 'vacancy_added'; metadata: { method: 'url' | 'paste' } }
  | { name: 'package_section_viewed' };

let utmCache: { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null } | null = null;

/** First-touch UTM capture for the current tab session — read once from the URL a visitor actually
 * landed on, not re-parsed on every internal navigation (which would lose attribution the moment
 * the user clicks anywhere and the query string disappears from the address bar). */
function firstTouchUtm() {
  if (utmCache) return utmCache;
  const params = new URLSearchParams(window.location.search);
  utmCache = {
    utmSource: params.get('utm_source')?.slice(0, 100) ?? null,
    utmMedium: params.get('utm_medium')?.slice(0, 100) ?? null,
    utmCampaign: params.get('utm_campaign')?.slice(0, 100) ?? null,
  };
  return utmCache;
}

export function track(event: AnalyticsEvent, analysisId?: string): void {
  const metadata = 'metadata' in event ? event.metadata : undefined;
  const utm = firstTouchUtm();
  apiRequest('/events', {
    method: 'POST',
    body: JSON.stringify({
      name: event.name,
      analysisId,
      metadata,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      ...utm,
    }),
  }).catch(() => {});
}
