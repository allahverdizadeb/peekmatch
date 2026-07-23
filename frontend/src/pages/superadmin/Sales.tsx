import { useState } from 'react';
import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { TimeSeriesChart, PackagePerformance } from '../../components/superadmin/Charts';
import { DataTable, StatusPill, Pagination } from '../../components/superadmin/Table';
import { LoadingBlock, ErrorBlock, ProviderNotConnectedNote } from '../../components/superadmin/Feedback';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchSales, downloadCsv } from '../../lib/superadminApi';

export default function SuperadminSales() {
  const { range, compare, from, to } = useSuperadminFilters();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [pkg, setPkg] = useState('');
  const params = { range, compare, from, to, page, status: status || undefined, package: pkg || undefined };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchSales(params), [range, compare, from, to, page, status, pkg]);

  return (
    <SuperadminShell
      title="Satışlar"
      subtitle="Gəlir və sifariş sağlamlığı."
      lastRefreshedAt={lastRefreshedAt}
      refreshing={loading}
      onRefresh={refresh}
      onExport={() => downloadCsv('sales', { range, compare, from, to }, 'satislar.csv')}
    >
      {data && !data.financialDataAvailable && <ProviderNotConnectedNote />}
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <KpiGrid>
            <KpiCard label="Ümumi gəlir" metric={data.kpis.grossRevenue} tooltip="Uğurlu ödənişlərin cəmi." />
            <KpiCard label="Ödənişli sifariş" metric={data.kpis.paidOrders} tooltip="Uğurlu sifariş sayı." />
            <KpiCard label="Orta sifariş dəyəri" metric={data.kpis.averageOrderValue} tooltip="Ümumi gəlir ÷ uğurlu sifariş sayı." />
            <KpiCard label="ARPPU" metric={data.kpis.arppu} tooltip="Gəlir ÷ fərqli ödəniş edən ziyarətçi." />
            <KpiCard label="Qaytarma nisbəti" metric={data.kpis.refundRate} tooltip="Qaytarılan məbləğ ÷ gəlir. Azalma müsbətdir." />
            <KpiCard
              label="Net toplanmış gəlir"
              metric={data.kpis.netCollectedRevenue}
              tooltip="Gəlir − qaytarmalar − real provayder komissiyası. Yalnız real komissiya məlumatı olduqda hesablanır, heç vaxt təxmin edilmir."
            />
          </KpiGrid>

          <div className="grid lg:grid-cols-[1.9fr_1fr] gap-5">
            <div className="border border-border rounded-rl p-4">
              <h2 className="font-semibold text-[14px] text-navy mb-3">Gəlir trendi</h2>
              <TimeSeriesChart series={data.revenueTrend} color="#B8860B" unit="AZN" />
            </div>
            <div className="border border-border rounded-rl p-4">
              <h2 className="font-semibold text-[14px] text-navy mb-3">Paket üzrə gəlir</h2>
              <PackagePerformance packages={data.revenueByPackage} />
            </div>
          </div>

          <div className="border border-border rounded-rl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-[14px] text-navy">Sifarişlər</h2>
              <div className="flex gap-2">
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="text-[12.5px] border border-border rounded-rk px-2.5 py-1.5">
                  <option value="">Bütün statuslar</option>
                  <option value="paid">Uğurlu</option>
                  <option value="failed">Uğursuz</option>
                  <option value="pending">Gözləyir</option>
                  <option value="refunded">Qaytarılıb</option>
                </select>
                <select value={pkg} onChange={(e) => { setPkg(e.target.value); setPage(1); }} className="text-[12.5px] border border-border rounded-rk px-2.5 py-1.5">
                  <option value="">Bütün paketlər</option>
                  <option value="1">Müraciət Paketi</option>
                  <option value="2">Müsahibəyə Hazır Paketi</option>
                </select>
              </div>
            </div>
            <DataTable<any>
              columns={[
                { key: 'time', label: 'Vaxt', render: (r) => r.time },
                { key: 'reference', label: 'Referans', render: (r) => r.maskedReference },
                { key: 'package', label: 'Paket', render: (r) => r.packageName },
                { key: 'amount', label: 'Məbləğ', align: 'right', render: (r) => r.amountFormatted },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'provider', label: 'Provayder', render: (r) => r.provider },
                { key: 'analysis', label: 'Analiz', render: (r) => r.analysisRef },
              ]}
              rows={data.orders.rows}
              emptyMessage="Bu dövrdə real (Payriff) satış qeydə alınmayıb."
            />
            <Pagination page={data.orders.page} pageSize={data.orders.pageSize} total={data.orders.total} onPageChange={setPage} />
          </div>
        </div>
      )}
    </SuperadminShell>
  );
}
