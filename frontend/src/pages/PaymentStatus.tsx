import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Button, Card } from '../components/ui';
import { getOrder, simulatePayment, type Order } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';

type Stage = 'redirect' | 'pending' | 'success' | 'failed';

export default function PaymentStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
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
              <h1 className="text-[20px] font-bold mb-2">{t.paymentStatus.redirectTitle}</h1>
              <p className="text-[13.5px] text-text2">{t.paymentStatus.redirectSubtitle}</p>
              <button
                className="text-[11.5px] text-muted underline mt-8"
                onClick={() => {
                  if (started.current) return;
                  started.current = true;
                  triggerSimulation('fail');
                }}
              >
                {t.paymentStatus.simulateFailLink}
              </button>
            </>
          )}
          {stage === 'pending' && (
            <>
              <Loader2 className="w-9 h-9 text-teal mx-auto mb-4 animate-spin" />
              <h1 className="text-[20px] font-bold mb-2">{t.paymentStatus.pendingTitle}</h1>
              <p className="text-[13.5px] text-text2">{t.paymentStatus.pendingSubtitle}</p>
            </>
          )}
          {stage === 'success' && order && (
            <>
              <CheckCircle2 className="w-11 h-11 text-success mx-auto mb-4" />
              <h1 className="text-[21px] font-bold mb-2">{t.paymentStatus.successTitle}</h1>
              <p className="text-[13.5px] text-text2 mb-5">{t.paymentStatus.successSubtitle}</p>
              <div className="border border-border rounded-rc p-4 mb-6 text-left text-[13.5px] grid gap-1.5">
                <div className="flex justify-between"><span className="text-text2">{t.paymentStatus.packageLabel}</span><span className="font-semibold">{t.paymentStatus.packageValuePrefix} {order.package}</span></div>
                <div className="flex justify-between"><span className="text-text2">{t.paymentStatus.amountLabel}</span><span className="font-semibold">{order.amountUsd.toFixed(2)} USD</span></div>
                <div className="flex justify-between"><span className="text-text2">{t.paymentStatus.statusLabel}</span><span className="font-semibold text-success">{t.paymentStatus.statusPaid}</span></div>
              </div>
              <Button className="w-full" onClick={() => navigate(`/workspace/${order.analysisId}/report`)}>
                {t.paymentStatus.viewResults}
              </Button>
            </>
          )}
          {stage === 'failed' && order && (
            <>
              <XCircle className="w-11 h-11 text-danger mx-auto mb-4" />
              <h1 className="text-[21px] font-bold mb-2">{t.paymentStatus.failedTitle}</h1>
              <p className="text-[13.5px] text-text2 mb-6">{t.paymentStatus.failedSubtitle}</p>
              <div className="grid gap-2.5">
                <Button onClick={() => navigate(`/checkout/${order.analysisId}/${order.package}`)}>{t.paymentStatus.retryCta}</Button>
                <Button variant="secondary" onClick={() => navigate(`/results/${order.analysisId}`)}>{t.paymentStatus.backToResults}</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
