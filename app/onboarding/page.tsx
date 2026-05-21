'use client';

/**
 * /onboarding page — TRAIL-aligned wizard
 *
 * Full-page mode of WizardContainer. Renders the onboarding wizard
 * directly (not as a modal on /dashboard).
 *
 * Phase 12 Track G.2 (2026-05-21): the standalone conversational-chat
 * path + the chat/form mode-selector + the mid-flow toggle were retired.
 * The unified companion (inside the wizard — Track G.1) makes them
 * redundant, and two onboarding implementations was a §12.1/§12.3
 * violation. `/onboarding` is now always the form wizard with its
 * companion — no mode choice, no flag.
 *
 * The wizard uses the bulk-create API exclusively
 * (POST /api/onboarding/bulk-create) which creates new rows via
 * prisma.create — no destructive upserts, no overwrite risk.
 *
 * See: docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md
 *      docs/blueprint/TRAIL_FRAMEWORK.md §10
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { WizardContainer } from '@/components/onboarding';
import type { WizardData } from '@/components/onboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    state: onboardingState,
    saveDraft,
    completeOnboarding,
    clearDraft,
    readLocalDraft,
  } = useOnboardingState();

  // Auth / completion gates
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/signin');
      return;
    }
    if (onboardingState?.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }
  }, [user, authLoading, onboardingState, router]);

  // Hydrate draft from server, fall back to localStorage
  const hydratedDraft = useMemo<Partial<WizardData> | undefined>(() => {
    const serverDraft = onboardingState?.draft;
    if (serverDraft && typeof serverDraft === 'object') {
      return serverDraft as Partial<WizardData>;
    }
    const localDraft = readLocalDraft();
    if (localDraft && typeof localDraft === 'object') {
      return localDraft as Partial<WizardData>;
    }
    return undefined;
  }, [onboardingState?.draft, readLocalDraft]);

  const hydratedStepIndex = onboardingState?.currentStep ?? 0;

  const handleAutoSave = useCallback(
    (wizardData: WizardData, stepIndex: number) => {
      void saveDraft(wizardData, stepIndex);
    },
    [saveDraft]
  );

  const handleComplete = useCallback(
    async (wizardData: WizardData) => {
      try {
        // Track G.3c: `bulk-create` is retired. Every domain has already
        // written itself to the real tables via its step's commit
        // (Track F + G.3a). `completeOnboarding` calls the `/api/
        // onboarding/complete` finaliser — the sole end-of-wizard write:
        // it marks completion + does the cross-domain wiring (G.3b). It
        // throws on failure; the wizard footer surfaces the message.
        await completeOnboarding(wizardData);
        await clearDraft();

        // Full reload so dashboard refetches all client-side data.
        window.location.href = '/dashboard';
      } catch (e) {
        console.error('Could not complete wizard:', e);
        throw e;
      }
    },
    [completeOnboarding, clearDraft]
  );

  const handleClose = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // Loading state while auth + state resolve
  if (authLoading || !user) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent motion-reduce:animate-none" />
      </section>
    );
  }

  if (onboardingState?.onboardingCompleted) {
    return null;
  }

  return (
    <WizardContainer
      isOpen={true}
      mode="page"
      onClose={handleClose}
      onComplete={handleComplete}
      initialData={hydratedDraft}
      initialStepIndex={hydratedStepIndex}
      onAutoSave={handleAutoSave}
    />
  );
}
