import { SuperadminShell } from '../../components/superadmin/Shell';
import { DataTable } from '../../components/superadmin/Table';
import { Badge } from '../../components/ui';
import { LoadingBlock, ErrorBlock, ProviderNotConnectedNote } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchPackages } from '../../lib/superadminApi';

interface PackageRow {
  code: string;
  name: string;
  priceAzn: number;
  sectionViews: number;
  selections: number;
  purchases: number;
  failedPayments: number;
  revenueAzn: number;
  revenueSharePct: number;
  orderSharePct: number;
  selectionToPurchase: { formatted: string };
  paymentSuccessRate: { formatted: string };
}

export default function SuperadminPackages() {
  const { range, compare, from, to } = useSuperadminFilters();
  const params = { range, compare, from, to };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchPackages(params), [range, compare, from, to]);

  return (
    <SuperadminShell title="Paketlər" subtitle="Hansı paketi önə çıxarmalı — hər etiket öz meyarı ilə." lastRefreshedAt={lastRefreshedAt} refreshing={loading} onRefresh={refresh}>
      {data && !data.financialDataAvailable && <ProviderNotConnectedNote />}
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          {data.labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.labels.map((l: { code: string; label: string; criterion: string }, i: number) => (
                <Badge key={i} tone="premium" icon={null}>
                  {data.packages.find((p: PackageRow) => p.code === l.code)?.name}: {l.label} ({l.criterion})
                </Badge>
              ))}
            </div>
          )}
          <div className="border border-border rounded-rl p-4">
            <h2 className="font-semibold text-[14px] text-navy mb-3">Paket müqayisəsi</h2>
            <DataTable<PackageRow>
              columns={[
                { key: 'name', label: 'Paket', render: (r) => r.name },
                { key: 'price', label: 'Qiymət', align: 'right', render: (r) => `${r.priceAzn.toFixed(2)} AZN` },
                { key: 'views', label: 'Baxış', align: 'right', render: (r) => r.sectionViews },
                { key: 'selections', label: 'Seçim', align: 'right', render: (r) => r.selections },
                { key: 'purchases', label: 'Satış', align: 'right', render: (r) => r.purchases },
                { key: 'revenue', label: 'Gəlir', align: 'right', render: (r) => `${r.revenueAzn.toFixed(2)} AZN` },
                { key: 'revenueShare', label: 'Gəlir payı', align: 'right', render: (r) => `${r.revenueSharePct.toFixed(1)}%` },
                { key: 'selToPurchase', label: 'Seçim→alış', align: 'right', render: (r) => r.selectionToPurchase.formatted },
                { key: 'successRate', label: 'Ödəniş uğuru', align: 'right', render: (r) => r.paymentSuccessRate.formatted },
                { key: 'failed', label: 'Uğursuz ödəniş', align: 'right', render: (r) => r.failedPayments },
              ]}
              rows={data.packages}
            />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
