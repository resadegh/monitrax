/**
 * Neobrain — engine-grounded debt projections (Phase 54 §15 Phase C).
 *
 * The debt-analysis AI surface must never INVENT a payoff date or interest-saved
 * figure. This module computes those projections from the canonical debt-payoff
 * engine (`lib/planning/debtPlanner.ts` → `runDebtPlan`) so the route can
 * OVERWRITE whatever the AI produced. SSOT: reuses the engine, adds no new
 * calculation (§12.2.1) — it only maps + formats.
 */
import { runDebtPlan, type LoanInput } from '@/lib/planning/debtPlanner';

/** Matches `DebtAnalysisResponse.projections` in the debt-analysis route. */
export interface DebtProjections {
  debtFreeDate: string;
  totalInterestSaved: number;
  monthsSaved: number;
  comparedToMinimum: string;
}

export type DebtStrategy = 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';

/** Whole months between two dates (later − earlier), floored at 0. */
function monthsBetween(earlier: Date, later: Date): number {
  const m = (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
  return Math.max(0, m);
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

/**
 * Compute the projections block from the canonical engine for a strategy +
 * monthly surplus. Pure (calls the pure `runDebtPlan`). Never fabricates a
 * payoff date — a non-payoffable portfolio returns an honest string.
 */
export function buildEngineProjections(
  loans: LoanInput[],
  strategy: DebtStrategy,
  monthlySurplus: number,
): DebtProjections {
  const plan = runDebtPlan(loans, {
    strategy,
    surplusPerPeriod: monthlySurplus,
    surplusFrequency: 'MONTHLY',
    emergencyBuffer: 0, // availableForExtra is already net of expenses + min repayments
    respectFixedCaps: true,
    rolloverRepayments: true,
  });

  const totalInterestSaved = Math.round(plan.totalInterestSaved);

  // Non-payoffable (e.g. interest-only with no surplus) → null debt-free date.
  // Never fabricate one.
  if (!plan.debtFreeDate) {
    return {
      debtFreeDate: 'Not payable off at the recommended surplus',
      totalInterestSaved,
      monthsSaved: 0,
      comparedToMinimum:
        'With the recommended surplus, the portfolio is not fully paid off within the modelled horizon — increase the surplus or review interest-only loans.',
    };
  }

  const monthsSaved = plan.baselineDebtFreeDate
    ? monthsBetween(plan.debtFreeDate, plan.baselineDebtFreeDate)
    : 0;

  const comparedToMinimum =
    monthsSaved > 0 || totalInterestSaved > 0
      ? `Debt-free by ${formatMonthYear(plan.debtFreeDate)} — about ${monthsSaved} month${monthsSaved === 1 ? '' : 's'} sooner and $${totalInterestSaved.toLocaleString()} less interest than minimum repayments.`
      : `Debt-free by ${formatMonthYear(plan.debtFreeDate)} on minimum repayments.`;

  return {
    debtFreeDate: formatMonthYear(plan.debtFreeDate),
    totalInterestSaved,
    monthsSaved,
    comparedToMinimum,
  };
}

/** Map the route's Prisma loans → the engine's LoanInput contract (units 1:1). */
export function toLoanInputs(
  loans: Array<Record<string, unknown> & { offsetAccount?: { currentBalance?: number } | null }>,
): LoanInput[] {
  return loans.map((l) => ({
    id: l.id as string,
    name: l.name as string,
    type: l.type as LoanInput['type'],
    principal: l.principal as number,
    interestRateAnnual: l.interestRateAnnual as number, // decimal (e.g. 0.0625)
    rateType: l.rateType as LoanInput['rateType'],
    fixedExpiry: (l.fixedExpiry as Date | null) ?? null,
    isInterestOnly: l.isInterestOnly as boolean,
    termMonthsRemaining: l.termMonthsRemaining as number,
    minRepayment: l.minRepayment as number,
    repaymentFrequency: l.repaymentFrequency as LoanInput['repaymentFrequency'],
    offsetBalance: l.offsetAccount?.currentBalance ?? 0,
    extraRepaymentCap: (l.extraRepaymentCap as number | null) ?? null,
  }));
}
