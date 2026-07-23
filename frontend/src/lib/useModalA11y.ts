import { useEffect, useRef } from 'react';

/** Shared modal accessibility, used by every full-screen dialog in the app (DeleteConfirmDialog,
 * NewAnalysisConfirmModal): focuses the dialog on open, restores focus to whatever had it before
 * on close, closes on Escape, and locks background scroll while open — so none of this has to be
 * reimplemented per modal, and none of it gets skipped by accident. */
export function useModalA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (focusable ?? dialog)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // onClose deliberately excluded from deps — re-running on every render would re-run the
    // focus/scroll-lock setup, which must only happen once per modal open lifecycle. The Escape
    // handler closure staying "stale" is harmless here: useModalClose's requestClose is a no-op
    // once closing has already started, so an old closure reference still behaves correctly.
  }, []);

  return dialogRef;
}
