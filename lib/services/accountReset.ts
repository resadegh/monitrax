/**
 * Account data reset — the "Start fresh" executor.
 *
 * WHY THIS EXISTS
 * ---------------
 * Users whose financial data gets out of hand (bad imports, abandoned
 * experiments, stale structures) need a clean slate WITHOUT losing their
 * account: login, MFA/passkeys, legal consent records, billing, and
 * support history all survive; every piece of financial data goes. After
 * a reset the user lands back in the onboarding wizard as a day-one user
 * (the wizard recreates the PERSONAL_NAME LegalEntity exactly as it does
 * for a genuinely new account).
 *
 * This is deliberately a SIBLING of `lib/services/accountDeletion.ts`
 * (delete account + identity, 30-day grace), not a replacement. The two
 * share the CDR purge (`deleteCDRData`) and the Restrict-aware delete
 * ordering, but differ in the terminal state: deletion removes the User
 * row and Firebase identity; reset keeps both.
 *
 * THE CLASSIFICATION CONTRACT (load-bearing)
 * ------------------------------------------
 * Every Prisma model with a direct relation to `User` is classified into
 * exactly one of three exported lists:
 *
 *   RESET_DELETE_MODELS   — financial data + derived artifacts. Wiped.
 *   RESET_KEEP_MODELS     — identity, access, integrations, legal /
 *                           compliance records, billing relationships,
 *                           professional communications. Survive.
 *   RESET_CDR_DELEGATED   — owned by `lib/services/cdrDataLifecycle.ts`
 *                           (remote Basiq deletion + local purge). The
 *                           reset calls deleteCDRData() and never touches
 *                           these models directly.
 *
 * `tests/services/accountReset.classification.test.ts` walks the Prisma
 * DMMF and FAILS THE BUILD if a model with a User relation is missing
 * from all three lists — so adding a new model forces the author to
 * decide whether a fresh start wipes it. (Same structural-drift defence
 * as the 2026-06-11 AuditAction enum fix: classification drift must be a
 * red test, not a silent hole in a destructive feature.)
 *
 * KEEP rationale, where non-obvious:
 *   - UserConsent / CDRConsent / CDRDisclosure / CDRComplaint — legal &
 *     CDR record-keeping obligations; consent history must survive data
 *     erasure (Privacy Act APP / CDR rules).
 *   - AuditLog — immutable trail (CLAUDE.md §12.5).
 *   - ConversationMessage / ConversationParticipant / Professional* —
 *     adviser-side communications carry a 7-year AFSL retention
 *     obligation (decision 2026-05-04); a consumer data reset cannot
 *     erase the professional's compliance archive.
 *   - FeedbackThread / FeedbackMessage — support history with Monitrax,
 *     not financial data.
 *   - MFAMethod / PasskeyCredential / UserSession / OAuthAccount /
 *     MagicLink / LoginAttempt / EmailMFACode — access + security. A
 *     data reset must not weaken account security or log the user out.
 *   - UserPreference — app preferences (theme, dismissed banners) are
 *     about the app, not the data. Kept.
 *   - StorageProviderConfig / AccountingIntegration — integration
 *     connections (like OAuth); reset wipes the data, not the plumbing.
 *   - OrganizationMember — org/portal membership is access, not data.
 *
 * DB DELETION ORDER (CLAUDE.md §12.11 destructive write)
 * ------------------------------------------------------
 * The schema has EXACTLY 7 `onDelete: Restrict` relations, all of them
 * `<entity> → LegalEntity` (verified against the DMMF 2026-06-12, same
 * set as `accountDeletion.ts`). Those 7 entity models are deleted FIRST
 * so `legalEntity.deleteMany` cannot hit a Restrict violation. Every
 * other relation is Cascade or SetNull, so children without a direct
 * userId (holdings, household members, document shares, …) fall away at
 * the DB level when their parent row goes.
 *
 * §12.11 answers for every operation in this module:
 *   1. WHERE matches: `{ userId }` from the verified bearer token on
 *      every deleteMany; `{ id: userId }` on the User update. The user
 *      can only ever reset their OWN data.
 *   2. Columns / rows affected: all rows of the RESET_DELETE_MODELS for
 *      this user; on User only the onboarding flags + basiqUserId are
 *      overwritten (reset to day-one defaults) — identity, email,
 *      password, security and trusted-contact columns are untouched.
 *   3. Guard: route-level type-RESET confirmation + active-adviser-link
 *      block (see `app/api/account/reset/route.ts`), plus the
 *      classification test above.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { createAuditLog } from '@/lib/security/auditLog';
import { deleteCDRData } from '@/lib/services/cdrDataLifecycle';

/**
 * Financial data + derived artifacts — wiped by a reset.
 * Order matters ONLY for the first 7 (Restrict-bearing entity models);
 * the rest are Cascade/SetNull-safe in any order.
 */
