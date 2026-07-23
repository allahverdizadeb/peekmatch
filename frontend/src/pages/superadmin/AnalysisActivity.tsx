import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { LoadingBlock, ErrorBlock } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchAnalysisActivity } from '../../lib/superadminApi';

function BreakdownList({ title, rows, keyLabel }: { title: string; rows: { count: number; [k: string]: unknown }[]; keyLabel: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="border border-border rounded-rl p-4">
      <h3 className="font-semibold text-[13px] text-navy mb-3">{title}</h3>
      {rows.length === 0 && <p className="text-[12px] text-muted">Bu dövr üçün məlumat yoxdur</p>}
      <div className="grid gap-2">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex justify-between text-[12.5px] mb-1">
              <span className="text-text2">{String(r[keyLabel] ?? 'unknown')}</span>
              <span className="font-semibold text-navy font-tab">{r.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-bg2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.count / total) * 100}%`, background: '#0F9D91' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperadminAnalysisActivity() {
  const { range, compare, from, to } = useSuperadminFilters();
  const params = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchAnalysisActivity(params), [range, compare, from, to]);

  return (
    <SuperadminShell title="Analizlər" subtitle="Məhsul istifadəsi və emal etibarlılığı." lastRefreshedAt={lastRefreshedAt} refreshing={loading} onRefresh={refresh}>
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard label="Analiz başladı" metric={data.kpis.started} />
            <KpiCard label="Tamamlandı" metric={data.kpis.completed} />
            <KpiCard label="Tamamlanma %" metric={data.kpis.completionRate} />
            <KpiCard label="Orta emal vaxtı" metric={data.kpis.avgProcessing} />
            <KpiCard label="Median emal vaxtı" metric={data.kpis.medianProcessing} />
            <KpiCard label="Uğursuz" metric={data.kpis.failed} />
          </KpiGrid>
          <KpiGrid>
            <KpiCard label="Uğursuzluq nisbəti" metric={data.kpis.failureRate} />
            <KpiCard label="Yenidən cəhd nisbəti" metric={data.kpis.retryRate} />
            <KpiCard label="Ödənişli nəticə baxışı" metric={data.kpis.paidResultViews} />
            <KpiCard label="Sessiya bərpası" metric={data.kpis.sessionRestorations} />
            <KpiCard label="Manual silinmə" metric={data.kpis.manualDeletions} />
            <KpiCard label="Vaxtı bitmiş" metric={data.kpis.expiredAnalyses} />
          </KpiGrid>

          <div className="grid md:grid-cols-2 gap-4">
            <BreakdownList title="Dil" rows={data.languageBreakdown} keyLabel="language" />
            <BreakdownList title="Fayl növü" rows={data.fileTypeBreakdown} keyLabel="fileType" />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
