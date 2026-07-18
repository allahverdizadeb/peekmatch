import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BarChart3 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { AdminGate } from '../components/AdminGate';
import { Button, Badge, Card } from '../components/ui';
import { getAdminKey, listSuggestions, type Suggestion } from '../lib/adminApi';
import { classifySuggestion } from '../lib/suggestionClassifier';
import { useLanguage } from '../lib/i18n/LanguageContext';

const CAT_TONE: Record<string, 'info' | 'warning' | 'premium' | 'neutral'> = {
  Funksionallıq: 'info',
  Qiymət: 'warning',
  Dizayn: 'premium',
  Digər: 'neutral',
};
const SENT_TONE: Record<string, 'success' | 'danger' | 'neutral'> = { Konstruktiv: 'success', Mənfi: 'danger', Neytral: 'neutral' };
const PRI_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = { Yüksək: 'danger', Orta: 'warning', Aşağı: 'neutral' };

export default function Admin() {
  return (
    <AdminGate>
      <AdminContent />
    </AdminGate>
  );
}

function AdminContent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [classified, setClassified] = useState(false);

  useEffect(() => {
    const key = getAdminKey();
    if (key) listSuggestions(key).then(setList).catch(() => {});
  }, []);

  if (!list) {
    return (
      <div>
        <AppHeader />
        <div className="max-w-[900px] mx-auto px-6 py-20 text-center text-text2">{t.common.loading}</div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader />
      <div className="max-w-[900px] mx-auto px-6 py-9">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1.5">
          <h1 className="text-[24px] font-bold">{t.admin.title}</h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/insights')}>
              <BarChart3 className="w-4 h-4" />
              {t.admin.viewInsights}
            </Button>
            <Button variant="premium" size="sm" onClick={() => setClassified(true)}>
              <Sparkles className="w-4 h-4" />
              {t.admin.classifyCta}
            </Button>
          </div>
        </div>
        <p className="text-[13.5px] text-text2 mb-6">
          {t.admin.totalLabel}: {list.length} · {t.admin.teamOnlyNote}
        </p>

        <div className="grid gap-3">
          {list.length === 0 && <p className="text-[14px] text-text2">{t.admin.empty}</p>}
          {list.map((sg) => {
            const c = classified ? classifySuggestion(sg) : null;
            return (
              <Card key={sg.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge tone={CAT_TONE[sg.category] || 'neutral'}>{sg.category}</Badge>
                  <span className="ml-auto text-[12px] text-muted">{new Date(sg.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[14.5px] leading-relaxed mb-1.5">{sg.text}</p>
                <p className="text-[12px] text-muted">{sg.email}</p>
                {c && (
                  <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-dashed border-border">
                    <span className="text-[11px] font-extrabold tracking-wide text-premium">AI:</span>
                    <Badge tone="premium">{c.theme}</Badge>
                    <Badge tone={SENT_TONE[c.sentiment]}>{c.sentiment}</Badge>
                    <Badge tone={PRI_TONE[c.priority]}>
                      {t.admin.priorityLabel}: {c.priority}
                    </Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
