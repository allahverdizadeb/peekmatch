import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Upload, FileSearch, ListChecks, Target, BarChart3, Sparkles, ShieldCheck } from 'lucide-react';
import { MarketingHeader, Footer } from '../components/MarketingChrome';
import { Button } from '../components/ui';
import { getStatus, startAnalysis } from '../lib/api';

const STAGES = [
  { icon: Upload, label: 'CV yüklənir' },
  { icon: FileSearch, label: 'CV məlumatları oxunur' },
  { icon: ListChecks, label: 'Vakansiyanın əsas tələbləri müəyyən edilir' },
  { icon: Target, label: 'CV-də uyğun sübutlar tapılır' },
  { icon: BarChart3, label: 'Uyğunluq hesablanır' },
  { icon: Sparkles, label: 'Nəticə hazırlanır' },
];

export default function Processing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    timer.current = setInterval(async () => {
      try {
        const s = await getStatus(id);
        setStage(s.procStage);
        if (s.status === 'done') {
          if (timer.current) clearInterval(timer.current);
          setTimeout(() => navigate(`/results/${id}`), 400);
        } else if (s.status === 'failed') {
          if (timer.current) clearInterval(timer.current);
          setFailed(s.failReason || 'Analiz tamamlanmadı.');
        }
      } catch {
        // keep polling
      }
    }, 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [id, navigate]);

  async function retry() {
    if (!id) return;
    setFailed(null);
    setStage(0);
    await startAnalysis(id);
  }

  return (
    <div>
      <MarketingHeader />
      <div className="max-w-[640px] mx-auto px-6 py-16">
        {failed ? (
          <div className="bg-surface border border-border rounded-rl shadow-sh p-8 text-center">
            <h1 className="text-[22px] font-bold mb-2">Analiz tamamlanmadı</h1>
            <p className="text-[14.5px] text-text2 mb-6">Fayllarınız saxlanılıb. Analizi yenidən başlada bilərsiniz.</p>
            <Button onClick={retry}>Yenidən cəhd et</Button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-rl shadow-sh p-8">
            <h1 className="text-[24px] font-bold mb-1.5 text-center">CV və vakansiya analiz edilir</h1>
            <p className="text-[14.5px] text-text2 mb-8 text-center">
              Bu proses sənədlərin ölçüsünə və vakansiyanın strukturuna görə dəyişə bilər.
            </p>
            <div className="grid gap-1">
              {STAGES.map((s, i) => {
                const idx = i + 1;
                const done = stage > idx || (stage === 6 && idx <= 6);
                const current = stage === idx;
                return (
                  <div key={s.label} className="flex items-center gap-3.5 py-2.5">
                    <span
                      className={
                        'w-8 h-8 rounded-full flex items-center justify-center flex-none border ' +
                        (done ? 'bg-success text-white border-success' : current ? 'bg-info-bg text-info border-info animate-pulse' : 'bg-bg2 text-muted border-border')
                      }
                    >
                      {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                    </span>
                    <span className={'text-[14.5px] ' + (done || current ? 'text-navy font-medium' : 'text-muted')}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-7 flex items-center gap-2 justify-center text-[12.5px] text-text2">
              <ShieldCheck className="w-4 h-4 text-teal" />
              Faylınız yalnız bu analiz üçün istifadə olunur.
            </div>
            <div className="text-center mt-4">
              <button className="text-[13px] text-muted hover:text-danger" onClick={() => navigate('/')}>
                Analizi dayandır
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
