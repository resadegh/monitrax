/**
 * expenseDataMaturity — Phase 43.4
 *
 * The "data confidence" gate for the Money Story Hero's day-count
 * display. Replaces the cheap `monthlyExpenses > 0` check shipped in
 * Phase 43 with a more honest two-mode assessment that covers both
 * bank-imported users and manual-entry users.
 *
 * Why this exists: the Money Story Hero shows *"47 days of life"* —
 * the user's runway in days. That number is honest only when monthly
 * expenses are well-defined. A user with three weeks of bank data
 * may not have hit their annual home-insurance bill yet, so the
 * monthlyExpenses figure undercounts and "47 days" overstates. This
 * helper detects that case and lets the hero fall back to *"Truly
 * liquid right now"* (the dollar amount, no day claim).
 *
 * Two-mode logic:
 *   1. Bank-imported users:
 *        ≥ 90 days of UnifiedTransaction history → mature.
 *        (At least one quarterly cycle, so annual bills should
 *        have appeared at least once.)
 *   2. Manual-entry users:
 *        ≥ 3 recurring Expense entries AND ≥ 1 flagged essential.
 *        (User has done meaningful expense classification.)
 *
 * Either mode satisfies. A user with both can satisfy via either
 * path. A user with neither — e.g. brand new sign-up — gets the
 * fallback display.
 *
 * Pure read query. SSOT-clean (CLAUDE.md §6.1 + §12.2). Lives at
 * `lib/dashboard/` because it's a presentation-layer guard, not a
 * canonical financial calculation.
 *
 * @see docs/blueprint/PHASE_43_4_ENOUGH_HISTORY_GATE.md
 */

import prisma from '@/lib/db';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_RECURRING_EXPENSES = 3;

export interface ExpenseDataMaturityResult {
  /** True when the day-count display is honest to show. */
  isMature: boolean;
  /** Which path satisfied (or 'none' if not mature). For doc/debug only. */
  reason: 'bank_history' | 'manual_classification' | 'none';
}

/**
 * Determine whether the user's expense data is mature enough to back
 * a runway-in-days claim on the Money Story Hero.
 *
 * Single Prisma round-trip — uses a parallel-fetch of the oldest
 * transaction date and the recurring-expense classification counts
 * via Promise.all to keep latency low.
 */
export async function getExpenseDataMaturity(
  userId: string,
): Promise<ExpenseDataMaturityResult> {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);

  // Two independent reads — fire in parallel.
  const [oldestTxn, expenseCounts] = await Promise.all([
    prisma.unifiedTransaction.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
    prisma.expense.aggregate({
      where: {
        userId,
        // Recurring entries only — one-off expenses don't count
        // as "user has classified their recurring spending".
        isRecurring: true,
      },
      _count: { _all: true },
    }),
  ]);

  // Mode 1 — bank history.
  if (oldestTxn && oldestTxn.date <= ninetyDaysAgo) {
    return { isMature: true, reason: 'bank_history' };
  }

  // Mode 2 — manual classification. The recurring count gates it;
  // we add a second small query for essential-flag presence so the
  // empty-classification case doesn't satisfy.
  if ((expenseCounts._count._all ?? 0) >= MIN_RECURRING_EXPENSES) {
    const essentialCount = await prisma.expense.count({
      where: { userId, isRecurring: true, isEssential: true },
    });
    if (essentialCount >= 1) {
      return { isMature: true, reason: 'manual_classification' };
    }
  }

  return { isMature: false, reason: 'none' };
}
