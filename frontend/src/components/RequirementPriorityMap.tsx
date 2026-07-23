import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import clsx from 'clsx';
import { Card, Badge } from './ui';
import { PriorityChip, type PriorityLevel } from './PriorityChip';
import { StatusDot, type CoverageStatus } from './StatusDot';
import { RequirementCoverageBar, ImportanceMatrix } from './charts';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { STAGGER, staggerDelay } from '../lib/motion';
import type { RequirementRow, EvidenceChainLink } from '../lib/api';

/** Replaces the old dense "Əhəmiyyət matrisi" (importance × status grid) as the *default* view on
 * the paid Report tab. The grid itself is correct but too abstract for a first read — this groups
 * every requirement into three plain-language buckets instead, each requirement rendered as a
 * card (never a spreadsheet row), with a short "why it matters" and one concrete next step. The
 * original grid survives, collapsed behind "Ətraflı uyğunluq xəritəsi" for anyone who wants it. */
export function RequirementPriorityMap({ requirements, chain }: { requirements: RequirementRow[]; chain: EvidenceChainLink[] | null }) {
  const { t } = useLanguage();
  const m = t.workspace.priorityMap;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const urgent = requirements.filter((r) => r.importance !== 'üstünlük' && r.status !== 'met');
  const strong = requirements.filter((r) => r.importance !== 'üstünlük' && r.status === 'met');
  const preferred = requirements.filter((r) => r.importance === 'üstünlük');

  const counts = {
    missing: requirements.filter((r) => r.status === 'missing').length,
    partial: requirements.filter((r) => r.status === 'partial').length,
    met: requirements.filter((r) => r.status === 'met').length,
    insufficient_info: requirements.filter((r) => r.status === 'insufficient_info').length,
  };

  function relatedChangeFor(title: string): string | null {
    return chain?.find((c) => c.requirement === title)?.relatedChangeSection ?? null;
  }

  return (
    <Card className="p-6">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-teal mb-2">{m.eyebrow}</div>
      <h2 className="text-[19px] font-bold mb-1.5">{m.title}</h2>
      <p className="text-[13px] text-text2 mb-5 max-w-[640px]">{m.subtitle}</p>

      <div className="mb-7">
        <RequirementCoverageBar
          met={counts.met}
          partial={counts.partial}
          missing={counts.missing}
          unknown={counts.insufficient_info}
          labels={{ met: m.statusLabel.met, partial: m.statusLabel.partial, missing: m.statusLabel.missing, unknown: m.statusLabel.insufficient_info }}
        />
      </div>

      <div className="grid gap-7">
        {urgent.length > 0 && (
          <RequirementGroup title={m.groupUrgentTitle} note={m.groupUrgentNote} tone="urgent" icon={AlertTriangle}>
            {urgent.map((r, i) => (
              <RequirementCard key={i} index={i} r={r} tone="urgent" relatedChange={relatedChangeFor(r.title)} />
            ))}
          </RequirementGroup>
        )}

        {strong.length > 0 && (
          <RequirementGroup title={m.groupStrongTitle} note={m.groupStrongNote} tone="strong" icon={CheckCircle2}>
            {strong.map((r, i) => (
              <RequirementCard key={i} index={i} r={r} tone="strong" relatedChange={null} />
            ))}
          </RequirementGroup>
        )}

        {preferred.length > 0 && (
          <RequirementGroup title={m.groupPreferredTitle} note={m.groupPreferredNote} tone="preferred" icon={Info}>
            {preferred.map((r, i) => (
              <RequirementCard key={i} index={i} r={r} tone="preferred" relatedChange={r.status !== 'met' ? relatedChangeFor(r.title) : null} />
            ))}
          </RequirementGroup>
        )}
      </div>

      <div className="mt-7 pt-6 border-t border-border">
        <button
          type="button"
          className="text-[13px] font-semibold text-teal hover:text-teal-h focus-ring rounded-rk transition-colors duration-[var(--motion-fast)]"
          aria-expanded={advancedOpen}
          aria-controls="advanced-match-map"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? '▾' : '▸'} {m.advancedToggleLabel}
        </button>
        {/* Margin must live on an inner div, not the grid item itself (`.motion-collapse > *`) —
         * a box's own margin isn't clipped by its own `overflow: hidden`, so margin placed directly
         * on the collapsing element still reserves visible space at 0 height. See Accordion.tsx for
         * the same fix applied to padding. */}
        <div
          id="advanced-match-map"
          className="motion-collapse"
          data-state={advancedOpen ? 'open' : 'closed'}
          aria-hidden={!advancedOpen}
          inert={!advancedOpen}
        >
          <div>
            <div className="mt-4">
              <p className="text-[12.5px] text-text2 mb-4">{m.advancedToggleSubtitle}</p>
              <ImportanceMatrix requirements={requirements} importanceLabels={t.workspace.importanceLabel} statusLabels={t.workspace.statusLabel} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const GROUP_TONE: Record<'urgent' | 'strong' | 'preferred', { border: string; iconBg: string; iconColor: string; titleColor: string }> = {
  urgent: { border: 'border-danger/30', iconBg: 'bg-danger-bg', iconColor: 'text-danger', titleColor: 'text-danger' },
  strong: { border: 'border-success/30', iconBg: 'bg-success-bg', iconColor: 'text-success', titleColor: 'text-success' },
  preferred: { border: 'border-border', iconBg: 'bg-bg2', iconColor: 'text-muted', titleColor: 'text-text2' },
};

function RequirementGroup({
  title,
  note,
  tone,
  icon: Icon,
  children,
}: {
  title: string;
  note: string;
  tone: 'urgent' | 'strong' | 'preferred';
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  const s = GROUP_TONE[tone];
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center flex-none', s.iconBg, s.iconColor)}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <h3 className={clsx('text-[15px] font-bold', s.titleColor)}>{title}</h3>
      </div>
      <p className="text-[12.5px] text-text2 mb-3 ml-[38px]">{note}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

const IMPORTANCE_TO_PRIORITY: Record<RequirementRow['importance'], PriorityLevel> = {
  kritik: 'kritik',
  əsas: 'əsas',
  üstünlük: 'üstünlük',
};

function RequirementCard({
  r,
  tone,
  relatedChange,
  index,
}: {
  r: RequirementRow;
  tone: 'urgent' | 'strong' | 'preferred';
  relatedChange: string | null;
  /** Position within its group — drives both the between-card stagger and, added on top of it,
   * the within-card reveal order (requirement -> status/priority -> evidence -> next step), so the
   * "relationship" reads as a short sequence rather than everything appearing at once. Fires once
   * on mount only (a CSS `animation`, not a `transition`) — never replays on later re-renders. */
  index: number;
}) {
  const { t } = useLanguage();
  const m = t.workspace.priorityMap;
  const s = GROUP_TONE[tone];
  const baseDelay = staggerDelay(index, STAGGER.cards);

  return (
    <div className={clsx('border rounded-rl p-4 grid gap-2.5 bg-surface motion-rise-in', s.border)} style={{ animationDelay: `${baseDelay}ms` }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <span className="font-semibold text-[14px] text-navy">{r.title}</span>
        <div className="flex items-center gap-1.5 flex-none flex-wrap justify-end motion-pop-in" style={{ animationDelay: `${baseDelay + 70}ms` }}>
          <PriorityChip level={IMPORTANCE_TO_PRIORITY[r.importance]} label={m.importanceLabel[r.importance]} />
          <Badge
            tone={r.status === 'met' ? 'success' : r.status === 'partial' ? 'warning' : r.status === 'insufficient_info' ? 'neutral' : 'danger'}
            icon={null}
          >
            <StatusDot status={r.status as CoverageStatus} className="w-3.5 h-3.5" />
            {m.statusLabel[r.status]}
          </Badge>
        </div>
      </div>

      {tone === 'strong' ? (
        r.evidence && (
          <div className="motion-rise-in" style={{ animationDelay: `${baseDelay + 130}ms` }}>
            <div className="text-[11px] font-semibold text-muted mb-0.5">{t.cvChangePlan.evidenceLabel}</div>
            <p className="text-[13px] text-text2 leading-relaxed">{r.evidence}</p>
          </div>
        )
      ) : (
        r.explanation && (
          <div className="motion-rise-in" style={{ animationDelay: `${baseDelay + 130}ms` }}>
            <div className="text-[11px] font-semibold text-muted mb-0.5">{m.whyItMattersLabel}</div>
            <p className="text-[13px] text-text2 leading-relaxed">{r.explanation}</p>
          </div>
        )
      )}

      {tone === 'urgent' && (
        <div className="bg-bg rounded-rk p-2.5 motion-rise-in" style={{ animationDelay: `${baseDelay + 190}ms` }}>
          <div className="text-[11px] font-semibold text-teal mb-0.5">{m.nextActionLabel}</div>
          <p className="text-[13px] text-navy leading-relaxed">
            {relatedChange ? (
              <>
                {m.relatedChangePrefix} <span className="font-semibold">"{relatedChange}"</span> {m.relatedChangeSuffix}
              </>
            ) : (
              m.nextActionFallback[r.status as 'missing' | 'partial' | 'insufficient_info'] ?? m.nextActionFallback.missing
            )}
          </p>
        </div>
      )}
    </div>
  );
}
