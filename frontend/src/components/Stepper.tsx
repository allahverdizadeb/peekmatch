import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';

export interface StepItem {
  key: string;
  label: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Slim horizontal progress stepper — used at the top of AnalysisForm to show where the user is
 * in the CV → Vacancy → Language → Consent flow. `activeIndex` is the current (in-progress) step;
 * everything before it is done, everything after is upcoming. */
export function Stepper({ steps, activeIndex }: { steps: StepItem[]; activeIndex: number }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center flex-1 min-w-0 last:flex-none">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-none text-[12px] font-bold border transition-colors',
                  done && 'bg-teal border-teal text-white',
                  current && 'bg-white border-teal text-teal',
                  !done && !current && 'bg-bg2 border-border text-muted',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={clsx('text-[12.5px] font-semibold truncate hidden sm:inline', done || current ? 'text-navy' : 'text-muted')}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <span className={clsx('h-px flex-1 mx-2', done ? 'bg-teal' : 'bg-border')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical timeline variant — used on the Processing page for the analysis stage list. */
export function VerticalStepper({
  steps,
  activeIndex,
  allDone,
}: {
  steps: StepItem[];
  activeIndex: number;
  /** Force every step to the "done" state (used once the backend reports the final stage). */
  allDone?: boolean;
}) {
  return (
    <ol className="grid gap-0.5">
      {steps.map((s, i) => {
        const done = allDone || i < activeIndex;
        const current = !allDone && i === activeIndex;
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex gap-3.5">
            <div className="flex flex-col items-center flex-none">
              <span
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center border transition-colors',
                  done && 'bg-success border-success text-white',
                  current && 'bg-info-bg border-info text-info',
                  !done && !current && 'bg-bg2 border-border text-muted',
                )}
              >
                {done ? <Check className="w-4 h-4" aria-hidden="true" /> : Icon ? <Icon className="w-4 h-4" /> : null}
              </span>
              {i < steps.length - 1 && <span className={clsx('w-px flex-1 min-h-[18px]', done ? 'bg-success' : 'bg-border')} aria-hidden="true" />}
            </div>
            <span className={clsx('text-[14.5px] pb-4', done || current ? 'text-navy font-medium' : 'text-muted')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
