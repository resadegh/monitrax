/**
 * Account-deletion executor — the hard-delete half of right-to-erasure.
 *
 * WHY THIS EXISTS
 * ---------------
 * `/api/account/delete-request` only flips a 30-day soft-delete timer
 * (`User.deletionRequestedAt` + `deletionScheduledFor`). The schema comment and
 * that route's docstring both promise the actual hard-deletion happens
 * "out-of-band on the scheduled date via Cloud Scheduler". THIS module is that
 * job. Without it, "Delete my account" never erased anything — a
 * Privacy Act APP 11.2 / CDR §3.2 gap.
 *
 * SAFE ORDERING (the load-bearing design decision)
 * ------------------------------------------------
 * Identity is deleted FIRST, and the data deletion ABORTS if it fails:
 *
 *   1. Delete the Firebase Auth identity (REST, via WIF SA).
 *        - If this FAILS, STOP. We do NOT delete the data. A user whose data
 *          is gone but whose Firebase identity survives would resurrect as a
 *          fresh empty account on next login (see
 *          `lib/auth/identityPlatformAdmin.ts`). The soft-delete flags stay
 *          set, so the next scheduled run retries.
 *   2. Purge CDR data (also calls the Basiq API to delete remote connections).
 *   3. Hard-delete the DB rows in an ordered transaction.
 *   4. Write the `USER_DELETED` audit record.
 *
 * DB DELETION ORDER (CLAUDE.md §12.11 destructive write)
 * ------------------------------------------------------
 * The schema has EXACTLY 7 `onDelete: Restrict` relations, all of them
 * `<entity> → LegalEntity` (Property, Loan, Account, Income, Expense,
 * InvestmentAccount, Asset). Every other relation is Cascade or SetNull.
 * `User → LegalEntity` is Cascade, so a naive `user.delete()` would try to
 * cascade-delete a `LegalEntity` while a `Property` still references it →
 * the Restrict constraint blocks it non-deterministically. The fix: delete
 * those 7 entity models first (their own children are Cascade/SetNull, so they
 * fall away at the DB level), THEN `user.delete()` cascades `LegalEntity` and
 * everything else cleanly. Proven precedent: `lib/testing/reset.ts` (which
 * predates `Asset` and is missing it — this module covers all 7).
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { createAuditLog } from '@/lib/security/auditLog';
import { deleteCDRData } from '@/lib/services/cdrDataLifecycle';
import { deleteIdentityByEmail, type IdentityDeletionStatus } from '@/lib/auth/identityPlatformAdmin';

export type DeletionTrigger = 'SCHEDULED' | 'ADMIN';

export interface AccountDeletionResult {
  userId: string;
  success: boolean;
  /** Outcome of the Firebase identity deletion step. */
  identityStatus: IdentityDeletionStatus;
  /** True once the irreversible DB delete completed. */
  dataDeleted: boolean;
  /** Diagnostic when success === false. */
  error?: string;
}

export interface ScheduledDeletionSummary {
  processed: number;
  deleted: number;
  failed: number;
  results: AccountDeletionResult[];
}

/**
 * Hard-delete a single user. Idempotent: a user that no longer exists returns
 * `success: true`. Never throws — failures are returned so the caller (the
 * Cloud Scheduler endpoint) can report a summary and the soft-delete flags can
 * remain set for a retry.
 */
export async function deleteUserAccount(
  userId: string,
  trigger: DeletionTrigger,
): Promise<AccountDeletionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  // Already gone — nothing to do (idempotent).
  if (!user) {
    return { userId, success: true, identityStatus: 'not_found', dataDeleted: false };
  }

  // 1. Identity first. Abort the whole deletion if it could not be removed,
  //    so we never leave a resurrectable account (data gone, login intact).
  const identity = await deleteIdentityByEmail(user.email);
  if (identity.status === 'failed') {
    log.error('Account deletion aborted — identity deletion failed', undefined, {
      userId,
      trigger,
      detail: identity.detail,
    });
    return {
      userId,
      success: false,
      identityStatus: identity.status,
      dataDeleted: false,
      error: `Identity deletion failed; data deletion aborted. ${identity.detail ?? ''}`.trim(),
    };
  }

  // 2. Purge CDR data (local rows + remote Basiq connections). This never
  //    throws; it returns a structured result and logs its own failures.
  let cdrPurged = false;
  try {
    // Returns deletion counts (or throws); completion == purged.
    await deleteCDRData(userId, 'user_requested');
    cdrPurged = true;
  } catch (err) {
    // deleteCDRData is defensive, but guard anyway — a Basiq hiccup must not
    // block the DB erasure the user is legally owed.
    log.warn('CDR purge errored during account deletion (continuing)', {
      userId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  // 3. Ordered hard-delete. The 7 Restrict-bearing entity models first, then
  //    the User row cascades LegalEntity + all remaining Cascade children.
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.asset.deleteMany({ where: { userId } });
        await tx.property.deleteMany({ where: { userId } });
        await tx.loan.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.income.deleteMany({ where: { userId } });
        await tx.expense.deleteMany({ where: { userId } });
        await tx.investmentAccount.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error('Account data deletion failed', err as Error, { userId, trigger });
    return {
      userId,
      success: false,
      identityStatus: identity.status,
      dataDeleted: false,
      error: `Data deletion failed after identity removal: ${detail}`,
    };
  }

  // 4. Audit AFTER the row is gone. userId is intentionally omitted (the FK
  //    target no longer exists); the deleted id lives in entityId + metadata so
  //    the trail survives (AuditLog.userId is SetNull-on-delete anyway). The
  //    dual-write to Cloud Logging (365-day CDR retention) also captures it.
  await createAuditLog({
    action: 'USER_DELETED',
    status: 'SUCCESS',
    entityType: 'User',
    entityId: userId,
    metadata: {
      trigger,
      identityStatus: identity.status,
      identityUidsDeleted: identity.deletedUids.length,
      cdrPurged,
    },
  });

  log.info('Account hard-deleted', { userId, trigger, identityStatus: identity.status });
  return { userId, success: true, identityStatus: identity.status, dataDeleted: true };
}

/**
 * Find every user past their 30-day grace period and hard-delete them.
 * Invoked by the Cloud Scheduler endpoint (`/api/account/lifecycle`).
 *
 * Processed sequentially, not in parallel: each deletion touches the shared
 * DB connection pool (max 2) and the Basiq API, so a fan-out would risk
 * connection-slot exhaustion (the failure mode behind the 2026-05-20 pool
 * tuning). Deletion volume is low (opt-in, 30-day-delayed) so sequential is
 * comfortably fast enough.
 */
export async function executeScheduledDeletions(): Promise<ScheduledDeletionSummary> {
  const now = new Date();

  const due = await prisma.user.findMany({
    where: {
      deletionRequestedAt: { not: null },
      deletionScheduledFor: { lte: now },
    },
    select: { id: true },
  });

  const results: AccountDeletionResult[] = [];
  for (const { id } of due) {
    results.push(await deleteUserAccount(id, 'SCHEDULED'));
  }

  return {
    processed: results.length,
    deleted: results.filter((r) => r.success && r.dataDeleted).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
