import { useNavigate } from 'react-router-dom';
import { Check, Shield, Trash2, Upload, Link as LinkIcon, Target, BarChart3, ScanLine, AlertTriangle, Minus, Lock } from 'lucide-react';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { Button, Badge, SectionLabel } from '../components/ui';
import { RadialGauge } from '../components/charts';

const PACKAGES = [
  { id: 1, name: 'Tam uyğunluq hesabatı', price: '0.49 USD', desc: 'CV və vakansiya arasındakı bütün uyğunluqları detallı görün.' },
  { id: 2, name: 'Vakansiyaya uyğun CV və cover letter', price: '0.99 USD', desc: 'Uyğunlaşdırılmış CV, cover letter, Word və PDF faylları.', popular: true },
  { id: 3, name: 'Tam müraciət və müsahibə paketi', price: '5.90 USD', desc: 'Müsahibə sualları, cavab çərçivələri və hazırlıq materialları.', premium: true },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div>
      <MarketingHeader />

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 pt-16 pb-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-bg rounded-full text-[13px] font-semibold text-success mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Qeydiyyat tələb olunmur
          </div>
          <h1 className="text-[38px] md:text-[46px] leading-[1.12] font-bold tracking-tight mb-4">
            CV-niz bu vakansiyaya həqiqətən uyğundur?
          </h1>
          <p className="text-[18px] leading-relaxed text-text2 mb-7 max-w-[520px]">
            CV-nizi yükləyin, vakansiya linkini əlavə edin və real təcrübənizin əsas tələblərlə necə uyğunlaşdığını görün.
          </p>
          <div className="flex gap-3.5 flex-wrap mb-6">
            <Button onClick={() => navigate('/analyze')}>Pulsuz analiz et</Button>
            <Button variant="secondary" onClick={() => document.getElementById('sec-result')?.scrollIntoView({ behavior: 'smooth' })}>
              Nümunə nəticəyə bax
            </Button>
          </div>
          <div className="flex gap-5 flex-wrap text-[14px] text-text2 font-medium">
            <span className="inline-flex items-center gap-2"><Check className="w-[18px] h-[18px] text-teal" />Qeydiyyat tələb olunmur</span>
            <span className="inline-flex items-center gap-2"><Shield className="w-[18px] h-[18px] text-teal" />Olmayan təcrübə əlavə edilmir</span>
            <span className="inline-flex items-center gap-2"><Trash2 className="w-[18px] h-[18px] text-teal" />Məlumatlar avtomatik silinir</span>
          </div>
        </div>
        <div className="relative min-h-[340px]">
          <div className="absolute left-0 top-4 w-[220px] bg-white border border-border rounded-rc shadow-sh-lg p-4 z-10">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">CV</div>
            <div className="h-2.5 bg-bg2 rounded w-4/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-3/5 mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-full mb-2" />
            <div className="h-2.5 bg-bg2 rounded w-2/3" />
          </div>
          <div className="absolute right-0 top-24 w-[220px] bg-white border border-border rounded-rc shadow-sh-lg p-4 z-20">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Vakansiya tələbləri</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />Operational reporting</div>
            <div className="flex items-center gap-2 text-[13px] mb-1.5"><Check className="w-4 h-4 text-success" />Stakeholder coordination</div>
            <div className="flex items-center gap-2 text-[13px] text-warning"><AlertTriangle className="w-4 h-4" />Power BI</div>
          </div>
          <div className="absolute left-10 bottom-0 z-30">
            <RadialGauge value={71} label="Yaxşı uyğunluq" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="sec-how" className="bg-surface border-y border-border mt-8">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <SectionLabel>Necə işləyir</SectionLabel>
            <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight">CV-dən nəticəyə — 3 addım</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: 1, icon: Upload, title: 'CV-ni yüklə', text: 'PDF və ya DOCX formatında CV-nizi əlavə edin.' },
              { n: 2, icon: LinkIcon, title: 'Vakansiyanı əlavə et', text: 'İş elanının linkini yerləşdirin və ya mətni daxil edin.' },
              { n: 3, icon: Target, title: 'Nəticəni gör', text: 'Uyğunluğunuzu, güclü tərəflərinizi və kritik boşluqları görün.' },
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
            <Button onClick={() => navigate('/analyze')}>Pulsuz analiz et</Button>
          </div>
        </div>
      </section>

      {/* Differentiation */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="max-w-[760px] mx-auto mb-11 text-center">
          <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight leading-tight mb-3.5">
            Biz CV-yə sadəcə açar sözlər əlavə etmirik.
          </h2>
          <p className="text-[19px] leading-relaxed text-text2">Namizədin real təcrübəsini vakansiyanın tələblərinə uyğun şəkildə göstəririk.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-rl p-7">
            <div className="flex items-center gap-2.5 mb-4 text-muted font-semibold text-[15px]">
              <span className="w-7.5 h-7.5 w-[30px] h-[30px] rounded-lg bg-bg2 inline-flex items-center justify-center"><ScanLine className="w-4 h-4" /></span>
              Ənənəvi açar söz skaneri
            </div>
            {[
              ['Yalnız sözləri sayır', 'CV-də eyni sözlərin neçə dəfə yazıldığına baxır.'],
              ['Aldatmaq asandır', 'Eyni sözü çox təkrarlayan daha yüksək bal ala bilər.'],
              ['Səbəbi izah etmir', 'Sadəcə faiz göstərir — niyə uyğun olub-olmadığınızı demir.'],
            ].map(([t, x], i) => (
              <div key={i} className="flex gap-3 py-3 border-t border-border items-start">
                <span className="w-[34px] h-[34px] rounded-[9px] bg-bg2 text-muted inline-flex items-center justify-center flex-none">
                  {i === 0 ? <ScanLine className="w-4 h-4" /> : i === 1 ? <AlertTriangle className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{t}</div>
                  <div className="text-[13.5px] text-text2 leading-relaxed mt-0.5">{x}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-b from-white to-[#FAFEFD] border-[1.5px] border-teal rounded-rl p-7 shadow-sh">
            <div className="flex items-center gap-2.5 mb-4 text-teal font-bold text-[15px]">
              <span className="w-[30px] h-[30px] rounded-lg bg-success-bg inline-flex items-center justify-center"><Check className="w-4 h-4" /></span>
              PeekMatch
            </div>
            {[
              ['Real təcrübənizi yoxlayır', 'Vakansiyanın hər tələbi üçün CV-nizdə konkret sübut axtarır.'],
              ['Boşluqları dəqiq göstərir', 'Nəyin tam uyğun, nəyin qismən, nəyin çatışmadığını ayırır.'],
              ['Nə edəcəyinizi deyir', 'Dərhal müraciət etməli, yoxsa əvvəl CV-ni düzəltməli — konkret tövsiyə verir.'],
            ].map(([t, x], i) => (
              <div key={i} className="flex gap-3 py-3 border-t border-border items-start">
                <span className="w-[34px] h-[34px] rounded-[9px] bg-success-bg text-teal inline-flex items-center justify-center flex-none">
                  {i === 0 ? <Target className="w-4 h-4" /> : i === 1 ? <BarChart3 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{t}</div>
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
            <span className="px-3 py-1.5 bg-navy text-white rounded-full text-[12px] font-bold tracking-wide">Nümunə analiz</span>
            <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight">Nəticə belə görünür</h2>
          </div>
          <div className="bg-surface border border-border rounded-rl shadow-sh p-7 max-w-[900px] mx-auto">
            <div className="text-[13px] text-muted mb-1">Business Analyst · Caspian Systems (nümunə) · Bakı, Azərbaycan</div>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center mt-4">
              <RadialGauge value={71} label="Yaxşı uyğunluq" />
              <div className="grid gap-4">
                <div>
                  <div className="flex justify-between text-[13.5px] mb-1"><span className="font-medium">Əsas tələblər</span><span className="font-bold">7 / 10</span></div>
                  <div className="flex h-2.5 rounded-full overflow-hidden border border-border">
                    <div style={{ width: '70%', background: '#198754' }} />
                    <div style={{ width: '20%', background: '#C97800' }} />
                    <div style={{ width: '10%', background: '#CF3F4F' }} />
                  </div>
                </div>
                <div className="bg-success-bg border border-border rounded-rc p-3.5 text-[13.5px]">
                  <span className="font-semibold text-success">Güclü tərəf: </span>Operational reporting təcrübəniz vakansiyanın reporting tələbi ilə uyğunlaşır.
                </div>
                <div className="bg-warning-bg border border-border rounded-rc p-3.5 text-[13.5px]">
                  <span className="font-semibold text-warning">Kritik boşluq: </span>Power BI üzrə praktiki təcrübə göstərilməyib.
                </div>
                <div className="text-[13.5px] text-text2">
                  <span className="font-semibold text-navy">Tövsiyə: </span>CV-ni uyğunlaşdırdıqdan sonra müraciət et.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section id="sec-pricing" className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="text-center max-w-[620px] mx-auto mb-11">
          <SectionLabel>Qiymətlər</SectionLabel>
          <h2 className="text-[30px] md:text-[34px] font-bold tracking-tight mb-3">Nəticəni gördükdən sonra seçin</h2>
          <p className="text-[16px] text-text2">İlkin analiz həmişə pulsuzdur. Bütün paketlər birdəfəlik ödənişdir — abunəlik yoxdur.</p>
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
              {p.popular && <Badge tone="success" className="mb-3 self-start">Ən populyar</Badge>}
              {p.premium && <Badge tone="premium" className="mb-3 self-start">Premium</Badge>}
              <h3 className="text-[17px] font-bold mb-1">{p.name}</h3>
              <div className="text-[24px] font-extrabold text-navy mb-2">{p.price}</div>
              <p className="text-[13.5px] text-text2 mb-5 flex-1">{p.desc}</p>
              <Button variant={p.premium ? 'premium' : 'secondary'} onClick={() => navigate('/analyze')}>Pulsuz analizə başla</Button>
            </div>
          ))}
        </div>
        <div className="text-center mt-7">
          <button className="font-semibold text-teal text-[15px] hover:text-teal-h" onClick={() => navigate('/analyze')}>
            Paketləri müqayisə et →
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
            <h2 className="text-[28px] md:text-[32px] font-bold tracking-tight mb-4">CV məlumatlarınız sizə məxsusdur</h2>
            <p className="text-[16px] leading-relaxed text-[#b9c7d4] max-w-[440px]">
              Fayllarınız yalnız analiz üçün istifadə olunur və heç vaxt publik paylaşılmır.
            </p>
          </div>
          <div className="grid gap-3.5">
            {[
              [Lock, 'Fayllar məxfi emal olunur'],
              [Shield, 'Publik CV linkləri yaradılmır'],
              [Trash2, 'İstənilən vaxt bütün məlumatları silə bilərsiniz'],
              [Check, 'Fayllar saxlanma müddətindən sonra avtomatik silinir'],
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
