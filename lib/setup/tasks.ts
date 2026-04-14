/**
 * Setup task registry — Phase 12 v3 (dashboard-as-onboarding)
 *
 * Canonical, single-source-of-truth list of the setup tasks rendered by
 * the Setup Tray (`docs/blueprint/PHASE_12_REDESIGN_V3.md` §2.1).
 *
 * Every task has:
 *   - a stable `id` (used as a key in the tray and in any future
 *     `setupTrayState` JSONB),
 *   - human-readable `title` and `subtitle` strings,
 *   - an `icon` lucide-react identifier (string, not a JSX element, so
 *     this file can be imported on the server without pulling React),
 *   - a `kind` discriminator separating data-derived predicates from
 *     flag-derived ones,
 *   - a deep-link `href` that opens the real entity dialog the user
 *     would have taken from the wizard — never a wizard step,
 *   - an `isDone(ctx)` predicate that returns true once the task is
 *     considered complete.
 *
 * This registry is the foundation that `lib/services/setupStateService.ts`
 * (Phase B.2) and the `<SetupTray>` component (Phase C) will consume.
 *
 * Architecture notes:
 *   - Per CLAUDE.md §12.2, completion derives from the master financial
 *     snapshot wherever possible. There is no parallel "setup completion"
 *     table — completion is a function of the user's real data.
 *   - For tasks that cannot be derived from data alone (e.g. "I clicked
 *     to dismiss this", or "I sent a partner invite"), the predicate
 *     reads from `SetupTaskContext` flags. Those flags will be
 *     populated by `setupStateService` once the underlying signals
 *     (Basiq connection registry, partner invite table, dismiss flag
 *     column) land in subsequent micro-fixes.
 *   - This file is server-safe and has zero runtime dependencies beyond
 *     the snapshot type. Import it from API routes, services, or
 *     React components alike.
 *
 * See `docs/blueprint/PHASE_12_REDESIGN_V3.md` §2.1 (Setup Tray) and
 * §11.3 (rewire matrix — what the Setup Tray replaces).
 */

import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Stable identifiers for every setup task. Add new ids here and the
 * compiler will force every consumer (Setup Tray UI, dismiss state,
 * audit logs) to handle them.
 */
export type SetupTaskId =
  | 'connect-bank'
  | 'add-property'
  | 'add-household'
  | 'add-income'
  | 'add-expenses'
  | 'review-net-worth'
  | 'invite-partner';

/**
 * Discriminator for how a task's completion is derived.
 *
 *   - `data`: completion is a pure function of the master financial
 *     snapshot (e.g. `counts.properties > 0`). Always accurate, no
 *     extra round-trips, no risk of getting out of sync with reality.
 *   - `flag`: completion comes from a non-snapshot signal — a UI
 *     dismiss flag, a partner-invite record, etc. The signal is
 *     surfaced through `SetupTaskContext` by `setupStateService` once
 *     those data sources are wired up.
 */
export type SetupTaskKind = 'data' | 'flag';

/**
 * Inputs available to a task's `isDone` predicate.
 *
 * The snapshot is always present; the optional flags are populated by
 * `setupStateService` (Phase B.2) and may be `undefined` while the
 * supporting signals are still being built. A `flag`-kind task whose
 * supporting flag is still `undefined` evaluates to `false` (i.e. not
 * done) — this fails-safe behaviour means a user is never marked
 * "done" by accident due to a missing signal.
 */
export interface SetupTaskContext {
  /** Always present. Source of truth for every data-derived task. */
  snapshot: MasterFinancialSnapshot;

  /**
   * True once the user has at least one ACTIVE Basiq connection.
   * Populated by `setupStateService` from the Basiq connection table.
   * `undefined` until that wiring lands; treated as `false` by the
   * `connect-bank` predicate. (Phase 12 v3 follow-up.)
   */
  hasBasiqConnection?: boolean;

  /**
   * True once the user has at least one HouseholdMember row.
   * Populated by `setupStateService` from a direct prisma count.
   * `undefined` until that wiring lands; treated as `false`.
   */
  hasHouseholdMember?: boolean;

  /**
   * True once the user has dismissed the "review your net worth" tile
   * or actually reviewed the net-worth detail card. Sourced from a
   * future `UserPreference.setupTrayState` JSONB field. `undefined`
   * until that schema change lands; treated as `false`.
   */
  hasReviewedNetWorth?: boolean;

  /**
   * True once the user has sent at least one partner invite.
   * Sourced from a future partner-invite table or
   * `UserPreference.setupTrayState`. `undefined` until that wiring
   * lands; treated as `false`.
   */
  hasInvitedPartner?: boolean;
}

/**
 * One row in the setup tray checklist.
 *
 * `priority` is used by the tray to order tasks when none have been
 * dismissed. Lower numbers surface first. The "Connect a bank" task is
 * intentionally first (priority 10) because it is the single
 * highest-leverage action a new user can take — see
 * `PHASE_12_REDESIGN_V3.md` §2.3 (Basiq as hero).
 */
