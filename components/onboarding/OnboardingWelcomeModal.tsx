'use client';

/**
 * OnboardingWelcomeModal — Phase 12 PR 2 premium redesign
 *
 * The first-time experience gate. Shown to users on their first visit to
 * /dashboard when onboarding is not yet complete AND the user has not
 * explicitly opted out with "Don't show this again".
 *
 * Behaviour contract (strict "show once / never again"):
 *   - Closing with X / backdrop / "Not right now" ONLY hides for this
 *     session. The modal returns on next login UNLESS the user also
 *     ticked the "Don't show this again" box — in which case we call
 *     onDismissPermanently() to persist the preference.
 *   - "Start setup" opens the wizard. If the user abandons the wizard
 *     without a draft, the modal returns next login.
 *   - "Take a quick tour first" hands off to the guided tour. Tour
 *     completion does NOT dismiss the welcome modal (tour state is
 *     tracked separately).
 *   - Completing the wizard clears the draft and sets
 *     onboardingCompleted = true, so the modal never returns.
 *
 * See: hooks/useOnboardingState.ts (shouldShowWelcome contract),
 *      components/DashboardLayout.tsx (handler wiring).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  ArrowRight,
  Play,
  X,
  TrendingUp,
  PiggyBank,
  BarChart3,
  Clock,
  Check,
} from 'lucide-react';
import '@/styles/wizard-animations.css';

interface OnboardingWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSetup: () => void;
  onTakeTour: () => void;
  /**
   * Close the modal for this session only. Called when the user dismisses
   * without ticking "Don't show this again" — the modal will reappear on
   * next login.
   */
  onSkip: () => void;
  /**
   * Permanently opt the user out of future welcome modal appearances.
   * Persists `UserPreference.dismissedWelcomeModal = true`. Called only
   * when the user ticks "Don't show this again" before closing.
   */
  onDismissPermanently?: () => Promise<void>;
}

const VALUE_PROPS: Array<{
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}> = [
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: 'See your full picture',
    description: 'Net worth, cashflow and portfolio health in one place.',
    accent: 'from-blue-500/15 to-indigo-500/15 text-blue-600 dark:text-blue-400',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Forecast the future',
    description: 'Smart projections show where your money is headed.',
    accent: 'from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-400',
  },
  {
    icon: <PiggyBank className="h-5 w-5" />,
    title: 'Optimise & grow',
    description: 'AI recommendations you can actually act on.',
    accent: 'from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400',
  },
];

export function OnboardingWelcomeModal({
  isOpen,
  onClose,
  onStartSetup,
  onTakeTour,
  onSkip,
  onDismissPermanently,
}: OnboardingWelcomeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Unified close path — respects the "Don't show again" checkbox.
  // Called from: X button, backdrop click, Escape key, "Not right now".
  const handleDismiss = useCallback(async () => {
    if (isDismissing) return;
    if (dontShowAgain && onDismissPermanently) {
      setIsDismissing(true);
      try {
        await onDismissPermanently();
      } catch (e) {
        console.warn('Could not save permanent dismiss preference:', e);
      }
      setIsDismissing(false);
    }
    onSkip();
  }, [dontShowAgain, isDismissing, onDismissPermanently, onSkip]);

  // Escape key closes (respecting the checkbox). Only active while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleDismiss]);

  // Lock body scroll while the modal is open so the underlying dashboard
  // doesn't slide behind the hero.
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, mounted]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-subtitle"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close welcome dialog"
        onClick={handleDismiss}
        className="welcome-modal-backdrop absolute inset-0 cursor-default"
      />

      {/* Card */}
      <div
        className="welcome-modal-card relative w-full max-w-xl overflow-hidden rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-md transition-all hover:bg-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero section */}
        <div className="relative h-48 overflow-hidden">
          {/* Animated aurora layers */}
          <div className="welcome-hero-aurora" />
          <div className="welcome-hero-aurora-secondary" />
          {/* Noise overlay for texture */}
          <div className="welcome-hero-noise" />
          {/* Bottom fade into card body */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white/95 dark:to-slate-900/95" />

          {/* Floating sparkles */}
          <Sparkles
            className="welcome-sparkle absolute left-[14%] top-[22%] h-4 w-4 text-white/80"
            style={{ ['--sparkle-delay' as string]: '0s' }}
          />
          <Sparkles
            className="welcome-sparkle absolute right-[18%] top-[18%] h-3 w-3 text-white/70"
            style={{ ['--sparkle-delay' as string]: '0.8s' }}
          />
          <Sparkles
            className="welcome-sparkle absolute left-[28%] top-[58%] h-3 w-3 text-white/60"
            style={{ ['--sparkle-delay' as string]: '1.6s' }}
          />
          <Sparkles
            className="welcome-sparkle absolute right-[30%] top-[50%] h-4 w-4 text-white/80"
            style={{ ['--sparkle-delay' as string]: '2.2s' }}
          />

          {/* Logo mark */}
          <div className="relative z-10 flex h-full items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-white shadow-[0_8px_28px_-8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              <Sparkles className="h-8 w-8" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-8 pb-7 pt-5">
          {/* Time chip */}
          <div className="mb-4 flex justify-center">
            <span className="welcome-time-chip inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3 w-3" />
              Takes about 5 minutes
            </span>
          </div>

          {/* Heading */}
          <h1
            id="welcome-modal-title"
            className="text-center text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            style={{ letterSpacing: '-0.02em' }}
          >
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
              Monitrax
            </span>
          </h1>
          <p
            id="welcome-modal-subtitle"
            className="mt-2 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Your personal wealth command center. Let&apos;s get you set up — it&apos;s faster than
            you think.
          </p>

          {/* Value props — horizontal on ≥sm, stacked on xs */}
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {VALUE_PROPS.map((prop, i) => (
              <div
                key={prop.title}
                className="welcome-prop rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-700/50 dark:bg-slate-800/40"
                style={{ ['--prop-index' as string]: i }}
              >
                <div
                  className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${prop.accent}`}
                >
                  {prop.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {prop.title}
                </h3>
                <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
                  {prop.description}
                </p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={onStartSetup}
              className="welcome-cta-primary group relative flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white"
            >
              Start guided setup
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={onTakeTour}
              className="welcome-cta-secondary flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <Play className="h-4 w-4" />
              Take a quick tour first
            </button>
          </div>

          {/* Skip link + "Don't show again" checkbox */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <label className="group flex cursor-pointer items-center gap-2 select-none">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                  dontShowAgain
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 group-hover:border-slate-400 dark:group-hover:border-slate-500'
                }`}
              >
                {dontShowAgain && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="sr-only"
                aria-label="Don't show this welcome modal again"
              />
              <span className="text-xs text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">
                Don&apos;t show this again
              </span>
            </label>

            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              Not right now
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default OnboardingWelcomeModal;
