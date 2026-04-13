'use client';

/**
 * /app/onboarding — Phase 12 PR 3a
 *
 * Dedicated full-page onboarding route. Users land here from:
 *   - Direct navigation (deep link from marketing emails)
 *   - Registration → redirect (future — PR 3a ships the route but
 *     registration stays routing to /dashboard)
 *   - Resume banner on /dashboard (optional alternative path)
 *
 * The page simply mounts WizardContainer in mode="page" and wires up
 * the same draft persistence + bulk-create flow that the dashboard
 * modal uses. Unauth users redirect to /signin with ?next=/onboarding.
 *
 * The wizard modal on /dashboard still works exactly as before — this
 * route is purely additive.
 *
 * See: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md (§3 decision E)
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { WizardContainer, WizardData } from '@/components/onboarding';
import { Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const {
    state: onboardingState,
    isLoading: onboardingLoading,
    completeOnboarding,
    saveDraft,
    clearDraft,
    setCurrentStep,
  } = useOnboardingState();

  // ---- Auth gate -------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !user && !token) {
      router.push('/signin?next=/onboarding');
    }
  }, [authLoading, user, token, router]);

  // ---- Redirect away if onboarding is already complete ----------------
  // Users who have already finished the wizard shouldn't see it again by
  // mistake. They get bounced to the dashboard.
  useEffect(() => {
    if (!onboardingLoading && onboardingState?.onboardingCompleted) {
      router.push('/dashboard');
    }
  }, [onboardingLoading, onboardingState?.onboardingCompleted, router]);

  // ---- Hydrated draft + step index (same pattern as DashboardLayout) --
  const hydratedDraft = useMemo<Partial<WizardData> | undefined>(() => {
    const serverDraft = onboardingState?.draft;
    if (serverDraft && typeof serverDraft === 'object') {
      return serverDraft as Partial<WizardData>;
    }
    return undefined;
  }, [onboardingState?.draft]);
  const hydratedStepIndex = onboardingState?.currentStep ?? 0;

  // ---- Handlers --------------------------------------------------------
  const handleAutoSave = useCallback(
    (wizardData: WizardData, stepIndex: number) => {
      void saveDraft(wizardData, stepIndex);
      void setCurrentStep(stepIndex);
    },
    [saveDraft, setCurrentStep]
  );

  const handleComplete = useCallback(
    async (wizardData: WizardData) => {
      try {
        const response = await fetch('/api/onboarding/bulk-create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(wizardData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to save wizard data:', errorData);
          throw new Error(errorData.error || 'Failed to save data');
        }

        await completeOnboarding();
        await clearDraft();
        router.push('/dashboard');
      } catch (e) {
        console.error('Could not complete wizard:', e);
      }
    },
    [clearDraft, completeOnboarding, router, token]
  );

  const handleClose = useCallback(() => {
    // In page mode the "X" button is hidden, so this is only invoked
    // from Escape or external triggers. Go to dashboard — the draft is
    // already saved server-side.
    router.push('/dashboard');
  }, [router]);

  // ---- Loading / unauth fallback --------------------------------------
  if (authLoading || onboardingLoading || (token && !user)) {
    return (
      <div className="wz-page-root flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preparing your setup…
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <WizardContainer
      mode="page"
      isOpen={true}
      onClose={handleClose}
      onComplete={handleComplete}
      initialData={hydratedDraft}
      initialStepIndex={hydratedStepIndex}
      onAutoSave={handleAutoSave}
    />
  );
}
