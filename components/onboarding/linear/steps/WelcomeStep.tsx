'use client';

/**
 * WelcomeStep — Phase 12 Track B (B.2)
 *
 * Step 0 of the /onboarding wizard. Sets expectations, reduces
 * anxiety, and primes the user for the 90-second discovery flow.
 *
 * Per the directive and §8.4 of the twin-track plan:
 *   - Calm, intelligent, minimal
 *   - One primary CTA: "Start guided setup →"
 *   - One tertiary exit: "Skip for now"
 *   - No input, no form, just the greeting beat
 *
 * This is a pure presentational component. The parent container
 * (LinearWizardContainer) handles navigation state.
 */

import { Sparkles, Clock, Shield } from 'lucide-react';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';

export interface WelcomeStepProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onStart, onSkip }: WelcomeStepProps) {
  return (
    <LinearStepShell
      question="Let's get a quick picture of your finances."
      supporting="Takes about 90 seconds. Rough numbers are fine — you can refine everything later."
      ctaLabel="Start guided setup"
      onAdvance={onStart}
      onSkip={onSkip}
      skipLabel="Skip for now"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-700/50 dark:bg-slate-900/60">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)]"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              A quick discovery experience
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Five short questions, then we show you your financial picture.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-700/50 dark:bg-slate-900/60">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <Clock className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              90 seconds, tops
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Rough estimates are fine. You can refine every number later.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-slate-700/50 dark:bg-slate-900/60">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
          >
            <Shield className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Your data stays with you
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              We never share, sell, or store your bank login. CDR-compliant.
            </p>
          </div>
        </div>
      </div>
    </LinearStepShell>
  );
}

export default WelcomeStep;
