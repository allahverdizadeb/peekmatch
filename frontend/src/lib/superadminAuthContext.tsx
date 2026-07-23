import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { fetchMe, setCsrfToken, type SuperadminMe } from './superadminApi';

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  me: SuperadminMe | null;
  refresh: () => Promise<void>;
  signOutLocally: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function SuperadminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [me, setMe] = useState<SuperadminMe | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMe();
      setCsrfToken(data.csrfToken);
      setMe(data);
      setStatus('authenticated');
    } catch {
      setCsrfToken(null);
      setMe(null);
      setStatus('unauthenticated');
    }
  }, []);

  const signOutLocally = useCallback(() => {
    setCsrfToken(null);
    setMe(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ status, me, refresh, signOutLocally }}>{children}</Ctx.Provider>;
}

export function useSuperadminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSuperadminAuth must be used within SuperadminAuthProvider');
  return ctx;
}
