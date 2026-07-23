import { useState, type FormEvent } from 'react';
import { SuperadminShell } from '../../components/superadmin/Shell';
import { LoadingBlock, ErrorBlock } from '../../components/superadmin/Feedback';
import { useAdminData } from '../../lib/useAdminData';
import { fetchSettings, fetchSessions, fetchAudit, changePassword, revokeOtherSessions, SuperadminApiError } from '../../lib/superadminApi';
import { useSuperadminAuth } from '../../lib/superadminAuthContext';

function PasswordChangeForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 12) return setError('Yeni şifrə ən azı 12 simvol olmalıdır.');
    if (next !== confirm) return setError('Yeni şifrələr uyğun gəlmir.');
    setStatus('saving');
    try {
      await changePassword(current, next);
      setStatus('done');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof SuperadminApiError ? err.message : 'Şifrə dəyişdirilə bilmədi.');
      setStatus('idle');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 max-w-[360px]">
      <div>
        <label className="block text-[12px] font-semibold text-text2 mb-1">Mövcud şifrə</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required className="w-full border border-border rounded-rk px-3 py-2 text-[13.5px] focus-ring" />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-text2 mb-1">Yeni şifrə</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required className="w-full border border-border rounded-rk px-3 py-2 text-[13.5px] focus-ring" />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-text2 mb-1">Yeni şifrə (təkrar)</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full border border-border rounded-rk px-3 py-2 text-[13.5px] focus-ring" />
      </div>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      {status === 'done' && <p className="text-[12.5px] text-success">Şifrə uğurla dəyişdirildi. Digər sessiyalar bağlandı.</p>}
      <button type="submit" disabled={status === 'saving'} className="bg-teal text-white rounded-rk py-2.5 font-semibold text-[13.5px] disabled:bg-border">
        Şifrəni dəyiş
      </button>
    </form>
  );
}

function SessionsList() {
  const { data, loading, refresh } = useAdminData(() => fetchSessions(), []);
  const [revoking, setRevoking] = useState(false);

  async function doRevoke() {
    setRevoking(true);
    try {
      await revokeOtherSessions();
      await refresh();
    } finally {
      setRevoking(false);
    }
  }

  if (loading && !data) return <LoadingBlock />;
  return (
    <div className="grid gap-2.5">
      {data?.map((s: { id: string; createdAt: string; lastActivityAt: string; userAgentSummary: string | null; current: boolean }) => (
        <div key={s.id} className="border border-border rounded-rk p-3 flex items-center justify-between text-[12.5px]">
          <div>
            <div className="font-semibold text-navy">
              {s.userAgentSummary ?? 'Naməlum cihaz'} {s.current && <span className="text-teal">(bu sessiya)</span>}
            </div>
            <div className="text-muted">Son fəaliyyət: {new Date(s.lastActivityAt).toLocaleString('az-AZ')}</div>
          </div>
        </div>
      ))}
      <button onClick={doRevoke} disabled={revoking} className="text-danger font-semibold text-[12.5px] text-left underline w-fit">
        Digər bütün sessiyaları ləğv et
      </button>
    </div>
  );
}

function AuditLogTable() {
  const [page, setPage] = useState(1);
  const { data, loading } = useAdminData(() => fetchAudit(page), [page]);
  if (loading && !data) return <LoadingBlock />;
  return (
    <div className="grid gap-2">
      {data?.rows.map((r: { id: string; time: string; action: string; status: string; actorEmail: string | null; requestIdMasked: string | null }) => (
        <div key={r.id} className="flex items-center justify-between text-[12px] border-b border-dashed border-border pb-2">
          <span className="text-navy font-medium">{r.action}</span>
          <span className={r.status === 'success' ? 'text-success' : 'text-danger'}>{r.status}</span>
          <span className="text-muted font-tab">{r.time}</span>
        </div>
      ))}
      {data && data.rows.length === 0 && <p className="text-[12.5px] text-muted">Hələ audit qeydi yoxdur.</p>}
      {data && data.total > data.pageSize && (
        <div className="flex justify-end gap-2 mt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-[12px] px-2 py-1 border border-border rounded-rk disabled:opacity-40">
            Geri
          </button>
          <button
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((p) => p + 1)}
            className="text-[12px] px-2 py-1 border border-border rounded-rk disabled:opacity-40"
          >
            İrəli
          </button>
        </div>
      )}
    </div>
  );
}

export default function SuperadminSettings() {
  const { me } = useSuperadminAuth();
  const { data, loading, error, refresh } = useAdminData(() => fetchSettings(), []);

  return (
    <SuperadminShell title="Tənzimləmələr" subtitle="Hesab, təhlükəsizlik və audit jurnalı.">
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-6 max-w-[720px]">
          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Hesab</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[11px] text-muted">Email</div>
                <div className="font-semibold text-navy">{me?.email ?? data.email}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">Son giriş</div>
                <div className="font-semibold text-navy font-tab">{data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString('az-AZ') : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">Şifrə son dəyişdirilmə</div>
                <div className="font-semibold text-navy font-tab">{new Date(data.passwordChangedAt).toLocaleString('az-AZ')}</div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Şifrəni dəyiş</h2>
            <PasswordChangeForm />
          </div>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Aktiv sessiyalar</h2>
            <SessionsList />
          </div>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Audit jurnalı</h2>
            <AuditLogTable />
          </div>

          <div className="border border-border rounded-rl p-4 text-[12.5px] text-text2 leading-relaxed">
            <h2 className="font-semibold text-[14px] text-navy mb-2">Məlumat saxlama</h2>
            <p>{data.dataRetention.analyticsRetentionNote}</p>
            <p className="mt-1.5">Analiz məlumatları {data.dataRetention.analysisRetentionHours} saat ərzində, ödəniş girişi isə {data.dataRetention.entitlementWindowHours} saat aktivdir.</p>
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
