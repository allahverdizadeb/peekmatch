/** JS-side mirror of index.css's motion custom properties — needed anywhere a duration has to be
 * a number (setTimeout for delayed unmount, a transitionDelay/animationDelay computed in JS for
 * stagger). Keep these in sync with index.css's `:root` block by hand; there are few enough values
 * that a build-time codegen step isn't worth the complexity. */
export const DURATION = {
  instant: 100,
  fast: 160,
  standard: 240,
  deliberate: 400,
  sequence: 600,
} as const;

/** Per-item delay increments for staggered reveals — multiply by index, cap the result (see
 * `staggerDelay`) so a long list doesn't take seconds to finish appearing. */
export const STAGGER = {
  /** Compact lists — chips, small rows. */
  compact: 30,
  /** Cards — result cards, package cards. */
  cards: 60,
  /** Analysis loading sequence steps. */
  sequence: 90,
  /** Result page sections. */
  sections: 80,
} as const;

const MAX_STAGGER_DELAY_MS = 480;

/** `index * increment`, capped so a long list's last item doesn't wait forever — beyond ~8-10
 * items the extra delay stops reading as "sequence" and starts reading as "slow". */
export function staggerDelay(index: number, increment: number): number {
  return Math.min(index * increment, MAX_STAGGER_DELAY_MS);
}
