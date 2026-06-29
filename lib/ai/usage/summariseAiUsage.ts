/**
 * Pure aggregation helpers for the Neobrain AI-usage panel (Phase 54).
 *
 * Split out of the admin route so the cost/share math is unit-testable WITHOUT
 * a database (the §19.2 discipline: test the pure transform, not the engine).
 * No Prisma, no I/O.
 */

export interface AiUsageGroupRow {
  /** The group key value (a surface or a model id). */
  key: string;
  calls: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageBreakdownRow extends AiUsageGroupRow {
  /** Share of total window cost, 0–100. 0 when total cost is 0. */
  costSharePct: number;
}

/**
 * Turn raw per-group sums into display rows: attach each group's share of the
 * total window cost and sort by cost descending (biggest spender first).
 */
export function toBreakdownRows(rows: AiUsageGroupRow[], totalCostUsd: number): AiUsageBreakdownRow[] {
  return rows
    .map((r) => ({
      ...r,
      costSharePct: totalCostUsd > 0 ? (r.estimatedCostUsd / totalCostUsd) * 100 : 0,
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
}

/** Success rate as a percentage (0–100); 100 when there were no calls. */
export function successRatePct(totalCalls: number, failedCalls: number): number {
  if (totalCalls <= 0) return 100;
  return ((totalCalls - failedCalls) / totalCalls) * 100;
}
