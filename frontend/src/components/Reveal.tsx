import type { ReactNode } from 'react';
import { useInView } from '../lib/useInView';

/** Wraps a section/card so it fades and rises into place the first time it enters the viewport
 * (via `.motion-reveal` in index.css) — never replayed on scroll up/down (`once: true` in
 * useInView). `delay` (ms) is for staggering a group of siblings; keep it small — see
 * lib/motion.ts's `staggerDelay()`. Reduced-motion users get `inView: true` immediately from the
 * hook, so content just renders in place with no transition to skip. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={'motion-reveal' + (className ? ' ' + className : '')}
      data-state={inView ? 'visible' : 'hidden'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
