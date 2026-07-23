import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SuperadminShell } from '../../components/superadmin/Shell';
import { KpiCard, KpiGrid } from '../../components/superadmin/Kpi';
import { DataTable, StatusPill, Pagination } from '../../components/superadmin/Table';
import { LoadingBlock, ErrorBlock, ProviderNotConnectedNote } from '../../components/superadmin/Feedback';
import { Drawer } from '../../components/superadmin/Drawer';
import { useSuperadminFilters } from '../../lib/useSuperadminFilters';
import { useAdminData } from '../../lib/useAdminData';
import { fetchPayments, fetchPaymentDetail, downloadCsv } from '../../lib/superadminApi';

export default function SuperadminPayments() {
  const { range, compare, from, to, queryString } = useSuperadminFilters();
  const { reference } = useParams<{ reference?: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const params = { range, compare, from, to, page, status: status || undefined };
  const { data, loading, error, refresh, lastRefreshedAt } = useAdminData(() => fetchPayments(params), [range, compare, from, to, page, status]);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!reference) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchPaymentDetail(reference)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [reference]);

  function openRow(row: { reference: string }) {
    navigate(`/superadmin/payments/${encodeURIComponent(row.reference)}${queryString ? `?${queryString}` : ''}`);
  }
  function closeDrawer() {
    navigate(`/superadmin/payments${queryString ? `?${queryString}` : ''}`);
  }

  return (
    <SuperadminShell
      title="Ödənişlər"
      subtitle="Ödəniş əməliyyatları və provayder sağlamlığı."
      lastRefreshedAt={lastRefreshedAt}
      refreshing={loading}
      onRefresh={refresh}
      onExport={() => downloadCsv('payments', { range, compare, from, to }, 'odenisler.csv')}
    >
      {data && !data.financialDataAvailable && <ProviderNotConnectedNote />}
      {error && <ErrorBlock message={error} onRetry={refresh} />}
      {!error && loading && !data && <LoadingBlock />}
      {data && (
        <div className="grid gap-5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold">
            <span className="text-text2">Provayder statusu:</span>
            <span
              className={
                data.provider.state === 'not_connected' ? 'text-warning' : data.provider.state === 'connected_healthy' ? 'text-success' : 'text-danger'
              }
            >
              {data.provider.label}
            </span>
          </div>
          <KpiGrid>
            <KpiCard label="Uğurlu" metric={data.kpis.succeeded} />
            <KpiCard label="Uğursuz" metric={data.kpis.failed} />
            <KpiCard label="Gözləyir" metric={data.kpis.pending} />
            <KpiCard label="Qaytarılıb" metric={data.kpis.refunded} />
            <KpiCard label="Ödəniş uğuru" metric={data.kpis.successRate} tooltip="Uğurlu ÷ (uğurlu + uğursuz)." />
            <KpiCard label="Ümumi məbləğ" metric={data.kpis.grossAmount} />
          </KpiGrid>
          <KpiGrid>
            <KpiCard label="Provayder komissiyası" metric={data.kpis.providerFees} tooltip="Yalnız real komissiya məlumatı olduqda göstərilir." />
            <KpiCard label="Net toplanmış" metric={data.kpis.netCollected} tooltip="Ümumi məbləğ − real komissiya." />
            <KpiCard label="Orta təsdiq vaxtı" metric={data.kpis.avgConfirmationTime} />
          </KpiGrid>

          <div className="border border-border rounded-rl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-semibold text-[14px] text-navy">Əməliyyatlar</h2>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="text-[12.5px] border border-border rounded-rk px-2.5 py-1.5"
              >
                <option value="">Bütün statuslar</option>
                <option value="paid">Uğurlu</option>
                <option value="failed">Uğursuz</option>
                <option value="pending">Gözləyir</option>
                <option value="refunded">Qaytarılıb</option>
              </select>
            </div>
            <DataTable<any>
              columns={[
                { key: 'time', label: 'Vaxt', render: (r) => r.time },
                { key: 'reference', label: 'Referans', render: (r) => r.maskedReference },
                { key: 'package', label: 'Paket', render: (r) => r.packageName },
                { key: 'amount', label: 'Məbləğ', align: 'right', render: (r) => r.amountFormatted },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'confirmed', label: 'Təsdiq vaxtı', render: (r) => r.confirmedAt ?? '—' },
              ]}
              rows={data.orders.rows}
              onRowClick={openRow}
              emptyMessage="Bu dövrdə real (Payriff) ödəniş qeydə alınmayıb."
            />
            <Pagination page={data.orders.page} pageSize={data.orders.pageSize} total={data.orders.total} onPageChange={setPage} />
          </div>
        </div>
      )}

      <Drawer open={Boolean(reference)} onClose={closeDrawer} title="Ödəniş təfərrüatı">
        {detailLoading && <LoadingBlock />}
        {!detailLoading && detail && (
          <div className="grid gap-4 text-[13px]">
            <div>
              <div className="text-[11px] text-muted mb-0.5">Referans</div>
              <div className="font-tab font-semibold text-navy">{detail.reference}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-muted mb-0.5">Paket</div>
                <div className="font-semibold text-navy">{detail.packageName}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted mb-0.5">Məbləğ</div>
                <div className="font-semibold text-navy font-tab">{detail.amountFormatted}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted mb-0.5">Status</div>
                <StatusPill status={detail.status} />
              </div>
              <div>
                <div className="text-[11px] text-muted mb-0.5">Provayder</div>
                <div className="font-semibold text-navy">{detail.provider}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted mb-1.5">Status tarixçəsi</div>
              <div className="grid gap-1.5">
                {detail.statusHistory.map((h: { status: string; at: string }, i: number) => (
                  <div key={i} className="flex justify-between text-[12.5px] border-b border-dashed border-border pb-1.5">
                    <span className="text-text2">{h.status}</span>
                    <span className="font-tab text-navy">{h.at}</span>
                  </div>
                ))}
              </div>
            </div>
            {detail.refundAmountFormatted && (
              <div>
                <div className="text-[11px] text-muted mb-0.5">Qaytarma məbləği</div>
                <div className="font-semibold text-navy font-tab">{detail.refundAmountFormatted}</div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-muted mb-0.5">Analiz istinadı (maskalanmış)</div>
              <div className="font-tab text-navy">{detail.analysisRef}</div>
            </div>
            <p className="text-[11px] text-muted leading-relaxed border-t border-dashed border-border pt-3">
              Bu görünüş yalnız işləmə üçün lazım olan maskalanmış metadata göstərir — tam kart məlumatı, CV və ya vakansiya mətni heç vaxt saxlanılmır.
            </p>
          </div>
        )}
      </Drawer>
    </SuperadminShell>
  );
}
