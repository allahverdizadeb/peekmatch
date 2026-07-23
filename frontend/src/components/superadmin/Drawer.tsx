import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-surface h-full shadow-sh-xl overflow-y-auto motion-rise-in">
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold text-navy">{title}</h2>
          <button onClick={onClose} aria-label="Bağla">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
