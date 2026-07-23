import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Badge, Card } from '../components/ui';
import { Reveal } from '../components/Reveal';
import { getAnalysis, type AnalysisInfo } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';
import { STAGGER, staggerDelay } from '../lib/motion';
import type { Dict } from '../lib/i18n/locales';

function buildPackages(t: Dict) {
  return [
    { id: 1, ...t.pricing.packages['1'], price: '0.90 USD', popular: false },
    { id: 2, ...t.pricing.packages['2'], price: '2.90 USD', popular: true },
  ];
}

// Which paid package (id 1/2) includes each comparison-table row, in the same order as t.pricing.comparisonRows.
const COMPARISON_MATRIX: [boolean, boolean][] = [
  [true, true],
  [true, true],
  [true, true],
  [true, true],
  [true, true],
  [false, true],
  [false, true],
  [false, true],
  [false, true],
];

export default function Pricing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const PACKAGES = buildPackages(t);

  useEffect(() => {
    if (id) getAnalysis(id).then(setInfo).catch(() => {});
  }, [id]);

  const highlight = Number(params.get('pkg') || 0);
  const notDone = Boolean(info && info.status !== 'done');

  function selectPackage(pkgId: number) {
    track({ name: 'package_selected', metadata: { package: pkgId } }, id);
    navigate(notDone ? '/analyze' : `/checkout/${id}/${pkgId}`);
  }

  return (
    <div>
      <AppHeader vacancyTitle={info?.vacancyTitle} vacancyCompany={info?.vacancyCompany} vacancyLocation={info?.vacancyLocation} analysisId={id} />
      <div className="max-w-[880px] mx-auto px-6 py-10">
        <div className="text-center max-w-[620px] mx-auto mb-9">
          <h1 className="font-display font-semibold text-[30px] mb-2">{t.pricing.title}</h1>
          <p className="text-[15px] text-text2">{t.pricing.subtitle}</p>
        </div>

        {notDone && (
          <div className="bg-info-bg border border-info rounded-rc p-4 mb-8 flex items-center justify-between flex-wrap gap-3">
            <span className="text-[14px] text-navy flex items-center gap-2">
              <Info className="w-4 h-4 text-info" />
              {t.pricing.needFreeAnalysis}
            </span>
            <Button size="sm" onClick={() => navigate('/analyze')}>{t.pricing.startFreeAnalysis}</Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch mb-14">
          <Reveal delay={staggerDelay(0, STAGGER.cards)} className="h-full">
            <Card className="p-6 flex flex-col h-full border-dashed border-[1.5px] border-teal">
              <h3 className="text-[17px] font-bold mb-1">{t.pricing.freeTier.name}</h3>
              <div className="font-display font-semibold text-[26px] text-success mb-2">{t.pricing.freeTier.priceLabel}</div>
              <p className="text-[13.5px] text-text2 mb-4">{t.pricing.freeTier.desc}</p>
              <ul className="grid gap-2 mb-6 flex-1">
                {t.pricing.freeTier.features.map((f) => (
                  <li key={f} className="text-[13px] text-text2 flex gap-2 items-start">
                    <Check className="w-3.5 h-3.5 text-teal flex-none mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {info?.status === 'done' ? (
                <Badge tone="success" className="justify-center py-2.5">{t.pricing.ownedBadge}</Badge>
              ) : (
                <Button variant="secondary" onClick={() => navigate('/analyze')}>{t.pricing.freeTier.cta}</Button>
              )}
            </Card>
          </Reveal>
          {PACKAGES.map((p, i) => {
            const owned = (info?.ownedPackage || 0) >= p.id;
            return (
              <Reveal key={p.id} delay={staggerDelay(i + 1, STAGGER.cards)} className="h-full">
                <Card
                  className={
                    'p-6 flex flex-col h-full ' +
                    (p.popular ? 'border-teal border-[1.5px] shadow-sh border-t-4 border-t-accent' : highlight === p.id ? 'border-teal' : '')
                  }
                >
                  {p.popular && (
                    <Badge tone="premium" icon={null} className="mb-3 self-start bg-accent-bg text-accent">
                      {t.pricing.mostPopular}
                    </Badge>
                  )}
                  <h3 className="text-[17px] font-bold mb-1">{p.name}</h3>
                  <div className="font-display font-semibold text-[26px] text-navy mb-2 tabular-nums">{p.price}</div>
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
                    <Badge tone="success" className="justify-center py-2.5">{t.pricing.ownedBadge}</Badge>
                  ) : (
                    <Button variant="primary" disabled={notDone} onClick={() => selectPackage(p.id)}>
                      {p.cta}
                    </Button>
                  )}
                </Card>
              </Reveal>
            );
          })}
        </div>

        <h2 className="font-display font-semibold text-[21px] mb-4 text-center">{t.pricing.comparisonTitle}</h2>
        <Card className="overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[420px]">
            <thead>
              <tr className="bg-bg">
                <th className="text-left px-5 py-3.5 text-[13px] font-bold">{t.pricing.comparisonFeatureLabel}</th>
                {PACKAGES.map((p, i) => (
                  <th key={p.id} className={'px-3 py-3.5 text-[13px] font-bold text-center tabular-nums ' + (i === 1 ? 'text-teal' : '')}>
                    {p.price}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.pricing.comparisonRows.map((row, i) => (
                <tr key={row} className="border-t border-border">
                  <td className="px-5 py-3 text-[14px] text-text2">{row}</td>
                  {COMPARISON_MATRIX[i].map((has, j) => (
                    <td key={j} className="px-3 py-3 text-center">
                      {has ? <Check className="w-[18px] h-[18px] text-teal inline-block" /> : <span className="text-border">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="text-center text-[12.5px] text-muted mt-6">{t.pricing.footerNote}</p>
      </div>
    </div>
  );
}
