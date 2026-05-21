'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

// LocalStorage key prefix for fallback when DB is unavailable
const DISMISSED_WELCOME_KEY_PREFIX = 'monitrax_dismissed_welcome_modal_';
// Phase 12 PR 2: client-side draft fallback (same-device same-session).
// The server is the source of truth — this only protects against network
// blips or tab crashes between debounced server writes.
const DRAFT_KEY_PREFIX = 'monitrax_onboarding_draft_';

export type OnboardingProfileType = 'HOMEOWNER' | 'INVESTOR' | 'MIXED' | 'STARTER';

export interface OnboardingPreferences {
  hasSeenGuidedTour: boolean;
  tourSkippedAt: string | null;
  tourCompletedAt: string | null;
  dismissedOnboardingBadge: boolean;
  dismissedWelcomeModal: boolean;
  preferredCurrency: string;
  preferredDateFormat: string;
  country: string;
  taxYear: string | null;
}

export interface OnboardingDataSummary {
  properties: number;
  accounts: number;
  income: number;
  expenses: number;
}

export interface OnboardingState {
  onboardingCompleted: boolean;
  onboardingProfileType: OnboardingProfileType | null;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  currentStep: number;
  preferences: OnboardingPreferences;
  // Phase 12 PR 2: Server-persisted wizard draft (null if none).
  // Typed as unknown here; WizardContainer narrows it to Partial<WizardData>.
  draft: unknown;
  hasExistingData: boolean;
  dataSummary: OnboardingDataSummary;
}

interface UseOnboardingStateReturn {
  state: OnboardingState | null;
  isLoading: boolean;
  error: string | null;

  // State checks
  shouldShowWelcome: boolean;
  shouldShowTour: boolean;
  // Phase 12 PR 2: true when the user has an unfinished wizard to resume.
  // This is the SINGLE onboarding-progress signal — the legacy
  // `shouldShowOnboardingBadge` was removed 2026-05-20 with its widget.
  shouldShowResumeBanner: boolean;

  // Actions
  setProfileType: (type: OnboardingProfileType) => Promise<void>;
  setCurrentStep: (step: number) => Promise<void>;
  startOnboarding: () => Promise<void>;
  completeOnboarding: (wizardData?: unknown) => Promise<void>;
  dismissWelcomeModal: () => Promise<void>;
  markTourCompleted: () => Promise<void>;
  markTourSkipped: () => Promise<void>;
  resetTour: () => Promise<void>; // Restart the tour from settings
  refetch: () => Promise<void>;

  // Phase 12 PR 2: draft persistence
  /** Save the wizard draft to the server (debounced by caller) and to localStorage. */
  saveDraft: (draft: unknown, currentStep?: number) => Promise<void>;
  /** Clear the draft both server-side and in localStorage. */
  clearDraft: () => Promise<void>;
  /** Synchronously read the localStorage-cached draft (server state takes precedence). */
  readLocalDraft: () => unknown;
}

// Check if welcome modal was dismissed via localStorage (fallback)
// Now user-specific to prevent cross-user dismissal issues
function isWelcomeDismissedLocally(userId: string | null): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    return localStorage.getItem(DISMISSED_WELCOME_KEY_PREFIX + userId) === 'true';
  } catch {
    return false;
  }
}

// Save dismiss preference to localStorage (fallback)
// Now user-specific
function setWelcomeDismissedLocally(userId: string | null): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(DISMISSED_WELCOME_KEY_PREFIX + userId, 'true');
  } catch {
    // Ignore localStorage errors
  }
}

// Phase 12 PR 2: localStorage-backed wizard draft (same-device fallback).
function readLocalDraftForUser(userId: string | null): unknown {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalDraftForUser(userId: string | null, draft: unknown): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(DRAFT_KEY_PREFIX + userId, JSON.stringify(draft));
  } catch {
    // Quota/privacy mode — server-side write is still the source of truth.
  }
}