export interface SetupTask {
  id: SetupTaskId;
  kind: SetupTaskKind;
  /** Short title shown in the tray row. */
  title: string;
  /** One-sentence subtitle explaining what the task unlocks. */
  subtitle: string;
  /** lucide-react icon name. Resolved to a JSX element by the consumer. */
  icon: string;
  /**
   * Deep-link target. The Setup Tray opens this href (modal-routed or
   * navigated, consumer's choice). NEVER a wizard step — always the
   * real entity dialog or page on the dashboard.
   */
  href: string;
  /**
   * Optional explicit ordering hint. When two tasks have the same
   * priority, the registry order in `SETUP_TASKS` below is used as
   * the tiebreaker.
   */
  priority: number;
  /**
   * Returns true when the task is considered complete. Pure function of
   * the inputs — no I/O, no global state.
   */
  isDone: (ctx: SetupTaskContext) => boolean;
}

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * The canonical setup task list. Order matters for two reasons:
 *
 *   1. It is the default sort order shown in the Setup Tray when no
 *      other ordering applies.
 *   2. It establishes the priority ladder a user implicitly follows on
 *      a fresh dashboard — bank first, then property, then household,
 *      then cashflow, then invites — which is the order our research
 *      foundation (Copilot Money, Rocket Money, Plaid Link) shows
 *      converts best.
 *
 * Adding or reordering tasks here is a UX decision and must be
 * reviewed against the §10 magic moments and §9 cross-cutting
 * principles in PHASE_12_REDESIGN_V3.md.
 */
export const SETUP_TASKS: SetupTask[] = [
  {
    id: 'connect-bank',
    kind: 'flag',
    title: 'Connect your bank',
    subtitle: 'Import accounts, balances, and transactions in 60 seconds.',
    icon: 'Banknote',
    href: '/dashboard/accounts?action=connect-basiq',
    priority: 10,
    // Done once any ACTIVE Basiq connection exists for the user.
    // Until setupStateService wires `hasBasiqConnection`, the predicate
    // falls back to "true if the user has any account at all" — this
    // matches the Phase A behaviour where manual accounts also count
    // toward setup progress, and avoids permanently marking the task
    // as undone for users who connected via Basiq before the registry
    // existed.
    isDone: (ctx) =>
      ctx.hasBasiqConnection === true || ctx.snapshot.counts.accounts > 0,
  },
  {
    id: 'add-property',
    kind: 'data',
    title: 'Add a property',
    subtitle: 'Unlock equity, LVR, and net worth tracking.',
    icon: 'Home',
    href: '/dashboard/properties?action=add',
    priority: 20,
    isDone: (ctx) => ctx.snapshot.counts.properties > 0,
  },
  {
    id: 'add-household',
    kind: 'flag',
    title: 'Add your household',
    subtitle: 'Personalises budget targets and cashflow projections.',
    icon: 'Users',
    href: '/dashboard/household?action=add',
    priority: 30,
    // No HouseholdMember count on the master snapshot today, so this
    // depends on the optional context flag. setupStateService will
    // populate `hasHouseholdMember` from a direct prisma count once
    // the supporting wiring lands. Defaults to false (not done).
    isDone: (ctx) => ctx.hasHouseholdMember === true,
  },
  {
    id: 'add-income',
    kind: 'data',
    title: 'Add recurring income',
    subtitle: 'Powers cashflow forecasts and emergency-fund metrics.',
    icon: 'Wallet',
    href: '/dashboard/income-expenses?tab=income&action=add',
    priority: 40,
    isDone: (ctx) => ctx.snapshot.counts.income > 0,
  },
  {
    id: 'add-expenses',
    kind: 'data',
    title: 'Add recurring expenses',
    subtitle: 'Lets us track your savings rate and budget variance.',
    icon: 'Receipt',
    href: '/dashboard/income-expenses?tab=expenses&action=add',
    priority: 50,
    isDone: (ctx) => ctx.snapshot.counts.expenses > 0,
  },
  {
    id: 'review-net-worth',
    kind: 'flag',
    title: 'Review your net worth',
    subtitle: 'See your full picture and confirm everything looks right.',
    icon: 'TrendingUp',
    href: '/dashboard?focus=net-worth',
    priority: 60,
    // Sourced from a future UserPreference.setupTrayState dismiss flag.
    // Defaults to false until that column exists.
    isDone: (ctx) => ctx.hasReviewedNetWorth === true,
  },
  {
    id: 'invite-partner',
    kind: 'flag',
    title: 'Invite your partner',
    subtitle: 'Share the dashboard and plan together.',
    icon: 'UserPlus',
    href: '/dashboard/settings?tab=sharing&action=invite',
    priority: 70,
    // Sourced from a future partner-invite table or
    // UserPreference.setupTrayState. Defaults to false.
    isDone: (ctx) => ctx.hasInvitedPartner === true,
  },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the registry sorted by `priority` (then by registry order
 * for ties). Pure helper — no side effects.
 */
export function getOrderedSetupTasks(): SetupTask[] {
  // Slice first so callers can't mutate SETUP_TASKS by accident.
  return SETUP_TASKS.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return SETUP_TASKS.indexOf(a) - SETUP_TASKS.indexOf(b);
  });
}

/**
 * Computes the per-task completion map. Used by the Setup Tray to
 * render the checklist and by the progress meter to compute "X of N
 * done". Stays a pure function of the context so it is trivially
 * testable and can be safely memoised on the client.
 */
export function computeSetupTaskState(
  ctx: SetupTaskContext
): Array<{ task: SetupTask; isDone: boolean }> {
  return getOrderedSetupTasks().map((task) => ({
    task,
    isDone: task.isDone(ctx),
  }));
}

/**
 * Returns `{ done, total, percent }` for the progress meter. `percent`
 * is a 0-100 integer (rounded) so consumers can render it directly
 * without re-doing the math.
 */
export function getSetupProgress(ctx: SetupTaskContext): {
  done: number;
  total: number;
  percent: number;
  allDone: boolean;
} {
  const states = computeSetupTaskState(ctx);
  const done = states.filter((s) => s.isDone).length;
  const total = states.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent, allDone: done === total };
}
