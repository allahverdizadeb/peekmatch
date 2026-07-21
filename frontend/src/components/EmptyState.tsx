import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Standardized empty state — replaces the ad-hoc `<p className="text-text2">...</p>` scattered
 * across the product (no strengths found, no CV changes found, etc.). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-6">
      <div className="w-11 h-11 rounded-full bg-bg2 flex items-center justify-center mx-auto mb-3.5">
        <Icon className="w-5 h-5 text-muted" aria-hidden="true" />
      </div>
      <div className="text-[14.5px] font-semibold text-navy">{title}</div>
      {description && <p className="text-[13px] text-text2 mt-1 max-w-[360px] mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
