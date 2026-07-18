import { useNavigate } from 'react-router-dom';
import { Check, Shield, Trash2, Upload, Link as LinkIcon, Target, BarChart3, ScanLine, AlertTriangle, Minus, Lock } from 'lucide-react';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { Button, Badge, SectionLabel } from '../components/ui';
import { RadialGauge } from '../components/charts';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Dict } from '../lib/i18n/locales';

function buildPackages(t: Dict) {
  return [
    { id: 1, name: t.landing.packages['1'].name, price: '0.49 USD', desc: t.landing.packages['1'].desc },
    { id: 2, name: t.landing.packages['2'].name, price: '0.99 USD', desc: t.landing.packages['2'].desc, popular: true },
    { id: 3, name: t.landing.packages['3'].name, price: '5.90 USD', desc: t.landing.packages['3'].desc, premium: true },
  ];
}

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const PACKAGES = buildPackages(t);

  return (
    <div>
      <MarketingHeader />

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-bg rounded-full text-[13px] font-semibold text-success mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {t.landing.badge}
          </div>
          <h1 className="text-[38px] md:text-[46px] leading-[1.12] font-bold tracking-tight mb-4">
            {t.landing.heroTitle}
          </h1>
          <p className="text-[18px] leading-relaxed text-text2 mb-7 max-w-[520px]">
            {t.landing.heroSubtitle}
          </p>
          <div className="flex gap-3.5 flex-wrap mb-6">
            <Button onClick={() => navigate('/analyze')}>{t.landing.ctaPrimary}</Button>
            <Button variant="secondary" onClick={() => document.getElementById('sec-result')?.scrollIntoView({ behavior: 'smooth' })}>
              {t.landing.ctaSecondary}
            </Button>
          </div>
          <div className="flex gap-5 flex-wrap text-[14px] text-text2 font-medium">
            <span className="inline-flex items-center gap-2"><Check className="w-[18px] h-[18px] text-teal" />{t.landing.trust1}</span>
            <span className="inline-flex items-center gap-2"><Shield className="w-[18px] h-[18px] text-teal" />{t.landing.trust2}</span>
            <span className="inline-flex items-center gap-2"><Trash2 className="w-[18px] h-[18px] text-teal" />{t.landing.trust3}</span>
          </div>
        </div>
        <div className="relative min-h-[340px]">
          <div className="absolute left-0 top-4 w-[220px] bg-white border border-border rounded-rc shadow-sh-lg p-4 z-10">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">{t.landing.cvCardLabel}</div>
            <div className="h-2.5 bg-bg2 rounded w-4/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-3/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-full mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-2/3" />
          </div>
          <div className="absolute right-0 top-24 w-[220px] bg-white border border-border rounded-rc shadow-sh-lg p-4 z-20">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">{t.landing.vacancyCardLabel}</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />{t.landing.vacancyItem1}</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />{t.landing.vacancyItem2}</div>
            <div className="flex items-center gap-2 text-[13px] text-warning"><AlertTriangle className="w-4 h-4" />{t.landing.vacancyItem3}</div>
          </div>
          <div className="absolute left-10 bottom-0 z-30">
            <RadialGauge value={71} label={t.landing.gaugeLabel} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="sec-how" className="bg-surface border-y border-border mt-8">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <SectionLabel>{t.landing.howItWorksLabel}</SectionLabel>
            <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight">{t.landing.howItWorksTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: 1, icon: Upload, title: t.landing.step1Title, text: t.landing.step1Text },
              { n: 2, icon: LinkIcon, title: t.landing.step2Title, text: t.landing.step2Text },
              { n: 3, icon: Target, title: t.landing.step3Title, text: t.landing.step3Text },
            ].map((s) => (
              <div key={s.n} className="bg-bg border border-border rounded-rl p-7">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-9 h-9 rounded-[9px] bg-navy text-white inline-flex items-center justify-center font-bold text-[16px]">{s.n}</span>
                  <s.icon className="w-6 h-6 text-teal" />
                </div>
                <h3 className="text-[19px] font-semibold mb-2">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-text2">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <Button onClick={() => navigate('/analyze')}>{t.landing.ctaPrimary}</Button>
          </div>
        </div>
      </section>

      {/* Differentiation */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="max-w-[760px] mx-auto mb-11 text-center">
          <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight leading-tight mb-3.5">
            {t.landing.diffTitle}
          </h2>
          <p className="text-[19px] leading-relaxed text-text2">{t.landing.diffSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-rl p-7">
            <div className="flex items-center gap-2.5 mb-4 text-muted font-semibold text-[15px]">
              <span className="w-7.5 h-7.5 w-[30px] h-[30px] rounded-lg bg-bg2 inline-flex items-center justify-center"><ScanLine className="w-4 h-4" /></span>
              {t.landing.scannerLabel}
            </div>
            {[
              [t.landing.scannerPoint1Title, t.landing.scannerPoint1Text],
              [t.landing.scannerPoint2Title, t.landing.scannerPoint2Text],
              [t.landing.scannerPoint3Title, t.landing.scannerPoint3Text],
            ].map(([tt, x], i) => (
              <div key={i} className="flex gap-3 py-3 border-t border-border items-start">
                <span className="w-[34px] h-[34px] rounded-[9px] bg-bg2 text-muted inline-flex items-center justify-center flex-none">
                  {i === 0 ? <ScanLine className="w-4 h-4" /> : i === 1 ? <AlertTriangle className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{tt}</div>
                  <div className="text-[13.5px] text-text2 leading-relaxed mt-0.5">{x}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-b from-white to-[#FAFEFD] border-[1.5px] border-teal rounded-rl p-7 shadow-sh">
            <div className="flex items-center gap-2.5 mb-4 text-teal font-bold text-[15px]">
              <span className="w-[30px] h-[30px] rounded-lg bg-success-bg inline-flex items-center justify-center"><Check className="w-4 h-4" /></span>
              {t.landing.peekmatchLabel}
            </div>
            {[
              [t.landing.pmPoint1Title, t.landing.pmPoint1Text],
              [t.landing.pmPoint2Title, t.landing.pmPoint2Text],
              [t.landing.pmPoint3Title, t.landing.pmPoint3Text],
            ].map(([tt, x], i) => (
              <div key={i} className="flex gap-3 py-3 border-t border-border items-start">
                <span className="w-[34px] h-[34px] rounded-[9px] bg-success-bg text-teal inline-flex items-center justify-center flex-none">
                  {i === 0 ? <Target className="w-4 h-4" /> : i === 1 ? <BarChart3 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{tt}</div>
                  <div className="text-[13.5px] text-text2 leading-relaxed mt-0.5">{x}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example result preview */}
      <section id="sec-result" className="bg-bg2 border-y border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="flex items-center gap-3 justify-center mb-9">
            <span className="px-3 py-1.5 bg-navy text-white rounded-full text-[12px] font-bold tracking-wide">{t.landing.exampleBadge}</span>
            <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight">{t.landing.exampleTitle}</h2>
          </div>
          <div className="bg-surface border border-border rounded-rl shadow-sh p-7 max-w-[900px] mx-auto">
            <div className="text-[13px] text-muted mb-1">{t.landing.exampleMeta}</div>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center mt-4">
              <RadialGauge value={71} label={t.landing.gaugeLabel} />
              <div className="grid gap-4">
                <div>
                  <div className="flex justify-between text-[13.5px] mb-1"><span className="font-medium">{t.landing.exampleMainReq}</span><span className="font-bold">7 / 10</span></div>
                  <div className="flex h-2.5 rounded-full overflow-hidden border border-border">
                    <div style={{ width: '70%', background: '#198754' }} />
                    <div style={{ width: '20%', background: '#C97800' }} />
                    <div style={{ width: '10%', background: '#CF3F4F' }} />
                  </div>
                </div>
                <div className="bg-success-bg border border-border rounded-rc p-3.5 text-[13.5px]">
                  <span className="font-semibold text-success">{t.landing.exampleStrengthLabel} </span>{t.landing.exampleStrengthText}
                </div>
                <div className="bg-warning-bg border border-border rounded-rc p-3.5 text-[13.5px]">
                  <span className="font-semibold text-warning">{t.landing.exampleGapLabel} </span>{t.landing.exampleGapText}
                </div>
                <div className="text-[13.5px] text-text2">
                  <span className="font-semibold text-navy">{t.landing.exampleRecommendationLabel} </span>{t.landing.exampleRecommendationText}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section id="sec-pricing" className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="text-center max-w-[620px] mx-auto mb-11">
          <SectionLabel>{t.landing.pricingLabel}</SectionLabel>
          <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight mb-3">{t.landing.pricingTitle}</h2>
          <p className="text-[16px] text-text2">{t.landing.pricingSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PACKAGES.map((p) => (
            <div
              key={p.id}
              className={
                'rounded-rl p-6 flex flex-col border ' +
                (p.premium
                  ? 'bg-premium-bg border-premium'
                  : p.popular
                    ? 'bg-white border-teal border-[1.5px] shadow-sh'
                    : 'bg-white border-border')
              }
            >
              {p.popular && <Badge tone="success" className="mb-3 self-start">{t.pricing.mostPopular}</Badge>}
              {p.premium && <Badge tone="premium" className="mb-3 self-start">{t.pricing.premiumBadge}</Badge>}
              <h3 className="text-[17px] font-bold mb-1">{p.name}</h3>
              <div className="text-[24px] font-extrabold text-navy mb-2">{p.price}</div>
              <p className="text-[13.5px] text-text2 mb-5 flex-1">{p.desc}</p>
              <Button variant={p.premium ? 'premium' : 'secondary'} onClick={() => navigate('/analyze')}>{t.landing.packageCta}</Button>
            </div>
          ))}
        </div>
        <div className="text-center mt-7">
          <button className="font-semibold text-teal text-[15px] hover:text-teal-h" onClick={() => navigate('/analyze')}>
            {t.landing.comparePackages}
          </button>
        </div>
      </section>

      {/* Privacy */}
      <section id="sec-privacy" className="bg-navy text-white">
        <div className="max-w-[1200px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-flex w-11 h-11 rounded-xl bg-teal/20 text-[#4fd6c9] items-center justify-center mb-5">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-[28px] md:text-[32px] font-bold tracking-tight mb-4">{t.landing.privacyTitle}</h2>
            <p className="text-[16px] leading-relaxed text-[#b9c7d4] max-w-[440px]">
              {t.landing.privacySubtitle}
            </p>
          </div>
          <div className="grid gap-3.5">
            {[
              [Lock, t.landing.privacyPoint1],
              [Shield, t.landing.privacyPoint2],
              [Trash2, t.landing.privacyPoint3],
              [Check, t.landing.privacyPoint4],
            ].map(([Icon, text], i) => (
              <div key={i} className="flex gap-3.5 items-start bg-white/[0.06] border border-white/10 rounded-xl px-4.5 py-4">
                <Icon className="w-[22px] h-[22px] text-[#4fd6c9] flex-none mt-0.5" />
                <span className="text-[15px] leading-relaxed text-[#e6edf3]">{text as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
