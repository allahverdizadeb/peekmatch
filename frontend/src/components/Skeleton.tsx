import clsx from 'clsx';

/** Pulsing placeholder block for loading states — respects `prefers-reduced-motion` globally via
 * index.css's `animation-duration: 0.001ms !important` override, same as every other animation. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('rounded-rk bg-bg2 animate-pulse', className)} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-rl p-5 grid gap-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
