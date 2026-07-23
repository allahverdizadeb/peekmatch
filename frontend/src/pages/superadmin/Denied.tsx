import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { logout } from '../../lib/superadminApi';
import { useSuperadminAuth } from '../../lib/superadminAuthContext';

export default function SuperadminDenied() {
  const navigate = useNavigate();
  const { signOutLocally } = useSuperadminAuth();

  async function backToLogin() {
    try {
      await logout();
    } catch {
      // proceed regardless — the goal is getting the user back to a clean login state
    }
    signOutLocally();
    navigate('/superadmin/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-[380px] text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bg2 text-muted flex items-center justify-center">
          <ShieldOff className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[20px] font-semibold text-navy mb-2">Girişə icazə yoxdur</h1>
        <p className="text-[13.5px] text-text2 mb-6">Bu hesabın Superadmin girişi yoxdur.</p>
        <button onClick={backToLogin} className="text-teal font-semibold text-[13.5px] underline focus-ring rounded">
          Girişə qayıt
        </button>
      </div>
    </div>
  );
}
