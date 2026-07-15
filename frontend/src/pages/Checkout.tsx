import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, CreditCard } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Card } from '../components/ui';
import { createOrder } from '../lib/api';

const PACKAGE_NAMES: Record<string, { name: string; price: string; features: string[] }> = {
  '1': { name: 'Tam uyğunluq hesabatı', price: '0.49 USD', features: ['Tam tələb analizi', 'CV-dən sübutlar', 'PDF hesabat'] },
  '2': {
    name: 'Vakansiyaya uyğun CV və cover letter',
    price: '0.99 USD',
    features: ['Tam hesabat', 'Uyğunlaşdırılmış CV', 'Cover letter', 'Word və PDF'],
  },
  '3': {
    name: 'Tam müraciət və müsahibə paketi',
    price: '5.90 USD',
    features: ['Yuxarıdakıların hamısı', 'Müsahibə sualları', 'Cavab çərçivələri', 'Hazırlıq PDF-i'],
  },
};

export default function Checkout() {
  const { id, pkg } = useParams<{ id: string; pkg: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const info = PACKAGE_NAMES[pkg || '1'];

  async function proceed() {
    if (!id || !pkg) return;
    setLoading(true);
    setError('');
    try {
      const order = await createOrder(id, Number(pkg));
      navigate(`/payment/${order.id}`);
    } catch (err: any) {
      setError(err.message || 'Sifariş yaradılarkən xəta baş verdi.');
      setLoading(false);
    }
  }

  return (
    <div>
      <AppHeader />
      <div className="max-w-[520px] mx-auto px-6 py-14">
        <Card className="p-7">
          <h1 className="text-[21px] font-bold mb-6">Ödəniş məlumatları</h1>
          <div className="border border-border rounded-rc p-4 mb-5">
            <div className="text-[15px] font-semibold mb-2">{info.name}</div>
            <ul className="grid gap-1.5 mb-3">
              {info.features.map((f) => (
                <li key={f} className="text-[13px] text-text2">• {f}</li>
              ))}
            </ul>
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="text-[13.5px] text-text2">Qiymət</span>
              <span className="text-[20px] font-extrabold text-navy">{info.price}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-[13px] text-text2 mb-2">
            <CreditCard className="w-4 h-4 flex-none mt-0.5 text-teal" />
            Ödənişi tamamlamaq üçün təhlükəsiz ödəniş səhifəsinə yönləndiriləcəksiniz.
          </div>
          <div className="flex items-start gap-2.5 text-[13px] text-text2 mb-6">
            <ShieldCheck className="w-4 h-4 flex-none mt-0.5 text-teal" />
            PeekMatch kart məlumatlarınızı görmür və saxlamır.
          </div>

          {error && <p className="text-[13.5px] text-danger mb-3">{error}</p>}

          <Button className="w-full mb-3" loading={loading} onClick={proceed}>
            Ödənişə keç
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => navigate(`/pricing/${id}`)}>
            Paketlərə qayıt
          </Button>
        </Card>
      </div>
    </div>
  );
}
