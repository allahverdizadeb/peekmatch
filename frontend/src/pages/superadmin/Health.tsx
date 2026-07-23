import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { LoadingBlock, ErrorBlock } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchHealth } from '../../lib/superadminApi';

const STATE_LABEL: Record<string, { label: string; cls: string }> = {
  normal: { label: 'Normal', cls: 'text-success bg-success-bg' },
  warning: { label: 'Xəbərdarlıq', cls: 'text-warning bg-warning-bg' },
  problem: { label: 'Problem', cls: 'text-danger bg-danger-bg' },
  not_connected: { label: 'Qoşulmayıb', cls: 'text-muted bg-bg2' },
  no_data: { label: 'Məlumat yoxdur', cls: 'text-muted bg-bg2' },
};

export default function SuperadminHealth() {
  const { range, compare, from, to } = useSuperadminFilters();
  const params = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchHealth(params), [range, compare, from, to]);

  return (
    <SuperadminShell
      title="Sistem sağlamlığı"
      subtitle="Əməliyyat etibarlılığı — tam DevOps paneli deyil."
      lastRefreshedAt={lastRefreshedAt}
      refreshing={loading}
      onRefresh={refresh}
    >
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard label="API əlçatanlıq" metric={data.kpis.apiAvailability} />
            <KpiCard label="Emal uğuru" metric={data.kpis.processingSuccessRate} />
            <KpiCard label="Webhook sağlamlığı" metric={data.kpis.webhookHealth} />
            <KpiCard label="Növbədə iş" metric={data.kpis.queuedWork} />
          </KpiGrid>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Komponent statusu</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.components.map((c: { key: string; label: string; state: string }) => {
                const s = STATE_LABEL[c.state] ?? STATE_LABEL.no_data;
                return (
                  <div key={c.key} className="border border-border rounded-rk p-3 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-navy">{c.label}</span>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Təmizləmə işi</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <div className="text-[11px] text-muted">Son uğurlu işləmə</div>
                <div className="font-semibold text-navy font-tab">{data.cleanup.lastRunAt ?? '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">Silinmiş vaxtı bitmiş analiz</div>
                <div className="font-semibold text-navy font-tab">{data.cleanup.lastDeletedCount}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
