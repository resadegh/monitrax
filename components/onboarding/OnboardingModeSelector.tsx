'use client';

/**
 * Onboarding mode selector — Phase 12 Track E.2c
 *
 * Renders BEFORE either the form-wizard or the chat surface when:
 *   (a) the `CONVERSATIONAL_ONBOARDING` flag is ON, AND
 *   (b) no `?mode=` query param is present, AND
 *   (c) the user has no draft progress yet (currentStep === 0 and
 *       no entered fields in their draft).
 *
 * Why this exists: live testing 2026-05-19 surfaced that the small
 * pill toggle at the top of `/onboarding` was effectively invisible
 * — users landed, saw the form below, and started typing without
 * registering that "Chat with Monitrax" was a real option. Per the
 * Behavioural-Psychologist + Designer lenses (CLAUDE.md §0), when
 * the default path is visible the alternative gets ~5% engagement.
 * Solution: stop the user at a fork before either path renders.
 * Two equally weighted cards, deliberate click, no default.
 *
 * Design discipline (Phase 12 §4a — presence, not persona):
 *   - No "AI" marketing language, no character framing, no emojis.
 *   - Two cards, equal visual weight. Neither is "recommended".
 *   - Time estimates on both ("Either mode reaches the same place").
 *   - Mobile-first stack; side-by-side from `sm:` (640px).
 *   - Matches the existing wizard hero token palette (warm gradient
 *     glyph, slate-on-white card chrome, green pill for time).
 *
 * After selection, navigates to `/onboarding?mode=chat` or
 * `/onboarding?mode=form` — the existing `<ConversationalModeToggle>`
 * (smaller pill) remains rendered in the chosen mode as a way to
 * switch later.
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { MessagesSquare, ListChecks, Clock, ArrowRight } from 'lucide-react';

export function OnboardingModeSelector() {
  const router = useRouter();

  const choose = useCallback(
    (mode: 'chat' | 'form') => {
      router.replace(
        mode === 'chat' ? '/onboarding?mode=chat' : '/onboarding?mode=form'
      );
    },
    [router]
  );

  return (
    <section className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center px-5 py-10 sm:py-14">
      {/* Hero glyph — same visual family as the wizard hero */}
      <div
        aria-hidden="true"
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 shadow-[0_12px_32px_-12px_rgba(99,102,241,0.55)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-white"
        >
          <path d="M9 3 L9.8 6 L13 6.8 L9.8 7.6 L9 11 L8.2 7.6 L5 6.8 L8.2 6 Z" fill="currentColor" />
          <path d="M17 13 L17.5 14.5 L19 15 L17.5 15.5 L17 17 L16.5 15.5 L15 15 L16.5 14.5 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Heading */}
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
        Welcome to Monitrax
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-600 sm:text-base dark:text-slate-400">
        How would you like to set up? Pick whichever feels easier — both
        paths reach the same place.
      </p>

      {/* Mode cards */}
      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2 sm:gap-5">
        <ModeCard
          icon={<MessagesSquare className="h-6 w-6" aria-hidden="true" />}
          title="Chat with Monitrax"
          description="Walk through it together — voice or typing. We&rsquo;ll fill the form for you."
          time="~3 min"
          accent="from-violet-500 via-indigo-500 to-blue-500"
          ctaLabel="Start chatting"
          onClick={() => choose('chat')}
        />
        <ModeCard
          icon={<ListChecks className="h-6 w-6" aria-hidden="true" />}
          title="Fill in a form"
          description="Tap through fields at your own pace. Classic and quick."
          time="~5 min"
          accent="from-amber-500 via-orange-500 to-rose-500"
          ctaLabel="Start form"
          onClick={() => choose('form')}
        />
      </div>

      {/* Reassurance */}
      <p className="mt-8 max-w-md text-center text-xs text-slate-500 dark:text-slate-400">
        Your progress saves automatically. You can switch modes any time
        from the toggle at the top.
      </p>
    </section>
  );
}

function ModeCard({
  icon,
  title,
  description,
  time,
  accent,
  ctaLabel,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  accent: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {/* Accented glyph */}
      <div
        aria-hidden="true"
        className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}
      >
        {icon}
      </div>

      <h2 className="mb-1.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-auto flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {time}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100">
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}
