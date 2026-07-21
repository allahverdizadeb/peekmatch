/** Application Readiness — a frontend-only gamification status, NOT a restoration of the removed
 * CV Recheck feature. It's computed purely client-side from two numbers the free `/result`
 * response already returns (`compatibility`, `criticalGapsCount`) — no backend change, no revived
 * recheck data model. Thresholds mirror the same product judgment the old (removed)
 * backend `computeApplicationReadiness` used, since they were already sound; this is a fresh,
 * general-purpose readiness label for the results-page gamification layer only. */
export type ApplicationReadiness = 'not_ready' | 'needs_improvement' | 'nearly_ready' | 'ready';

export function computeApplicationReadiness(compatibility: number, criticalGapsCount: number): ApplicationReadiness {
  if (criticalGapsCount === 0 && compatibility >= 75) return 'ready';
  if (criticalGapsCount <= 1 && compatibility >= 60) return 'nearly_ready';
  if (compatibility >= 40) return 'needs_improvement';
  return 'not_ready';
}
