import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, CreditCard } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Card } from '../components/ui';
import { createOrder } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Dict } from '../lib/i18n/locales';

function buildPackageNames(t: Dict): Record<string, { name: string; price: string; features: string[] }> {
  return {
    '1': { ...t.checkout.packages['1'], price: '0.49 USD' },
    '2': { ...t.checkout.packages['2'], price: '0.99 USD' },
    '3': { ...t.checkout.packages['3'], price: '5.90 USD' },
  };
}

export default function Checkout() {
  const { id, pkg } = useParams<{ id: string; pkg: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const info = buildPackageNames(t)[pkg || '1'];

  async function proceed() {
    if (!id || !pkg) return;
    setLoading(true);
    setError('');
    try {
      const order = await createOrder(id, Number(pkg));
      navigate(`/payment/${order.id}`);
    } catch (err: any) {
      setError(err.message || t.checkout.errGeneric);
      setLoading(false);
    }
  }

  return (
    <div>
      <AppHeader />
      <div className="max-w-[520px] mx-auto px-6 py-14">
        <Card className="p-7">
          <h1 className="text-[21px] font-bold mb-6">{t.checkout.title}</h1>
          <div className="border border-border rounded-rc p-4 mb-5">
            <div className="text-[15px] font-semibold mb-2">{info.name}</div>
            <ul className="grid gap-1.5 mb-3">
              {info.features.map((f) => (
                <li key={f} className="text-[13px] text-text2">• {f}</li>
              ))}
            </ul>
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="text-[13.5px] text-text2">{t.checkout.priceLabel}</span>
              <span className="text-[20px] font-extrabold text-navy">{info.price}</span>
            </div>
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
