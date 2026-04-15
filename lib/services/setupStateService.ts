/**
 * Setup State Service — Phase 12 v3 (dashboard-as-onboarding)
 *
 * Canonical service that assembles the per-user setup tray state.
 * Wraps the master financial snapshot together with the non-snapshot
 * signals (Basiq connection status, household membership) into a
 * `SetupTaskContext`, runs the registry from `lib/setup/tasks.ts`,
 * and returns the per-task completion list plus a progress summary.
 *
 * This is the engine the future `/api/setup/state` route (Phase B.3)
 * and any client hook will call. Keep it pure (no UI imports), keep
 * the queries parallel (CLAUDE.md §12.10), and never duplicate
 * business logic — the registry is the source of truth for what
 * "done" means for each task; this file is just a context builder.
 *
 * Architecture notes:
 *   - Per CLAUDE.md §12.3, route handlers must stay thin. This file
 *     is where the work happens; route handlers will be 5-10 lines.
 *   - Per CLAUDE.md §12.10, the snapshot fetch and the per-flag
 *     queries run in parallel via `Promise.all`. No N+1 query
 *     patterns, no sequential awaits.
 *   - Per CLAUDE.md §13.3, no CDR-classified data leaks out — the
 *     return shape carries booleans and counts only, no balances,
 *     transactions, or institution identifiers.
 *   - The two flags this turn cannot yet populate
 *     (`hasReviewedNetWorth`, `hasInvitedPartner`) are intentionally
 *     left `undefined` so the registry's fail-safe defaults kick in.
 *     A follow-up turn will add the `UserPreference.setupTrayState`
 *     JSONB column and source these flags from there.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1 (Setup Tray)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §11.3 (rewire matrix)
 *   - lib/setup/tasks.ts (the registry this file consumes)
 */

import prisma from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import {
  computeSetupTaskState,
  getSetupProgress,
  type SetupTask,
  type SetupTaskContext,
} from '@/lib/setup/tasks';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/**
 * One row in the setup tray response. Mirrors the registry's
 * `{ task, isDone }` tuple but is re-exported here so consumers can
 * import everything they need from this single service file.
 */
export interface SetupTaskState {
  task: SetupTask;
  isDone: boolean;
}

// =============================================================================
// PHASE 12 TWIN-TRACK (A.1) — PER-MODULE COMPLETION TRACKING
// =============================================================================

/**
 * Canonical module keys that the refined `/dashboard/setup` page
 * tracks. Maps 1:1 to the six tiles in `DashboardEmptyStateGrid`.
 *
 * Note: the directive §2.2 lists "Assets" generically — here we
 * split it into `properties` and `investments` because the existing
 * grid has those as separate tiles. The `Asset` Prisma model (cars,
 * electronics, etc.) is not tracked separately in A.1; if it becomes
 * a seventh tile in a future phase, add it to this union.
 */
export type ModuleKey =
  | 'accounts'
  | 'properties'
  | 'income'
  | 'expenses'
  | 'investments'
  | 'loans';

/**
 * Per-module completion state, derived from row counts split by
 * `source === 'ONBOARDING'`:
 *
 *   - `Missing`   → no rows at all
 *   - `Estimated` → at least one row, all of them written by the
 *                   `/onboarding` wizard (source = ONBOARDING)
 *   - `Verified`  → at least one row with source ≠ ONBOARDING
 *                   (manual, basiq, import, calculated)
 *
 * The UI maps these to badge colours in §3.5 of the plan doc.
 */
export type ModuleState = 'Missing' | 'Estimated' | 'Verified';

/**
 * One row in the `moduleProgress` array of `SetupStateResult`.
 * Consumed by the `<SetupTray />` extension (A.1) and by the
 * `<DashboardEmptyStateGrid />` card prioritisation logic (A.3).
 */
export interface ModuleProgress {
  module: ModuleKey;
  state: ModuleState;
  /** 0–100 integer, ready for direct UI rendering. */
  percent: number;
  rowCount: number;
  estimatedCount: number;
  verifiedCount: number;
}

