import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Button } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../lib/i18n/LanguageContext';

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
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-40 bg-white/92 backdrop-blur border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center gap-7">
        <button onClick={() => navigate('/')} className="flex items-center">
          <Logo />
        </button>
        <nav className="hidden md:flex gap-6 ml-2 text-[15px] font-medium text-text2">
          <button onClick={() => scrollTo('sec-how')} className="hover:text-navy">{t.header.howItWorks}</button>
          <button onClick={() => scrollTo('sec-result')} className="hover:text-navy">{t.header.result}</button>
          <button onClick={() => scrollTo('sec-pricing')} className="hover:text-navy">{t.header.pricing}</button>
          <button onClick={() => scrollTo('sec-privacy')} className="hover:text-navy">{t.header.privacy}</button>
        </nav>
        <div className="ml-auto flex items-center gap-3.5">
          <LanguageSwitcher />
          <Button size="sm" onClick={() => navigate('/analyze')}>{t.header.analyzeCta}</Button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const navigate = useNavigate();
  const scrollTo = useScrollToSection();
  const { t } = useLanguage();
  return (
    <footer className="bg-surface border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-8 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
        <div>
          <Logo size={19} />
          <p className="text-[14px] text-text2 leading-relaxed mt-3 max-w-[300px]">{t.footer.tagline}</p>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted uppercase tracking-wider mb-3.5">{t.footer.productLabel}</div>
          <div className="grid gap-2.5 text-[14px] text-text2">
            <button onClick={() => scrollTo('sec-how')} className="text-left hover:text-teal">{t.footer.howItWorks}</button>
            <button onClick={() => scrollTo('sec-pricing')} className="text-left hover:text-teal">{t.footer.pricing}</button>
            <button onClick={() => navigate('/analyze')} className="text-left hover:text-teal">{t.footer.freeAnalysis}</button>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted uppercase tracking-wider mb-3.5">{t.footer.legalLabel}</div>
          <div className="grid gap-2.5 text-[14px] text-text2">
            <span>{t.footer.privacy}</span>
            <span>{t.footer.terms}</span>
            <span>{t.footer.dataDelete}</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 pb-7 pt-5 border-t border-border flex justify-between items-center flex-wrap gap-3">
        <span className="text-[13px] text-muted">{t.footer.copyright}</span>
      </div>
    </footer>
  );
}
