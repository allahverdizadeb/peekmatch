import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface AccordionItemData {
  key: string;
  title: ReactNode;
  content: ReactNode;
  /** Optional trailing content in the header row (e.g. a count badge). */
  meta?: ReactNode;
}

/** Reusable accordion — replaces the inline `openSection`-string-state pattern previously
 * hand-rolled in Workspace.tsx's Interview Playbook tab, and used for the Landing page FAQ.
 * Single-open by default (`allowMultiple` opts into independent sections). */
export function Accordion({
  items,
  defaultOpenKey,
  allowMultiple = false,
}: {
  items: AccordionItemData[];
  defaultOpenKey?: string;
  allowMultiple?: boolean;
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set(defaultOpenKey ? [defaultOpenKey] : []));
  const baseId = useId();

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = allowMultiple ? new Set(prev) : new Set<string>();
      if (prev.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const open = openKeys.has(item.key);
        const panelId = `${baseId}-${item.key}`;
        return (
          <div key={item.key} className="bg-surface border border-border rounded-rl overflow-hidden">
            <h3>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus-ring"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(item.key)}
              >
                <span className="text-[14.5px] font-semibold text-navy">{item.title}</span>
                <span className="flex items-center gap-2 flex-none">
                  {item.meta}
                  <ChevronDown className={clsx('w-4 h-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </span>
              </button>
            </h3>
            {open && (
              <div id={panelId} className="px-5 pb-5 text-[13.5px] text-text2 leading-relaxed">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
