/**
 * ACTUAL CASHFLOW ENGINE
 * ======================
 *
 * PURE, unit-testable computation of cashflow from ACTUAL bank transactions
 * (the `UnifiedTransaction` table) rather than DECLARED records
 * (`Expense`/`Income`/`Loan` × frequency).
 *
 * WHY THIS EXISTS (Phase 1 — financial-correctness fix):
 * Headline tiles (cashflow surplus, savings rate, Money-Story kept/margin,
 * emergency-fund months, Safety-Net survival) were historically computed from
 * DECLARED records via `calculateCashflow()`. That silently DROPS every
 * uncategorised / unlinked OUT transaction → falsely optimistic surplus,
 * margin, and runway. This engine sums ALL non-transfer OUT transactions
 * (abs amount), so the headline reflects what actually left the account —
 * including the "Uncategorised" bucket.
 *
 * The CORRECT aggregation pattern already existed in `lib/tie/analytics.ts`
 * (`calculateSpendingSummary`) and `lib/calculations/moneyStoryTrend.ts`
 * (the ribbon). This file extracts that pattern into a single canonical,
 * SSOT-respecting engine consumed by `masterFinancialService`.
 *
 * DESIGN RULES (kept identical to the reference implementations):
 * - `isTransfer === true` rows are EXCLUDED (an internal account-to-account
 *   move is not spend or income).
 * - Amounts are summed via `Math.abs(amount)` — OUT amounts may be stored
 *   negative in some sources; we normalise to magnitude.
 * - OUT vs IN is determined by `direction`, NOT by the sign of the amount.
 * - Uncategorised OUT (categoryLevel1 null/empty) is INCLUDED in outflow
 *   totals and bucketed under the literal label 'Uncategorised'. Dropping it
 *   is the exact bug this engine fixes.
 *
 * PURE: accepts raw rows, returns structured output, never fetches, never
 * mutates global state. Unit-tested in tests/calculations/actualCashflow.test.ts.
 *
 * @module lib/calculations/actualCashflow
 * @since Phase 1 (cashflow-actuals)
 */

/** Label used for OUT transactions with no categoryLevel1. */
export const UNCATEGORISED_LABEL = 'Uncategorised';

/**
 * Minimal raw transaction shape this engine needs. Deliberately narrow so the
 * caller can `select` only these columns from Prisma.
 */
export interface ActualCashflowTransaction {
  date: Date;
  amount: number;
  /** 'IN' | 'OUT' — TransactionDirection enum. */
  direction: string;
  /** categoryLevel1; null/empty → bucketed under UNCATEGORISED_LABEL. */
  categoryLevel1?: string | null;
  /** Internal transfers are excluded from spend/income totals. */
  isTransfer?: boolean | null;
}

export interface ActualCashflowResult {
  /** Sum of non-transfer OUT amounts in the CURRENT calendar month. */
  currentMonthOutflow: number;
  /** Sum of non-transfer IN amounts in the CURRENT calendar month. */
  currentMonthInflow: number;
  /** currentMonthInflow − currentMonthOutflow (can be negative). */
  currentMonthNet: number;
  /**
   * Average monthly OUT across the trailing 3 FULL calendar months
   * (i.e. excluding the in-progress current month). Smooths spikes for
   * rate / runway tiles. Divisor is always 3 — a zero-spend month is a
   * real data point, not absence of data.
   */
  avgMonthlyOutflow: number;
  /** Average monthly IN across the trailing 3 FULL calendar months. */
  avgMonthlyInflow: number;
  /**
   * Current-month OUT broken down by categoryLevel1, null → 'Uncategorised'.
   * Includes the Uncategorised line — that is the headline-correctness fix.
   */
  outflowByCategory: Record<string, number>;
  /** True if ANY non-transfer transaction exists in the supplied window. */
  hasActualData: boolean;
}

export interface ComputeActualCashflowOptions {
  /** "Now" reference (defaults to new Date()). Injectable for tests. */
  now?: Date;
}

/** Year-month key, e.g. 2026-06 (zero-padded month so lexical === chrono). */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute actual-transaction cashflow.
 *
 * @param transactions raw transaction rows (any window; this fn buckets them)
 * @param options.now reference timestamp for "current month" + trailing window
 */
export function computeActualCashflow(
  transactions: ActualCashflowTransaction[],
  options: ComputeActualCashflowOptions = {}
): ActualCashflowResult {
  const now = options.now ?? new Date();

  // Exclude internal transfers up front — they are neither spend nor income.
  const nonTransfers = transactions.filter((t) => t.isTransfer !== true);

  const empty: ActualCashflowResult = {
    currentMonthOutflow: 0,
    currentMonthInflow: 0,
    currentMonthNet: 0,
    avgMonthlyOutflow: 0,
    avgMonthlyInflow: 0,
    outflowByCategory: {},
    hasActualData: false,
  };

  if (nonTransfers.length === 0) return empty;

  const currentKey = monthKey(now);

  // Trailing 3 FULL months = the 3 calendar months immediately BEFORE the
  // current (in-progress) month. We average across exactly these 3 buckets
  // so an empty month still drags the average down (it's a real zero-spend
  // month, not missing data — the window is fixed, not data-driven).
  const fullMonthKeys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    fullMonthKeys.push(monthKey(d));
  }
  const fullMonthSet = new Set(fullMonthKeys);

  let currentMonthOutflow = 0;
  let currentMonthInflow = 0;
  const outflowByCategory: Record<string, number> = {};

  // Per-month trailing aggregates keyed by month for the average.
  const trailingOut = new Map<string, number>();
  const trailingIn = new Map<string, number>();

  for (const t of nonTransfers) {
    const key = monthKey(t.date);
    const magnitude = Math.abs(t.amount);
    const isOut = t.direction === 'OUT';
    const isIn = t.direction === 'IN';

    if (key === currentKey) {
      if (isOut) {
        currentMonthOutflow += magnitude;
        const cat = t.categoryLevel1 || UNCATEGORISED_LABEL;
        outflowByCategory[cat] = (outflowByCategory[cat] || 0) + magnitude;
      } else if (isIn) {
        currentMonthInflow += magnitude;
      }
    }

    if (fullMonthSet.has(key)) {
      if (isOut) {
        trailingOut.set(key, (trailingOut.get(key) || 0) + magnitude);
      } else if (isIn) {
        trailingIn.set(key, (trailingIn.get(key) || 0) + magnitude);
      }
    }
  }

  // Average across the fixed 3-month window (divisor is always 3).
  const sumTrailingOut = fullMonthKeys.reduce(
    (s, k) => s + (trailingOut.get(k) || 0),
    0
  );
  const sumTrailingIn = fullMonthKeys.reduce(
    (s, k) => s + (trailingIn.get(k) || 0),
    0
  );
  const avgMonthlyOutflow = sumTrailingOut / fullMonthKeys.length;
  const avgMonthlyInflow = sumTrailingIn / fullMonthKeys.length;

  return {
    currentMonthOutflow,
    currentMonthInflow,
    currentMonthNet: currentMonthInflow - currentMonthOutflow,
    avgMonthlyOutflow,
    avgMonthlyInflow,
    outflowByCategory,
    hasActualData: true,
  };
}
