import { useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';
import { Button } from './ui';
import { submitSuggestion, type SuggestionCategory } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';

const CATEGORIES: SuggestionCategory[] = ['Funksionallıq', 'Dizayn', 'Qiymət', 'Digər'];
const MIN_CHARS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FeedbackWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SuggestionCategory>('Funksionallıq');
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = text.trim().length >= MIN_CHARS && EMAIL_RE.test(email.trim());

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitSuggestion(category, text.trim(), email.trim());
      setSent(true);
      setText('');
      setEmail('');
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1600);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-5 left-5 z-40">
      {open && (
        <div className="absolute bottom-[60px] left-0 w-[320px] bg-white border border-border rounded-rl shadow-sh-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold">{t.feedback.title}</h3>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          {sent ? (
            <p className="text-[13.5px] text-success font-medium py-4 text-center">{t.feedback.thanks}</p>
          ) : (
            <>
              <p className="text-[13px] text-text2 mb-3">{t.feedback.subtitle}</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={
                      'px-2.5 py-1 rounded-full text-[12px] font-semibold border ' +
                      (category === c ? 'border-navy bg-navy text-white' : 'border-border text-text2 bg-white')
                    }
                  >
                    {t.feedback.categories[c]}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.feedback.placeholder}
                className="w-full min-h-[90px] border border-border rounded-rk p-2.5 text-[13.5px] resize-y focus-ring mb-1"
              />
              <div className={'text-[11px] font-semibold mb-2 ' + (text.trim().length >= MIN_CHARS ? 'text-success' : 'text-muted')}>
                {t.analysisForm.minCharsPrefix} {MIN_CHARS} {t.analysisForm.minCharsUnit} · {text.trim().length} / {MIN_CHARS}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.feedback.emailPlaceholder}
                className="w-full border border-border rounded-rk px-2.5 py-2 text-[13.5px] focus-ring mb-1.5"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">{t.feedback.emailNote}</span>
                <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
                  {t.feedback.send}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-teal text-white font-semibold text-[13.5px] shadow-sh-lg hover:bg-teal-h focus-ring"
      >
        <MessageSquarePlus className="w-4 h-4" />
        {t.feedback.button}
      </button>
    </div>
  );
}
