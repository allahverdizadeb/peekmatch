import { useCallback, useEffect, useRef, useState } from 'react';

/** Shared data-fetching pattern for every Superadmin page: loading/error/refresh + a last-refreshed
 * timestamp for the header's Refresh Indicator. Re-fetches whenever `deps` change (range/compare/
 * filters), and exposes `refresh()` for the manual refresh button / auto-refresh interval. */
export function useAdminData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumat yüklənə bilmədi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh: load, lastRefreshedAt };
}
