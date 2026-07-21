import { Check, Minus, X, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export type CoverageStatus = 'met' | 'partial' | 'missing' | 'insufficient_info';

const STATUS_STYLE: Record<CoverageStatus, { icon: typeof Check; bg: string; text: string }> = {
  met: { icon: Check, bg: 'bg-success', text: 'text-white' },
  partial: { icon: Minus, bg: 'bg-warning', text: 'text-white' },
  missing: { icon: X, bg: 'bg-danger', text: 'text-white' },
  insufficient_info: { icon: HelpCircle, bg: 'bg-muted', text: 'text-white' },
};

/** Compact status marker (shape + icon, not just color) for dense layouts like the Importance
 * Matrix and requirement tables — a colorblind-safe alternative to a plain colored dot. */
export function StatusDot({ status, className }: { status: CoverageStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span className={clsx('inline-flex items-center justify-center w-5 h-5 rounded-full flex-none', s.bg, s.text, className)}>
      <Icon className="w-3 h-3" aria-hidden="true" />
    </span>
  );
}
