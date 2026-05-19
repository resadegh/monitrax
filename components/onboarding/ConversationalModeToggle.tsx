'use client';

/**
 * Conversational-onboarding mode toggle. Renders inline at the top
 * of `/onboarding` ONLY when the `CONVERSATIONAL_ONBOARDING` flag is
 * ON. Two pills — "Fill in a form" (default) | "Chat with Monitrax".
 *
 * When the flag is OFF, returns `null` — `/onboarding` is byte-for-
 * byte the existing form-wizard experience.
 *
 * Design lens (Phase 12 §4a — presence, not persona): restrained
 * pill toggle. No emojis, no "AI" badge, no character framing. The
 * second pill says "Chat with Monitrax" — the product's name, not a
 * persona. Active state uses warm-ivory background; inactive is
 * ghost. Matches the form wizard's restraint.
 *
 * Routes:
 *   - Form mode (default):  /onboarding
 *   - Chat mode:            /onboarding?mode=chat
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useConversationalOnboardingEnabled } from '@/lib/featureFlags/ConversationalOnboardingGateContext';

export function ConversationalModeToggle() {
  const flagEnabled = useConversationalOnboardingEnabled();
  const params = useSearchParams();
  const mode = params?.get('mode') === 'chat' ? 'chat' : 'form';

  if (!flagEnabled) return null;

  return (
    <div className="mx-auto flex max-w-[640px] items-center justify-center px-5 pt-6">
      <div
        role="tablist"
        aria-label="Onboarding mode"
        className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-white/80 p-1 shadow-sm backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/60"
      >
        <ModePill
          href="/onboarding?mode=form"
          active={mode === 'form'}
          label="Fill in a form"
        />
        <ModePill
          href="/onboarding?mode=chat"
          active={mode === 'chat'}
          label="Chat with Monitrax"
        />
      </div>
    </div>
  );
}

function ModePill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        'inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ' +
        (active
          ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100')
      }
    >
      {label}
    </Link>
  );
}
