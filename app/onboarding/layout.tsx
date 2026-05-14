'use client';

/**
 * /onboarding layout — Phase 12 Track B (B.0)
 *
 * Hybrid chrome for the linear wizard per Q11 of the twin-track plan:
 *   - Top bar: logotype (left) + progress bar (inside page) + exit (right)
 *   - No sidebar, no DashboardLayout nesting
 *   - Full-height centered content area
 *   - Mobile: top bar collapses, content stays centered
 *
 * The layout is intentionally minimal. The progress bar lives
 * inside the LinearWizardContainer (since it needs the current
 * step index) so the layout just provides the outer chrome.
 *
 * Per §8.1 of the twin-track plan: "Avoid clutter at all costs —
 * no sidebar in the wizard, no progress badges competing with the
 * primary action."
 */

import Link from 'next/link';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { BasiqGateProvider } from '@/lib/featureFlags/BasiqGateContext';

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <BasiqGateProvider>
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4 dark:border-slate-800/60">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none dark:text-slate-100 dark:hover:text-slate-300"
          aria-label="Monitrax — home"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.55)]"
          >
            M
          </span>
          Monitrax
        </Link>

        <Link
          href="/dashboard/setup"
          aria-label="Exit onboarding"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
        >
          Exit
          <X className="h-3.5 w-3.5" />
        </Link>
      </header>

      {children}
    </div>
    </BasiqGateProvider>
  );
}
