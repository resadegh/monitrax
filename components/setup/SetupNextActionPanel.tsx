'use client';

/**
 * SetupNextActionPanel — Phase 12 twin-track (A.2)
 *
 * Top-of-page "one recommended next action" panel on `/dashboard/setup`.
 * Dynamically computes the single highest-leverage next step from the
 * user's module progress (A.1) and renders a prominent CTA that deep-
 * links to the real entity surface for that action.
 *
 * Intentionally opinionated: shows ONE action, not a list. The Setup
 * Tray below this panel (A.1 extension) shows the full per-module
 * checklist; this panel exists to remove decision fatigue at the top.
 *
 * Decision rule (deterministic priority chain):
 *
 *   1. If Accounts is Missing            → "Connect your bank"
 *   2. Else if Income is Missing         → "Add your income sources"
 *   3. Else if Expenses is Missing       → "Add your expenses"
 *   4. Else if Properties is Missing     → "Add a property"
 *   5. Else if Loans is Missing          → "Add a loan"
 *   6. Else if Investments is Missing    → "Add an investment"
 *   7. Else if any module is Estimated   → "Refine your {module} estimates"
 *   8. Else                              → "Setup complete ✓"
 *
 * Rules 1-6 cover the directive's primary action set. Rules 7-8 are
 * the refinement phase after everything is at least minimally populated.
 *
 * Per CLAUDE.md §12.2 (SSOT): the action's CTA href matches the
 * corresponding Setup Tray task href exactly, so clicking this panel
 * and clicking a tray task land in the same dialog. No parallel
 * routing logic.
 *
 * Architecture:
 *   - Pure consumer of `useSetupState()`. No business logic server-
 *     side, no extra API call.
 *   - Fails silently on error or loading (returns null). The dashboard
 *     setup page should never get WORSE because this panel can't load.
 *   - Dark-mode native, `prefers-reduced-motion` friendly.
 */

import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Home,
  Wallet,
  Receipt,
  TrendingUp,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  useSetupState,
  type UseSetupStateModuleProgress,
} from '@/hooks/useSetupState';

// =============================================================================
// ACTION DERIVATION
// =============================================================================

interface NextAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Computes the next best action from the module progress array.
 * Returns `null` when all modules are Verified (i.e. setup is done).
 */
function deriveNextAction(
  modules: UseSetupStateModuleProgress[]
): NextAction | null {
  // Priority chain — first Missing module wins.
  const missingPriority: Array<{
    module: UseSetupStateModuleProgress['module'];
    action: NextAction;
  }> = [
    {
      module: 'accounts',
      action: {
        id: 'connect-bank',
        label: 'Connect your bank',
        description:
          'Import accounts, balances, and 12 months of transactions in 60 seconds.',
        href: '/dashboard/accounts?action=connect-basiq',
        icon: Banknote,
      },
    },
    {
      module: 'income',
      action: {
        id: 'add-income',
        label: 'Add your income',
        description: 'So we can calculate your real savings rate.',
        href: '/dashboard/income?action=add',
        icon: Wallet,
      },
    },
    {
      module: 'expenses',
      action: {
        id: 'add-expenses',
        label: 'Add your recurring expenses',
        description: 'Track your burn and find leaks in your cashflow.',
        href: '/dashboard/expenses?action=add',
        icon: Receipt,
      },
    },
    {
      module: 'properties',
      action: {
        id: 'add-property',
        label: 'Add a property',
        description: 'Unlock equity, LVR, and real-time net worth tracking.',
        href: '/dashboard/properties?action=add',
        icon: Home,
      },
    },
    {
      module: 'loans',
      action: {
        id: 'add-loan',
        label: 'Add a loan',
        description:
          'Track debt-quality scoring and spot refinance opportunities.',
        href: '/dashboard/loans?action=add',
        icon: CreditCard,
      },
    },
    {
      module: 'investments',
      action: {
        id: 'add-investment',
        label: 'Add an investment',
        description: 'See your portfolio performance and capital gains.',
        href: '/dashboard/investments/accounts?action=add',
        icon: TrendingUp,
      },
    },
  ];

  for (const { module, action } of missingPriority) {
    const progress = modules.find((m) => m.module === module);
    if (progress && progress.state === 'Missing') {
      return action;
    }
  }

  // No Missing modules → look for estimates to refine.
  const estimated = modules.find((m) => m.state === 'Estimated');
  if (estimated) {
    return {
      id: `refine-${estimated.module}`,
      label: `Refine your ${estimated.module} estimates`,
      description: `You have rough ${estimated.module} data from onboarding. Refining it unlocks more accurate insights.`,
      href: `/dashboard/${estimated.module === 'investments' ? 'investments/accounts' : estimated.module}`,
      icon: Sparkles,
    };
  }

  // Everything Verified → setup complete.
  return null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export interface SetupNextActionPanelProps {
  className?: string;
}

export function SetupNextActionPanel({
  className = '',
}: SetupNextActionPanelProps) {
  const { moduleProgress, isLoading, error } = useSetupState();

  // Fail silently — optional chrome, never make the page worse.
  if (error) return null;
  // No skeleton — mirrors SetupTray + BasiqHeroCard behaviour. Optional
  // chrome does not flash a skeleton that might disappear 100ms later.
  if (isLoading && !moduleProgress) return null;
  if (!moduleProgress) return null;

  const action = deriveNextAction(moduleProgress);

  // All done → celebratory pill instead of the full panel.
  if (!action) {
    return (
      <section
        aria-label="Setup complete"
        className={`flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm backdrop-blur-xl dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300 ${className}`}
      >
        <Sparkles className="h-4 w-4" />
        Setup complete — your dashboard is ready
      </section>
    );
  }

  const Icon = action.icon;

  return (
    <section
      role="region"
      aria-label="Next recommended action"
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 shadow-[0_20px_60px_-30px_rgba(99,102,241,0.35)] backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-violet-950/40 ${className}`}
    >
      {/* Decorative gradient blob (aria-hidden) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-violet-400/30 blur-3xl dark:from-blue-500/20 dark:via-indigo-500/10 dark:to-violet-500/20"
      />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)]"
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Next step
          </div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {action.label}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {action.description}
          </p>
        </div>

        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:self-auto"
        >
          Start
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default SetupNextActionPanel;
