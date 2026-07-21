import { OctagonAlert, TriangleAlert, CircleDot } from 'lucide-react';
import clsx from 'clsx';

export type PriorityLevel = 'kritik' | 'əsas' | 'üstünlük';

const PRIORITY_STYLE: Record<PriorityLevel, { icon: typeof OctagonAlert; text: string; bg: string; border: string }> = {
  kritik: { icon: OctagonAlert, text: 'text-danger', bg: 'bg-danger-bg', border: 'border-l-danger' },
  əsas: { icon: TriangleAlert, text: 'text-warning', bg: 'bg-warning-bg', border: 'border-l-warning' },
  üstünlük: { icon: CircleDot, text: 'text-info', bg: 'bg-info-bg', border: 'border-l-info' },
};

/** Priority indicator that never relies on color alone: icon + label always travel together.
 * Reused for requirement importance, CV Change Plan card priority, and interview-question
 * priority (via the shared kritik/əsas/üstünlük scale already used app-wide). */
export function PriorityChip({ level, label, className }: { level: PriorityLevel; label: string; className?: string }) {
  const s = PRIORITY_STYLE[level];
  const Icon = s.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold', s.bg, s.text, className)}>
      <Icon className="w-3.5 h-3.5 flex-none" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Left-border accent strip, for pairing with PriorityChip on card containers so priority is
 * visible even at a glance (layout + color + icon, not one signal alone). */
export function priorityBorderClass(level: PriorityLevel): string {
  return clsx('border-l-4', PRIORITY_STYLE[level].border);
}
