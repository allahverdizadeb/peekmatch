import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Landing from './pages/Landing';
import AnalysisForm from './pages/AnalysisForm';
import Processing from './pages/Processing';
import Results from './pages/Results';
import Pricing from './pages/Pricing';
import Checkout from './pages/Checkout';
import PaymentStatus from './pages/PaymentStatus';
import Workspace from './pages/Workspace';
import Admin from './pages/Admin';
import AdminInsights from './pages/AdminInsights';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const LegalPage = lazy(() => import('./pages/LegalPage'));

// A cold visit to a lazy-loaded route (e.g. a search-engine crawl or a bookmarked /privacy link)
// must never render a blank screen while the chunk fetches — this is a visible loading state, not
// `fallback={null}`, wrapped by RouteErrorBoundary in case the chunk fetch itself fails (a common
// real-world SPA issue after a new deploy invalidates a tab's already-loaded HTML).
function LazyRouteFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-teal" />
    </div>
  );
}

function LegalRoute({ docKey }: { docKey: 'privacy' | 'terms' | 'deletion' }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LazyRouteFallback />}>
        <LegalPage docKey={docKey} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  const location = useLocation();
  // Keyed on the top-level path segment ("workspace", "results", ""for home, ...), NOT the full
  // pathname — Workspace's tab switching lives at /workspace/:id/:tab, so a naive full-pathname key
  // would force a full remount (losing all of Workspace's local state, in-flight interview-prep
  // polling, etc.) on every tab click. React Router already avoids remounting when the same <Route
  // element stays matched across a param change; keying any coarser than that would fight it.
  const routeGroup = location.pathname.split('/')[1] ?? '';
  return (
    // A brief, non-blocking fade+rise on mount (.route-fade, see index.css) — the route has
    // already resolved and rendered by the time this plays, so nothing is delayed or hidden behind
    // it; a direct URL load or refresh gets the exact same one-time entrance as an in-app
    // navigation, not a special case.
    <div key={routeGroup} className="route-fade">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/analyze" element={<AnalysisForm />} />
        <Route path="/processing/:id" element={<Processing />} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/pricing/:id" element={<Pricing />} />
        <Route path="/checkout/:id/:pkg" element={<Checkout />} />
        <Route path="/payment/:orderId" element={<PaymentStatus />} />
        <Route path="/workspace/:id/:tab" element={<Workspace />} />
        <Route path="/privacy" element={<LegalRoute docKey="privacy" />} />
        <Route path="/terms" element={<LegalRoute docKey="terms" />} />
        <Route path="/deletion" element={<LegalRoute docKey="deletion" />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/insights" element={<AdminInsights />} />
      </Routes>
    </div>
  );
}
