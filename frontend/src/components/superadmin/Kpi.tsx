import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import clsx from 'clsx';

export interface MetricLike {
  value: number | null;
  formatted: string;
  delta?: { absolute: number; percent: number | null; direction: 'pos' | 'neg' | 'neu' } | null;
  missing?: boolean;
  trackingStatus?: string;
}

function DeltaPill({ delta }: { delta: MetricLike['delta'] }) {
  if (!delta) return null;
  const Icon = delta.direction === 'pos' ? ArrowUp : delta.direction === 'neg' ? ArrowDown : Minus;
  const cls = delta.direction === 'pos' ? 'text-success bg-success-bg' : delta.direction === 'neg' ? 'text-danger bg-danger-bg' : 'text-muted bg-bg2';
  const pctText =
    delta.percent === null ? '—' : `${delta.percent > 0 ? '+' : delta.percent < 0 ? '−' : ''}${Math.abs(Math.round(delta.percent * 10) / 10)}%`;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11.5px] font-bold px-2 py-0.5 rounded-full font-tab', cls)}>
      <Icon className="w-3 h-3" aria-hidden="true" /> {pctText}
    </span>
  );
}

export function Sparkline({ data, color = '#0F9D91' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({
  label,
  metric,
  tooltip,
  sparklineData,
  sparklineColor,
  linkTo,
  denominatorNote,
}: {
  label: string;
  metric: MetricLike;
  tooltip?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  linkTo?: string;
  denominatorNote?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  const content = (
    <div className="border border-border rounded-rl p-4 bg-surface lift h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12px] font-semibold text-text2">{label}</span>
        {tooltip && (
          <span className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              onFocus={() => setShowTip(true)}
              onBlur={() => setShowTip(false)}
              className="text-muted cursor-help focus-ring rounded"
              aria-label={tooltip}
            >
              <Info className="w-3 h-3" />
            </button>
            {showTip && (
              <span className="absolute z-20 left-0 top-5 w-56 bg-navy text-white text-[11.5px] leading-relaxed rounded-rk p-2.5 shadow-sh-lg">{tooltip}</span>
            )}
          </span>
        )}
      </div>
      <div className="font-display text-[26px] font-semibold text-navy tabular-nums leading-none mb-2 font-tab">{metric.formatted}</div>
      <div className="flex items-center gap-2 mt-auto flex-wrap">
        <DeltaPill delta={metric.delta} />
        {metric.missing && metric.trackingStatus && <span className="text-[11px] text-muted">{metric.trackingStatus}</span>}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparklineData} color={sparklineColor} />
        </div>
      )}
      {denominatorNote && <div className="text-[11px] text-muted mt-1.5">{denominatorNote}</div>}
    </div>
  );
  if (linkTo)
    return (
      <Link to={linkTo} className="block h-full">
        {content}
      </Link>
    );
  return content;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div>;
}
