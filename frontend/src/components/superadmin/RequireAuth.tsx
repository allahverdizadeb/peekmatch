import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSuperadminAuth } from '../../lib/superadminAuthContext';

/** Client-side guard is UX-only — the real security boundary is `requireSuperadminSession` on every
 * /api/admin/* route (see backend/src/middleware/superadminAuth.ts). This just avoids flashing
 * protected UI before the server has actually confirmed the session. */
export function RequireSuperadminAuth({ children }: { children: ReactNode }) {
  const { status } = useSuperadminAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }
  if (status === 'unauthenticated') {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/superadmin/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
