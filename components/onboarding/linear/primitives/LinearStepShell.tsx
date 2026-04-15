'use client';

/**
 * LinearStepShell — Phase 12 Track B (B.1)
 *
 * The one-question-per-screen layout contract. Every step in the
 * /onboarding wizard composes this shell so they can never drift
 * on spacing, hierarchy, or motion.
 *
 * Layout:
 *   - Centered column, max 520px wide
 *   - Generous vertical breathing room
 *   - Title (large, tracked-tight)
 *   - Optional supporting line (muted)
 *   - Body slot (usually one input)
 *   - Optional feedback slot (appears after submit)
 *   - Footer with Back ghost + primary CTA
 *
 * Per §8.1 of the twin-track plan:
 *   - Minimal UI per screen — no chrome, no distractions
 *   - Generous spacing, clean typography
 *   - Single primary action, no competing secondaries
 */

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

export interface LinearStepShellProps {
  /** Step heading in user voice — large and tracked-tight. */
  question: string;
  /** Optional supporting line below the question. */
  supporting?: string;
  /** Step body — usually a single input or a small group. */
  children: ReactNode;
  /**
   * Optional feedback slot, rendered below the body. Used for
   * count-up confirmation lines after the user commits a value.
   */
  feedback?: ReactNode;
  /** Primary CTA label. Defaults to "Continue". */
  ctaLabel?: string;
  /** Whether the primary CTA is enabled. */
  canAdvance?: boolean;
  /** Whether a submit is currently in flight. */
  isSubmitting?: boolean;
  /** Primary CTA click handler. */
  onAdvance: () => void;
  /** Back ghost button click handler (optional — hidden if absent). */
  onBack?: () => void;
  /** Optional skip link rendered next to the ghost back button. */
  onSkip?: () => void;
  /** Label for the skip link. Defaults to "Skip for now". */
  skipLabel?: string;
}

export function LinearStepShell({
  question,
  supporting,
  children,
  feedback,
  ctaLabel = 'Continue',
  canAdvance = true,
  isSubmitting = false,
  onAdvance,
  onBack,
  onSkip,
  skipLabel = 'Skip for now',
}: LinearStepShellProps) {
  return (
    <section className="lw-step-enter mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-stretch justify-center gap-6 px-6 py-12 sm:py-20">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
          {question}
        </h1>
        {supporting && (
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
            {supporting}
          </p>
        )}
      </header>

      <div>{children}</div>

      {feedback && <div className="text-sm">{feedback}</div>}

      <footer className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              className="text-xs font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline focus:outline-none focus-visible:underline disabled:opacity-40 motion-reduce:transition-none dark:text-slate-500 dark:hover:text-slate-300"
            >
              {skipLabel}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance || isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-12px_rgba(99,102,241,0.5)] transition-all hover:-translate-y-[1px] hover:shadow-[0_24px_48px_-14px_rgba(99,102,241,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Saving…
            </>
          ) : (
            <>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </footer>
    </section>
  );
}

export default LinearStepShell;
