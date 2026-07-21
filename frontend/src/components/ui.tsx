import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { CheckCircle2, AlertTriangle, OctagonAlert, Info, Sparkles, Circle } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'premium';
type Size = 'md' | 'sm';

const VARIANT_CLS: Record<Variant, string> = {
  primary: 'bg-teal text-white hover:bg-teal-h shadow-sh-sm disabled:bg-border disabled:text-muted',
  secondary: 'bg-surface text-navy border border-border hover:bg-bg2 disabled:text-muted',
  tertiary: 'text-teal hover:bg-bg2 disabled:text-muted',
  danger: 'bg-danger text-white hover:bg-[#b8323f] disabled:bg-border disabled:text-muted',
  premium: 'bg-premium text-white hover:bg-[#5f47c4] disabled:bg-border disabled:text-muted',
};

const SIZE_CLS: Record<Size, string> = {
  md: 'px-6 py-3 text-[15px]',
  sm: 'px-4 py-2 text-[13.5px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  loading,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-rk font-semibold transition-colors focus-ring disabled:cursor-not-allowed',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        className,
      )}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('bg-surface border border-border rounded-rl min-w-0', className)}>{children}</div>;
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'premium' | 'neutral';

const BADGE_CLS: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  premium: 'bg-premium-bg text-premium',
  neutral: 'bg-bg2 text-text2',
};

// Every status badge pairs an icon with its color by default — status must never be communicated
// by color alone (accessibility requirement: colorblind users, low-vision users). Pass `icon={null}`
// explicitly to opt out for the rare purely-decorative badge.
const BADGE_ICON: Record<BadgeTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  info: Info,
  premium: Sparkles,
  neutral: Circle,
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Override the default per-tone icon, or pass `null` to omit it entirely. */
  icon?: typeof CheckCircle2 | null;
}) {
  const Icon = icon === undefined ? BADGE_ICON[tone] : icon;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold', BADGE_CLS[tone], className)}>
      {Icon && <Icon className="w-3.5 h-3.5 flex-none" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Standardized "big number + label" metric display — replaces the ad-hoc
 * `<div className="text-[26px] font-extrabold">` patterns previously scattered across
 * Results.tsx/Workspace.tsx, so every metric in the product shares one visual language
 * (tabular numerals, consistent scale, optional sub-label for context). */
export function MetricCard({
  value,
  label,
  subLabel,
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  subLabel?: ReactNode;
  icon?: typeof CheckCircle2;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  size?: 'md' | 'lg';
  className?: string;
}) {
  const toneCls: Record<string, string> = {
    neutral: 'text-navy',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    accent: 'text-accent',
  };
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-text2 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 flex-none" aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={clsx('font-display font-semibold tabular-nums leading-none', toneCls[tone], size === 'lg' ? 'text-[34px]' : 'text-[26px]')}>
        {value}
      </div>
      {subLabel && <div className="text-[12px] text-muted mt-1.5">{subLabel}</div>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-teal mb-3">{children}</div>;
}
