import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** For modals that are conditionally rendered by their parent (`{open && <Modal onClose={...} />}`)
 * rather than always-mounted — the common pattern in this app. Lets the modal play its own CSS
 * exit animation (`.motion-backdrop`/`.motion-dialog`, data-state="closed") before actually calling
 * the parent's close callback, instead of the parent yanking it out of the DOM instantly. Under
 * reduced motion, closes immediately — there's no exit animation to wait for. */
export function useModalClose(onClose: () => void, duration: number) {
  const [closing, setClosing] = useState(false);
  const reducedMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    if (reducedMotion) {
      onClose();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(onClose, duration);
  }, [closing, onClose, duration, reducedMotion]);

  return { closing, requestClose };
}
