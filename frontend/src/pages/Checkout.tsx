import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, CreditCard } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Card } from '../components/ui';
import { LifecycleState } from '../components/LifecycleState';
import { createOrder, getAnalysis } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { track } from '../lib/analytics';
import type { Dict } from '../lib/i18n/locales';

const PRICE_USD: Record<string, number> = { '1': 0.9, '2': 2.9 };

function buildPackageNames(t: Dict): Record<string, { name: string; price: string; features: string[] }> {
  return {
    '1': { ...t.checkout.packages['1'], price: '0.90 USD' },
    '2': { ...t.checkout.packages['2'], price: '2.90 USD' },
  };
}

export default function Checkout() {
  const { id, pkg } = useParams<{ id: string; pkg: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [owned, setOwned] = useState(0);
  const [lifecycleCode, setLifecycleCode] = useState<'expired' | 'deleted' | 'entitlement_expired' | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAnalysis(id)
      .then((a) => setOwned(a.ownedPackage))
      .catch((err) => {
        if (err.status === 410 && (err.code === 'expired' || err.code === 'deleted' || err.code === 'entitlement_expired')) {
          setLifecycleCode(err.code);
        } else if (err.status === 404) {
          setNotFound(true);
        }
      });
  }, [id]);

  const info = buildPackageNames(t)[pkg || '1'];
  // Display-only preview of the server-computed upgrade diff — the actual charge is always
  // computed server-side in POST /orders, this just avoids surprising the user at payment time.
  const isUpgrade = owned > 0 && owned < Number(pkg || 1);
  const basePriceUsd = PRICE_USD[pkg || '1'] ?? 0;
  const creditUsd = isUpgrade ? PRICE_USD[String(owned)] ?? 0 : 0;
  const amountDueUsd = Math.max(0, basePriceUsd - creditUsd);

  useEffect(() => {
    if (!pkg) return;
    track({ name: 'checkout_started', metadata: { package: Number(pkg), isUpgrade } }, id);
    // Intentionally keyed on id/pkg only, not isUpgrade, so this fires once per checkout page
    // load rather than re-firing every time `owned` finishes loading and isUpgrade recomputes.
  }, [id, pkg]);

  async function proceed() {
    if (!id || !pkg) return;
    setLoading(true);
    setError('');
    try {
      const order = await createOrder(id, Number(pkg));
      navigate(`/payment/${order.id}`);
    } catch (err: any) {
      if (err.status === 410 && (err.code === 'expired' || err.code === 'deleted' || err.code === 'entitlement_expired')) {
        setLifecycleCode(err.code);
      } else if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message || t.checkout.errGeneric);
      }
      setLoading(false);
    }
  }

  if (lifecycleCode) return <LifecycleState code={lifecycleCode} />;

  if (notFound) {
    return (
      <div className="max-w-[520px] mx-auto px-6 py-20 text-center">
        <p className="text-danger text-[15px] mb-4">{t.checkout.notFound}</p>
        <Button onClick={() => navigate('/analyze')}>{t.results.newAnalysisCta}</Button>
      </div>
    );
  }

  return (
    <div>
      <AppHeader analysisId={id} />
      <div className="max-w-[520px] mx-auto px-6 py-14">
        <Card className="p-7">
          <h1 className="font-display font-semibold text-[22px] mb-6">{t.checkout.title}</h1>
          <div className="border border-border rounded-rc p-4 mb-5">
            <div className="text-[15px] font-semibold mb-2">{info.name}</div>
            <ul className="grid gap-1.5 mb-3">
              {info.features.map((f) => (
                <li key={f} className="text-[13px] text-text2">• {f}</li>
              ))}
            </ul>
            {isUpgrade ? (
              <div className="pt-3 border-t border-border grid gap-1.5">
                <div className="flex justify-between text-[13.5px] text-text2">
                  <span>{t.checkout.upgrade.newPackageLabel}</span>
                  <span className="tabular-nums">{basePriceUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-[13.5px] text-text2">
                  <span>{t.checkout.upgrade.previouslyPaidLabel}</span>
                  <span className="tabular-nums">− {creditUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-border">
                  <span className="text-[15px] font-bold">{t.checkout.upgrade.amountDueLabel}</span>
                  <span className="font-display font-semibold text-[20px] text-navy tabular-nums">{amountDueUsd.toFixed(2)} USD</span>
                </div>
                <p className="text-[12px] text-muted">{t.checkout.upgrade.note}</p>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-[13.5px] text-text2">{t.checkout.priceLabel}</span>
                <span className="font-display font-semibold text-[20px] text-navy tabular-nums">{info.price}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 text-[13px] text-text2 mb-2">
            <CreditCard className="w-4 h-4 flex-none mt-0.5 text-teal" />
            {t.checkout.secureRedirect}
          </div>
          <div className="flex items-start gap-2.5 text-[13px] text-text2 mb-6">
            <ShieldCheck className="w-4 h-4 flex-none mt-0.5 text-teal" />
            {t.checkout.noCardStorage}
          </div>

          {error && <p className="text-[13.5px] text-danger mb-3">{error}</p>}

          <Button className="w-full mb-3" loading={loading} onClick={proceed}>
            {t.checkout.proceedCta}
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => navigate(`/pricing/${id}`)}>
            {t.checkout.backToPackages}
          </Button>
        </Card>
      </div>
    </div>
  );
}
