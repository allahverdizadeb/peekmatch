import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AnalysisForm from './pages/AnalysisForm';
import Processing from './pages/Processing';
import Results from './pages/Results';
import Pricing from './pages/Pricing';
import Checkout from './pages/Checkout';
import PaymentStatus from './pages/PaymentStatus';
import Workspace from './pages/Workspace';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/analyze" element={<AnalysisForm />} />
      <Route path="/processing/:id" element={<Processing />} />
      <Route path="/results/:id" element={<Results />} />
      <Route path="/pricing/:id" element={<Pricing />} />
      <Route path="/checkout/:id/:pkg" element={<Checkout />} />
      <Route path="/payment/:orderId" element={<PaymentStatus />} />
      <Route path="/workspace/:id/:tab" element={<Workspace />} />
    </Routes>
  );
}
