import { useEffect, useState } from 'react';

/** Cycles through short status hints during a long AI wait, fading each one in via `pm-rise`
 * (same pattern as Processing.tsx's stage-5 wait) so a blocking request doesn't feel frozen. */
export function RotatingHint({ hints, intervalMs = 2600, className }: { hints: string[]; intervalMs?: number; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (hints.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % hints.length), intervalMs);
    return () => clearInterval(id);
  }, [hints, intervalMs]);

  return (
    <span key={index} className={className} style={{ display: 'inline-block', animation: 'pm-rise .4s ease both' }}>
      {hints[index]}
    </span>
  );
}
