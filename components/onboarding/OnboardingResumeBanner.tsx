'use client';

/**
 * OnboardingResumeBanner — Phase 12 PR 2
 *
 * Persistent in-progress banner shown on EVERY dashboard page when a
 * user has an unfinished wizard draft (server-persisted via
 * UserPreference.onboardingDraft, or localStorage fallback). Matches
 * the premium feel of OnboardingWelcomeModal.
 *
 * Persistence rationale: the user is technically still inside the
 * onboarding workflow even when they navigate from /dashboard to
 * /dashboard/properties to add their first property. Hiding the
 * banner the moment they leave /dashboard would lose the visual
 * anchor and the way back to the wizard. The banner stays put across
 * all pages until the wizard completes, the user dismisses it, or
 * the user explicitly clicks "Start over".
 *
 * Actions:
 *   - Resume setup  → reopens the wizard pre-hydrated with the saved draft
 *   - Start over    → clears the draft and resets currentStep (see
 *                     DashboardLayout.handleResumeBannerStartOver)
 *   - Dismiss (X)   → hides for this session only (resets next login)
 *
 * See: hooks/useOnboardingState.ts (shouldShowResumeBanner)
 *      components/DashboardLayout.tsx (handler wiring + render gate)
 */

import React from 'react';
import { Rocket, RotateCcw, X, Sparkles, ArrowRight } from 'lucide-react';
import '@/styles/wizard-animations.css';

interface OnboardingResumeBannerProps {
  /** Zero-based step the user left off on (for the "Step X of Y" label). */
  currentStep?: number;
  /** Total steps in the active profile flow (for the "Step X of Y" label). */
  totalSteps?: number;
  /** Click handler for the "Resume setup" button. */
  onResume: () => void;
  /** Click handler for the "Start over" button. Should call clearDraft(). */
  onStartOver: () => void;
  /** Click handler for the dismiss (X) button. Session-scoped only. */
  onDismiss: () => void;
}

export function OnboardingResumeBanner({
  currentStep,
  totalSteps,
  onResume,
  onStartOver,
  onDismiss,
}: OnboardingResumeBannerProps) {
  const hasProgress =
    typeof currentStep === 'number' && typeof totalSteps === 'number' && totalSteps > 0;
  const stepLabel = hasProgress
    ? `Step ${Math.min((currentStep ?? 0) + 1, totalSteps!)} of ${totalSteps}`
    : 'Draft saved';
  // Percent complete for the inline progress meter.
  const percent = hasProgress
    ? Math.round((Math.min((currentStep ?? 0) + 1, totalSteps!) / totalSteps!) * 100)
    : 0;

  return (
    <div
      role="region"
      aria-label="Resume onboarding"
      className="welcome-modal-card relative mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/85"
    >
      {/* Subtle gradient accent bar on the left edge */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 via-indigo-500 to-violet-500" />

      {/* Soft ambient glow behind the rocket — echoes the welcome hero. */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-violet-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        {/* Icon + sparkle */}
        <div className="flex-shrink-0">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.45)]">
            <Rocket className="h-5 w-5" />
            <Sparkles
              className="welcome-sparkle absolute -right-1 -top-1 h-3 w-3 text-amber-300"
              style={{ ['--sparkle-delay' as string]: '0s' }}
            />
          </div>
        </div>

        {/* Text + progress */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Continue your TRAIL
            </h3>
            <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 sm:inline-block">
              {stepLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Your progress is saved. Finish to unlock your Guide and dashboard insights.
          </p>

          {/* Progress bar */}
          {hasProgress && (
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {percent}%
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:flex-col sm:items-stretch lg:flex-row lg:items-center">
          <button
            type="button"
            onClick={onResume}
            className="welcome-cta-primary group inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Resume
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="welcome-cta-secondary inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </button>
        </div>

        {/* Dismiss (session-scoped) */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default OnboardingResumeBanner;
