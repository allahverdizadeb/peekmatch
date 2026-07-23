import { useEffect, useRef } from 'react';
import { lockBodyScroll, unlockBodyScroll } from './bodyScrollLock';
import { lockBackgroundInert, unlockBackgroundInert } from './backgroundInert';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Shared modal accessibility, used by every full-screen dialog in the app (via components/Dialog.tsx):
 * focuses the dialog on open, traps Tab/Shift+Tab within it while open, restores focus to whatever
 * had it before on close, closes on Escape, locks background scroll, and marks the app root
 * `inert` so screen readers and keyboard navigation cannot reach background content (both
 * reference-counted — see lib/bodyScrollLock.ts / lib/backgroundInert.ts — so two dialogs closing
 * out of order can never under-release either lock) — so none of this has to be reimplemented per
 * modal, and none of it gets skipped by accident. */
export function useModalA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const initialFocusable = getFocusable(dialog);
    (initialFocusable[0] ?? dialog)?.focus();

    lockBodyScroll();
    lockBackgroundInert();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Recomputed on every Tab press rather than cached once — a card's own action buttons can
      // change `disabled` state (e.g. mid-request) while the dialog is open.
      const items = getFocusable(dialog);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
      unlockBackgroundInert();
      previouslyFocused?.focus?.();
    };
    // onClose deliberately excluded from deps — re-running on every render would re-run the
    // focus/scroll-lock setup, which must only happen once per modal open lifecycle. The Escape
    // handler closure staying "stale" is harmless here: useModalClose's requestClose is a no-op
    // once closing has already started, so an old closure reference still behaves correctly.
  }, []);

  return dialogRef;
}
