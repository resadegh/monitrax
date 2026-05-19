'use client';

/**
 * /onboarding page — TRAIL-aligned wizard (2026-04-18)
 *
 * Full-page mode of WizardContainer. Renders the onboarding wizard
 * directly (not as a modal on /dashboard).
 *
 * The wizard uses the bulk-create API exclusively
 * (POST /api/onboarding/bulk-create) which creates new rows via
 * prisma.create — no destructive upserts, no overwrite risk.
 *
 * The old onboardingEstimateService remains disabled (throws
 * OnboardingDisabledError) as defence in depth.
 *
 * See: docs/blueprint/TRAIL_FRAMEWORK.md §10
 *      docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md
 */

import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { WizardContainer } from '@/components/onboarding';
import type { WizardData } from '@/components/onboarding';
import { ConversationalModeToggle } from '@/components/onboarding/ConversationalModeToggle';
import { ConversationalSetup } from '@/components/onboarding/wizard-chat/ConversationalSetup';
import { OnboardingModeSelector } from '@/components/onboarding/OnboardingModeSelector';
import { useConversationalOnboardingEnabled } from '@/lib/featureFlags/ConversationalOnboardingGateContext';

function OnboardingLoadingFallback() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent motion-reduce:animate-none" />
    </section>
  );
}

/**
 * Next.js 15 requires `useSearchParams()` to be wrapped in a Suspense
 * boundary during static prerendering. Phase 12 Track E.0 added a
 * `?mode=chat` query-param read here + in `<ConversationalModeToggle>`.
 * Both are descendants of this `<Suspense>` boundary, so the page
 * still prerenders cleanly and the search-param read happens client-side
 * after hydration.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoadingFallback />}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatFlagEnabled = useConversationalOnboardingEnabled();
  // Phase 12 Track E.0 — read ?mode=chat. Only honoured when the
  // CONVERSATIONAL_ONBOARDING flag is ON; otherwise the toggle is
  // hidden and form-mode is the only path (byte-for-byte unchanged
  // behaviour pre-flag).
  const requestedMode = searchParams?.get('mode');
  const mode: 'form' | 'chat' =
    chatFlagEnabled && requestedMode === 'chat' ? 'chat' : 'form';

  const { user, token, isLoading: authLoading } = useAuth();
  const {
    state: onboardingState,
    saveDraft,
    completeOnboarding,
    clearDraft,
    readLocalDraft,
  } = useOnboardingState();

  // Phase 12 Track E.2c — deliberate mode-choice landing screen.
  // Show the selector when the chat flag is ON AND the user hasn't
  // expressed a choice yet AND has no draft progress. After the
  // first pick (recorded in the URL), subsequent visits skip the
  // selector so the user lands directly back where they were.
  // When the flag is OFF the selector is bypassed entirely —
  // /onboarding stays byte-for-byte the existing form experience.
  const hasDraftProgress = useMemo(() => {
    if (!onboardingState) return false;
    if ((onboardingState.currentStep ?? 0) > 0) return true;
    const draft = onboardingState.draft;
    if (draft && typeof draft === 'object' && Object.keys(draft).length > 0) {
      return true;
    }
    return false;
  }, [onboardingState]);
  const showModeSelector =
    chatFlagEnabled && !requestedMode && !hasDraftProgress;

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
          // The server returns `{ error, details? }`. For 4xx
          // user-recoverable errors (validation) `error` is the
          // human-readable message and `details` is omitted. For
          // 5xx the route puts the generic "Failed to save…" in
          // `error` and the actual message in `details`. Without
          // surfacing `details`, the user only ever sees the
          // generic fallback in the wizard footer banner — which
          // is exactly what we don't want, since it hides the
          // information that lets them (or us) fix the cause.
          const baseMessage =
            typeof errorData.error === 'string'
              ? errorData.error
              : 'Failed to save data';
          const details =
            typeof errorData.details === 'string' ? errorData.details : null;
          throw new Error(
            details && details !== baseMessage
              ? `${baseMessage}: ${details}`
              : baseMessage
          );
        }

        await completeOnboarding();
        await clearDraft();

        // Full reload so dashboard refetches all client-side data
        window.location.href = '/dashboard';
      } catch (e) {
        console.error('Could not complete wizard:', e);
        throw e;
      }
    },
    [token, completeOnboarding, clearDraft]
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

  // Mode-selector landing screen — only when flag ON + no choice yet + no draft.
  if (showModeSelector) {
    return <OnboardingModeSelector />;
  }

  return (
    <>
      <ConversationalModeToggle />
      {mode === 'chat' ? (
        <ConversationalSetup />
      ) : (
        <WizardContainer
          isOpen={true}
          mode="page"
          onClose={handleClose}
          onComplete={handleComplete}
          initialData={hydratedDraft}
          initialStepIndex={hydratedStepIndex}
          onAutoSave={handleAutoSave}
        />
      )}
    </>
  );
}
