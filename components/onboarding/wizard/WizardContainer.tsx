'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Rocket, Check, Loader2 } from 'lucide-react';
import {
  WizardData,
  WIZARD_STEPS,
  INITIAL_WIZARD_DATA,
  getStepsForProfile,
} from './types';
import { WelcomeStep } from './steps/WelcomeStep';
import { HouseholdStep } from './steps/HouseholdStep';
import { PropertiesStep } from './steps/PropertiesStep';
import { AccountsStep } from './steps/AccountsStep';
import { InvestmentsStep } from './steps/InvestmentsStep';
import { AssetsStep } from './steps/AssetsStep';
import { IncomeExpensesStep } from './steps/IncomeExpensesStep';
import { ReviewStep } from './steps/ReviewStep';
import { AIHelper } from './AIHelper';
import '@/styles/wizard-animations.css';

// =============================================================================
// TYPES
// =============================================================================

interface WizardContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: WizardData) => Promise<void> | void;
  /**
   * Pre-hydrated draft to seed the wizard with. Typically supplied by
   * DashboardLayout after reading `useOnboardingState().state.draft` from
   * the server. Merged over INITIAL_WIZARD_DATA on mount.
   */
  initialData?: Partial<WizardData>;
  /**
   * Step index to resume from (0-based within the profile-filtered steps
   * array). Ignored on first open if no profile is selected yet.
   */
  initialStepIndex?: number;
  /**
   * Phase 12 PR 2: Called with the current `WizardData` every time the
   * wizard state changes, debounced by ~1.2s. Use this to persist the
   * draft to the server via useOnboardingState().saveDraft.
   */
  onAutoSave?: (data: WizardData, currentStepIndex: number) => void;
}

// Debounce window for autosave. Short enough that a user who closes the
// modal mid-type doesn't lose much, long enough to avoid hammering the API
// on every keystroke.
const AUTOSAVE_DEBOUNCE_MS = 1200;

// =============================================================================
// WIZARD CONTAINER COMPONENT
// =============================================================================

export function WizardContainer({
  isOpen,
  onClose,
  onComplete,
  initialData,
  initialStepIndex,
  onAutoSave,
}: WizardContainerProps) {
  // Hooks must be called unconditionally (Rules of Hooks)
  const [data, setData] = useState<WizardData>({
    ...INITIAL_WIZARD_DATA,
    ...initialData,
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(
    typeof initialStepIndex === 'number' && initialStepIndex >= 0 ? initialStepIndex : 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Phase 12 PR 2: Autosave. We debounce to avoid hammering the state API.
  // The ref holds the latest onAutoSave callback so the debounce timer
  // closure can pick up new closures without re-scheduling on every render.
  const autoSaveRef = useRef(onAutoSave);
  useEffect(() => {
    autoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Skip the very first autosave trigger of each "open session" — that
  // first state is the one we received FROM the server (or the empty
  // bootstrap). Writing it back immediately is pointless churn.
  // When the wizard closes we reset the guard so the next open also
  // suppresses its first save.
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasHydratedRef.current = false;
      return;
    }
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    if (!autoSaveRef.current) return;
    const handle = window.setTimeout(() => {
      autoSaveRef.current?.(data, currentStepIndex);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [data, currentStepIndex, isOpen]);

  // Get steps based on profile
  const steps = useMemo(() => {
    if (!data.profileType) {
      return WIZARD_STEPS.filter((s) => s.id === 'welcome');
    }
    return getStepsForProfile(data.profileType);
  }, [data.profileType]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Update wizard data
  const handleUpdate = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Navigate to next step
  const handleNext = useCallback(() => {
    if (isLastStep) {
      return;
    }
    setDirection('forward');
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [isLastStep, steps.length]);

  // Navigate to previous step
  const handleBack = useCallback(() => {
    if (isFirstStep) {
      return;
    }
    setDirection('backward');
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, [isFirstStep]);

  // Jump to specific step
  const handleJumpToStep = useCallback(
    (index: number) => {
      if (index < currentStepIndex) {
        setDirection('backward');
      } else {
        setDirection('forward');
      }
      setCurrentStepIndex(index);
    },
    [currentStepIndex]
  );

  // Handle final submission
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onComplete(data);
    } catch (error) {
      console.error('Failed to complete wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [data, onComplete]);

  // Check if current step allows navigation
  const canProceed = useMemo(() => {
    switch (currentStep?.id) {
      case 'welcome':
        return !!data.profileType;
      default:
        return true;
    }
  }, [currentStep?.id, data.profileType]);

  // Don't render if not open - MUST be after all hooks!
  if (!isOpen) return null;

  // Render step content
  const renderStepContent = () => {
    const animationClass =
      direction === 'forward' ? 'wizard-step-enter' : 'wizard-step-enter-back';

    switch (currentStep?.id) {
      case 'welcome':
        return <WelcomeStep data={data} onUpdate={handleUpdate} />;
      case 'household':
        return <HouseholdStep data={data} onUpdate={handleUpdate} />;
      case 'properties':
        return <PropertiesStep data={data} onUpdate={handleUpdate} />;
      case 'accounts':
        return <AccountsStep data={data} onUpdate={handleUpdate} />;
      case 'investments':
        return <InvestmentsStep data={data} onUpdate={handleUpdate} />;
      case 'assets':
        return <AssetsStep data={data} onUpdate={handleUpdate} />;
      case 'income-expenses':
        return <IncomeExpensesStep data={data} onUpdate={handleUpdate} />;
      case 'review':
        return <ReviewStep data={data} onUpdate={handleUpdate} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Setup Wizard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentStep?.description || 'Get started with Monitrax'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        {data.profileType && (
          <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isAccessible = index <= currentStepIndex;

                return (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => isAccessible && handleJumpToStep(index)}
                      disabled={!isAccessible}
                      className={`wizard-progress-step flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium border-2 ${
                        isCompleted
                          ? 'completed bg-green-500 border-green-500 text-white'
                          : isCurrent
                          ? 'active bg-blue-500 border-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
                      } ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      title={step.title}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{step.icon}</span>
                      )}
                    </button>
                    {index < steps.length - 1 && (
                      <div
                        className={`wizard-progress-bar flex-1 h-1 rounded-full ${
                          index < currentStepIndex
                            ? 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{currentStep?.title}</span>
              <span>
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{renderStepContent()}</div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className={`wizard-button flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isFirstStep
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {currentStep?.isOptional && (
              <button
                onClick={handleNext}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Skip this step
              </button>
            )}

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="wizard-button wizard-button-primary flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Launch Dashboard
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`wizard-button flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  canProceed
                    ? 'wizard-button-primary text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* AI Helper Button */}
        <AIHelper currentStep={currentStep?.id || 'welcome'} />
      </div>
    </div>
  );
}
