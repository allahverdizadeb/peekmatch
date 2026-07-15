import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, AlertTriangle, Lock, CheckCircle2, TrendingUp, Users, Activity } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { RadialGauge, CategoryBarChart } from '../components/charts';
import { getAnalysis, getResult, type FreeResult, type AnalysisInfo } from '../lib/api';

const STRENGTH_ICONS = [TrendingUp, Users, Activity];

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [result, setResult] = useState<FreeResult | null>(null);
  const [error, setError] = useState('');
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAnalysis(id), getResult(id)])
      .then(([i, r]) => {
        setInfo(i);
        setResult(r);
      })
      .catch((err) => setError(err.message || 'Nəticə yüklənə bilmədi.'));
  }, [id]);

  if (error) {
    return (
      <div className="max-w-[520px] mx-auto px-6 py-20 text-center">
        <p className="text-danger text-[15px] mb-4">{error}</p>
        <Button onClick={() => navigate('/analyze')}>Yeni analiz başlat</Button>
      </div>
    );
  }
  if (!result || !info) {
    return <div className="max-w-[520px] mx-auto px-6 py-20 text-center text-text2">Yüklənir...</div>;
  }

  const recTone = result.recommendationTone === 'positive' ? 'success' : result.recommendationTone === 'negative' ? 'danger' : 'warning';

  return (
    <div>
      <AppHeader vacancyTitle={info.vacancyTitle} vacancyCompany={info.vacancyCompany} vacancyLocation={info.vacancyLocation} />
      <div className="max-w-[1160px] mx-auto px-6 py-9">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-[26px] font-bold">Analiz nəticəniz hazırdır</h1>
            <p className="text-[15px] text-text2 mt-1">
              CV-nizin {info.vacancyTitle || 'vakansiyaya'} uyğunluğu
            </p>
          </div>
          <Badge tone="info">Analiz etibarlılığı: {result.reliability === 'yüksək' ? 'Yüksək' : result.reliability === 'orta' ? 'Orta' : 'Aşağı'}</Badge>
        </div>
        <p className="text-[12.5px] text-muted mb-8">CV və nəticələriniz 24 saat ərzində avtomatik silinəcək.</p>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 flex flex-col items-center text-center">
            <span className="text-[13px] font-semibold text-text2 mb-3 self-start">Namizədin uyğunluğu</span>
            <RadialGauge value={result.compatibility} label={result.compatibilityLabel} />
            <p className="text-[12.5px] text-text2 mt-3">CV-niz vakansiyanın əsas tələblərinin əhəmiyyətli hissəsini qarşılayır.</p>
          </Card>

          <Card className="p-5">
            <span className="text-[13px] font-semibold text-text2 mb-3 block">Əsas tələblərdən uyğun olanlar</span>
            <div className="text-[26px] font-extrabold text-navy mb-3">
              {result.mainRequirementsMet} / {result.mainRequirementsTotal}
            </div>
            <div className="flex gap-1 mb-3">
              {Array.from({ length: result.mainRequirementsTotal }, (_, i) => {
                const tone =
                  i < result.mainRequirementsMet ? '#198754' : i < result.mainRequirementsMet + result.mainRequirementsPartial ? '#C97800' : '#CF3F4F';
                return <div key={i} className="h-2.5 flex-1 rounded-full" style={{ background: tone }} />;
              })}
            </div>
            <div className="text-[12px] text-text2 space-y-0.5">
              <div>{result.mainRequirementsMet} tam uyğun</div>
              <div>{result.mainRequirementsPartial} qismən</div>
              <div>{result.mainRequirementsMissing} uyğun deyil</div>
            </div>
          </Card>

          <Card className="p-5">
            <span className="text-[13px] font-semibold text-text2 mb-3 block">Kritik boşluqlar</span>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <span className="text-[26px] font-extrabold text-navy">{result.criticalGapsCount}</span>
            </div>
            <p className="text-[12.5px] text-text2">{result.criticalGapSummary}</p>
          </Card>

          <Card className="p-5 relative">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[13px] font-semibold text-text2">HR müsahibəsinə dəvət almaq ehtimalı</span>
              <button onMouseEnter={() => setTooltipOpen(true)} onMouseLeave={() => setTooltipOpen(false)} className="text-muted">
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            {tooltipOpen && (
              <div className="absolute z-10 right-4 top-12 w-64 bg-navy text-white text-[12px] leading-relaxed rounded-rc p-3 shadow-sh-lg">
                Göstərici yalnız təqdim olunan CV və vakansiyanın AI əsaslı screening qiymətləndirməsidir. Müraciətçi sayı, referral, daxili
                namizəd, əmək bazarı, işəgötürənin qərarı və müsahibə performansı nəzərə alınmır.
              </div>
            )}
            <RadialGauge value={result.hrScreeningEstimate} size={100} stroke={9} />
            <p className="text-[11.5px] text-muted mt-3">Bu göstərici real işə qəbul zəmanəti deyil.</p>
          </Card>
        </div>

        {/* Category chart */}
        <Card className="p-6 mb-8">
          <h2 className="text-[17px] font-bold mb-1">Kateqoriya üzrə uyğunluq</h2>
          <p className="text-[13px] text-text2 mb-5">Hər kateqoriya üzrə CV-nizin vakansiya tələbləri ilə üst-üstə düşmə səviyyəsi.</p>
          <CategoryBarChart data={result.categoryScores} />
        </Card>

        {/* Strengths */}
        <div className="mb-8">
          <h2 className="text-[19px] font-bold mb-4">Güclü tərəfləriniz</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.strengths.length === 0 && <p className="text-[14px] text-text2">Güclü tərəf tapılmadı.</p>}
            {result.strengths.map((s, i) => {
              const Icon = STRENGTH_ICONS[i % STRENGTH_ICONS.length];
              return (
                <Card key={i} className="p-5">
                  <Icon className="w-6 h-6 text-teal mb-3" />
                  <h3 className="text-[15px] font-bold mb-1.5">{s.title}</h3>
                  <p className="text-[13.5px] text-text2 leading-relaxed mb-3">{s.text}</p>
                  {s.evidenceFound && <Badge tone="success">CV-də sübut tapıldı</Badge>}
                  {s.relatedRequirement && <p className="text-[12px] text-muted mt-2">Əlaqəli tələb: {s.relatedRequirement}</p>}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Most important requirement */}
        <Card className="p-6 mb-8 border-warning border">
          <h2 className="text-[17px] font-bold mb-3">Vakansiyanın ən vacib tələbi</h2>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-none mt-0.5" />
            <div>
              <div className="text-[15px] font-semibold">{result.mostImportantMissingRequirement}</div>
              <Badge tone="warning" className="my-2">Kritik boşluq</Badge>
              <p className="text-[13.5px] text-text2 leading-relaxed">{result.mostImportantMissingExplanation}</p>
              <p className="text-[12.5px] text-text2 mt-2 italic">
                Bu bacarıq sizdə varsa, CV-yə əlavə edin. Yoxdursa, olmayan təcrübəni qeyd etməyin.
              </p>
            </div>
          </div>
        </Card>

        {/* Recommendation */}
        <Card className="p-6 mb-8">
          <Badge tone={recTone as any} className="mb-3">{result.recommendationStatus}</Badge>
          <ul className="grid gap-1.5 mb-4">
            {result.recommendationReasons.map((r, i) => (
              <li key={i} className="text-[13.5px] text-text2 flex gap-2">
                <span className="text-teal">•</span>
                {r}
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-navy font-medium mb-5">{result.recommendationNextAction}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(`/pricing/${id}?pkg=2`)}>CV-mi bu vakansiyaya uyğunlaşdır</Button>
            <Button variant="secondary" onClick={() => navigate(`/pricing/${id}?pkg=1`)}>Tam hesabatı aç — 0.49 USD</Button>
          </div>
        </Card>

        {/* Locked report preview */}
        <Card className="p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-premium" />
            <h2 className="text-[17px] font-bold">Bütün tələblər üzrə sübutları və boşluqları görün</h2>
          </div>
          <div className="grid gap-2 mb-4 opacity-40 select-none pointer-events-none">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-rk p-3">
                <CheckCircle2 className="w-4 h-4 text-muted" />
                <div className="h-2.5 bg-bg2 rounded flex-1" />
                <div className="h-2.5 bg-bg2 rounded w-16" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3 bg-premium-bg rounded-rc p-4">
            <div>
              <div className="font-bold text-[15px]">Tam uyğunluq hesabatı</div>
              <div className="text-[13px] text-text2">Bütün əsas tələblərin analizi, CV-dən tapılan sübutlar, kritik boşluqlar və detallı statistika.</div>
            </div>
            <Button variant="premium" onClick={() => navigate(`/pricing/${id}?pkg=1`)}>Tam hesabatı aç — 0.49 USD</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
