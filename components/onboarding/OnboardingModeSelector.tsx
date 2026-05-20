'use client';

/**
 * Onboarding mode selector — Phase 12 Track E.2c
 *
 * Renders BEFORE either the form-wizard or the chat surface when the
 * `CONVERSATIONAL_ONBOARDING` flag is ON and no `?mode=` query param
 * is present. Two variants:
 *
 *   - `hasDraft={false}` — NEW user. Two equally weighted cards
 *     ("Chat with Monitrax" / "Fill in a form"). Forces a deliberate
 *     first-time choice instead of letting the form anchor the eye.
 *
 *   - `hasDraft={true}` — RETURNING user mid-setup. A prominent
 *     "Continue where you left off" primary (resumes the form wizard
 *     at the saved step) PLUS a single "switch to chat" card. The
 *     user's progress is never lost — both paths read the same draft.
 *
 * Why the two variants (Option C, decided by Reza 2026-05-20,
 * Open Question Q-CONV-2): rev 1 of this component bypassed the
 * selector entirely for mid-draft users, so they only ever saw the
 * small hard-to-see pill toggle. Rev 2 keeps the mode choice visible
 * for returning users too, without forcing a blind re-pick — the
 * "continue" path is one tap.
 *
 * Design discipline (Phase 12 §4a — presence, not persona):
 *   - No "AI" marketing language, no character framing, no emojis.
 *   - New-user variant: two cards, equal visual weight, neither
 *     "recommended". Time estimates on both.
 *   - Returning-user variant: continue is primary (the path of least
 *     resistance — behaviour-psychology lens), chat is the clearly
 *     labelled alternative. Progress reassurance in the subcopy.
 *   - Mobile-first stack; side-by-side from `sm:` (640px).
 *   - Matches the wizard hero token palette (warm gradient glyph,
 *     slate-on-white card chrome, green pill for time).
 *
 * After a choice, navigates to `/onboarding?mode=chat` or
 * `/onboarding?mode=form` — the existing `<ConversationalModeToggle>`
 * (smaller pill) still renders in the chosen mode as a later switch.
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  MessagesSquare,
  ListChecks,
  Clock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

export function OnboardingModeSelector({
  hasDraft = false,
}: {
  hasDraft?: boolean;
}) {
  const router = useRouter();

  const choose = useCallback(
    (mode: 'chat' | 'form') => {
      router.replace(
        mode === 'chat' ? '/onboarding?mode=chat' : '/onboarding?mode=form',
      );
    },
    [router],
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

      {hasDraft ? (
        <ReturningUserVariant choose={choose} />
      ) : (
        <NewUserVariant choose={choose} />
      )}
    </section>
  );
}

/** New user — two equally weighted mode cards. */
function NewUserVariant({
  choose,
}: {
  choose: (mode: 'chat' | 'form') => void;
}) {
  return (
    <>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
        Welcome to Monitrax
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-600 sm:text-base dark:text-slate-400">
        How would you like to set up? Pick whichever feels easier — both
        paths reach the same place.
      </p>

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

      <p className="mt-8 max-w-md text-center text-xs text-slate-500 dark:text-slate-400">
        Your progress saves automatically. You can switch modes any time
        from the toggle at the top.
      </p>
    </>
  );
}

/** Returning user mid-setup — prominent continue + a switch-to-chat card. */
function ReturningUserVariant({
  choose,
}: {
  choose: (mode: 'chat' | 'form') => void;
}) {
  return (
    <>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
        Welcome back
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-600 sm:text-base dark:text-slate-400">
        You&rsquo;re partway through your setup. Pick up where you left off,
        or switch how you finish — your progress is saved either way.
      </p>

      {/* Primary — continue the form wizard at the saved step */}
      <button
        type="button"
        onClick={() => choose('form')}
        className="group mt-9 flex w-full items-center gap-4 rounded-2xl border border-transparent bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 p-5 text-left shadow-[0_12px_32px_-14px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-14px_rgba(99,102,241,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white"
        >
          <RotateCcw className="h-6 w-6" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-lg font-semibold text-white">
            Continue where you left off
          </span>
          <span className="text-sm text-white/80">
            Resume the step-by-step form from your last saved step.
          </span>
        </span>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-white transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
      </button>

      {/* Divider */}
      <div className="mt-7 flex w-full items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          or switch how you finish
        </span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Secondary — switch to chat */}
      <div className="mt-5 w-full">
        <ModeCard
          icon={<MessagesSquare className="h-6 w-6" aria-hidden="true" />}
          title="Switch to chat"
          description="Finish by talking it through instead — your answers so far carry over."
          time="~3 min"
          accent="from-violet-500 via-indigo-500 to-blue-500"
          ctaLabel="Chat with Monitrax"
          onClick={() => choose('chat')}
        />
      </div>

      <p className="mt-8 max-w-md text-center text-xs text-slate-500 dark:text-slate-400">
        Switching modes never loses your progress — both paths save to the
        same place.
      </p>
    </>
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
