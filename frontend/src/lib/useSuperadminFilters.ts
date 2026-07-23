import { useSearchParams } from 'react-router-dom';

/** URL-persisted global date-range/comparison state (+ arbitrary page filters) — shared across every
 * Superadmin page so navigating the sidebar, drilling into a KPI, or bookmarking a filtered view all
 * preserve context instead of resetting to defaults. */
export function useSuperadminFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const range = searchParams.get('range') ?? '7d';
  const compare = searchParams.get('compare') ?? 'previous_period';
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('range', next);
    if (next !== 'custom') {
      params.delete('from');
      params.delete('to');
    }
    setSearchParams(params, { replace: true });
  }

  function setCompare(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('compare', next);
    setSearchParams(params, { replace: true });
  }

  function setCustomRange(f: string, t: string) {
    const params = new URLSearchParams(searchParams);
    params.set('range', 'custom');
    params.set('from', f);
    params.set('to', t);
    setSearchParams(params, { replace: true });
  }

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams);
    if (value === undefined || value === '') params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }

  return {
    range,
    compare,
    from,
    to,
    setRange,
    setCompare,
    setCustomRange,
    setParam,
    query: Object.fromEntries(searchParams.entries()) as Record<string, string>,
    queryString: searchParams.toString(),
  };
}

/** Only ever allows an internal /superadmin/... path — the open-redirect guard for `returnTo`. */
export function safeReturnTo(raw: string | null): string {
  if (!raw) return '/superadmin/overview';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/superadmin/overview';
  }
  if (decoded.startsWith('/superadmin/') && !decoded.startsWith('//') && !decoded.includes('://')) return decoded;
  return '/superadmin/overview';
}
