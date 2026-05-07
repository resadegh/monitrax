/**
 * Phase 42 PR3 — Cash account auto-creation.
 *
 * Per Phase 42 spec §4 PR3: every user gets a single, idempotently-
 * created `Account` of type `CASH` the first time they tap the cash
 * quick-add button. The cash account is the canonical landing spot for
 * the sole-trader / market-seller cash-log workflow Reza called out as
 * underserved in the bookkeeping review.
 *
 * Per CLAUDE.md §12.2 SSOT — cash transactions live on the same
 * `unified_transactions` table as everything else. There is no parallel
 * cash ledger; the cash account is just an Account row tagged
 * `type='CASH'` (added to LIQUID_ACCOUNT_TYPES per
 * `lib/types/prisma-enums.ts`). Net-worth + emergency-fund + cashflow
 * snapshots all read it the same way they read any liquid account.
 *
 * Idempotency is enforced by a deterministic name. If the user manually
 * created an account named "Cash" before this PR shipped (very unusual
 * but possible), we adopt it: re-tag its type to CASH on first
 * `getOrCreateCashAccount` call. This avoids duplicate rows.
 */

import prisma from '@/lib/db';
import type { Account } from '@prisma/client';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';

/** Canonical name used to discover an existing-but-untagged cash row. */
const CASH_ACCOUNT_NAME = 'Cash';

/**
 * Get-or-create the user's CASH-type Account. Idempotent — safe to
 * call from every cash-add request.
 *
 * Resolution order:
 *   1. Existing Account with `type='CASH'` for this user → use it
 *   2. Existing Account named "Cash" with another type → re-tag to CASH
 *      (one-shot adoption; never overwrites balance, name, or other
 *      user-set fields)
 *   3. Otherwise → create a fresh CASH account with $0 opening balance
 */
export async function getOrCreateCashAccount(userId: string): Promise<Account> {
  const existingTyped = await prisma.account.findFirst({
    where: { userId, type: 'CASH' },
  });
  if (existingTyped) return existingTyped;

  const existingNamed = await prisma.account.findFirst({
    where: { userId, name: CASH_ACCOUNT_NAME },
  });
  if (existingNamed) {
    // Adoption path — only flips the `type`. Balance, institution,
    // links, etc. all preserved. Per CLAUDE.md §12.11 — this update
    // touches user-created data, but the change is purely a tagging
    // (type field), not an overwrite of any user-entered numeric
    // value. Documented in PR body.
    return prisma.account.update({
      where: { id: existingNamed.id },
      data: { type: 'CASH' },
    });
  }

  // Resolve the user's PERSONAL_NAME LegalEntity (Phase 41a). Required
  // FK on Account; the helper auto-creates the entity on first call so
  // brand-new users still get a cash account.
  const ownerEntityId = await getDefaultLegalEntityId(userId);

  return prisma.account.create({
    data: {
      userId,
      ownerEntityId,
      name: CASH_ACCOUNT_NAME,
      type: 'CASH',
      institution: 'Cash on hand',
      currentBalance: 0,
      balanceSource: 'MANUAL',
      balanceLastUpdatedAt: new Date(),
    },
  });
}
