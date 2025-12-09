'use client';

import { useState, useEffect, useCallback } from 'react';

// LocalStorage key for fallback when DB is unavailable
const DISMISSED_WELCOME_KEY = 'monitrax_dismissed_welcome_modal';

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
  shouldShowOnboardingBadge: boolean;

  // Actions
  setProfileType: (type: OnboardingProfileType) => Promise<void>;
  setCurrentStep: (step: number) => Promise<void>;
  startOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  dismissWelcomeModal: () => Promise<void>;
  dismissOnboardingBadge: () => Promise<void>;
  markTourCompleted: () => Promise<void>;
  markTourSkipped: () => Promise<void>;
  resetTour: () => Promise<void>; // Restart the tour from settings
  refetch: () => Promise<void>;
}

// Check if welcome modal was dismissed via localStorage (fallback)
function isWelcomeDismissedLocally(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISSED_WELCOME_KEY) === 'true';
  } catch {
    return false;
  }
}

// Save dismiss preference to localStorage (fallback)
function setWelcomeDismissedLocally(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_WELCOME_KEY, 'true');
  } catch {
    // Ignore localStorage errors
  }
}

export function useOnboardingState(): UseOnboardingStateReturn {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/onboarding/state');
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
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const updateState = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [fetchState]);

  const setProfileType = useCallback(async (type: OnboardingProfileType) => {
    await updateState({ profileType: type });
  }, [updateState]);

  const setCurrentStep = useCallback(async (step: number) => {
    await updateState({ currentStep: step });
  }, [updateState]);

  const startOnboarding = useCallback(async () => {
    await updateState({ startOnboarding: true, currentStep: 0 });
  }, [updateState]);

  const completeOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [fetchState]);

  const dismissWelcomeModal = useCallback(async () => {
    // Always save to localStorage as fallback (works even if DB fails)
    setWelcomeDismissedLocally();
    // Try to save to DB as well
    try {
      await updateState({ dismissWelcomeModal: true });
    } catch {
      // localStorage fallback already saved, so this is okay
      console.warn('Could not save dismiss preference to DB, using localStorage fallback');
    }
  }, [updateState]);

  const dismissOnboardingBadge = useCallback(async () => {
    await updateState({ dismissOnboardingBadge: true });
  }, [updateState]);

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

  // Computed properties
  // Show welcome modal for ALL users who haven't dismissed it or completed tour
  // This includes both new and existing users - everyone should see onboarding once
  // Check localStorage as fallback if DB state is unavailable or missing the preference
  const dismissedViaLocalStorage = isWelcomeDismissedLocally();
  const shouldShowWelcome = !isLoading && !dismissedViaLocalStorage && (
    state === null || // API failed - check localStorage fallback above
    (!state.preferences.dismissedWelcomeModal &&
      !state.preferences.hasSeenGuidedTour &&
      !state.preferences.tourSkippedAt)
  );

  const shouldShowTour = state
    ? !state.preferences.hasSeenGuidedTour &&
      !state.preferences.tourSkippedAt
    : false;

  const shouldShowOnboardingBadge = state
    ? !state.onboardingCompleted &&
      !state.preferences.dismissedOnboardingBadge &&
      state.onboardingStartedAt !== null
    : false;

  return {
    state,
    isLoading,
    error,
    shouldShowWelcome,
    shouldShowTour,
    shouldShowOnboardingBadge,
    setProfileType,
    setCurrentStep,
    startOnboarding,
    completeOnboarding,
    dismissWelcomeModal,
    dismissOnboardingBadge,
    markTourCompleted,
    markTourSkipped,
    resetTour,
    refetch: fetchState,
  };
}
