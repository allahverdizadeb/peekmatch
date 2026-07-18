import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import { FeedbackWidget } from './components/FeedbackWidget';
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
  return (
    <>
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
      <FeedbackWidget />
    </>
  );
}
