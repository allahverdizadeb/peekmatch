import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import clsx from 'clsx';

/** Reusable, keyboard-accessible tooltip trigger. Opens on hover AND focus (so keyboard-only users
 * can reach it via Tab, not just mouse hover) and wires `aria-describedby` so screen readers
 * announce the tooltip content when the trigger receives focus. Replaces the one-off
 * useState+absolute-div pattern previously hand-rolled inline in Results.tsx. */
export function Tooltip({ content, className, children }: { content: ReactNode; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={clsx('relative inline-flex', className)}>
      <button
        type="button"
        className="text-muted hover:text-navy focus-ring rounded-full"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children ?? <Info className="w-3.5 h-3.5" aria-hidden="true" />}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-ink text-white text-[12px] leading-relaxed rounded-rc p-3 shadow-sh-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
