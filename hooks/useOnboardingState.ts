'use client';

import { useState, useEffect, useCallback } from 'react';

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
  refetch: () => Promise<void>;
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
    await updateState({ dismissWelcomeModal: true });
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

  // Computed properties
  const shouldShowWelcome = state
    ? !state.onboardingCompleted &&
      !state.preferences.dismissedWelcomeModal &&
      !state.hasExistingData
    : false;

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
    refetch: fetchState,
  };
}
