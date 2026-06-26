/**
 * SSOT for a transaction row's DISPLAY status on the Activity / reconciliation
 * surface (Phase 55). One derived status per row, computed from the underlying
 * fields, so the UI shows ONE clear answer to "is this done, or does it need
 * me?" — instead of the five overlapping, contradictory signals it showed
 * before (confidence band + "Looks right" action + raw category pill +
 * confirm-state chip + link/transfer state).
 *
 * Read by BOTH the Activity row and the summary header (CLAUDE.md §12.2 — the
 * two surfaces can never disagree again). Pure + framework-agnostic.
 *
 * Two rules kill the old contradictions:
 *   1. LABEL = strongest signal, NOT raw categoryLevel1. A transfer reads
 *      "Transfer"; a row linked to an Income/Expense entry reads that link;
 *      only an unlinked row falls back to its category, then "Uncategorised".
 *      (Fixes the "Salary shows OTHER but is linked to income" inconsistency,
 *      and makes stale `isTransfer` rows read "Transfer" even before the
 *      data backfill — the display derives from isTransfer, not the null
 *      category.)
 *   2. STATE is one of three, mutually exclusive: done / suggested /
 *      needs-category — with at most ONE action. No row ever shows
 *      "Looks right" + "Uncategorised" + "Not confirmed yet" at once.
 *
 * §19.1 alignment: a transfer is "done" and excluded from spend — the label +
 * done-state communicate "handled, not spending", consistent with the actuals
 * engine excluding `isTransfer` rows.
 */

export type RowState = 'done' | 'suggested' | 'needs-category';

/** Minimal field subset the status derives from (a slice of UnifiedTransaction). */
export interface RowStatusInput {
  categoryLevel1: string | null;
  isTransfer: boolean;
  incomeId?: string | null;
  expenseId?: string | null;
  /** true once the user has confirmed/corrected the category. */
  userCorrectedCategory?: boolean | null;
}

export interface RowStatus {
  /** The single mutually-exclusive state driving the row's status cluster. */
  state: RowState;
  /** The ONE authoritative label shown on the row (strongest signal). */
  label: string;
  /** The single contextual action, or null when nothing is needed. */
  actionLabel: 'Confirm' | 'Add category' | null;
  /** Convenience: state === 'done'. */
  done: boolean;
}

/**
 * Derive the one display status for a transaction row.
 *
 * Priority for the label (strongest signal first): transfer → income link →
 * expense link (its category if any) → category → "Uncategorised".
 *
 * State:
 *   - done           — user-confirmed, OR a transfer, OR linked to an entity
 *                      (these are settled; nothing to do).
 *   - suggested      — has an AI category but isn't confirmed yet → "Confirm".
 *   - needs-category — genuinely uncategorised → "Add category".
 */
export function deriveRowStatus(tx: RowStatusInput): RowStatus {
  const isLinked = !!(tx.incomeId || tx.expenseId);

  // Label — the strongest signal wins; raw categoryLevel1 is the fallback.
  let label: string;
  if (tx.isTransfer) label = 'Transfer';
  else if (tx.incomeId) label = 'Income';
  else if (tx.expenseId) label = tx.categoryLevel1 || 'Expense';
  else label = tx.categoryLevel1 || 'Uncategorised';

  // State — done if confirmed / transfer / linked; else suggested vs needs-category.
  if (tx.userCorrectedCategory === true || tx.isTransfer || isLinked) {
    return { state: 'done', label, actionLabel: null, done: true };
  }
  if (tx.categoryLevel1) {
    return { state: 'suggested', label, actionLabel: 'Confirm', done: false };
  }
  return { state: 'needs-category', label: 'Uncategorised', actionLabel: 'Add category', done: false };
}

/** Tally rows into the three header states (the action-state summary). */
export function summariseRowStates(rows: RowStatusInput[]): {
  done: number;
  suggested: number;
  needsCategory: number;
  total: number;
} {
  let done = 0;
  let suggested = 0;
  let needsCategory = 0;
  for (const r of rows) {
    const s = deriveRowStatus(r).state;
    if (s === 'done') done++;
    else if (s === 'suggested') suggested++;
    else needsCategory++;
  }
  return { done, suggested, needsCategory, total: rows.length };
}
