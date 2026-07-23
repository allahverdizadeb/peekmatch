import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitial(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** The single source of truth for "should this component skip JS-driven motion" — index.css's
 * global `@media (prefers-reduced-motion: reduce)` rule already collapses every CSS
 * transition/animation duration to ~0 by itself, so most components need nothing extra. This hook
 * is only for the handful of places that make a motion decision in JS rather than CSS: whether to
 * run a number count-up vs. show the final value immediately, whether useDelayedUnmount should
 * keep exit-animating nodes mounted, whether a staggered reveal sequence should run at all. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
