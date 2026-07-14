/**
 * MON-043 — the ONE aggregation behind the income "data-completeness" nudge.
 *
 * A user's DECLARED income (what they entered) drives the Tax estimate (gross),
 * but Home / Cashflow show the trailing-12-month ACTUALS (§19.1). When a declared
 * income row has NO matching transactions, it inflates the declared/tax total but
 * never enters the actuals — the source of the Home-vs-Tax income gap. This sums
 * the GROSS annual of exactly those rows so the surface can surface the gap.
 *
 * NOT a canonical financial engine — a presentation aggregation for a nudge, feeding
 * no downstream calc (the tax/net-worth engines read the rows directly, not this).
 * It reuses the canonical frequency conversion (`toAnnual`) — no new money formula.
 *
 * §19.2 worked example: one row {amount: 16058, frequency: 'MONTHLY',
 * transactionCount: 0} → annualTotal = 16058 × 12 = 192,696 (≈ the $192,698 "Other"
 * income Reza's VR-006 flagged as declared-only), sourceCount = 1.
 */
import { toAnnual } from '@/lib/utils/frequencies';

export interface DeclaredIncomeRow {
  amount: number;
  frequency: string;
  hasTransactions?: boolean | null;
  transactionCount?: number | null;
}

const hasActualTransactions = (r: DeclaredIncomeRow): boolean =>
  Boolean(r.hasTransactions && r.transactionCount && r.transactionCount > 0);

export function sumUnmatchedDeclaredAnnualIncome(rows: DeclaredIncomeRow[]): {
  annualTotal: number;
  sourceCount: number;
} {
  let annualTotal = 0;
  let sourceCount = 0;
  for (const r of rows) {
    if (hasActualTransactions(r)) continue;
    annualTotal += toAnnual(r.amount, r.frequency as never);
    sourceCount += 1;
  }
  return { annualTotal, sourceCount };
}
