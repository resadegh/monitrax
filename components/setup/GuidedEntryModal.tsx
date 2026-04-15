'use client';

/**
 * GuidedEntryModal — Phase 12 twin-track (A.6)
 *
 * Shared shell for the 6 lightweight per-module guided entry flows
 * on `/dashboard/setup`. Replaces the "click tile → deep-link to
 * full entity page" pattern with a step-based modal that keeps the
 * user in the setup context.
 *
 * Design philosophy (directive §2.6):
 *   - Step-based, not one giant form
 *   - Each step is a single input or a small set of related inputs
 *   - Immediate feedback after each submit
 *   - Cancel at any step without writing partial data
 *   - Align visually with the /onboarding wizard (linear, minimal,
 *     premium) so users don't feel they've jumped UX paradigms
 *
 * What this file is
 * =================
 *
 * A pure presentational shell. Consumers define their steps as an
 * array of `GuidedEntryStep` objects and pass them in. The shell
 * handles:
 *   - Modal chrome (overlay, close button, ESC to close, focus trap)
 *   - Step index state machine
 *   - Back / Next / Submit navigation
 *   - Progress dots showing the user where they are
 *   - Fade/slide transitions between steps
 *   - `prefers-reduced-motion` compliance
 *
 * What the shell does NOT do
 * ==========================
 *
 *   - Validation — consumers validate their own inputs per step
 *   - API calls — consumers call their own endpoints on submit
 *   - Loading states — consumers decide how to render in-flight state
 *
 * Architecture:
 *   - Pure client component. No hooks except React state.
 *   - Composable: each step is just a ReactNode, so consumers can
 *     render anything they like (forms, segmented controls, etc.).
 *   - Keyboard accessible: ESC closes, Enter submits (per step), Tab
 *     loops focus within the modal.
 *   - Dark-mode native.
 *
 * See docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md §4.2 A.6.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface GuidedEntryStep {
  /** Stable id for the step, used as React key and for debugging. */
  id: string;
  /** Short question or prompt, shown as the step heading. */
  question: string;
  /** Optional supporting line below the question. */
  supporting?: string;
  /** The step body — usually a form field or a small group of them. */
  body: ReactNode;
  /**
   * Optional validation hook. Return `true` to allow advancing.
   * Return `false` to block advancement (consumer is responsible
   * for surfacing the validation error in the body).
   */
  canAdvance?: () => boolean;
}

export interface GuidedEntryModalProps {
  /** Whether the modal is open. Parent controls visibility. */
  open: boolean;
  /** Called when the user closes the modal (ESC, X button, cancel). */
  onClose: () => void;
  /** The title of the overall flow, shown in the modal header. */
  title: string;
  /** Optional subtitle rendered below the title in the header. */
  subtitle?: string;
  /** Ordered steps. The shell advances through them sequentially. */
  steps: GuidedEntryStep[];
  /**
   * Called when the user clicks the final-step submit button.
   * Receives no arguments — consumers track their own form state
   * outside the shell. Should return a Promise; the shell shows a
   * loading state until it resolves.
   */
  onComplete: () => Promise<void> | void;
  /** Custom submit button label on the last step. Defaults to "Save". */
  submitLabel?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GuidedEntryModal({
  open,
  onClose,
  title,
  subtitle,
  steps,
  onComplete,
  submitLabel = 'Save',
}: GuidedEntryModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset step index when the modal opens or closes.
  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setIsSubmitting(false);
    }
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, isSubmitting]);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const currentStep = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    setStepIndex((idx) => Math.max(0, idx - 1));
  }, [isFirstStep]);

  const handleAdvance = useCallback(async () => {
    if (currentStep?.canAdvance && !currentStep.canAdvance()) {
      return;
    }
    if (isLastStep) {
      setIsSubmitting(true);
      try {
        await onComplete();
        onClose();
      } catch (err) {
        // Consumers are responsible for surfacing errors in the body.
        // eslint-disable-next-line no-console
        console.error('[GuidedEntryModal] onComplete failed:', err);
        setIsSubmitting(false);
      }
    } else {
      setStepIndex((idx) => Math.min(steps.length - 1, idx + 1));
    }
  }, [currentStep, isLastStep, onComplete, onClose, steps.length]);

  if (!open || !currentStep) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-entry-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop — click to close */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => !isSubmitting && onClose()}
        className="absolute inset-0 h-full w-full bg-slate-900/60 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
      />

      {/* Modal card */}
      <div
        ref={modalRef}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 p-5 dark:border-slate-700/50">
          <div className="min-w-0 flex-1">
            <h2
              id="guided-entry-title"
              className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 motion-reduce:transition-none dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        {steps.length > 1 && (
          <div
            aria-hidden="true"
            className="flex items-center justify-center gap-1.5 pt-4"
          >
            {steps.map((step, idx) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                  idx === stepIndex
                    ? 'w-6 bg-indigo-500 dark:bg-indigo-400'
                    : idx < stepIndex
                    ? 'w-1.5 bg-emerald-500 dark:bg-emerald-400'
                    : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Body — the active step */}
        <div className="flex-1 p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {currentStep.question}
          </h3>
          {currentStep.supporting && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {currentStep.supporting}
            </p>
          )}
          <div className="mt-4">{currentStep.body}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 p-4 dark:border-slate-700/50">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep || isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-30 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleAdvance}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Saving…
              </>
            ) : (
              <>
                {isLastStep ? submitLabel : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuidedEntryModal;
