'use client';

/**
 * WizardContainer — Phase 12 PR 3a
 *
 * The main orchestrator for the Enhanced Setup Wizard v2. Can render in
 * two modes:
 *
 *   - `mode="modal"` (default) — fixed overlay; used from DashboardLayout
 *                                as the onboarding gate. Backwards
 *                                compatible with PR 2 behaviour.
 *   - `mode="page"`            — full-page centered card; used by
 *                                /app/onboarding for deep-linkable and
 *                                email-friendly onboarding flows.
 *
 * Both modes share the same header, progress bar, body, footer, and AI
 * helper — only the outer wrapper differs.
 *
 * Autosave (PR 2): every state change is debounced by 1.2s and fires the
 * optional `onAutoSave(data, stepIndex)` callback. The first save per
 * "open session" is suppressed because the state was just hydrated.
 */

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
// PR 3b: new conditional step for non-property loans
import { DebtsStep } from './steps/DebtsStep';
import { AccountsStep } from './steps/AccountsStep';
import { InvestmentsStep } from './steps/InvestmentsStep';
// PR 3b: new step for SuperannuationAccount (replaces InvestmentAccount type=SUPERS)
import { SuperStep } from './steps/SuperStep';
import { AssetsStep } from './steps/AssetsStep';
import { IncomeExpensesStep } from './steps/IncomeExpensesStep';
import { ReviewStep } from './steps/ReviewStep';
import { AIHelper } from './AIHelper';
import '@/styles/wizard-animations.css';

// =============================================================================
// TYPES
// =============================================================================

export type WizardMode = 'modal' | 'page';

interface WizardContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: WizardData) => Promise<void> | void;
  /**
   * Render as a full-page experience (`'page'`) or a fixed overlay modal
   * (`'modal'`, default). Used from /app/onboarding vs /dashboard
   * respectively.
   */
  mode?: WizardMode;
  /**
   * Pre-hydrated draft to seed the wizard with. Typically supplied by
   * the mounting layout after reading `useOnboardingState().state.draft`
   * from the server. Merged over INITIAL_WIZARD_DATA on mount.
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
  mode = 'modal',
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

  // ---- Autosave (Phase 12 PR 2) ----------------------------------------
  const autoSaveRef = useRef(onAutoSave);
  useEffect(() => {
    autoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

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

  // ---- Body scroll lock in modal mode ----------------------------------
  useEffect(() => {
    if (mode !== 'modal' || !isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, mode]);

  // ---- Steps -----------------------------------------------------------
  // PR 3b: pass runtime context so getStepsForProfile can hide the
  // Properties step for renters and show the Debts step only when the
  // user ticked at least one debt category on Welcome.
  const steps = useMemo(() => {
    if (!data.profileType) {
      return WIZARD_STEPS.filter((s) => s.id === 'welcome');
    }
    return getStepsForProfile(data.profileType, {
      housing: data.housing,
      debtCategories: data.debtCategories,
    });
  }, [data.profileType, data.housing, data.debtCategories]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // ---- Handlers --------------------------------------------------------
  const handleUpdate = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) return;
    setDirection('forward');
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [isLastStep, steps.length]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    setDirection('backward');
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, [isFirstStep]);

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

  // ---- Keyboard (Escape closes in modal mode) --------------------------
  useEffect(() => {
    if (mode !== 'modal' || !isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, mode, isSubmitting, onClose]);

  const canProceed = useMemo(() => {
    switch (currentStep?.id) {
      case 'welcome':
        return !!data.profileType;
      default:
        return true;
    }
  }, [currentStep?.id, data.profileType]);

  // Don't render if closed (modal mode only — page mode is always
  // "open" when routed). MUST be after all hooks.
  if (mode === 'modal' && !isOpen) return null;

  // ---- Step content ----------------------------------------------------
  const renderStepContent = () => {
    const animationClass =
      direction === 'forward' ? 'wizard-step-enter' : 'wizard-step-enter-back';
    switch (currentStep?.id) {
      case 'welcome':
        return (
          <div key={currentStep.id} className={animationClass}>
            <WelcomeStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'household':
        return (
          <div key={currentStep.id} className={animationClass}>
            <HouseholdStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'properties':
        return (
          <div key={currentStep.id} className={animationClass}>
            <PropertiesStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'debts':
        return (
          <div key={currentStep.id} className={animationClass}>
            <DebtsStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'accounts':
        return (
          <div key={currentStep.id} className={animationClass}>
            <AccountsStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'investments':
        return (
          <div key={currentStep.id} className={animationClass}>
            <InvestmentsStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'super':
        return (
          <div key={currentStep.id} className={animationClass}>
            <SuperStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'assets':
        return (
          <div key={currentStep.id} className={animationClass}>
            <AssetsStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'income-expenses':
        return (
          <div key={currentStep.id} className={animationClass}>
            <IncomeExpensesStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'review':
        return (
          <div key={currentStep.id} className={animationClass}>
            <ReviewStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      default:
        return null;
    }
  };

  // =============================================================================
  // SHELL — shared header, progress, body, footer (used by both modes)
  // =============================================================================

  const showProgress = !!data.profileType;

  const Header = (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.45)]">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            Monitrax setup
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {currentStep?.description || 'Let\u2019s build your dashboard'}
          </p>
        </div>
      </div>
      {mode === 'modal' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close setup"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  const ProgressBar = showProgress ? (
    <div className="px-6 py-3 border-b border-slate-200/70 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40">
      <div className="flex items-center gap-1.5" role="list" aria-label="Wizard progress">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isAccessible = index <= currentStepIndex;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => isAccessible && handleJumpToStep(index)}
                disabled={!isAccessible}
                aria-current={isCurrent ? 'step' : undefined}
                title={step.title}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold border-2 transition-all ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 border-transparent text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)]'
                    : isCurrent
                    ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 border-transparent text-white shadow-[0_4px_12px_-4px_rgba(99,102,241,0.55)] scale-110'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                } ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : step.icon}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-colors ${
                    index < currentStepIndex
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {currentStep?.title}
        </span>
        <span className="tabular-nums">
          Step {currentStepIndex + 1} of {steps.length}
        </span>
      </div>
    </div>
  ) : null;

  const Body = (
    <div
      className={`flex-1 overflow-y-auto px-6 py-8 ${
        mode === 'modal' ? 'max-h-[60vh]' : ''
      }`}
    >
      {renderStepContent()}
    </div>
  );

  const Footer = (
    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
      <button
        type="button"
        onClick={handleBack}
        disabled={isFirstStep}
        className={`wz-btn-ghost ${isFirstStep ? 'opacity-30' : ''}`}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center gap-3">
        {currentStep?.isOptional && (
          <button
            type="button"
            onClick={handleNext}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            Skip this step
          </button>
        )}

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="wz-btn-primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Launch dashboard
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="wz-btn-primary"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  const ShellInner = (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {Header}
      {ProgressBar}
      {Body}
      {Footer}
      <AIHelper currentStep={currentStep?.id || 'welcome'} />
    </div>
  );

  // --- Render based on mode --------------------------------------------
  if (mode === 'page') {
    return (
      <div className="wz-page-root">
        <div className="wz-page-shell">
          <div className="wz-page-card">{ShellInner}</div>
        </div>
      </div>
    );
  }

  // mode === 'modal'
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)_inset] max-h-[92vh]">
        {ShellInner}
      </div>
    </div>
  );
}

export default WizardContainer;
