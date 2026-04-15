/**
 * Linear Wizard design tokens — Phase 12 Track B (B.1)
 *
 * Typed token constants for the /onboarding wizard. Kept as TypeScript
 * constants (not Tailwind config) so consumers can import them for
 * inline style calculations (count-up durations, etc.) without
 * duplicating values across files.
 *
 * Values align with §8 of the twin-track plan:
 *   - Title ~48px, supporting ~16px, input label ~14px
 *   - Spacing rhythm: 120px vertical breathing room
 *   - Max content width: 520px centered
 *   - Ease-out cubic, no bounce
 *   - 200-300ms step transitions, 600-1400ms count-ups
 */

export const LINEAR_WIZARD_TOKENS = {
  // Layout
  maxContentWidth: '520px',
  verticalBreathingRoom: '120px',

  // Typography
  typeScale: {
    title: 'text-4xl sm:text-5xl font-semibold tracking-tight',
    supporting: 'text-base text-slate-600 dark:text-slate-400',
    label: 'text-xs font-medium text-slate-600 dark:text-slate-400',
    feedback: 'text-sm text-slate-600 dark:text-slate-400',
  },

  // Motion
  durations: {
    stepTransition: 280, // ms — fade+slide between steps
    feedbackCountUp: 700, // ms — per-step count-up
    finalRevealCountUp: 1400, // ms — Final Reveal hero count-up
    progressBar: 400, // ms — width transition
  },

  easings: {
    // ease-out cubic bezier — no bounce per §8.6
    primary: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },

  // Colours (Tailwind class fragments)
  colors: {
    primaryGradient:
      'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500',
    primaryGradientText:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400',
    primaryShadow:
      'shadow-[0_20px_40px_-12px_rgba(99,102,241,0.5)]',
    confirmationAccent:
      'text-emerald-600 dark:text-emerald-400',
  },

  // Radii
  radii: {
    card: 'rounded-3xl',
    button: 'rounded-xl',
    chip: 'rounded-full',
  },
} as const;

export type LinearWizardTokens = typeof LINEAR_WIZARD_TOKENS;
