'use client';

/**
 * /onboarding page — Phase 12 Track B (B.0)
 *
 * Top-level route for the new linear wizard. Replaces the legacy
 * WizardContainer page-mode (PR 3a). The legacy wizard remains
 * reachable as a modal via /dashboard?legacy=wizard for support
 * and QA until Track C.2 deletes it.
 *
 * Routing logic:
 *   - Unauthenticated → /signin?next=/onboarding
 *   - Already completed → /dashboard/setup (refinement is the next step)
 *   - Otherwise → render the wizard container, silent-resume from
 *     User.onboardingStep if set
 *
 * This file is intentionally thin. All step state and rendering
 * lives in LinearWizardContainer (B.1).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { LinearWizardContainer } from '@/components/onboarding/linear/LinearWizardContainer';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { state: onboardingState } = useOnboardingState();

  // Auth gate — redirect unauthenticated users to signin with a
  // ?next=/onboarding return path.
  useEffect(() => {
    if (authLoading) return;
    if (!user && !token) {
      router.push('/signin?next=/onboarding');
    }
  }, [authLoading, user, token, router]);

  // Completion gate — if the user has already finished onboarding,
  // route them to /dashboard/setup where they refine estimates.
  useEffect(() => {
    if (!onboardingState) return;
    if (onboardingState.onboardingCompleted) {
      router.replace('/dashboard/setup');
    }
  }, [onboardingState, router]);

  // Silent resume — for now, always start at Welcome. Legacy
  // onboardingStep indices do not map cleanly to the new step ids.
  // A follow-up after B.3-B.8 lands can add real resume logic.
  const initialStepId = 'welcome';

  if (authLoading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent motion-reduce:animate-none" />
      </section>
    );
  }

  return <LinearWizardContainer initialStepId={initialStepId} />;
}
