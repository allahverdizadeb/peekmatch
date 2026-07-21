import { useNavigate } from 'react-router-dom';
import { Check, Shield, Trash2, Upload, Link as LinkIcon, Target, BarChart3, ScanLine, AlertTriangle, Minus, Lock, Sparkles, Clock, FileText, X } from 'lucide-react';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { Button, Badge, SectionLabel } from '../components/ui';
import { RadialGauge } from '../components/charts';
import { Accordion } from '../components/Accordion';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Dict } from '../lib/i18n/locales';

function buildPackages(t: Dict) {
  return [
    { id: 1, ...t.pricing.packages['1'], price: '0.90', popular: false },
    { id: 2, ...t.pricing.packages['2'], price: '2.90', popular: true },
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
          <h1 className="font-display font-semibold text-[38px] md:text-[48px] leading-[1.1] tracking-tight mb-4">
            {t.landing.heroTitle}
          </h1>
          <p className="text-[18px] leading-relaxed text-text2 mb-7 max-w-[520px]">
            {t.landing.heroSubtitle} {t.landing.heroTrustLine}
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
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted" />
              <span className="text-[13px] font-bold text-text">{t.landing.cvCardName}</span>
            </div>
            <div className="h-2.5 bg-bg2 rounded w-4/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-3/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-full mb-3" />
            <div className="flex gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-success-bg text-success">{t.landing.cvCardTag1}</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-info-bg text-info">{t.landing.cvCardTag2}</span>
            </div>
          </div>
          <div className="absolute right-0 top-24 w-[220px] bg-white border border-border rounded-rc shadow-sh-lg p-4 z-20">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">{t.landing.vacancyCardLabel}</div>
            <div className="text-[15px] font-bold text-navy mb-0.5">{t.landing.heroVacancyTitle}</div>
            <div className="text-[12.5px] text-muted mb-3">{t.landing.heroVacancyCompany}</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />{t.landing.vacancyItem1}</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />{t.landing.vacancyItem2}</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5 text-warning"><Minus className="w-4 h-4" />{t.landing.vacancyItem3}</div>
            <div className="flex items-center gap-2 text-[13px] text-danger"><X className="w-4 h-4" />{t.landing.vacancyItem4}</div>
          </div>
          <div className="absolute left-10 bottom-0 z-30 bg-ink rounded-rc shadow-sh-xl px-5 py-4 w-[200px]">
            <div className="flex items-center gap-3">
              <svg width="44" height="44" className="-rotate-90 flex-none">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#0F9D91"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(71 / 100) * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                />
              </svg>
              <div>
                <div className="font-display font-semibold text-[22px] text-white leading-none tabular-nums">71%</div>
                <div className="text-[11px] text-[#9fb0c3] mt-1">{t.landing.exampleGaugeUnit}</div>
              </div>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden mt-3" aria-hidden="true">
              <div className="bg-success" style={{ width: '70%' }} />
              <div className="bg-warning" style={{ width: '10%' }} />
              <div className="bg-danger" style={{ width: '20%' }} />
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/10 text-[12px] text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning flex-none" />
              {t.landing.heroCriticalGap}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="sec-how" className="bg-surface border-y border-border mt-8">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <SectionLabel>{t.landing.howItWorksLabel}</SectionLabel>
            <h2 className="font-display font-semibold text-[30px] md:text-[34px] tracking-tight">{t.landing.howItWorksTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: 1, icon: Upload, tag: t.landing.howVisualTag1, title: t.landing.step1Title, text: t.landing.step1Text },
              { n: 2, icon: LinkIcon, tag: t.landing.howVisualTag2, title: t.landing.step2Title, text: t.landing.step2Text },
              { n: 3, icon: Sparkles, tag: 'AI', title: t.landing.step3Title, text: t.landing.step3Text },
              { n: 4, icon: BarChart3, tag: t.landing.howVisualTag4, title: t.landing.step4Title, text: t.landing.step4Text },
            ].map((s) => (
              <div key={s.n} className="bg-bg border border-border rounded-rl p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[9px] bg-navy text-white inline-flex items-center justify-center font-bold text-[16px]">{s.n}</span>
                    <s.icon className="w-6 h-6 text-teal" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{s.tag}</span>
                </div>
                <h3 className="text-[18px] font-semibold mb-1.5">{s.title}</h3>
                <p className="text-[14px] leading-relaxed text-text2 mb-4 min-h-[46px]">{s.text}</p>

                {s.n === 1 && (
                  <div
                    className="bg-white border-[1.5px] border-dashed border-teal rounded-rk px-2.5 py-3 text-center shadow-sh-sm mt-auto w-full h-[112px] overflow-hidden flex flex-col justify-center"
                    style={{ animation: 'pm-pop .5s ease both .3s' }}
                  >
                    <Upload className="w-[18px] h-[18px] text-teal mx-auto mb-1" style={{ animation: 'pm-pulse 2.4s ease-in-out infinite' }} />
                    <div className="text-[11px] font-semibold text-text2">{t.landing.howVisualFileName}</div>
                    <div className="text-[10px] text-muted mt-0.5">{t.landing.howVisualFileHint}</div>
                  </div>
                )}

                {s.n === 2 && (
                  <div
                    className="bg-white border border-border rounded-rk p-3 shadow-sh-sm mt-auto w-full h-[112px] overflow-hidden flex flex-col justify-center"
                    style={{ animation: 'pm-pop .5s ease both .3s' }}
                  >
                    <div
                      className="flex items-center gap-1.5 border border-border rounded-[7px] px-2.5 py-1.5 text-[10.5px] text-muted mb-1.5 overflow-hidden whitespace-nowrap"
                      style={{ animation: 'pm-pop .5s ease both .65s' }}
                    >
                      <LinkIcon className="w-3 h-3 flex-none" />
                      {t.landing.howVisualUrl}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text2 py-0.5" style={{ animation: 'pm-rise .45s ease both 1.05s' }}>
                      <Check className="w-[13px] h-[13px] text-success flex-none" />
                      {t.landing.howVisualVacancyFound} — {t.landing.howVisualVacancyTitle}
                    </div>
                  </div>
                )}

                {s.n === 3 && (
                  <div
                    className="bg-white border border-border rounded-rk p-3 shadow-sh-sm mt-auto w-full h-[112px] overflow-hidden flex flex-col justify-center"
                    style={{ animation: 'pm-pop .5s ease both .3s' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text2 py-0.5" style={{ animation: 'pm-rise .45s ease both .9s' }}>
                      <Check className="w-[13px] h-[13px] text-success flex-none" />
                      {t.landing.howVisualReqIdentified}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-text2 py-0.5" style={{ animation: 'pm-rise .45s ease both 1.25s' }}>
                      <Check className="w-[13px] h-[13px] text-success flex-none" />
                      {t.landing.howVisualEvidenceFound}
                    </div>
                    <div style={{ animation: 'pm-pulse 1.6s ease-in-out infinite' }}>
                      <div
                        className="flex items-center gap-1.5 text-[11.5px] text-info py-0.5"
                        style={{ animation: 'pm-rise .45s ease both 1.6s' }}
                      >
                        <Target className="w-[13px] h-[13px] flex-none" />
                        {t.landing.howVisualCalculating}
                      </div>
                    </div>
                  </div>
                )}

                {s.n === 4 && (
                  <div
                    className="bg-white border border-border rounded-rk p-3 shadow-sh-sm mt-auto w-full h-[112px] overflow-hidden flex flex-col justify-center"
                    style={{ animation: 'pm-pop .5s ease both .3s' }}
                  >
                    <div className="flex items-baseline gap-1.5 mb-1" style={{ animation: 'pm-rise .45s ease both 1.15s' }}>
                      <span className="text-[20px] font-extrabold text-teal">71%</span>
                      <span className="text-[10.5px] text-text2">{t.landing.gaugeLabel}</span>
                    </div>
                    <div className="h-1.5 bg-bg2 rounded overflow-hidden mb-1.5">
                      <div
                        className="h-full bg-teal rounded"
                        style={{ width: '71%', transformOrigin: 'left', animation: 'pm-growx .8s ease both 1.25s' }}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-bg text-success"
                        style={{ animation: 'pm-pop .4s ease both 1.7s' }}
                      >
                        7/10
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning"
                        style={{ animation: 'pm-pop .4s ease both 1.9s' }}
                      >
                        {t.landing.howVisualCriticalGap}
                      </span>
                    </div>
                  </div>
                )}
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
          <h2 className="font-display font-semibold text-[30px] md:text-[34px] tracking-tight leading-tight mb-3.5">
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
            <h2 className="font-display font-semibold text-[26px] md:text-[30px] tracking-tight">{t.landing.exampleTitle}</h2>
          </div>
          <div className="bg-surface border border-border rounded-rl shadow-sh max-w-[1000px] mx-auto overflow-hidden">
            <div className="flex items-start justify-between gap-4 flex-wrap p-7 border-b border-border">
              <div>
                <div className="text-[19px] font-bold">{t.landing.exampleJobTitle}</div>
                <div className="text-[14px] text-text2 mt-1">{t.landing.exampleLocation}</div>
              </div>
              <Badge tone="success">{t.landing.exampleReliabilityBadge}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center p-7">
              <div className="text-center">
                <RadialGauge value={71} />
                <div className="text-[12px] text-text2 mt-2">{t.landing.exampleGaugeUnit}</div>
                <div className="text-teal font-semibold text-[15px]">{t.landing.gaugeLabel}</div>
              </div>
              <div className="grid gap-3.5">
                <div className="flex items-start gap-3 bg-success-bg rounded-rc p-4">
                  <Check className="w-5 h-5 text-success flex-none mt-0.5" />
                  <div>
                    <div className="font-bold text-[15px]">{t.landing.exampleStrengthTitle}</div>
                    <div className="text-[13.5px] text-text2 mt-0.5">{t.landing.exampleStrengthSubtitle}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-warning-bg rounded-rc p-4">
                  <AlertTriangle className="w-5 h-5 text-warning flex-none mt-0.5" />
                  <div>
                    <div className="font-bold text-[15px]">{t.landing.exampleGapTitle}</div>
                    <div className="text-[13.5px] text-text2 mt-0.5">{t.landing.exampleGapSubtitle}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-info-bg rounded-rc p-4">
                  <Target className="w-5 h-5 text-info flex-none mt-0.5" />
                  <div>
                    <div className="font-bold text-[15px]">{t.landing.exampleRecommendationTitle}</div>
                    <div className="text-[13.5px] text-text2 mt-0.5">{t.landing.exampleRecommendationSubtitle}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-7">
            <Button variant="secondary" onClick={() => navigate('/analyze')}>{t.landing.exampleCta}</Button>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section id="sec-pricing" className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="text-center max-w-[620px] mx-auto mb-11">
          <SectionLabel>{t.landing.pricingLabel}</SectionLabel>
          <h2 className="font-display font-semibold text-[30px] md:text-[34px] tracking-tight mb-3">{t.landing.pricingTitle}</h2>
          <p className="text-[16px] text-text2">{t.landing.pricingSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          <div className="relative rounded-rl p-6 flex flex-col bg-white border-[1.5px] border-dashed border-teal">
            <h3 className="text-[17px] font-bold mb-1">{t.pricing.freeTier.name}</h3>
            <p className="text-[13.5px] text-text2 mb-4">{t.pricing.freeTier.desc}</p>
            <div className="text-[32px] font-extrabold text-success mb-4">{t.pricing.freeTier.priceLabel}</div>
            <ul className="grid gap-2 mb-6 flex-1">
              {t.pricing.freeTier.features.slice(0, 3).map((f) => (
                <li key={f} className="text-[13.5px] text-text2 flex gap-2 items-start">
                  <Check className="w-4 h-4 text-teal flex-none mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => navigate('/analyze')}>{t.pricing.freeTier.cta}</Button>
          </div>

          {PACKAGES.map((p) => (
            <div
              key={p.id}
              className={
                'relative rounded-rl p-6 flex flex-col border ' +
                (p.popular ? 'bg-white border-teal border-[1.5px] shadow-sh' : 'bg-white border-border')
              }
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[12px] font-bold text-white bg-teal whitespace-nowrap">
                  {t.pricing.mostPopular}
                </span>
              )}
              <h3 className="text-[17px] font-bold mb-1">{p.name}</h3>
              <p className="text-[13.5px] text-text2 mb-4">{p.desc}</p>
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-[32px] font-extrabold text-navy">{p.price}</span>
                <span className="text-[14px] font-semibold text-muted">USD</span>
              </div>
              <ul className="grid gap-2 mb-6 flex-1">
                {p.features.slice(0, 3).map((f: string) => (
                  <li key={f} className="text-[13.5px] text-text2 flex gap-2 items-start">
                    <Check className="w-4 h-4 text-teal flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={p.popular ? 'primary' : 'secondary'} onClick={() => navigate('/analyze')}>
                {t.landing.selectCta}
              </Button>
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
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="font-display font-semibold text-[28px] md:text-[32px] tracking-tight mb-4">{t.landing.privacyTitle}</h2>
            <p className="text-[16px] leading-relaxed text-[#b9c7d4] max-w-[440px] mb-6">
              {t.landing.privacySubtitle}
            </p>
            <button
              className="inline-flex items-center px-5 py-3 rounded-rk border border-white/20 text-white font-semibold text-[14px] hover:bg-white/5"
              onClick={() => navigate('/privacy')}
            >
              {t.landing.privacyCta}
            </button>
          </div>
          <div className="grid gap-3.5">
            {[
              [Lock, t.landing.privacyPoint1],
              [Shield, t.landing.privacyPoint2],
              [Trash2, t.landing.privacyPoint3],
              [Clock, t.landing.privacyPoint4],
            ].map(([Icon, text], i) => (
              <div key={i} className="flex gap-3.5 items-center bg-white/[0.06] border border-white/10 rounded-2xl px-5 py-4">
                <Icon className="w-[20px] h-[20px] text-[#4fd6c9] flex-none" />
                <span className="text-[15px] leading-relaxed text-[#e6edf3]">{text as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[820px] mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <SectionLabel>{t.landing.faqLabel}</SectionLabel>
          <h2 className="font-display font-semibold text-[30px] md:text-[34px] tracking-tight">{t.landing.faqTitle}</h2>
        </div>
        <Accordion items={t.landing.faq.map((item, i) => ({ key: String(i), title: item.q, content: item.a }))} />
      </section>

      <Footer />
    </div>
  );
}
