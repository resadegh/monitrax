'use client';

/**
 * LinearProgressBar — Phase 12 Track B (B.1)
 *
 * Top-of-page progress bar for the /onboarding wizard. Renders as a
 * thin gradient fill over a slate track. Width transitions smoothly
 * over 400ms when the current step index advances.
 *
 * Per §8.2 of the twin-track plan: smooth, ease-out cubic, no bounce.
 * Honours `prefers-reduced-motion` via `motion-reduce:transition-none`.
 */

export interface LinearProgressBarProps {
  /** 0-based index of the active step. */
  currentStepIndex: number;
  /** Total number of steps including Welcome and Final Reveal. */
  totalSteps: number;
  /** Optional className appended to the track. */
  className?: string;
}

export function LinearProgressBar({
  currentStepIndex,
  totalSteps,
  className = '',
}: LinearProgressBarProps) {
  // Compute percent filled. +1 so the welcome step shows a small slice
  // (not 0%) and the final step shows 100%.
  const safeTotal = Math.max(totalSteps, 1);
  const percent = Math.min(
    100,
    Math.round(((currentStepIndex + 1) / safeTotal) * 100)
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Onboarding progress: ${percent}%`}
      className={`h-1 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-[width] duration-[400ms] ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default LinearProgressBar;
