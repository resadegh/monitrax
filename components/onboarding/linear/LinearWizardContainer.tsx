'use client';

/**
 * LinearWizardContainer — Phase 12 Track B (B.1)
 *
 * Orchestrator for the /onboarding wizard. Manages step index,
 * renders the active step, and passes navigation handlers to
 * each step component.
 *
 * Per §8.1-§8.2 of the twin-track plan:
 *   - One question per screen
 *   - Fade+slide transitions between steps
 *   - No multi-step forms on a single screen
 *   - Resume via User.onboardingStep (silent)
 *
 * The container is intentionally thin — step components own their
 * own input state and API calls. The container just knows which
 * step is active.
 *
 * Initial step list (B.2-B.8 will fill in the components):
 *   0: Welcome
 *   1: Household   (B.3)
 *   2: Income      (B.4)
 *   3: Housing     (B.5)
 *   4: Expenses    (B.6)
 *   5: Goal        (B.7)
 *   6: Final Reveal (B.8)
 */

import { useCallback, useState, type ReactElement } from 'react';
import { LinearProgressBar } from '@/components/onboarding/linear/primitives/LinearProgressBar';
import { WelcomeStep } from '@/components/onboarding/linear/steps/WelcomeStep';
import '@/styles/linear-wizard.css';

// =============================================================================
// STEP REGISTRY
// =============================================================================

export type LinearStepId =
  | 'welcome'
  | 'household'
  | 'income'
  | 'housing'
  | 'expenses'
  | 'goal'
  | 'reveal';

const STEP_ORDER: LinearStepId[] = [
  'welcome',
  'household',
  'income',
  'housing',
  'expenses',
  'goal',
  'reveal',
];

// =============================================================================
// CONTAINER
// =============================================================================

export interface LinearWizardContainerProps {
  /** Optional starting step, used for silent resume. Defaults to 'welcome'. */
  initialStepId?: LinearStepId;
}

export function LinearWizardContainer({
  initialStepId = 'welcome',
}: LinearWizardContainerProps) {
  const initialIndex = Math.max(0, STEP_ORDER.indexOf(initialStepId));
  const [stepIndex, setStepIndex] = useState<number>(initialIndex);

  const advance = useCallback(() => {
    setStepIndex((idx) => Math.min(STEP_ORDER.length - 1, idx + 1));
  }, []);

  const goBack = useCallback(() => {
    setStepIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const activeStep: LinearStepId = STEP_ORDER[stepIndex] ?? 'welcome';

  // Render the active step. B.2 ships Welcome; B.3-B.8 will replace the
  // "coming soon" stubs as each phase lands.
  let stepContent: ReactElement;
  switch (activeStep) {
    case 'welcome':
      stepContent = (
        <WelcomeStep
          onStart={advance}
          onSkip={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/dashboard/setup';
            }
          }}
        />
      );
      break;
    default:
      // Placeholder for B.3-B.8. Each subsequent phase PR will
      // replace this stub with its real step component.
      stepContent = (
        <section className="lw-step-enter mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-center justify-center gap-6 px-6 py-12 text-center sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Step coming soon
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            This step (`{activeStep}`) is part of a future Track B PR.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={advance}
              className="rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)]"
            >
              Skip ahead →
            </button>
          </div>
        </section>
      );
  }

  return (
    <>
      <LinearProgressBar
        currentStepIndex={stepIndex}
        totalSteps={STEP_ORDER.length}
      />
      <main className="flex-1">{stepContent}</main>
    </>
  );
}

export default LinearWizardContainer;
