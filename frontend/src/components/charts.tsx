import { Fragment, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { localizeCategoryName } from '../lib/categoryLabel';
import { StatusDot, type CoverageStatus } from './StatusDot';
import { useReducedMotion } from '../lib/useReducedMotion';
import type { ApplicationReadiness } from '../lib/readiness';

function toneColor(pct: number): string {
  if (pct >= 70) return '#0F9D91';
  if (pct >= 45) return '#C97800';
  return '#CF3F4F';
}

// Deliberately shows the score ONLY — no label text inside the ring. An earlier version rendered an
// optional `label` string inside this same fixed-size circle via absolute positioning, which
// overlapped/clipped the ring for longer AZ/EN compatibility labels (and at small viewport widths).
// Any supporting label now belongs in the surrounding layout, not inside the chart.
export function RadialGauge({
  value,
  size = 132,
  stroke = 12,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const ringColor = color || toneColor(clamped);
  const reducedMotion = useReducedMotion();

  // Controlled reveal: the ring sweeps in from 0 exactly once, the first time a real value
  // mounts — never replayed on ordinary re-renders. If `value` changes later (a live update),
  // the ring transitions smoothly from its current position, not back to 0. The percentage LABEL
  // always shows the true, final `clamped` value directly (never the mid-sweep ring position), so
  // the number on screen can never read as a different score than the real one, even mid-animation.
  const mountedRef = useRef(false);
  const [ringValue, setRingValue] = useState(reducedMotion ? clamped : 0);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (reducedMotion) {
        setRingValue(clamped);
        return;
      }
      // One extra frame so the browser paints the 0-state first — a transition needs a "from"
      // value to animate from, which an instant same-frame update wouldn't provide.
      const raf = requestAnimationFrame(() => setRingValue(clamped));
      return () => cancelAnimationFrame(raf);
    }
    setRingValue(clamped);
  }, [clamped, reducedMotion]);

  const dash = (ringValue / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center flex-none drop-shadow-[0_6px_14px_rgba(16,42,67,0.08)]" style={{ width: size, height: size }}>
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
          style={{ transition: 'stroke-dasharray var(--motion-sequence) var(--ease-standard)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-semibold tabular-nums text-navy leading-none" style={{ fontSize: size * 0.2 }}>
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
}

export function CategoryBarChart({ data }: { data: { category: string; score: number }[] }) {
  const { lang } = useLanguage();
  const palette = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)'];
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={d.category}>
          <div className="flex justify-between text-[13.5px] mb-1">
            <span className="font-medium text-text">{localizeCategoryName(d.category, lang)}</span>
            <span className="font-bold text-navy tabular-nums">{d.score}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-bg2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${d.score}%`, background: palette[i % palette.length], transition: 'width .5s ease' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Segmented stat bar (shared primitive) ----------
// One generic "N items across K labeled buckets" bar + accessible text legend, reused for
// requirement coverage, evidence coverage, CV Change Plan summary, and Interview Prep summary —
// every caller supplies already-real, already-computed counts (never hardcoded here) and
// already-localized labels, so the component itself carries no copy or backend assumptions.

export interface StatSegment {
  key: string;
  value: number;
  label: string;
  colorClass: string;
}

export function SegmentedStatBar({ segments }: { segments: StatSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-bg2"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {visible.map((s) => (
          <div key={s.key} className={s.colorClass} style={{ width: `${(s.value / total) * 100}%`, transition: 'width .5s ease' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-[12.5px] text-text2">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <i className={clsx('h-2.5 w-2.5 rounded-full inline-block flex-none', s.colorClass)} aria-hidden="true" />
            {s.label}: <span className="font-semibold text-navy tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface CoverageLabels {
  met: string;
  partial: string;
  missing: string;
  unknown: string;
}

/** Requirement coverage: 3-state on the free Results page (met/partial/missing, from the
 * already-bucketed summary counts), 4-state on the paid Report tab (adds `unknown` = the real
 * `insufficient_info` status, only visible once the full requirements[] array is available). */
export function RequirementCoverageBar({
  met,
  partial,
  missing,
  unknown = 0,
  labels,
}: {
  met: number;
  partial: number;
  missing: number;
  unknown?: number;
  labels: CoverageLabels;
}) {
  const segments: StatSegment[] = [
    { key: 'met', value: met, label: labels.met, colorClass: 'bg-success' },
    { key: 'partial', value: partial, label: labels.partial, colorClass: 'bg-warning' },
    { key: 'missing', value: missing, label: labels.missing, colorClass: 'bg-danger' },
  ];
  if (unknown > 0) segments.push({ key: 'unknown', value: unknown, label: labels.unknown, colorClass: 'bg-muted' });
  return <SegmentedStatBar segments={segments} />;
}

// ---------- Application Readiness gauge ----------

const READINESS_ORDER: ApplicationReadiness[] = ['not_ready', 'needs_improvement', 'nearly_ready', 'ready'];
const READINESS_COLOR: Record<ApplicationReadiness, string> = {
  not_ready: 'bg-danger',
  needs_improvement: 'bg-warning',
  nearly_ready: 'bg-accent',
  ready: 'bg-success',
};

/** A 4-zone status bar (not a literal needle gauge — deliberately avoids SVG arc-angle math in
 * favor of a CSS-grid layout that can't misalign) with a marker over the current zone. Zone names
 * and the current status label always render as real text alongside the bar, never color-only. */
export function ReadinessGauge({
  status,
  zoneLabels,
  statusLabel,
  description,
}: {
  status: ApplicationReadiness;
  zoneLabels: [string, string, string, string];
  statusLabel: string;
  description?: string;
}) {
  const activeIndex = READINESS_ORDER.indexOf(status);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {READINESS_ORDER.map((zone, i) => (
          <div key={zone} className="flex flex-col items-center">
            <div
              className={clsx(
                'w-0 h-0 border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent border-b-[6px] mb-1',
                i === activeIndex ? 'border-b-navy' : 'border-b-transparent',
              )}
              aria-hidden="true"
            />
            <div className={clsx('h-3 w-full rounded-full', READINESS_COLOR[zone], i === activeIndex ? '' : 'opacity-25')} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        {zoneLabels.map((label, i) => (
          <div key={label} className={clsx('text-[10.5px] text-center leading-tight', i === activeIndex ? 'text-navy font-bold' : 'text-muted')}>
            {label}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="font-display font-semibold text-[19px] text-navy leading-tight">{statusLabel}</div>
        {description && <p className="text-[13px] text-text2 mt-1 leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}

// ---------- Requirement importance matrix ----------

export interface MatrixRequirement {
  title: string;
  importance: 'kritik' | 'əsas' | 'üstünlük';
  status: CoverageStatus;
}

const IMPORTANCE_ORDER = ['kritik', 'əsas', 'üstünlük'] as const;
const STATUS_ORDER: CoverageStatus[] = ['missing', 'partial', 'met', 'insufficient_info'];

/** Importance × match-level matrix — one responsive component, not two chart implementations:
 * a true grid (importance rows × status columns) from md: up, the identical data reflowed into
 * grouped stacked lists below md:. Every requirement's full title is always visible — no
 * truncation, no hover-only tooltip, no collapsed "+N" count — cells and rows grow to fit their
 * content instead of clipping it, since the whole point of this view is reading the actual
 * requirement text. */
export function ImportanceMatrix({
  requirements,
  importanceLabels,
  statusLabels,
}: {
  requirements: MatrixRequirement[];
  importanceLabels: Record<'kritik' | 'əsas' | 'üstünlük', string>;
  statusLabels: Record<CoverageStatus, string>;
}) {
  return (
    <div>
      <div className="hidden md:grid gap-2 grid-cols-[110px_repeat(4,1fr)] items-start">
        <div />
        {STATUS_ORDER.map((s) => (
          <div key={s} className="text-[11px] font-bold text-text2 text-center pb-2 uppercase tracking-wide">
            {statusLabels[s]}
          </div>
        ))}
        {IMPORTANCE_ORDER.map((imp) => (
          <Fragment key={imp}>
            <div className="text-[12.5px] font-bold text-navy pt-2.5 pr-2">{importanceLabels[imp]}</div>
            {STATUS_ORDER.map((s) => {
              const cell = requirements.filter((r) => r.importance === imp && r.status === s);
              return (
                <div
                  key={s}
                  className="border border-border rounded-rk p-2.5"
                  aria-label={`${importanceLabels[imp]}, ${statusLabels[s]}`}
                >
                  {cell.length === 0 ? (
                    <span className="text-[11px] text-muted">—</span>
                  ) : (
                    <ul className="grid gap-1.5">
                      {cell.map((r, i) => (
                        <li key={i} className="flex gap-1.5 items-start text-[12px] text-text2 leading-relaxed">
                          <span className="text-muted flex-none mt-0.5" aria-hidden="true">•</span>
                          <span className="break-words">{r.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="md:hidden grid gap-4">
        {IMPORTANCE_ORDER.map((imp) => {
          const items = requirements.filter((r) => r.importance === imp);
          if (items.length === 0) return null;
          return (
            <div key={imp}>
              <div className="text-[12.5px] font-bold text-navy mb-2">{importanceLabels[imp]}</div>
              <div className="grid gap-1.5">
                {items.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12.5px] text-text2 border border-border rounded-rk px-2.5 py-2">
                    <span className="flex-none mt-0.5">
                      <StatusDot status={r.status} />
                    </span>
                    <span className="leading-relaxed break-words">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
