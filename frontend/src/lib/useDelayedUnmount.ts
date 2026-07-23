import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Keeps a node mounted for `duration` ms after `open` flips to false, so a CSS exit animation
 * (see `.motion-dialog`/`.motion-popover`/`.motion-backdrop` in index.css) has time to play instead
 * of the node vanishing instantly. Returns `shouldRender` (gate the JSX) and `dataState` (drive the
 * CSS via `data-state={dataState}`).
 *
 * Under reduced motion, the exit "animation" is already ~0-duration via index.css's global rule,
 * so this collapses its own timeout to match — otherwise the node would sit mounted (and, for a
 * modal, still trapping focus) for the normal exit duration while visually already gone. */
export function useDelayedUnmount(open: boolean, duration: number): { shouldRender: boolean; dataState: 'open' | 'closed' } {
  const reducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (timer.current) clearTimeout(timer.current);
      setShouldRender(true);
      return;
    }
    if (!shouldRender) return;
    const ms = reducedMotion ? 0 : duration;
    timer.current = setTimeout(() => setShouldRender(false), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // shouldRender deliberately excluded from deps — only open/duration/reducedMotion should re-trigger this.
  }, [open, duration, reducedMotion]);

  return { shouldRender, dataState: open ? 'open' : 'closed' };
}
