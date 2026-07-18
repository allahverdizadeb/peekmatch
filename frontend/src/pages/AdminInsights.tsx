import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { AdminGate } from '../components/AdminGate';
import { Button, Card } from '../components/ui';
import { getAdminKey, listSuggestions, type Suggestion } from '../lib/adminApi';
import { classifySuggestion, type Priority, type Sentiment, type Theme } from '../lib/suggestionClassifier';
import { useLanguage } from '../lib/i18n/LanguageContext';

export default function AdminInsights() {
  return (
    <AdminGate>
      <AdminInsightsContent />
    </AdminGate>
  );
}

function distribution<K extends string>(items: K[]): [K, number][] {
  const counts = new Map<K, number>();
  for (const k of items) counts.set(k, (counts.get(k) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function DistBar({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <div className="grid gap-2.5">
      {rows.map(([label, count]) => (
        <div key={label}>
          <div className="flex justify-between text-[13px] mb-1">
            <span className="font-medium">{label}</span>
            <span className="font-bold text-navy">{count}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-bg2 overflow-hidden">
            <div className="h-full rounded-full bg-teal" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminInsightsContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [list, setList] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    const key = getAdminKey();
    if (key) listSuggestions(key).then(setList).catch(() => {});
  }, []);

  const classifications = useMemo(() => (list || []).map(classifySuggestion), [list]);
  const themes = useMemo(() => distribution<Theme>(classifications.map((c) => c.theme)), [classifications]);
  const sentiments = useMemo(() => distribution<Sentiment>(classifications.map((c) => c.sentiment)), [classifications]);
  const priorities = useMemo(() => distribution<Priority>(classifications.map((c) => c.priority)), [classifications]);
  const categories = useMemo(() => distribution((list || []).map((s) => s.category)), [list]);

  if (!list) {
    return (
      <div>
        <AppHeader />
        <div className="max-w-[900px] mx-auto px-6 py-20 text-center text-text2">{t.common.loading}</div>
      </div>
    );
  }

  const total = list.length;
  const highPriority = classifications.filter((c) => c.priority === 'Yüksək').length;
  const featureRequests = classifications.filter((c) => c.theme === 'Yeni funksiya tələbi').length;
  const negative = classifications.filter((c) => c.sentiment === 'Mənfi').length;

  return (
    <div>
      <AppHeader />
      <div className="max-w-[900px] mx-auto px-6 py-9">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 text-[13px] font-semibold text-teal mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.admin.title}
        </button>
        <h1 className="text-[24px] font-bold mb-6">{t.admin.insightsTitle}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            [t.admin.kpiTotal, total],
            [t.admin.kpiHighPriority, highPriority],
            [t.admin.kpiFeatureRequests, featureRequests],
            [t.admin.kpiNegative, negative],
          ].map(([label, value]) => (
            <Card key={label as string} className="p-4 text-center">
              <div className="text-[22px] font-extrabold text-navy">{value}</div>
              <div className="text-[12px] text-text2">{label}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-5">
            <h2 className="text-[15px] font-bold mb-4">{t.admin.byTheme}</h2>
            {themes.length ? <DistBar rows={themes} total={total} /> : <p className="text-[13px] text-text2">{t.admin.empty}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-[15px] font-bold mb-4">{t.admin.bySentiment}</h2>
            {sentiments.length ? <DistBar rows={sentiments} total={total} /> : <p className="text-[13px] text-text2">{t.admin.empty}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-[15px] font-bold mb-4">{t.admin.byPriority}</h2>
            {priorities.length ? <DistBar rows={priorities} total={total} /> : <p className="text-[13px] text-text2">{t.admin.empty}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-[15px] font-bold mb-4">{t.admin.byCategory}</h2>
            {categories.length ? <DistBar rows={categories} total={total} /> : <p className="text-[13px] text-text2">{t.admin.empty}</p>}
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button variant="secondary" onClick={() => navigate('/admin')}>
            {t.admin.title}
          </Button>
        </div>
      </div>
    </div>
  );
}
