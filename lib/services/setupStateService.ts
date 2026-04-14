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

/**
 * The shape the future `/api/setup/state` route will return.
 * `tasks` is already ordered by the registry's priority ladder.
 * `progress` is precomputed so the client never has to re-walk the
 * list to render the meter.
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
}

// =============================================================================
// CORE SERVICE
// =============================================================================

/**
 * Builds the full setup task state for a user. Returns the ordered
 * task list with per-task completion flags and a progress summary.
 *
 * Throws if the master snapshot fetch fails — callers (route handlers)
 * are responsible for catching and converting to the standard
 * `{ success, error }` response envelope (CLAUDE.md §6.6).
 */
export async function getSetupState(userId: string): Promise<SetupStateResult> {
  const ctx = await buildSetupTaskContext(userId);
  const tasks = computeSetupTaskState(ctx);
  const progress = getSetupProgress(ctx);
  return { tasks, progress };
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
