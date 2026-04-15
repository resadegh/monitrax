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
import { HouseholdStep } from '@/components/onboarding/linear/steps/HouseholdStep';
import { IncomeStep } from '@/components/onboarding/linear/steps/IncomeStep';
import { HousingStep } from '@/components/onboarding/linear/steps/HousingStep';
import { ExpensesStep } from '@/components/onboarding/linear/steps/ExpensesStep';
import { GoalStep } from '@/components/onboarding/linear/steps/GoalStep';
import { FinalRevealStep } from '@/components/onboarding/linear/steps/FinalRevealStep';
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

  // Render the active step. B.2-B.7 all ship; B.8 Final Reveal is the
  // only remaining placeholder until the next Track B PR lands.
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
    case 'household':
      stepContent = <HouseholdStep onAdvance={advance} onBack={goBack} />;
      break;
    case 'income':
      stepContent = <IncomeStep onAdvance={advance} onBack={goBack} />;
      break;
    case 'housing':
      stepContent = <HousingStep onAdvance={advance} onBack={goBack} />;
      break;
    case 'expenses':
      stepContent = <ExpensesStep onAdvance={advance} onBack={goBack} />;
      break;
    case 'goal':
      stepContent = <GoalStep onAdvance={advance} onBack={goBack} />;
      break;
    case 'reveal':
    default:
      stepContent = <FinalRevealStep onBack={goBack} />;
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
