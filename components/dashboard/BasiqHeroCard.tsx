'use client';

/**
 * BasiqHeroCard — Phase 12 v3 (E.1)
 *
 * The §2.3 "Basiq as hero connection flow" pillar. A full-width,
 * top-of-dashboard card that sits above the empty-state tile grid
 * for any user who hasn't yet connected a bank via Basiq. It is the
 * single highest-leverage action a new user can take — Copilot Money
 * and Rocket Money both prove this is the biggest activation unlock
 * in personal finance UX (see PHASE_12_REDESIGN_V3.md §9 research).
 *
 * UX shape (desktop):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                                                          │
 *   │  Connect your bank in 60 seconds            [ illus ]   │
 *   │                                             [ bank   ]  │
 *   │  Import accounts, balances, and             [ icons  ]  │
 *   │  transactions — no bank login stored.                   │
 *   │                                                          │
 *   │  🛡 Secured by CDR                                       │
 *   │                                                          │
 *   │  [ Connect your bank → ]  or add manually               │
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * On mobile the illustration moves below the copy and the CTA
 * stretches full width.
 *
 * Auto-hide contract:
 *   - When the user has at least one ACTIVE Basiq connection, the
 *     `connect-bank` task in the Setup Tray registry flips to
 *     `isDone: true` and this card renders `null`. No parent-side
 *     gating required — just mount it unconditionally inside the
 *     v3 feature-flag branch.
 *   - If the setup state fetch is still loading on first render,
 *     the card renders `null` instead of a skeleton. The hero is
 *     optional chrome, not critical content; a stable skeleton
 *     would just create layout jitter when the data lands.
 *   - On fetch error, the card also renders `null`. Fail silently
 *     per the same principle as the Setup Tray (never make the
 *     dashboard worse than baseline).
 *
 * Architecture decisions:
 *   - Navigational shortcut, not a duplicate Basiq implementation.
 *     Clicking the primary CTA routes to
 *     `/dashboard/accounts?action=connect-basiq` — the same href
 *     the Setup Tray task (B.1) and the AccountsEmptyState (D.2)
 *     use. Single source of truth for "where does connecting a
 *     bank live" (CLAUDE.md §12.2).
 *   - Pure consumer of `useSetupState`. Zero business logic, zero
 *     Basiq SDK calls. The /dashboard/accounts page owns the
 *     consent initiation flow; this card just gets users there.
 *   - The §2.3 "trust strip" uses the existing ShieldCheck icon
 *     and links to the settings CDR consent page. No additional
 *     policy copy lives in this component — policy prose belongs
 *     in the linked page, not hard-coded in a dashboard card.
 *   - Per CLAUDE.md §13.3, CDR-free: the component never reads,
 *     displays, or logs account balances, transactions, or
 *     institution names. It only knows whether a connection
 *     exists, from the `connect-bank` task's boolean state.
 *   - Per CLAUDE.md §6 ground rules: dark-mode native (`dark:`
 *     variants throughout), `prefers-reduced-motion` honoured via
 *     Tailwind `motion-reduce:` on the hover lift, ARIA
 *     `role="region"` + `aria-label` on the outer container, real
 *     `<Link>` for the CTA so browser focus/keyboard/middle-click
 *     all work for free.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.3 (Basiq as hero)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §9 (research foundation)
 *   - lib/setup/tasks.ts (the task registry whose state we read)
 *   - hooks/useSetupState.ts (the data source)
 */

import Link from 'next/link';
import {
  Banknote,
  ArrowRight,
  ShieldCheck,
  Landmark,
  CreditCard,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useSetupState } from '@/hooks/useSetupState';

// =============================================================================
// PROPS
// =============================================================================

export interface BasiqHeroCardProps {
  /**
   * Optional className appended to the outer container so consumers
   * (the dashboard page) can position the card within their grid
   * without hard-coding the layout here.
   */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BasiqHeroCard({ className = '' }: BasiqHeroCardProps) {
  const { tasks, isLoading, error } = useSetupState();

  // Fail silently on error — the dashboard should never be made
  // worse by an optional hero card that can't load its state.
  if (error) return null;

  // No skeleton during initial load. The hero is optional chrome,
  // not critical content; a stable skeleton here would create
  // layout jitter when the real state lands and the card either
  // appears or disappears.
  if (isLoading && !tasks) return null;

  // Hook hasn't resolved yet (no token, etc.) → render nothing.
  if (!tasks) return null;

  // Auto-hide once the user has an ACTIVE Basiq connection. The
  // connect-bank task's isDone flag is the single source of truth
  // for "this user has a bank hooked up" — we never compute it
  // locally. If the task isn't in the registry for some reason,
  // default to hiding the card (fail-safe).
  const connectBankTask = tasks.find((t) => t.task.id === 'connect-bank');
  if (!connectBankTask || connectBankTask.isDone) return null;

  return (
    <section
      role="region"
      aria-label="Connect your bank"
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 shadow-[0_30px_80px_-30px_rgba(99,102,241,0.35)] backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-violet-950/40 ${className}`}
    >
      {/* Ambient gradient blob — decorative, aria-hidden */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-violet-400/30 blur-3xl dark:from-blue-500/20 dark:via-indigo-500/10 dark:to-violet-500/20"
      />

      <div className="relative flex flex-col items-start gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-10">
        {/* Copy column */}
        <div className="flex-1">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur dark:bg-slate-900/60 dark:text-indigo-300">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Fastest way to get started
          </div>

          {/* Headline */}
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Connect your bank in{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
              60 seconds
            </span>
          </h2>

          {/* Body */}
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            We&apos;ll import your accounts, balances, and 12 months of
            transactions. Your data stays in your account — we never
            store your bank login.
          </p>

          {/* Trust strip */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Secured by the Consumer Data Right (CDR)
            <Link
              href="/dashboard/settings?tab=privacy"
              className="ml-1 underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
            >
              Learn more
            </Link>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard/balances?action=connect-basiq"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Banknote className="h-4 w-4" aria-hidden="true" />
              Connect your bank
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Link
              href="/dashboard/balances?action=add-account"
              className="text-xs font-medium text-slate-600 underline-offset-2 transition-colors hover:text-slate-900 hover:underline focus:outline-none focus-visible:underline motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200"
            >
              or add accounts manually
            </Link>
          </div>
        </div>

        {/* Illustration column — decorative bank icon strip.
            Marked aria-hidden so screen readers don't enumerate the
            decorative icons. Only renders on large screens where
            horizontal space allows for it. */}
        <div
          aria-hidden="true"
          className="hidden shrink-0 lg:flex lg:items-center lg:gap-3"
        >
          <BankIconChip icon={Landmark} color="indigo" />
          <BankIconChip icon={Wallet} color="violet" />
          <BankIconChip icon={CreditCard} color="blue" />
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// DECORATIVE HELPER
// =============================================================================

interface BankIconChipProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  color: 'blue' | 'indigo' | 'violet';
}

/**
 * Decorative chip used inside the hero's illustration column. Three
 * of these stacked side-by-side read as "generic bank / wallet /
 * card" without implying any specific institution, which keeps the
 * component fully institution-agnostic.
 */
function BankIconChip({ icon: Icon, color }: BankIconChipProps) {
  const colorClasses: Record<BankIconChipProps['color'], string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm backdrop-blur ${colorClasses[color]}`}
    >
      <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export default BasiqHeroCard;
