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
import { X, ChevronLeft, ChevronRight, Rocket, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  WizardData,
  INITIAL_WIZARD_DATA,
  getStepsForProfile,
  type StepCommitFn,
} from './types';
import { WelcomeStep } from './steps/WelcomeStep';
import { HouseholdStep } from './steps/HouseholdStep';
// Phase 41b: "How is your wealth held?" — entity layer step
import { EntitiesStep } from './steps/EntitiesStep';
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
  // Surface submit failures so the user isn't stuck staring at a button
  // that quietly reverts from "Launching…" to "Launch dashboard" with
  // no idea what went wrong. Cleared on each new submit attempt.
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Phase 12 Track F.1: per-step commit ------------------------------
  // `stepCommitRef` holds the current step's async commit function, if it
  // registered one (a Track-F-migrated step does; un-migrated steps don't).
  // The container awaits it before advancing. `isCommitting` disables the
  // footer + shows a spinner while a domain is writing to its real tables.
  const stepCommitRef = useRef<StepCommitFn | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  // Surface a commit failure (e.g. a household write 500'd) in the footer
  // so the user can retry instead of silently failing to advance.
  const [commitError, setCommitError] = useState<string | null>(null);

  const registerStepCommit = useCallback((fn: StepCommitFn | null) => {
    stepCommitRef.current = fn;
  }, []);

  /**
   * Run the current step's registered commit (if any). Returns `true` when
   * it's safe to advance (no commit, or commit succeeded), `false` when a
   * commit threw — in which case the caller must NOT navigate.
   */
  const runStepCommit = useCallback(async (): Promise<boolean> => {
    const commit = stepCommitRef.current;
    if (!commit) return true;
    setCommitError(null);
    setIsCommitting(true);
    try {
      await commit();
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We couldn’t save this step. Please try again.';
      setCommitError(message);
      return false;
    } finally {
      setIsCommitting(false);
    }
  }, []);

  // ---- Late hydration from server draft --------------------------------
  // If the wizard mounts BEFORE the parent finishes fetching
  // onboardingState, `initialData` arrives as undefined and `data` stays
  // at INITIAL_WIZARD_DATA (profileType: null). When the fetch later
  // completes, `initialData` transitions from undefined → the real
  // server draft, but `useState` above only reads it on first mount —
  // so without this effect the wizard would stay stuck with empty data
  // and the `steps` array would collapse to [welcome], causing the
  // footer to show "Launch dashboard" on the Welcome step.
  //
  // Fix (Phase 12 v3 — bug A.6): the previous implementation flipped
  // `hasAppliedLateHydrationRef` on BOTH the successful-apply branch
  // AND the user-touched guard branch. That made the effect a one-shot
  // even when nothing had actually been applied — e.g. the user typed
  // something before the slow-network fetch returned, the effect ran,
  // saw non-null profileType/housing, flipped the ref and returned.
  // When `initialData` later arrived (or the user reverted their edits),
  // the ref was already true and the effect was permanently locked out,
  // so the wizard either stayed empty or held a partial draft forever.
  //
  // The ref now flips only on a **successful apply**. The user-touched
  // guard returns without flipping, so the effect stays armed: if the
  // user clears their edits back to null or if `initialData` changes
  // reference to richer content, the effect gets another fair attempt.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.6.
  const hasAppliedLateHydrationRef = useRef(false);
  useEffect(() => {
    if (hasAppliedLateHydrationRef.current) return;
    if (!initialData || typeof initialData !== 'object') return;
    if (Object.keys(initialData).length === 0) return;
    // Guard against overwriting user edits. "Untouched" = profileType
    // and housing are both still null (the two earliest decisions in
    // the Welcome step). We deliberately do NOT flip the ref here —
    // doing so would permanently disarm the effect and stop a later,
    // richer `initialData` from ever being applied.
    if (data.profileType !== null || data.housing !== null) {
      return;
    }
    hasAppliedLateHydrationRef.current = true;
    setData((prev) => ({ ...prev, ...initialData }));
    if (typeof initialStepIndex === 'number' && initialStepIndex >= 0) {
      setCurrentStepIndex(initialStepIndex);
    }
  }, [initialData, initialStepIndex, data.profileType, data.housing]);

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
    // Do not autosave a completely empty draft — that would persist
    // `{profileType: null, housing: null, ...}` to the server, which
    // later hydrates into a wizard that can't show the submit button
    // on the right step (see isSubmitStep below). We wait until the
    // user has made at least one meaningful selection.
    const hasMeaningfulProgress =
      data.profileType !== null ||
      data.housing !== null ||
      data.debtCategories.length > 0 ||
      data.properties.length > 0 ||
      data.accounts.length > 0;
    if (!hasMeaningfulProgress) return;
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
  //
  // Fix (Phase 12 v3 — bug A.7): previously returned just the welcome
  // step when `data.profileType` was null, which collapsed `steps.length`
  // to 1 and trapped navigation. The symptoms:
  //
  //   1. handleNext's `Math.min(prev + 1, steps.length - 1)` clamp sent
  //      the user back to index 0 on any navigation action — the
  //      "sent back to the property section" report.
  //   2. `isLastStep` evaluated to true on the welcome step, which made
  //      the footer try to render the "Launch dashboard" submit button.
  //      The `isSubmitStep` defensive check below was added as a
  //      workaround for exactly this symptom.
  //   3. If profileType went null mid-flow (late hydration race, user
  //      reverting Welcome answers, etc.) `currentStep = steps[currentStepIndex]`
  //      could become undefined, rendering a blank body.
  //
  // Fix: when profileType is null, fall back to the broadest profile
  // (MIXED) so the steps array stays stable and indexes remain valid.
  // The user is still gated from advancing by `canProceed` on the
  // welcome step (Continue is disabled until they pick housing and
  // hasInvestments), and `isSubmitStep` stays as belt-and-braces —
  // the submit button can only ever appear on the real review step.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.7.
  const steps = useMemo(() => {
    const effectiveProfile = data.profileType ?? 'MIXED';
    return getStepsForProfile(effectiveProfile, {
      housing: data.housing,
      debtCategories: data.debtCategories,
    });
  }, [data.profileType, data.housing, data.debtCategories]);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  // A step is the final "submit + launch" step only when it is literally
  // the review step. Using just `isLastStep` is UNSAFE: if the steps
  // array has collapsed to [welcome] because `data.profileType` is still
  // null (e.g. the user hasn't finished picking housing + investments
  // yet, or the wizard hydrated before the server draft finished
  // loading), `isLastStep` evaluates to true on the Welcome step. That
  // would cause the footer to render a "Launch dashboard" button that
  // submits an EMPTY draft to /api/onboarding/bulk-create on click.
  // Gating on `currentStep?.id === 'review'` avoids this footgun
  // entirely — the submit button can only appear when the wizard is
  // actually done.
  const isSubmitStep = currentStep?.id === 'review';

  // ---- Handlers --------------------------------------------------------
  const handleUpdate = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Phase 12 Track F.1: handleNext is now async — it commits the current
  // step's domain to its real tables (if the step registered a commit)
  // BEFORE advancing. A failed commit keeps the user on the step with an
  // error in the footer; their data is not lost.
  const handleNext = useCallback(async () => {
    if (isLastStep || isCommitting) return;
    const ok = await runStepCommit();
    if (!ok) return;
    setDirection('forward');
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [isLastStep, isCommitting, runStepCommit, steps.length]);

  // Back also commits — leaving the household step backward should still
  // persist the user's edits (the data IS the state, design doc §3.2).
  // A failed commit keeps them on the step so nothing is silently lost.
  const handleBack = useCallback(async () => {
    if (isFirstStep || isCommitting) return;
    const ok = await runStepCommit();
    if (!ok) return;
    setDirection('backward');
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, [isFirstStep, isCommitting, runStepCommit]);

  const handleJumpToStep = useCallback(
    async (index: number) => {
      if (isCommitting || index === currentStepIndex) return;
      // Commit the current step's domain before jumping away from it.
      const ok = await runStepCommit();
      if (!ok) return;
      if (index < currentStepIndex) {
        setDirection('backward');
      } else {
        setDirection('forward');
      }
      setCurrentStepIndex(index);
    },
    [currentStepIndex, isCommitting, runStepCommit]
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(data);
    } catch (error) {
      console.error('Failed to complete wizard:', error);
      // Surface a human-readable message in the footer so the user
      // can decide whether to retry, edit a field, or contact support.
      // Falls back to a generic message when the thrown value isn't
      // an Error (e.g. the page-mode handler in /app/onboarding/page.tsx
      // re-throws the parsed `errorData.error` string).
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : 'We couldn’t save your setup. Please try again.';
      setSubmitError(message);
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

  // Per-step validation. A step's `canProceed` returning `false`
  // disables Continue / Launch dashboard, and `blockedReason`
  // (computed alongside) is rendered as an inline hint above the
  // footer buttons so the user knows what's missing.
  //
  // We mirror the validation that bulk-create enforces server-side
  // (see app/api/onboarding/bulk-create/route.ts) so the user can
  // never reach the Review step in a state that would 400 the
  // submit. Previously the only validated step was Welcome, which
  // meant a user could complete the entire wizard, click Launch
  // dashboard, and only then discover that e.g. a Property was
  // missing a purchase date.
  const { canProceed, blockedReason } = useMemo<{
    canProceed: boolean;
    blockedReason: string | null;
  }>(() => {
    switch (currentStep?.id) {
      case 'welcome':
        if (!data.profileType) {
          return { canProceed: false, blockedReason: null };
        }
        return { canProceed: true, blockedReason: null };

      case 'properties': {
        // bulk-create rejects properties without a purchase date
        // (used for CGT, depreciation, equity history). Surface the
        // first offender's name so the user knows where to look.
        const missing = data.properties.find(
          (p) => !p.purchaseDate || !String(p.purchaseDate).trim()
        );
        if (missing) {
          const label =
            missing.name?.trim() ||
            missing.address?.trim() ||
            'one of your properties';
          return {
            canProceed: false,
            blockedReason: `Add a purchase date for "${label}" before continuing.`,
          };
        }
        return { canProceed: true, blockedReason: null };
      }

      case 'assets': {
        // Same contract as properties — bulk-create rejects assets
        // without a purchase date.
        const missing = data.assets.find(
          (a) => !a.purchaseDate || !String(a.purchaseDate).trim()
        );
        if (missing) {
          const label =
            missing.name?.trim() ||
            missing.type ||
            'one of your assets';
          return {
            canProceed: false,
            blockedReason: `Add a purchase date for "${label}" before continuing.`,
          };
        }
        return { canProceed: true, blockedReason: null };
      }

      default:
        return { canProceed: true, blockedReason: null };
    }
  }, [
    currentStep?.id,
    data.profileType,
    data.properties,
    data.assets,
  ]);

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
            {/*
             * Phase 12 Track F.1: HouseholdStep reads + writes the REAL
             * household tables directly. It registers an async commit via
             * `registerStepCommit`; the container awaits it on Continue /
             * Back / progress-jump (see runStepCommit above).
             */}
            <HouseholdStep
              data={data}
              onUpdate={handleUpdate}
              registerStepCommit={registerStepCommit}
            />
          </div>
        );
      case 'entities':
        return (
          <div key={currentStep.id} className={animationClass}>
            <EntitiesStep data={data} onUpdate={handleUpdate} />
          </div>
        );
      case 'properties':
        return (
          <div key={currentStep.id} className={animationClass}>
            {/*
             * Phase 12 Track F.2: PropertiesStep reads + writes the REAL
             * property tables (Property + Loan + Income + Expense). It
             * registers an async commit via `registerStepCommit`; the
             * container awaits it on Continue / Back / progress-jump.
             */}
            <PropertiesStep
              data={data}
              onUpdate={handleUpdate}
              registerStepCommit={registerStepCommit}
            />
          </div>
        );
      case 'debts':
        return (
          <div key={currentStep.id} className={animationClass}>
            {/*
             * Phase 12 Track F.4: DebtsStep reads + writes the real `Loan`
             * table for standalone debts. It registers an async commit via
             * `registerStepCommit`; the container awaits it on Continue /
             * Back / progress-jump.
             */}
            <DebtsStep
              data={data}
              onUpdate={handleUpdate}
              registerStepCommit={registerStepCommit}
            />
          </div>
        );
      case 'accounts':
        return (
          <div key={currentStep.id} className={animationClass}>
            {/*
             * Phase 12 Track F.3: AccountsStep reads + writes the real
             * `Account` table for MANUAL accounts. It registers an async
             * commit via `registerStepCommit`; the container awaits it on
             * Continue / Back / progress-jump.
             */}
            <AccountsStep
              data={data}
              onUpdate={handleUpdate}
              registerStepCommit={registerStepCommit}
            />
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
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60 flex-shrink-0">
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
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* AI Helper trigger — rendered inline in the header so it never
            overlaps the wizard's Back/Next buttons (which sit in the
            footer at the bottom-right of the card). */}
        <AIHelper
          currentStep={currentStep?.id || 'welcome'}
          buttonClassName="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-white shadow-sm hover:shadow-md hover:brightness-110 transition-all"
        />
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
    </div>
  );

  const ProgressBar = showProgress ? (
    <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-200/70 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 flex-shrink-0 overflow-x-auto">
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
                className={`flex h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] sm:text-xs font-semibold border-2 transition-all ${
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
      className={`flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8 ${
        mode === 'modal' ? 'max-h-[60vh]' : ''
      }`}
    >
      {renderStepContent()}
    </div>
  );

  const Footer = (
    <div className="flex flex-col gap-2 border-t border-slate-200/70 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95 flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4">
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/30 dark:text-rose-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <strong className="font-semibold">Couldn’t finish setup.</strong>{' '}
            {submitError} Please try again — your answers are still saved.
          </div>
        </div>
      )}
      {/*
       * Phase 12 Track F.1: a commit failure (the step's domain couldn't
       * be written to its real tables). Distinct from `submitError`
       * (final bulk-create) — this one means "Continue couldn't save".
       * The user's in-step data is intact; they can retry Continue.
       */}
      {!submitError && commitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/30 dark:text-rose-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <strong className="font-semibold">Couldn’t save this step.</strong>{' '}
            {commitError} Your answers are still here — please try again.
          </div>
        </div>
      )}
      {/*
       * Inline hint when the user can't continue because a required
       * field on the current step is missing. Using amber (not rose)
       * so it reads as a gentle nudge rather than an error — the
       * user hasn't done anything wrong, they just haven't finished.
       */}
      {!submitError && !commitError && blockedReason && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="min-w-0">{blockedReason}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={handleBack}
        disabled={isFirstStep || isCommitting}
        className={`wz-btn-ghost ${isFirstStep || isCommitting ? 'opacity-30' : ''}`}
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

        {isSubmitStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isCommitting || !canProceed}
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
            disabled={!canProceed || isCommitting}
            className="wz-btn-primary"
          >
            {isCommitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>
      </div>
    </div>
  );

  const ShellInner = (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ minHeight: '100dvh' }}>
      {Header}
      {ProgressBar}
      {Body}
      {Footer}
      {/* AIHelper trigger is rendered inline inside the Header (see above)
          to avoid the floating button overlapping the wizard's Next button.
          The panel itself is still portaled from within <AIHelper />. */}
    </div>
  );

  // --- Render based on mode --------------------------------------------
  if (mode === 'page') {
    return (
      <div className="wz-page-root">
        <div className="wz-page-shell">
          <div className="wz-page-card">
            {ShellInner}
          </div>
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)_inset] max-h-[92vh]">
        {ShellInner}
      </div>
    </div>
  );
}

export default WizardContainer;
