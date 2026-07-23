import type { ReactNode } from 'react';
import clsx from 'clsx';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Uğurlu', cls: 'text-success bg-success-bg' },
  failed: { label: 'Uğursuz', cls: 'text-danger bg-danger-bg' },
  pending: { label: 'Gözləyir', cls: 'text-warning bg-warning-bg' },
  processing: { label: 'Gözləyir', cls: 'text-warning bg-warning-bg' },
  refunded: { label: 'Qaytarılıb', cls: 'text-premium bg-premium-bg' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'text-muted bg-bg2' };
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap', s.cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current flex-none" aria-hidden="true" />
      {s.label}
    </span>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  onRowClick,
  emptyMessage,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-rk py-10 text-center text-[13px] text-muted">
        {emptyMessage ?? 'Bu dövr üçün məlumat yoxdur.'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-border rounded-rl">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-bg2 text-[11px] uppercase tracking-wide text-text2">
            {columns.map((c) => (
              <th key={c.key} className={clsx('px-3 py-2.5 font-bold whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={clsx('border-t border-border', onRowClick && 'cursor-pointer hover:bg-bg2')} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-3 py-2.5 tabular-nums whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-[12.5px] text-text2">
      <span>Cəmi {total.toLocaleString('en-US')}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-2.5 py-1 border border-border rounded-rk disabled:opacity-40">
          Geri
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-2.5 py-1 border border-border rounded-rk disabled:opacity-40">
          İrəli
        </button>
      </div>
    </div>
  );
}
