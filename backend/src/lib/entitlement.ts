import type { AnalysisRow } from './analysisLifecycle.js';

/** Paid-entitlement window length, anchored to the FIRST successful payment for an analysis (see
 * orders.ts's /:id/simulate handler, which sets Analysis.paidAt/entitlementExpiresAt exactly once
 * and bumps Analysis.expiresAt to match — that bump is what makes resolveAnalysis()'s existing
 * expiresAt check double as the entitlement check, so no separate route-level gate is needed on
 * top of it; this helper is for building response payloads (session/current, analysis detail),
 * not for gating access itself. */
export const ENTITLEMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a paid analysis's 24h entitlement window is still open. An analysis with no paidAt was
 * never purchased — that's a package-ownership question (see unlocksApplication/unlocksInterview
 * in pricing.ts), not an entitlement-expiry one. */
export function isEntitlementActive(analysis: Pick<AnalysisRow, 'paidAt' | 'entitlementExpiresAt'>): boolean {
  if (!analysis.paidAt || !analysis.entitlementExpiresAt) return false;
  return analysis.entitlementExpiresAt.getTime() > Date.now();
}