/**
 * The shape the `/api/setup/state` route returns.
 *
 * Phase B (original): `tasks` + `progress` for the Setup Tray checklist.
 *
 * Phase 12 twin-track (A.1): `moduleProgress` added as an additive
 * field. Existing consumers (SetupTray component, useSetupState hook)
 * ignore it — they read only `tasks` and `progress`. Track A.2+ reads
 * `moduleProgress` to drive the SetupNextActionPanel, card
 * prioritisation, and confidence badges.
 */
export interface SetupStateResult {
  tasks: SetupTaskState[];
  progress: {
    done: number;
    total: number;
    /** 0-100 integer, ready for direct UI rendering. */
    percent: number;
    allDone: boolean;
  };
  /**
   * Per-module Missing/Estimated/Verified state. Added by A.1 for
   * the `/dashboard/setup` refinement work. One entry per entry in
   * the `ModuleKey` union.
   */
  moduleProgress: ModuleProgress[];
}

// =============================================================================
// CORE SERVICE
// =============================================================================

/**
 * Builds the full setup task state for a user. Returns the ordered
 * task list with per-task completion flags, a progress summary,
 * and (A.1) per-module Missing/Estimated/Verified progress.
 *
 * Throws if the master snapshot fetch fails — callers (route handlers)
 * are responsible for catching and converting to the standard
 * `{ success, error }` response envelope (CLAUDE.md §6.6).
 *
 * Phase 12 twin-track (A.1): `buildSetupTaskContext` and
 * `buildModuleProgress` run in parallel at the top level so the
 * new per-module queries do not add latency on top of the existing
 * flag signals. All DB reads complete in a single round-trip wait.
 */
export async function getSetupState(userId: string): Promise<SetupStateResult> {
  const [ctx, moduleProgress] = await Promise.all([
    buildSetupTaskContext(userId),
    buildModuleProgress(userId),
  ]);
  const tasks = computeSetupTaskState(ctx);
  const progress = getSetupProgress(ctx);
  return { tasks, progress, moduleProgress };
}

/**
 * Assembles the `SetupTaskContext` for a user by fetching the master
 * snapshot in parallel with the non-snapshot flag signals.
 *
 * Exported so tests and future call sites that need just the context
 * (e.g. an audit log entry, a Gemini assist prompt that mentions
 * which tasks the user has completed) can build it without going
 * through the full `getSetupState` path.
 */
export async function buildSetupTaskContext(
  userId: string
): Promise<SetupTaskContext> {
  // Run all queries in parallel — no sequential awaits, no N+1.
  // Each branch is independently cancellable; if any reject, the
  // caller's try/catch handles it.
  const [snapshot, hasBasiqConnection, hasHouseholdMember] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    countActiveBasiqConnections(userId).then((n) => n > 0),
    countHouseholdMembers(userId).then((n) => n > 0),
  ]);

  return {
    snapshot,
    hasBasiqConnection,
    hasHouseholdMember,
    // The two flags below are intentionally left undefined until the
    // `UserPreference.setupTrayState` JSONB column lands in a follow-up
    // micro-fix. The registry's fail-safe defaults (false) apply.
    // hasReviewedNetWorth: undefined,
    // hasInvitedPartner: undefined,
  };
}

// =============================================================================
// FLAG QUERIES
// =============================================================================

/**
 * Counts ACTIVE Basiq connections for the user. PENDING / RECONNECT /
 * DISABLED rows do not count — the user must have at least one
 * connection that is currently producing real data.
 *
 * Returning a count rather than a boolean keeps the query useful for
 * future callers (audit, Gemini context) without re-fetching.
 */
async function countActiveBasiqConnections(userId: string): Promise<number> {
  return prisma.basiqConnection.count({
    where: {
      userId,
      status: 'ACTIVE',
    },
  });
}

/**
 * Counts HouseholdMember rows for the user. Members live under
 * `HouseholdProfile`, which is a 1:1 with `User` (`userId @unique`),
 * so the query joins through the profile and counts members.
 *
 * Users who have not yet created a HouseholdProfile return 0 (not an
 * error) — `count` short-circuits on the `where` clause.
 */
