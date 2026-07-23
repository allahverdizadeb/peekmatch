import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { TimeSeriesChart, FunnelSteps, HourlyBars, PackagePerformance } from '../../components/superadmin/Charts';
import { DataTable, StatusPill } from '../../components/superadmin/Table';
import { AlertCard, LoadingBlock, ErrorBlock, ProviderNotConnectedNote } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchOverview } from '../../lib/superadminApi';

const TREND_OPTIONS = [
  { value: 'revenue', label: 'Gəlir', color: '#B8860B' },
  { value: 'visitors', label: 'Ziyarətçilər', color: '#3B6FB5' },
  { value: 'analyses', label: 'Analizlər', color: '#0F9D91' },
  { value: 'paid_orders', label: 'Ödənişli sifarişlər', color: '#6B57C9' },
  { value: 'conversion', label: 'Konversiya', color: '#12876F' },
];

function qs(params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && k !== 'metric') usp.set(k, String(v));
  return usp.toString();
}

export default function SuperadminOverview() {
  const { range, compare, from, to } = useSuperadminFilters();
  const [trendMetric, setTrendMetric] = useState('revenue');
  const navigate = useNavigate();

  const baseParams = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(
    () => fetchOverview({ ...baseParams, metric: trendMetric }),
    [range, compare, from, to, trendMetric],
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <SuperadminShell title="Ümumi baxış" subtitle="Bu gün PeekMatch üzrə əsas biznes göstəriciləri." lastRefreshedAt={lastRefreshedAt} refreshing={loading} onRefresh={refresh}>
      {data && !data.financialDataAvailable && <ProviderNotConnectedNote />}
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard
              label="Unikal ziyarətçi"
              metric={data.kpis.uniqueVisitors}
              tooltip="Seçilmiş dövrdə fərqli anonim ziyarətçi sayı."
              linkTo={`/superadmin/traffic?${qs(baseParams)}`}
            />
            <KpiCard
              label="Tamamlanmış analiz"
              metric={data.kpis.completedAnalyses}
              tooltip="Uğurla tamamlanmış pulsuz analiz sayı."
              linkTo={`/superadmin/analysis?${qs(baseParams)}`}
            />
            <KpiCard
              label="Ödənişli sifariş"
              metric={data.kpis.paidOrders}
              tooltip="Real provayder vasitəsilə uğurla ödənilmiş sifariş sayı."
              linkTo={`/superadmin/sales?${qs(baseParams)}`}
            />
            <KpiCard label="Gəlir" metric={data.kpis.grossRevenue} tooltip="Uğurlu ödənişlərin cəmi (AZN)." linkTo={`/superadmin/sales?${qs(baseParams)}`} />
            <KpiCard
              label="Free→Paid konversiya"
              metric={data.kpis.freeToPaidConversion}
              tooltip="Uğurlu sifariş ÷ tamamlanmış pulsuz analiz."
              denominatorNote={`${data.kpis.freeToPaidConversion.numerator} / ${data.kpis.freeToPaidConversion.denominator}`}
              linkTo={`/superadmin/funnel?${qs(baseParams)}`}
            />
            <KpiCard label="ARPPU" metric={data.kpis.arppu} tooltip="Gəlir ÷ fərqli ödəniş edən anonim ziyarətçi sayı." />
          </KpiGrid>

          <div className="grid lg:grid-cols-[1.9fr_1fr] gap-5">
            <div className="border border-border rounded-rl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-semibold text-[14px] text-navy">Biznes trendi</h2>
                <div className="flex gap-1 bg-bg2 rounded-rk p-1 overflow-x-auto">
                  {TREND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTrendMetric(opt.value)}
                      className={`px-2.5 py-1 rounded-[7px] text-[11.5px] font-semibold whitespace-nowrap ${trendMetric === opt.value ? 'bg-white text-navy shadow-sh-sm' : 'text-text2'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <TimeSeriesChart series={data.trend.series} comparisonSeries={data.trend.comparisonSeries} color={TREND_OPTIONS.find((o) => o.value === trendMetric)?.color} />
            </div>
            <div className="border border-border rounded-rl p-4">
              <h2 className="font-semibold text-[14px] text-navy mb-3">Paket üzrə satış</h2>
              <PackagePerformance packages={data.packages} />
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
            <div className="border border-border rounded-rl p-4">
              <h2 className="font-semibold text-[14px] text-navy mb-3">Konversiya funneli</h2>
              <FunnelSteps stages={data.funnel} />
            </div>
            {data.hourly && (
              <div className="border border-border rounded-rl p-4 grid gap-4 content-start">
                <h2 className="font-semibold text-[14px] text-navy">Bu günün əməliyyat mənzərəsi</h2>
                <HourlyBars data={data.hourly.visitors} color="#3B6FB5" label="Ziyarətçilər" />
                <HourlyBars data={data.hourly.completedAnalyses} color="#0F9D91" label="Analizlər" />
                <HourlyBars data={data.hourly.payments} color="#6B57C9" label="Ödənişlər" />
              </div>
            )}
          </div>

          {data.alerts.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {data.alerts.map((a: { severity: 'negative' | 'warning' | 'positive'; title: string; body: string; link: string }, i: number) => (
                <AlertCard key={i} severity={a.severity} title={a.title} body={a.body} link={a.link} />
              ))}
            </div>
          )}

          <div className="border border-border rounded-rl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[14px] text-navy">Son satışlar</h2>
              <button onClick={() => navigate(`/superadmin/sales?${qs(baseParams)}`)} className="text-[12.5px] text-teal font-semibold">
                Hamısına bax
              </button>
            </div>
            <DataTable<any>
              columns={[
                { key: 'time', label: 'Vaxt', render: (r) => r.time },
                { key: 'package', label: 'Paket', render: (r) => r.packageName },
                { key: 'amount', label: 'Məbləğ', align: 'right', render: (r) => r.amountFormatted },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'analysis', label: 'Analiz', render: (r) => r.analysisRef },
              ]}
              rows={data.recentSales}
              emptyMessage="Bu dövrdə satış qeydə alınmayıb."
            />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