export const RESET_DELETE_MODELS = [
  // Phase A — the 7 Restrict-bearing entity models (must precede LegalEntity)
  'Asset',
  'Property',
  'Loan',
  'Account',
  'Income',
  'Expense',
  'InvestmentAccount',
  // Phase B — entity graph roots + independents (cascades cover children)
  'LegalEntity',
  'EntityRelationship',
  'OwnershipGroup',
  'BeneficialOwnershipOverride',
  'DistributionResolution',
  'DividendDistribution',
  'PrivateCompanyBenefit',
  'TrustDeedRule',
  'Category',
  'Transaction',
  'DebtPlan',
  'UnifiedTransaction',
  'CanonicalCategoryRegistry',
  'BookkeepingPeriod',
  'EngagementState',
  'TransactionEdit',
  'Vendor',
  'TaxCategoryMapping',
  'RecurringPayment',
  'ReminderState',
  'Reminder',
  'NetWorthSnapshot',
  'SpendingProfile',
  'StrategyRecommendation',
  'StrategySession',
  'StrategyForecast',
  'CashflowForecast',
  'CashflowInsight',
  'BankImportFile',
  'BudgetTarget',
  'CashflowStrategy',
  'Document',
  'SuperannuationAccount',
  'SmsfAnnualReturn',
  'TaxPosition',
  'HouseholdProfile',
  'BudgetAnalysis',
  'DebtAnalysis',
  'CashflowSummary',
  'AICategorizationLearning',
  'ImportBatch',
  'TransactionReviewQueue',
  'SharePackage',
  'AIAdviceDocument',
] as const;

/** Identity / legal / billing / comms — survive a reset. See header. */
export const RESET_KEEP_MODELS = [
  'UserConsent',
  'AuditLog',
  'CDRConsent',
  'CDRDisclosure',
  'CDRComplaint',
  'MFAMethod',
  'PasskeyCredential',
  'UserSession',
  'MagicLink',
  'OAuthAccount',
  'LoginAttempt',
  'EmailMFACode',
  'UserPreference',
  'OrganizationMember',
  'StorageProviderConfig',
  'AccountingIntegration',
  'ProfessionalRating',
  'ProfessionalRequest',
  'FeedbackThread',
  'FeedbackMessage',
  'ConversationParticipant',
  'ConversationMessage',
] as const;

/** Owned by the CDR lifecycle service (remote Basiq + local purge). */
export const RESET_CDR_DELEGATED_MODELS = ['BasiqConnection'] as const;

export interface AccountResetResult {
  userId: string;
  success: boolean;
  /** True once the irreversible wipe transaction committed. */
  dataDeleted: boolean;
  /** Total rows removed across all RESET_DELETE_MODELS. */
  deletedRows: number;
  /** Whether the CDR purge (remote Basiq + local rows) completed. */
  cdrPurged: boolean;
  /** Diagnostic when success === false. */
  error?: string;
}

/** Prisma client property for a DMMF model name (first char lowercased). */
function clientKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Wipe all financial data for a user while keeping the account.
 * Never throws — failures are returned so the route can report them.
 *
 * The wipe is a single transaction: either the user gets a complete
 * fresh start or nothing changes. CDR purge runs BEFORE the transaction
 * (it calls the remote Basiq API and must not hold a DB transaction
 * open); a CDR hiccup is logged but does not block the local wipe.
 */
export async function resetUserData(userId: string): Promise<AccountResetResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return {
      userId,
      success: false,
      dataDeleted: false,
      deletedRows: 0,
      cdrPurged: false,
      error: 'User not found',
    };
  }

  // 1. CDR purge first — deletes remote Basiq connections + BASIQ-sourced
  //    local rows. Best-effort: a Basiq outage must not block the local
  //    wipe the user asked for (mirrors accountDeletion.ts step 2).
  let cdrPurged = false;
  try {
    await deleteCDRData(userId, 'user_requested');
    cdrPurged = true;
  } catch (err) {
    log.warn('CDR purge errored during data reset (continuing)', {
      userId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  // 2. Single-transaction wipe: Phase A (Restrict-bearing) first, then
  //    Phase B, then reset the User row's onboarding state so the wizard
  //    treats them as day one.
  let deletedRows = 0;
  try {
    deletedRows = await prisma.$transaction(
      async (tx) => {
        let total = 0;
        for (const model of RESET_DELETE_MODELS) {
          // Every model in RESET_DELETE_MODELS has a direct `userId`
          // column (verified by the classification test against the DMMF).
          const delegate = (tx as unknown as Record<
            string,
            { deleteMany: (args: { where: { userId: string } }) => Promise<{ count: number }> }
          >)[clientKey(model)];
          const { count } = await delegate.deleteMany({ where: { userId } });
          total += count;
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingCompleted: false,
            onboardingProfileType: null,
            onboardingStartedAt: null,
            onboardingCompletedAt: null,
            onboardingStep: 0,
            basiqUserId: null,
          },
        });

        return total;
      },
      { timeout: 60_000 },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error('Account data reset failed', err as Error, { userId });
    return {
      userId,
      success: false,
      dataDeleted: false,
      deletedRows: 0,
      cdrPurged,
      error: `Data reset failed: ${detail}`,
    };
  }

  // 3. Audit. CDR-safe metadata — counts and booleans only (§13.3).
  await createAuditLog({
    userId,
    action: 'USER_DATA_RESET',
    status: 'SUCCESS',
    entityType: 'User',
    entityId: userId,
    metadata: { deletedRows, cdrPurged },
  }).catch(() => {});

  log.info('Account data reset completed', { userId, deletedRows, cdrPurged });
  return { userId, success: true, dataDeleted: true, deletedRows, cdrPurged };
}
