import { useState } from 'react';
import clsx from 'clsx';

export interface FunnelStageLike {
  key: string;
  label: string;
  count: number;
  stepConversionPct: number | null;
  topConversionPct: number | null;
  dropPct: number | null;
  worst: boolean;
}

export function TimeSeriesChart({
  series,
  comparisonSeries,
  unit,
  color = '#0F9D91',
}: {
  series: { bucket: string; value: number }[];
  comparisonSeries?: { bucket: string; value: number }[] | null;
  unit?: string;
  color?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!series || series.length === 0) {
    return <div className="h-56 flex items-center justify-center text-[13px] text-muted">Bu dövr üçün məlumat yoxdur</div>;
  }

  const w = 640;
  const h = 220;
  const padding = 24;
  const values = series.map((p) => p.value).concat(comparisonSeries?.map((p) => p.value) ?? []);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  function toPoints(pts: { value: number }[]) {
    return pts
      .map((p, i) => {
        const x = padding + (i / Math.max(1, pts.length - 1)) * (w - padding * 2);
        const y = h - padding - ((p.value - min) / range) * (h - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" onMouseLeave={() => setHoverIdx(null)} role="img" aria-label="Zaman seriyası qrafiki">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padding}
            x2={w - padding}
            y1={padding + t * (h - padding * 2)}
            y2={padding + t * (h - padding * 2)}
            stroke="var(--color-sa-grid)"
            strokeWidth={1}
          />
        ))}
        {comparisonSeries && comparisonSeries.length > 0 && (
          <polyline points={toPoints(comparisonSeries)} fill="none" stroke="var(--color-sa-compare)" strokeWidth={1.75} strokeDasharray="4 4" />
        )}
        <polyline points={toPoints(series)} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        {series.map((p, i) => {
          const x = padding + (i / Math.max(1, series.length - 1)) * (w - padding * 2);
          const y = h - padding - ((p.value - min) / range) * (h - padding * 2);
          return (
            <g key={i}>
              <rect x={x - 8} y={padding} width={16} height={h - padding * 2} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
              {hoverIdx === i && <circle cx={x} cy={y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />}
            </g>
          );
        })}
      </svg>
      <div className="text-[12px] text-text2 mt-1 h-5">
        {hoverIdx !== null && (
          <>
            <span className="font-semibold text-navy">{series[hoverIdx].bucket}</span>: {series[hoverIdx].value.toLocaleString('en-US')}
            {unit ? ` ${unit}` : ''}
            {comparisonSeries?.[hoverIdx] && <span className="text-muted"> · əvvəlki: {comparisonSeries[hoverIdx].value.toLocaleString('en-US')}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export function FunnelSteps({ stages }: { stages: FunnelStageLike[] }) {
  const top = stages[0]?.count || 1;
  return (
    <div className="grid gap-2.5">
      {stages.map((s) => (
        <div key={s.key} className={clsx('rounded-rk border p-3', s.worst ? 'border-danger/40 bg-danger-bg' : 'border-border')}>
          <div className="flex items-center justify-between text-[12.5px] mb-1.5">
            <span className="font-semibold text-navy">{s.label}</span>
            <span className="tabular-nums font-semibold text-navy font-tab">{s.count.toLocaleString('en-US')}</span>
          </div>
          <div className="h-2.5 rounded-full bg-bg2 overflow-hidden">
            <div className={clsx('h-full rounded-full', s.worst ? 'bg-danger' : 'bg-teal')} style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted mt-1">
            <span>{s.stepConversionPct !== null ? `Addımdan: ${s.stepConversionPct.toFixed(1)}%` : '—'}</span>
            <span className={s.worst ? 'text-danger font-semibold' : undefined}>{s.dropPct !== null ? `İtki: ${s.dropPct.toFixed(1)}%` : '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HourlyBars({ data, color = '#0F9D91', label }: { data: number[]; color?: string; label: string }) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-16">
        {data.map((v, h) => (
          <div
            key={h}
            className="flex-1 rounded-t-sm"
            style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: color, opacity: v > 0 ? 1 : 0.15 }}
            title={`${h}:00 — ${v}`}
          />
        ))}
      </div>
      <div className="text-[11px] text-muted mt-1">
        {label}: <span className="font-tab">{data.reduce((s, v) => s + v, 0).toLocaleString('en-US')}</span>
      </div>
    </div>
  );
}

export interface PackageMixLike {
  code: string;
  name: string;
  priceAzn: number;
  units: number;
  revenueAzn: number;
  orderSharePct: number;
  revenueSharePct: number;
}

export function PackagePerformance({ packages }: { packages: PackageMixLike[] }) {
  return (
    <div className="grid gap-3">
      {packages.map((p, i) => (
        <div key={p.code} className="border border-border rounded-rk p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-[13px] text-navy flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-none" style={{ background: i === 0 ? '#0F9D91' : '#6B57C9' }} /> {p.name}
            </span>
            <span className="text-[12px] text-muted font-tab">{p.priceAzn.toFixed(2)} AZN</span>
          </div>
          <div className="h-2 rounded-full bg-bg2 overflow-hidden mb-1.5">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, p.revenueSharePct)}%`, background: i === 0 ? '#0F9D91' : '#6B57C9' }} />
          </div>
          <div className="flex justify-between text-[11.5px] text-text2 tabular-nums font-tab">
            <span>{p.units} sifariş</span>
            <span>{p.revenueAzn.toFixed(2)} AZN</span>
            <span>{p.revenueSharePct.toFixed(1)}% gəlir payı</span>
          </div>
        </div>
      ))}
    </div>
  );
}
