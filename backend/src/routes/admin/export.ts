import { Router } from 'express';
import { parseRangeOrRespond } from '../../lib/adminRoute.js';
import { getOrderRows, type OrderFilters } from '../../lib/adminMetrics.js';
import { toCsv } from '../../lib/csv.js';
import { formatBakuDateTime, type ResolvedRange } from '../../lib/dateRange.js';
import { recordAudit } from '../../lib/auditLog.js';
import { maskRequestId } from '../../lib/superadminAuth.js';
import { PACKAGES } from '../../lib/pricing.js';

export const exportRouter = Router();

const MAX_EXPORT_ROWS = 20_000;
const EXPORT_PAGE_SIZE = 500;

/** Pages through getOrderRows up to a safety cap — never loads an unbounded dataset into memory for
 * an export, even though this product's real table sizes are currently tiny. */
async function fetchAllOrderRows(range: ResolvedRange, filters: OrderFilters) {
  let page = 1;
  const all: Awaited<ReturnType<typeof getOrderRows>>['rows'] = [];
  for (;;) {
    const { rows, total } = await getOrderRows(range, { ...filters, page, pageSize: EXPORT_PAGE_SIZE });
    all.push(...rows);
    if (all.length >= total || all.length >= MAX_EXPORT_ROWS || rows.length === 0) break;
    page++;
  }
  return all;
}

function packageName(pkg: number): string {
  return PACKAGES[pkg as 1 | 2]?.name ?? String(pkg);
}

exportRouter.get('/sales.csv', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range } = parsed;
  const rows = await fetchAllOrderRows(range, {});
  const csv = toCsv(
    ['Vaxt', 'Referans', 'Paket', 'Məbləğ (AZN)', 'Status', 'Provayder'],
    rows.map((o) => [formatBakuDateTime(o.createdAt), o.publicReference ?? '', packageName(o.package), o.amountUsd.toFixed(2), o.status, o.provider ?? 'simulated']),
  );
  await recordAudit({
    action: 'sales_csv_exported',
    status: 'success',
    actorId: req.superadmin!.userId,
    requestIdHash: maskRequestId(req),
    metadata: { range: String(req.query.range ?? ''), rowCount: rows.length },
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="satislar.csv"');
  res.send(csv);
});

exportRouter.get('/payments.csv', async (req, res) => {
  const parsed = parseRangeOrRespond(req, res);
  if (!parsed) return;
  const { range } = parsed;
  const rows = await fetchAllOrderRows(range, {});
  const csv = toCsv(
    ['Vaxt', 'Referans', 'Paket', 'Məbləğ (AZN)', 'Status', 'Provayder', 'Təsdiq vaxtı'],
    rows.map((o) => [
      formatBakuDateTime(o.createdAt),
      o.publicReference ?? '',
      packageName(o.package),
      o.amountUsd.toFixed(2),
      o.status,
      o.provider ?? 'simulated',
      o.paidAt ? formatBakuDateTime(o.paidAt) : '',
    ]),
  );
  await recordAudit({
    action: 'payments_csv_exported',
    status: 'success',
    actorId: req.superadmin!.userId,
    requestIdHash: maskRequestId(req),
    metadata: { range: String(req.query.range ?? ''), rowCount: rows.length },
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="odenisler.csv"');
  res.send(csv);
});
