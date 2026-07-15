import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { getAnalysis, type AnalysisInfo } from '../lib/api';

const PACKAGES = [
  {
    id: 1,
    name: 'Tam uyğunluq hesabatı',
    price: '0.49 USD',
    desc: 'CV və vakansiya arasındakı bütün uyğunluqları detallı görün.',
    features: [
      'Bütün əsas tələblərin analizi',
      'Uyğun, qismən uyğun və uyğun olmayan tələblər',
      'CV-dən tapılan sübutlar',
      'Kritik boşluqlar',
      'Detallı vizual statistika',
      'PDF hesabat',
    ],
    cta: 'Hesabatı aç',
  },
  {
    id: 2,
    name: 'Vakansiyaya uyğun CV və cover letter',
    price: '0.99 USD',
    desc: 'Yuxarıdakı hər şey + uyğunlaşdırılmış CV və cover letter.',
    features: [
      'Yuxarıdakı paketin hamısı',
      'Uyğunlaşdırılmış professional summary',
      'Yenidən yazılmış iş təcrübəsi',
      'Uyğunlaşdırılmış skills bölməsi',
      'Tam CV və cover letter',
      'Word və PDF faylları',
    ],
    cta: 'CV-mi uyğunlaşdır',
    popular: true,
  },
  {
    id: 3,
    name: 'Tam müraciət və müsahibə paketi',
    price: '5.90 USD',
    desc: 'Yuxarıdakı hər şey + müsahibə hazırlığı.',
    features: [
      'Yuxarıdakı paketlərin hamısı',
      'HR, situasiya və texniki suallar',
      '"Tell me about yourself" cavabı',
      'Güclü və zəif tərəflər üzrə hazırlıq',
      'Kritik boşluqların izahı',
      'Müsahibə hazırlığı PDF-i',
    ],
    cta: 'Tam paketi al',
    premium: true,
  },
];

export default function Pricing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);

  useEffect(() => {
    if (id) getAnalysis(id).then(setInfo).catch(() => {});
  }, [id]);

  const highlight = Number(params.get('pkg') || 0);
  const notDone = Boolean(info && info.status !== 'done');

  return (
    <div>
      <AppHeader vacancyTitle={info?.vacancyTitle} vacancyCompany={info?.vacancyCompany} vacancyLocation={info?.vacancyLocation} />
      <div className="max-w-[1080px] mx-auto px-6 py-10">
        <div className="text-center max-w-[620px] mx-auto mb-9">
          <h1 className="text-[28px] font-bold mb-2">Paketinizi seçin</h1>
          <p className="text-[15px] text-text2">İlkin analiz həmişə pulsuzdur. Bütün paketlər birdəfəlik ödənişdir — abunəlik yoxdur.</p>
        </div>

        {notDone && (
          <div className="bg-info-bg border border-info rounded-rc p-4 mb-8 flex items-center justify-between flex-wrap gap-3">
            <span className="text-[14px] text-navy flex items-center gap-2">
              <Info className="w-4 h-4 text-info" />
              Paket almaq üçün əvvəlcə pulsuz analiz edin.
            </span>
            <Button size="sm" onClick={() => navigate('/analyze')}>Pulsuz analizə başla</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PACKAGES.map((p) => {
            const owned = (info?.ownedPackage || 0) >= p.id;
            return (
              <Card
                key={p.id}
                className={
                  'p-6 flex flex-col ' +
                  (p.premium
                    ? 'bg-premium-bg border-premium'
                    : p.popular
                      ? 'border-teal border-[1.5px] shadow-sh'
                      : highlight === p.id
                        ? 'border-teal'
                        : '')
                }
              >
                {p.popular && <Badge tone="success" className="mb-3 self-start">Ən populyar</Badge>}
                {p.premium && <Badge tone="premium" className="mb-3 self-start">Premium</Badge>}
                <h3 className="text-[17px] font-bold mb-1">{p.name}</h3>
                <div className="text-[26px] font-extrabold text-navy mb-2">{p.price}</div>
                <p className="text-[13.5px] text-text2 mb-4">{p.desc}</p>
                <ul className="grid gap-2 mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-[13px] text-text2 flex gap-2 items-start">
                      <Check className="w-3.5 h-3.5 text-teal flex-none mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {owned ? (
                  <Badge tone="success" className="justify-center py-2.5">Sahibsiniz ✓</Badge>
                ) : (
                  <Button
                    variant={p.premium ? 'premium' : 'primary'}
                    disabled={notDone}
                    onClick={() => (notDone ? navigate('/analyze') : navigate(`/checkout/${id}/${p.id}`))}
                  >
                    {p.cta}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
        <p className="text-center text-[12.5px] text-muted mt-6">Birdəfəlik ödəniş — abunəlik yoxdur.</p>
      </div>
    </div>
  );
}
