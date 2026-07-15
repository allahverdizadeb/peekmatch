import clsx from 'clsx';

function toneColor(pct: number): string {
  if (pct >= 70) return '#0F9D91';
  if (pct >= 45) return '#C97800';
  return '#CF3F4F';
}

export function RadialGauge({
  value,
  size = 132,
  stroke = 12,
  label,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  const ringColor = color || toneColor(clamped);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF3F7" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold text-navy leading-none">{Math.round(clamped)}%</span>
        {label && <span className="text-[11px] text-text2 mt-1 text-center px-2">{label}</span>}
      </div>
    </div>
  );
}

export function SegmentedRequirementBar({ met, partial, total }: { met: number; partial: number; missing: number; total: number }) {
  const segs = Array.from({ length: total }, (_, i) => {
    if (i < met) return 'success';
    if (i < met + partial) return 'warning';
    return 'danger';
  });
  const colorFor = { success: '#198754', warning: '#C97800', danger: '#CF3F4F' } as const;
  return (
    <div className="flex gap-1">
      {segs.map((s, i) => (
        <div key={i} className="h-2.5 flex-1 rounded-full" style={{ background: colorFor[s] }} />
      ))}
    </div>
  );
}

export function RequirementDistributionBar({ met, partial, missing }: { met: number; partial: number; missing: number }) {
  const total = met + partial + missing || 1;
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-full border border-border">
        <div style={{ width: `${(met / total) * 100}%`, background: '#198754' }} />
        <div style={{ width: `${(partial / total) * 100}%`, background: '#C97800' }} />
        <div style={{ width: `${(missing / total) * 100}%`, background: '#CF3F4F' }} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px] text-text2">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: '#198754' }} />Uyğundur: {met}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: '#C97800' }} />Qismən uyğundur: {partial}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: '#CF3F4F' }} />Uyğun deyil: {missing}</span>
      </div>
    </div>
  );
}

export function CategoryBarChart({ data }: { data: { category: string; score: number }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.category}>
          <div className="flex justify-between text-[13.5px] mb-1">
            <span className="font-medium text-text">{d.category}</span>
            <span className="font-bold text-navy">{d.score}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-bg2 overflow-hidden">
            <div
              className={clsx('h-full rounded-full')}
              style={{ width: `${d.score}%`, background: toneColor(d.score), transition: 'width .5s ease' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
