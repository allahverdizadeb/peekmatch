import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** IntersectionObserver-backed "has this entered the viewport" hook for scroll-triggered reveals
 * (homepage sections, long result sections). `once` (default true) means it fires a single time —
 * scrolling back up and down must NOT replay the animation, per the product's motion rules. Under
 * reduced motion, returns `true` immediately (content is simply visible, no reveal to skip). */
export function useInView<T extends HTMLElement>(options?: { once?: boolean; rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();
  const [inView, setInView] = useState(reducedMotion);
  const once = options?.once ?? true;

  useEffect(() => {
    if (reducedMotion) {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.15, rootMargin: options?.rootMargin ?? '0px 0px -60px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, once, options?.rootMargin]);

  return { ref, inView };
}
