import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button, Card } from './ui';
import { getAdminKey, setAdminKey, listSuggestions } from '../lib/adminApi';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function AdminGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [verified, setVerified] = useState(() => getAdminKey() !== null);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setChecking(true);
    setError('');
    try {
      await listSuggestions(input);
      setAdminKey(input);
      setVerified(true);
    } catch {
      setError(t.admin.gateError);
    } finally {
      setChecking(false);
    }
  }

  if (verified) return <>{children}</>;

  return (
    <div className="max-w-[400px] mx-auto px-6 py-24">
      <Card className="p-7 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bg2 text-muted flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-[18px] font-bold mb-4">{t.admin.gateTitle}</h1>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t.admin.gatePlaceholder}
          className="w-full border border-border rounded-rk px-3.5 py-2.5 text-[14px] focus-ring mb-3"
        />
        {error && <p className="text-[13px] text-danger mb-3">{error}</p>}
        <Button className="w-full" loading={checking} disabled={!input} onClick={submit}>
          {t.admin.gateSubmit}
        </Button>
      </Card>
    </div>
  );
}
