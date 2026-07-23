import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { TimeSeriesChart } from '../../components/superadmin/Charts';
import { LoadingBlock, ErrorBlock } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchTraffic } from '../../lib/superadminApi';

function BreakdownList({ title, rows, missing }: { title: string; rows?: { key: string; count: number }[]; missing?: boolean }) {
  const total = rows?.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="border border-border rounded-rl p-4">
      <h3 className="font-semibold text-[13px] text-navy mb-3">{title}</h3>
      {missing && <p className="text-[12px] text-muted">İnstrumentasiya tələb olunur</p>}
      {!missing && (!rows || rows.length === 0) && <p className="text-[12px] text-muted">Bu dövr üçün məlumat yoxdur</p>}
      {!missing && rows && rows.length > 0 && (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex justify-between text-[12.5px] mb-1">
                <span className="text-text2">{r.key}</span>
                <span className="font-semibold text-navy font-tab">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg2 overflow-hidden">
                <div className="h-full bg-traffic rounded-full" style={{ width: `${(r.count / total) * 100}%`, background: '#3B6FB5' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperadminTraffic() {
  const { range, compare, from, to } = useSuperadminFilters();
  const params = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchTraffic(params), [range, compare, from, to]);

  return (
    <SuperadminShell title="Trafik" subtitle="Ziyarətçilər, mənbələr və cihazlar." lastRefreshedAt={lastRefreshedAt} refreshing={loading} onRefresh={refresh}>
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard label="Unikal ziyarətçi" metric={data.kpis.uniqueVisitors} />
            <KpiCard label="Sessiyalar" metric={data.kpis.sessions} tooltip="30 dəqiqəlik hərəkətsizlik pəncərəsi ilə müəyyən edilir." />
            <KpiCard label="Orta sessiya müddəti" metric={data.kpis.avgSessionDuration} tooltip="Hələ instrumentasiya edilməyib." />
            <KpiCard label="Yeni ziyarətçi %" metric={data.kpis.newVisitorPct} tooltip="Bu dövrdən əvvəl heç bir hadisəsi olmayan ziyarətçilər." />
          </KpiGrid>

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Ziyarətçi trendi</h2>
            <TimeSeriesChart series={data.visitorTrend} color="#3B6FB5" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <BreakdownList title="Əldəetmə mənbəyi" rows={data.acquisition} />
            <BreakdownList title="Yönləndirici domenlər" rows={data.referrerDomains} />
            <BreakdownList title="Giriş səhifələri" rows={data.landingPages} />
            <BreakdownList title="Cihaz" rows={data.device} />
            <BreakdownList title="Dil" rows={data.language} />
            <BreakdownList title="UTM mənbəyi" rows={data.utmSource} />
            <BreakdownList title="Brauzer" missing />
            <BreakdownList title="Əməliyyat sistemi" missing />
            <BreakdownList title="Region" missing />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
