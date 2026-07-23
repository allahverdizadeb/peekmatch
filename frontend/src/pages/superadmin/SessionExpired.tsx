import { useNavigate, useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';

export default function SuperadminSessionExpired() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-[380px] text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bg2 text-muted flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[20px] font-semibold text-navy mb-2">Sessiyanın müddəti bitib</h1>
        <p className="text-[13.5px] text-text2 mb-6">Təhlükəsizlik səbəbindən sessiyanız bağlandı. Davam etmək üçün yenidən daxil olun.</p>
        <button
          onClick={() => navigate(`/superadmin/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)}
          className="bg-teal text-white rounded-rk px-5 py-2.5 font-semibold text-[13.5px]"
        >
          Yenidən daxil ol
        </button>
      </div>
    </div>
  );
}
