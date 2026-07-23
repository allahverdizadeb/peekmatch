import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { login, SuperadminApiError } from '../../lib/superadminApi';
import { useSuperadminAuth } from '../../lib/superadminAuthContext';
import { safeReturnTo } from '../../lib/useSuperadminFilters';

export default function SuperadminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useSuperadminAuth();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      await refresh();
      navigate(safeReturnTo(searchParams.get('returnTo')), { replace: true });
    } catch (err) {
      if (err instanceof SuperadminApiError && err.status === 429) setError('Həddindən çox cəhd edildi. Bir az sonra yenidən cəhd edin.');
      else setError('Email və ya şifrə yanlışdır.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-ink text-white p-10">
        <Logo size={20} />
        <div>
          <h1 className="font-display text-[28px] font-semibold mb-2">Superadmin Panel</h1>
          <p className="text-white/60 text-[14px] max-w-[360px] leading-relaxed">
            PeekMatch biznes göstəriciləri, satışlar, ödənişlər və sistem sağlamlığı üçün daxili idarəetmə paneli.
          </p>
        </div>
        <p className="text-white/30 text-[12px]">© PeekMatch</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[360px]">
          <div className="md:hidden mb-6">
            <Logo size={18} />
          </div>
          <h2 className="font-display text-[22px] font-semibold text-navy mb-1">Daxil ol</h2>
          <p className="text-[13px] text-text2 mb-6">Superadmin hesabınızla daxil olun.</p>
          <label htmlFor="sa-email" className="block text-[12.5px] font-semibold text-text2 mb-1.5">
            Email
          </label>
          <input
            id="sa-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={loading}
            className="w-full border border-border rounded-rk px-3.5 py-2.5 text-[14px] focus-ring mb-4"
          />
          <label htmlFor="sa-password" className="block text-[12.5px] font-semibold text-text2 mb-1.5">
            Şifrə
          </label>
          <input
            id="sa-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
            className="w-full border border-border rounded-rk px-3.5 py-2.5 text-[14px] focus-ring mb-4"
          />
          {error && (
            <p className="text-[13px] text-danger mb-4" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-teal text-white rounded-rk py-3 font-semibold flex items-center justify-center gap-2 disabled:bg-border disabled:text-muted transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Daxil ol
          </button>
        </form>
      </div>
    </div>
  );
}
