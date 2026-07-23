import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SuperadminAuthProvider } from '../lib/superadminAuthContext';
import { RequireSuperadminAuth } from '../components/superadmin/RequireAuth';
import SuperadminLogin from './superadmin/Login';
import SuperadminDenied from './superadmin/Denied';
import SuperadminSessionExpired from './superadmin/SessionExpired';
import SuperadminOverview from './superadmin/Overview';
import SuperadminTraffic from './superadmin/Traffic';
import SuperadminFunnel from './superadmin/Funnel';
import SuperadminSales from './superadmin/Sales';
import SuperadminPackages from './superadmin/Packages';
import SuperadminPayments from './superadmin/Payments';
import SuperadminAnalysisActivity from './superadmin/AnalysisActivity';
import SuperadminHealth from './superadmin/Health';
import SuperadminSettings from './superadmin/Settings';

/** Listens for the "the session idle/absolute-expired mid-use" signal dispatched by
 * lib/superadminApi.ts's req() helper (a 401 with code 'session_expired', distinct from a cold
 * unauthenticated visit) and routes to the dedicated Session Expired screen with the page the
 * Superadmin was on, so re-login can return them there. */
function SessionExpiredListener() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    function onExpired() {
      navigate('/superadmin/session-expired', { state: { returnTo: location.pathname + location.search } });
    }
    window.addEventListener('superadmin:session-expired', onExpired);
    return () => window.removeEventListener('superadmin:session-expired', onExpired);
  }, [navigate, location]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  return <RequireSuperadminAuth>{children}</RequireSuperadminAuth>;
}

export default function SuperadminApp() {
  return (
    <SuperadminAuthProvider>
      <SessionExpiredListener />
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="login" element={<SuperadminLogin />} />
        <Route path="denied" element={<SuperadminDenied />} />
        <Route path="session-expired" element={<SuperadminSessionExpired />} />
        <Route
          path="overview"
          element={
            <Protected>
              <SuperadminOverview />
            </Protected>
          }
        />
        <Route
          path="traffic"
          element={
            <Protected>
              <SuperadminTraffic />
            </Protected>
          }
        />
        <Route
          path="funnel"
          element={
            <Protected>
              <SuperadminFunnel />
            </Protected>
          }
        />
        <Route
          path="sales"
          element={
            <Protected>
              <SuperadminSales />
            </Protected>
          }
        />
        <Route
          path="packages"
          element={
            <Protected>
              <SuperadminPackages />
            </Protected>
          }
        />
        <Route
          path="payments"
          element={
            <Protected>
              <SuperadminPayments />
            </Protected>
          }
        />
        <Route
          path="payments/:reference"
          element={
            <Protected>
              <SuperadminPayments />
            </Protected>
          }
        />
        <Route
          path="analysis"
          element={
            <Protected>
              <SuperadminAnalysisActivity />
            </Protected>
          }
        />
        <Route
          path="health"
          element={
            <Protected>
              <SuperadminHealth />
            </Protected>
          }
        />
        <Route
          path="settings"
          element={
            <Protected>
              <SuperadminSettings />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </SuperadminAuthProvider>
  );
}