function clearLocalDraftForUser(userId: string | null): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(DRAFT_KEY_PREFIX + userId);
  } catch {
    // Ignore localStorage errors.
  }
}

export function useOnboardingState(): UseOnboardingStateReturn {
  const { user, token } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/onboarding/state', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch onboarding state');
      }

      setState(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchState();
    }
  }, [fetchState, token]);

  const updateState = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update onboarding state');
      }

      // Refetch to get latest state
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  }, [fetchState, token]);

  const setProfileType = useCallback(async (type: OnboardingProfileType) => {
    await updateState({ profileType: type });
  }, [updateState]);

  const setCurrentStep = useCallback(async (step: number) => {
    await updateState({ currentStep: step });
  }, [updateState]);

  const startOnboarding = useCallback(async () => {
    await updateState({ startOnboarding: true, currentStep: 0 });
  }, [updateState]);

  const completeOnboarding = useCallback(
    async (wizardData?: unknown) => {
      try {
        // Phase 12 Track G.3b: the complete route is now the end-of-wizard
        // finaliser — it marks completion AND does the cross-domain wiring
        // relocated from bulk-create. Pass the wizard data so it can.
        const response = await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(wizardData ?? {}),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to complete onboarding');
        }

        await fetchState();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        throw err;
      }
    },
    [fetchState, token],
  );

  const dismissWelcomeModal = useCallback(async () => {
    // Always save to localStorage as fallback (works even if DB fails)
    // Now user-specific
    setWelcomeDismissedLocally(user?.id || null);
    // Try to save to DB as well
    try {
      await updateState({ dismissWelcomeModal: true });
    } catch {
      // localStorage fallback already saved, so this is okay
      console.warn('Could not save dismiss preference to DB, using localStorage fallback');
    }
  }, [updateState, user?.id]);

  const markTourCompleted = useCallback(async () => {
    await updateState({ tourCompleted: true });
  }, [updateState]);

  const markTourSkipped = useCallback(async () => {
    await updateState({ tourSkipped: true });
  }, [updateState]);

  // Reset tour - allows users to restart the tour from settings
  const resetTour = useCallback(async () => {
    await updateState({ resetTour: true });
  }, [updateState]);

  // Phase 12 PR 2: Draft persistence actions.
  // Writes the draft to both the server (authoritative, cross-device) and
  // localStorage (same-device blip protection). Intentionally does NOT
  // refetch state on every save — that would thrash the network. The hook
  // caller (WizardContainer) debounces calls to saveDraft.
  //
  // Fix (Phase 12 v3 — bug A.4): saveDraft now also optimistically
  // mirrors `currentStep` into local hook state after a successful POST.
  // Previously the caller had to fire a second `setCurrentStep` POST in
  // parallel to keep the resume-banner label fresh, which produced a
  // race: the server could end up with the new step index from POST #2
  // while POST #1's draft body was still in flight (or failed), leaving
  // the server with an advanced step + a stale draft. Now a single
  // atomic POST persists both fields, and the hook's in-memory state is
  // updated from the same arguments the POST succeeded with — so the
  // banner stays fresh without a second network round-trip.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.4.
  const saveDraft = useCallback(
    async (draft: unknown, currentStep?: number) => {
      if (!token) return;
      // Same-device fallback: write first, network second.
      writeLocalDraftForUser(user?.id || null, draft);
      try {
        const body: Record<string, unknown> = { draft };
        if (typeof currentStep === 'number') body.currentStep = currentStep;
        const response = await fetch('/api/onboarding/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save draft');
        }
        // Optimistic local-state update (A.4): mirror the just-persisted
        // draft + step index into the hook's in-memory state so the
        // resume banner label, shouldShowResumeBanner, and any other
        // state-derived UI stay fresh without a second POST or a
        // fetchState round-trip. Only runs if the POST succeeded and
        // we already have a hydrated state object.
        setState((prev) =>
          prev
            ? {
                ...prev,
                draft,
                currentStep:
                  typeof currentStep === 'number' ? currentStep : prev.currentStep,
              }
            : prev
        );
      } catch (err) {
        console.warn('Could not save wizard draft to server (using localStorage fallback):', err);
      }
    },
    [token, user?.id]
  );

  const clearDraft = useCallback(async () => {
    clearLocalDraftForUser(user?.id || null);
    if (!token) return;
    try {
      await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clearDraft: true }),
      });
      // Best-effort refetch so shouldShowResumeBanner flips off immediately.
      await fetchState();
    } catch (err) {
      console.warn('Could not clear wizard draft on server:', err);
    }
  }, [fetchState, token, user?.id]);

  const readLocalDraft = useCallback(
    () => readLocalDraftForUser(user?.id || null),
    [user?.id]
  );

  // Computed properties
  //
  // Welcome modal visibility — strict "show once / never again" contract
  // (Phase 12 PR 2, per product decision 2026-04-12):
  //
  //   Show the welcome modal on login when ALL of:
  //     1. User is logged in and state has loaded
  //     2. Onboarding is NOT marked complete (finished wizard → never show)
  //     3. User did NOT explicitly check "Don't show this again" — i.e.
  //        `state.preferences.dismissedWelcomeModal !== true` AND the
  //        localStorage fallback flag is not set
  //     4. There is NO saved draft / step progress (if there is, the
  //        resume banner takes priority)
  //
  // Critically: simply closing the modal with X or "Skip for now" does
  // NOT dismiss permanently — it only closes for the current session.
  // The user must explicitly tick "Don't show this again" to opt out.
  // Taking or skipping the tour also does NOT suppress the welcome modal
  // (tour state is tracked separately in preferences.hasSeenGuidedTour /
  // tourSkippedAt and has no bearing on welcome visibility).
  const dismissedViaLocalStorage = isWelcomeDismissedLocally(user?.id || null);
  const localDraftForWelcomeGate = readLocalDraftForUser(user?.id || null);
  const welcomeHiddenByDraft =
    (!!state?.draft && typeof state.draft === 'object') ||
    (!!state && !state.onboardingCompleted && state.currentStep > 0) ||
    (!state?.onboardingCompleted && !!localDraftForWelcomeGate);
  const shouldShowWelcome =
    !isLoading &&
    !!user &&
    !dismissedViaLocalStorage &&
    !welcomeHiddenByDraft &&
    (
      state === null || // API failed — localStorage fallback above handles the rest
      (!state.onboardingCompleted && !state.preferences.dismissedWelcomeModal)
    );

  const shouldShowTour = state
    ? !state.preferences.hasSeenGuidedTour &&
      !state.preferences.tourSkippedAt
    : false;

  // Phase 12 PR 2: banner fires when the user has an unfinished wizard.
  // "Unfinished" = onboarding not completed AND we have either a server
  // draft or some persisted step progress. localStorage is checked as a
  // last resort for users whose server draft never made it to the DB.
  const hasServerDraft =
    !!state?.draft && typeof state.draft === 'object';
  const hasStepProgress =
    !!state && !state.onboardingCompleted && state.currentStep > 0;
  const hasLocalDraft =
    !state?.onboardingCompleted && !!readLocalDraftForUser(user?.id || null);
  const shouldShowResumeBanner =
    !isLoading &&
    !!state &&
    !state.onboardingCompleted &&
    (hasServerDraft || hasStepProgress || hasLocalDraft);

  return {
    state,
    isLoading,
    error,
    shouldShowWelcome,
    shouldShowTour,
    shouldShowResumeBanner,
    setProfileType,
    setCurrentStep,
    startOnboarding,
    completeOnboarding,
    dismissWelcomeModal,
    markTourCompleted,
    markTourSkipped,
    resetTour,
    refetch: fetchState,
    saveDraft,
    clearDraft,
    readLocalDraft,
  };
}
