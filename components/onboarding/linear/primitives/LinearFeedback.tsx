'use client';

/**
 * LinearFeedback — Phase 12 Track B (B.1)
 *
 * The per-step confirmation line. Renders an emerald checkmark + a
 * short affirmation after the user submits a value. Used to create
 * the §8.3 "satisfying micro-feedback moment" on every step.
 *
 * Keep it short. 1-2 clauses max. Human voice.
 */

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface LinearFeedbackProps {
  children: ReactNode;
}

export function LinearFeedback({ children }: LinearFeedbackProps) {
  return (
    <div className="lw-step-enter flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export default LinearFeedback;
