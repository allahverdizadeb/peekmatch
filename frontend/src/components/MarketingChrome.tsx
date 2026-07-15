import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from './ui';

function useScrollToSection() {
  const navigate = useNavigate();
  const location = useLocation();
  return (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };
}

export function MarketingHeader() {
  const navigate = useNavigate();
  const scrollTo = useScrollToSection();
  return (
    <header className="sticky top-0 z-40 bg-white/92 backdrop-blur border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center gap-7">
        <button onClick={() => navigate('/')} className="flex items-center">
          <Logo />
        </button>
        <nav className="hidden md:flex gap-6 ml-2 text-[15px] font-medium text-text2">
          <button onClick={() => scrollTo('sec-how')} className="hover:text-navy">Necə işləyir</button>
          <button onClick={() => scrollTo('sec-result')} className="hover:text-navy">Nəticə</button>
          <button onClick={() => scrollTo('sec-pricing')} className="hover:text-navy">Qiymətlər</button>
          <button onClick={() => scrollTo('sec-privacy')} className="hover:text-navy">Məxfilik</button>
        </nav>
        <div className="ml-auto flex items-center gap-3.5">
          <Button size="sm" onClick={() => navigate('/analyze')}>CV-ni analiz et</Button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const navigate = useNavigate();
  const scrollTo = useScrollToSection();
  return (
    <footer className="bg-surface border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-8 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
        <div>
          <Logo size={19} />
          <p className="text-[14px] text-text2 leading-relaxed mt-3 max-w-[300px]">
            CV-nizin konkret vakansiyaya uyğunluğunu sübuta əsaslanan şəkildə göstərən karyera analitika platforması.
          </p>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted uppercase tracking-wider mb-3.5">Məhsul</div>
          <div className="grid gap-2.5 text-[14px] text-text2">
            <button onClick={() => scrollTo('sec-how')} className="text-left hover:text-teal">Necə işləyir</button>
            <button onClick={() => scrollTo('sec-pricing')} className="text-left hover:text-teal">Qiymətlər</button>
            <button onClick={() => navigate('/analyze')} className="text-left hover:text-teal">Pulsuz analiz</button>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted uppercase tracking-wider mb-3.5">Hüquqi</div>
          <div className="grid gap-2.5 text-[14px] text-text2">
            <span>Məxfilik</span>
            <span>İstifadə şərtləri</span>
            <span>Məlumatların silinməsi</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 pb-7 pt-5 border-t border-border flex justify-between items-center flex-wrap gap-3">
        <span className="text-[13px] text-muted">© 2026 PeekMatch. Bütün hüquqlar qorunur.</span>
      </div>
    </footer>
  );
}