async function countHouseholdMembers(userId: string): Promise<number> {
  return prisma.householdMember.count({
    where: {
      householdProfile: {
        userId,
      },
    },
  });
}

// =============================================================================
// PHASE 12 TWIN-TRACK (A.1) — MODULE PROGRESS QUERIES
// =============================================================================

/**
 * Builds the per-module progress list by counting rows in each of
 * the six financial entity tables, splitting counts by
 * `source === 'ONBOARDING'` so the UI can distinguish Estimated
 * (wizard-written) from Verified (manual/bank/import/calculated).
 *
 * All 12 queries run in a single `Promise.all` for minimum latency
 * (6 modules × 2 counts each = 12 simple `prisma.*.count` calls,
 * each using an indexed `{ userId }` where clause).
 *
 * Returns one `ModuleProgress` entry per `ModuleKey`, in the same
 * order as the `DashboardEmptyStateGrid` tiles for predictable
 * consumption by Track A.3 (card prioritisation).
 */
export async function buildModuleProgress(userId: string): Promise<ModuleProgress[]> {
  const [
    accountsAll, accountsEst,
    propertiesAll, propertiesEst,
    incomeAll, incomeEst,
    expensesAll, expensesEst,
    investmentsAll, investmentsEst,
    loansAll, loansEst,
  ] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.account.count({ where: { userId, source: 'ONBOARDING' } }),
    prisma.property.count({ where: { userId } }),
    prisma.property.count({ where: { userId, source: 'ONBOARDING' } }),
    prisma.income.count({ where: { userId } }),
    prisma.income.count({ where: { userId, source: 'ONBOARDING' } }),
    prisma.expense.count({ where: { userId } }),
    prisma.expense.count({ where: { userId, source: 'ONBOARDING' } }),
    prisma.investmentAccount.count({ where: { userId } }),
    prisma.investmentAccount.count({ where: { userId, source: 'ONBOARDING' } }),
    prisma.loan.count({ where: { userId } }),
    prisma.loan.count({ where: { userId, source: 'ONBOARDING' } }),
  ]);

  return [
    computeModuleProgress('accounts', accountsAll, accountsEst),
    computeModuleProgress('properties', propertiesAll, propertiesEst),
    computeModuleProgress('income', incomeAll, incomeEst),
    computeModuleProgress('expenses', expensesAll, expensesEst),
    computeModuleProgress('investments', investmentsAll, investmentsEst),
    computeModuleProgress('loans', loansAll, loansEst),
  ];
}

/**
 * Pure helper: derives `state` and `percent` from raw row counts.
 *
 * State rules:
 *   - `total === 0`                    → Missing
 *   - `verified === 0 && total > 0`    → Estimated (all rows came from the wizard)
 *   - `verified >= 1`                  → Verified (at least one real entry)
 *
 * Percent heuristic (kept deliberately simple per plan §4.2 A.1):
 *   - Missing                          → 0%
 *   - Estimated only                   → 25% (rough first row, not yet verified)
 *   - 1 verified row                   → 50%
 *   - 2 verified rows                  → 75%
 *   - 3+ verified rows                 → 100%
 *
 * The heuristic is not meant to be mathematically precise — it
 * exists to give the Setup Tray progress bar something to render
 * and to give the Next-Best-Action panel a signal for
 * prioritisation. Future phases may replace this with a more
 * nuanced scoring function.
 */
export function computeModuleProgress(
  module: ModuleKey,
  total: number,
  estimated: number
): ModuleProgress {
  const verified = total - estimated;

  let state: ModuleState;
  if (total === 0) {
    state = 'Missing';
  } else if (verified === 0) {
    state = 'Estimated';
  } else {
    state = 'Verified';
  }

  let percent: number;
  if (total === 0) {
    percent = 0;
  } else if (verified === 0) {
    percent = 25;
  } else if (verified === 1) {
    percent = 50;
  } else if (verified === 2) {
    percent = 75;
  } else {
    percent = 100;
  }

  return {
    module,
    state,
    percent,
    rowCount: total,
    estimatedCount: estimated,
    verifiedCount: verified,
  };
}
