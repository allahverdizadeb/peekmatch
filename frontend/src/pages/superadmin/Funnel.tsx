import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { FunnelSteps } from '../../components/superadmin/Charts';
import { LoadingBlock, ErrorBlock, InsightCard } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchFunnel } from '../../lib/superadminApi';

export default function SuperadminFunnel() {
  const { range, compare, from, to } = useSuperadminFilters();
  const params = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchFunnel(params), [range, compare, from, to]);

  return (
    <SuperadminShell title="Funnel" subtitle="Ən böyük itki nöqtəsini tapın." lastRefreshedAt={lastRefreshedAt} refreshing={loading} onRefresh={refresh}>
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard label="Ümumi konversiya" metric={data.kpis.overallConversion} tooltip="Uğurlu ödəniş ÷ unikal ziyarətçi." />
            <KpiCard
              label="Ən böyük itki"
              metric={{
                value: data.kpis.biggestDropStage?.dropPct ?? null,
                formatted: data.kpis.biggestDropStage ? `${data.kpis.biggestDropStage.dropPct.toFixed(1)}%` : '—',
                missing: !data.kpis.biggestDropStage,
              }}
              tooltip={data.kpis.biggestDropStage ? data.kpis.biggestDropStage.label : undefined}
            />
            <KpiCard label="Analiz tamamlanma" metric={data.kpis.completionRate} tooltip="Tamamlanmış ÷ başlamış analiz." />
            <KpiCard label="Checkout konversiya" metric={data.kpis.checkoutConversion} tooltip="Uğurlu ödəniş ÷ checkout başlama." />
          </KpiGrid>

          {data.biggestDrop && (
            <InsightCard kind="fakt" text={`Ən böyük itki nöqtəsi: "${data.biggestDrop.label}" mərhələsində ${data.biggestDrop.dropPct.toFixed(1)}% itki var.`} />
          )}

          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Tam funnel</h2>
            <FunnelSteps stages={data.stages} />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
