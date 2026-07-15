import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Card } from '../components/ui';
import { getOrder, simulatePayment, type Order } from '../lib/api';

type Stage = 'redirect' | 'pending' | 'success' | 'failed';

export default function PaymentStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('redirect');
  const [order, setOrder] = useState<Order | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    const t = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      triggerSimulation('success');
    }, 1100);
    return () => clearTimeout(t);
  }, [orderId]);

  async function triggerSimulation(outcome: 'success' | 'fail') {
    if (!orderId) return;
    setStage('pending');
    await simulatePayment(orderId, outcome);
    poll.current = setInterval(async () => {
      const o = await getOrder(orderId);
      setOrder(o);
      if (o.status === 'paid') {
        if (poll.current) clearInterval(poll.current);
        setStage('success');
      } else if (o.status === 'failed') {
        if (poll.current) clearInterval(poll.current);
        setStage('failed');
      }
    }, 400);
  }

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  return (
    <div>
      <AppHeader />
      <div className="max-w-[480px] mx-auto px-6 py-16">
        <Card className="p-8 text-center">
          {stage === 'redirect' && (
            <>
              <Loader2 className="w-9 h-9 text-teal mx-auto mb-4 animate-spin" />
              <h1 className="text-[20px] font-bold mb-2">Ödəniş səhifəsinə yönləndirilirsiniz</h1>
              <p className="text-[13.5px] text-text2">Pəncərəni bağlamayın.</p>
              <button
                className="text-[11.5px] text-muted underline mt-8"
                onClick={() => {
                  if (started.current) return;
                  started.current = true;
                  triggerSimulation('fail');
                }}
              >
                (sınaq: ödənişi uğursuz et)
              </button>
            </>
          )}
          {stage === 'pending' && (
            <>
              <Loader2 className="w-9 h-9 text-teal mx-auto mb-4 animate-spin" />
              <h1 className="text-[20px] font-bold mb-2">Ödəniş yoxlanılır</h1>
              <p className="text-[13.5px] text-text2">Ödəniş məlumatları təsdiqlənir.</p>
            </>
          )}
          {stage === 'success' && order && (
            <>
              <CheckCircle2 className="w-11 h-11 text-success mx-auto mb-4" />
              <h1 className="text-[21px] font-bold mb-2">Ödəniş uğurla tamamlandı</h1>
              <p className="text-[13.5px] text-text2 mb-5">Paketiniz aktivləşdirildi.</p>
              <div className="border border-border rounded-rc p-4 mb-6 text-left text-[13.5px] grid gap-1.5">
                <div className="flex justify-between"><span className="text-text2">Paket</span><span className="font-semibold">Paket {order.package}</span></div>
                <div className="flex justify-between"><span className="text-text2">Məbləğ</span><span className="font-semibold">{order.amountUsd.toFixed(2)} USD</span></div>
                <div className="flex justify-between"><span className="text-text2">Status</span><span className="font-semibold text-success">Ödənilib</span></div>
              </div>
              <Button className="w-full" onClick={() => navigate(`/workspace/${order.analysisId}/report`)}>
                Nəticələrə bax
              </Button>
            </>
          )}
          {stage === 'failed' && order && (
            <>
              <XCircle className="w-11 h-11 text-danger mx-auto mb-4" />
              <h1 className="text-[21px] font-bold mb-2">Ödəniş tamamlanmadı</h1>
              <p className="text-[13.5px] text-text2 mb-6">Kartdan ödəniş alınmadı və ya əməliyyat yarımçıq qaldı.</p>
              <div className="grid gap-2.5">
                <Button onClick={() => navigate(`/checkout/${order.analysisId}/${order.package}`)}>Yenidən cəhd et</Button>
                <Button variant="secondary" onClick={() => navigate(`/results/${order.analysisId}`)}>Nəticələrə qayıt</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
