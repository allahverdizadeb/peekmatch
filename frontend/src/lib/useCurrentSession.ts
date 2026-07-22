import { useCallback, useEffect, useState } from 'react';
import { getCurrentSession, type SessionCurrent } from './api';

// Explicit states (never an ambiguous boolean combination) driving the homepage resume card and
// the new-CV-upload confirmation gate. 'draft' (CV/vacancy not yet fully submitted) collapses into
// 'noActiveAnalysis' — there's nothing meaningfully resumable about an incomplete wizard, so
// showing a "processing" or "unpaid" card for it would be misleading.
export type SessionState =
  | { kind: 'restoring' }
  | { kind: 'noActiveAnalysis' }
  | { kind: 'processing'; analysisId: string }
  | { kind: 'failed'; analysisId: string; failReason: string | null }
  | { kind: 'unpaidAnalysis'; analysisId: string }
  | { kind: 'paidActiveAnalysis'; analysisId: string; ownedPackage: number; entitlementExpiresAt: string };

function deriveState(data: SessionCurrent | null): SessionState {
  if (!data) return { kind: 'restoring' };
  if (!data.hasAnalysis || !data.analysisId) return { kind: 'noActiveAnalysis' };
  const { analysisId } = data;
  switch (data.status) {
    case 'processing':
      return { kind: 'processing', analysisId };
    case 'failed':
      return { kind: 'failed', analysisId, failReason: data.failReason ?? null };
    case 'done':
      return data.entitlementActive && data.entitlementExpiresAt
        ? { kind: 'paidActiveAnalysis', analysisId, ownedPackage: data.ownedPackage ?? 0, entitlementExpiresAt: data.entitlementExpiresAt }
        : { kind: 'unpaidAnalysis', analysisId };
    default:
      // 'draft' or anything unrecognized — nothing resumable yet.
      return { kind: 'noActiveAnalysis' };
  }
}

/** Reads (never creates) the calling browser's most recent analysis on mount, exposing it as one
 * of a small set of explicit states rather than raw booleans — see SessionState above. Used by the
 * homepage resume card and the new-CV-upload confirmation gate; both need the same "does this
 * browser already have a real analysis in flight" answer. */
export function useCurrentSession() {
  const [data, setData] = useState<SessionCurrent | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(() => {
    getCurrentSession()
      .then((res) => setData(res))
      .catch(() => setData({ hasAnalysis: false }))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const state: SessionState = loaded ? deriveState(data) : { kind: 'restoring' };
  return { state, refetch };
}
