/** Reference-counted body scroll lock — shared across every dialog instance via module-level
 * state (not per-instance state), so this is correct even when dialogs open/close out of order.
 *
 * Before this existed, each modal independently captured `document.body.style.overflow` on mount
 * and restored that captured snapshot on unmount. That breaks the moment two dialogs are ever open
 * at once and close out of LIFO order: the first one to close would restore the *original*
 * (unlocked) value while the second dialog is still open, silently un-locking the background under
 * it. A plain counter has no such ordering dependency — the lock only lifts once nothing is holding
 * it anymore. */
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function getScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0;
  return window.innerWidth - document.documentElement.clientWidth;
}

/** Locks background scroll and compensates for the scrollbar's own width disappearing (which
 * would otherwise shift all fixed/centered content sideways by a few pixels the instant the lock
 * engages) by padding the body by the same amount. Safe to call repeatedly — only the first call
 * (per outstanding lock) actually touches the DOM. */
export function lockBodyScroll(): void {
  if (lockCount === 0) {
    const scrollbarWidth = getScrollbarWidth();
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPaddingRight = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
  }
  lockCount++;
}

/** Releases one lock. Background scroll is only actually restored once every outstanding lock has
 * been released (the last dialog to close wins, not the first). */
export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}
