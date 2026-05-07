/**
 * Phase 42 PR1 — Per-mutation audit trail for UnifiedTransaction.
 *
 * Records every category / link / flag mutation as a `TransactionEdit`
 * row with before/after JSON snapshots. Fire-and-forget per CLAUDE.md
 * §12.10 — audit logging never blocks a response.
 *
 * Used by:
 *   - `app/api/unified-transactions/[id]/route.ts` PATCH (this PR)
 *   - PR2 split mutations (when they land)
 *   - PR3 receipt-link mutations (when they land)
 *
 * For the read side of the audit trail (a professional opens a client's
 * dashboard), see Phase 32B PR3's `PRO_DASHBOARD_VIEW` flow in
 * `lib/services/masterFinancialService.ts`. Phase 42 audits the *write*;
 * Phase 32B audits the *read*. Both are required for AFSL/TPB compliance.
 */

import prisma from '@/lib/db';

export type TransactionEditType =
  | 'CATEGORY'      // categoryLevel1 / categoryLevel2 / subcategory changed
  | 'TAGS'          // tags array changed
  | 'LINK_ENTITY'   // propertyId / loanId / incomeId / expenseId / investmentAccountId changed
  | 'FLAG'          // isEssential / isTransfer / isInvestmentContribution toggled
  | 'RECURRING'     // isRecurring / recurrencePattern / recurrenceGroupId changed
  | 'DELETE'        // transaction deleted
  | 'SPLIT'         // PR2 — splits created/modified/removed
  | 'RECEIPT_LINK'; // PR3 — receipt linked/unlinked

export type TransactionEditSource =
  | 'USER'    // manual edit via UI
  | 'AI'      // AI categorisation pipeline (Phase 29)
  | 'RULE'    // CategoryRule auto-apply
  | 'IMPORT'  // initial import-time categorisation
  | 'SYSTEM'; // background processes (e.g. recurring-detection sweeps)

export interface RecordTransactionEditInput {
  transactionId: string;
  userId: string;
  editType: TransactionEditType;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  source?: TransactionEditSource;
}

/**
 * Record a transaction-edit audit row. Fire-and-forget — failure here
 * MUST NOT break the calling mutation. The caller does not await this
 * directly; this function returns a Promise that swallows errors.
 *
 * If the before/after snapshots are deeply identical, no row is written
 * — preserves the audit trail signal-to-noise ratio.
 */
export function recordTransactionEdit(input: RecordTransactionEditInput): Promise<void> {
  if (deepEqual(input.before, input.after)) {
    return Promise.resolve();
  }

  return prisma.transactionEdit
    .create({
      data: {
        transactionId: input.transactionId,
        userId: input.userId,
        editType: input.editType,
        before: input.before as object,
        after: input.after as object,
        source: input.source ?? 'USER',
      },
    })
    .then(() => {})
    .catch((err) => {
      console.error('[transactionEditAudit] failed to record edit:', err);
    });
}

/**
 * Helper — extract the subset of UnifiedTransaction fields a CATEGORY
 * edit cares about. Used by callers to build the before/after snapshots
 * without dragging the full row into the audit JSON.
 */
export function pickCategoryFields(row: {
  categoryLevel1?: string | null;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  userCorrectedCategory?: boolean;
  confidenceScore?: number | null;
}): Record<string, unknown> {
  return {
    categoryLevel1: row.categoryLevel1 ?? null,
    categoryLevel2: row.categoryLevel2 ?? null,
    subcategory: row.subcategory ?? null,
    userCorrectedCategory: row.userCorrectedCategory ?? false,
    confidenceScore: row.confidenceScore ?? null,
  };
}

export function pickLinkFields(row: {
  propertyId?: string | null;
  loanId?: string | null;
  incomeId?: string | null;
  expenseId?: string | null;
  investmentAccountId?: string | null;
}): Record<string, unknown> {
  return {
    propertyId: row.propertyId ?? null,
    loanId: row.loanId ?? null,
    incomeId: row.incomeId ?? null,
    expenseId: row.expenseId ?? null,
    investmentAccountId: row.investmentAccountId ?? null,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }
  return true;
}
