/**
 * Scenario: Refinance a loan to a new (lower) rate.
 *
 * Holds principal + remaining term constant; recomputes the monthly P&I
 * repayment at the new rate and reports monthly + lifetime savings.
 * Uses the canonical `calculatePIRepayment` primitive — no new math.
 */

import { calculatePIRepayment, calculatePIRepaymentDecimal } from '@/lib/utils/calculations';
import { Decimal, toDecimal } from '@/lib/decimal';
import type { ScenarioContext, ScenarioResult, ScenarioResultDecimal, ScenarioImpactDecimal } from './types';

export interface RefinanceLoanParams {
  loanId: string;
  newRate: number; // annual decimal, e.g. 0.055
  switchingCosts?: number;
}

const DEFAULT_SWITCHING_COSTS = 1500;

export function refinanceLoanScenario(
  ctx: ScenarioContext,
  params: RefinanceLoanParams
): ScenarioResult {
  const loan = ctx.loans?.find((l) => l.id === params.loanId);

  if (!loan) {
    return {
      type: 'refinanceLoan',
      title: 'Refinance loan',
      summary: 'Loan not found in current snapshot.',
      impacts: [],
      warnings: [{ severity: 'critical', message: `No loan with id ${params.loanId}.` }],
      assumptions: [],
      computedAt: new Date().toISOString(),
    };
  }

  const switchingCosts = params.switchingCosts ?? DEFAULT_SWITCHING_COSTS;
  const remainingMonths = Math.max(1, loan.remainingMonths);

  const newMonthlyRepayment = calculatePIRepayment(loan.principal, params.newRate, remainingMonths);
  const monthlySavings = loan.monthlyRepayment - newMonthlyRepayment;
  const lifetimeSavings = monthlySavings * remainingMonths - switchingCosts;
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(switchingCosts / monthlySavings) : Infinity;

  const monthlyCashflowBefore = ctx.snapshot.quickMetrics.monthlyCashflow;
  const monthlyCashflowAfter = monthlyCashflowBefore + monthlySavings;

  const warnings = [];
  if (monthlySavings <= 0) {
    warnings.push({
      severity: 'critical' as const,
      message: `New rate (${(params.newRate * 100).toFixed(2)}%) does not produce monthly savings vs current repayment. Refinancing not worthwhile at this rate.`,
    });
  }
  if (breakEvenMonths > 36 && breakEvenMonths !== Infinity) {
    warnings.push({
      severity: 'caution' as const,
      message: `Break-even is ${breakEvenMonths} months. Only worthwhile if you intend to keep the loan that long.`,
    });
  }
  if (loan.loanType?.toLowerCase().includes('fixed')) {
    warnings.push({
      severity: 'caution' as const,
      message: `${loan.name} appears to be fixed. Break costs on fixed-rate exits can be substantial — request a precise quote from your lender before committing.`,
    });
  }

  return {
    type: 'refinanceLoan',
    title: `Refinance ${loan.name} to ${(params.newRate * 100).toFixed(2)}%`,
    summary:
      monthlySavings > 0
        ? `Refinancing ${loan.name} from ${(loan.interestRate * 100).toFixed(
            2
          )}% to ${(params.newRate * 100).toFixed(2)}% would save ${formatCurrency(
            monthlySavings
          )}/mo, ${formatCurrency(lifetimeSavings)} over the remaining term (after ${formatCurrency(
            switchingCosts
          )} switching costs), with break-even in ${breakEvenMonths} months.`
        : `New rate of ${(params.newRate * 100).toFixed(2)}% is not lower than the current repayment implies — no savings.`,
    impacts: [
      {
        label: 'Monthly repayment',
        before: loan.monthlyRepayment,
        after: newMonthlyRepayment,
        delta: -monthlySavings,
        format: 'currency',
        direction: monthlySavings > 0 ? 'positive' : 'negative',
      },
      {
        label: 'Monthly cashflow',
        before: monthlyCashflowBefore,
        after: monthlyCashflowAfter,
        delta: monthlySavings,
        format: 'currency',
        direction: monthlySavings > 0 ? 'positive' : 'negative',
      },
      {
        label: 'Lifetime savings (net of costs)',
        before: 0,
        after: lifetimeSavings,
        delta: lifetimeSavings,
        format: 'currency',
        direction: lifetimeSavings > 0 ? 'positive' : 'negative',
      },
    ],
    warnings,
    assumptions: [
      `Principal (${formatCurrency(loan.principal)}) and remaining term (${remainingMonths} months) held constant.`,
      `Switching costs assumed at ${formatCurrency(switchingCosts)} (legals + discharge + new application). Real costs vary by lender.`,
      'New rate held constant for the remaining term — does not model future rate changes.',
    ],
    computedAt: new Date().toISOString(),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

// =============================================================================
// Q-DEC PR 2.E.1 — Decimal sibling
// =============================================================================

/**
 * Decimal sibling of `refinanceLoanScenario`. Composes
 * `calculatePIRepaymentDecimal` for the new repayment; all other
 * arithmetic (savings, break-even, cashflow) runs through Decimal.
 * Non-numeric outputs (title/summary/warnings/assumptions) are formatted
 * via the Float-side `formatCurrency` after boundary conversion — those
 * are presentation-side, not computation-side (mirrors the §12.2 SSOT
 * pattern PR 2.D engines use for `calculations` arrays).
 */
export function refinanceLoanScenarioDecimal(
  ctx: ScenarioContext,
  params: RefinanceLoanParams,
): ScenarioResultDecimal {
  const loan = ctx.loans?.find((l) => l.id === params.loanId);

  if (!loan) {
    return {
      type: 'refinanceLoan',
      title: 'Refinance loan',
      summary: 'Loan not found in current snapshot.',
      impacts: [],
      warnings: [{ severity: 'critical', message: `No loan with id ${params.loanId}.` }],
      assumptions: [],
      computedAt: new Date().toISOString(),
    };
  }

  const switchingCosts = new Decimal(params.switchingCosts ?? DEFAULT_SWITCHING_COSTS);
  const remainingMonths = Math.max(1, loan.remainingMonths);

  const principal = toDecimal(loan.principal) ?? new Decimal(0);
  const currentMonthlyRepayment = toDecimal(loan.monthlyRepayment) ?? new Decimal(0);
  const newRate = toDecimal(params.newRate) ?? new Decimal(0);

  const newMonthlyRepayment = calculatePIRepaymentDecimal(principal, newRate, remainingMonths);
  const monthlySavings = currentMonthlyRepayment.minus(newMonthlyRepayment);
  const lifetimeSavings = monthlySavings.times(remainingMonths).minus(switchingCosts);
  const breakEvenMonths = monthlySavings.gt(0)
    ? Math.ceil(switchingCosts.div(monthlySavings).toNumber())
    : Infinity;

  const monthlyCashflowBefore = toDecimal(ctx.snapshot.quickMetrics.monthlyCashflow) ?? new Decimal(0);
  const monthlyCashflowAfter = monthlyCashflowBefore.plus(monthlySavings);

  const warnings = [];
  if (monthlySavings.lte(0)) {
    warnings.push({
      severity: 'critical' as const,
      message: `New rate (${(params.newRate * 100).toFixed(2)}%) does not produce monthly savings vs current repayment. Refinancing not worthwhile at this rate.`,
    });
  }
  if (breakEvenMonths > 36 && breakEvenMonths !== Infinity) {
    warnings.push({
      severity: 'caution' as const,
      message: `Break-even is ${breakEvenMonths} months. Only worthwhile if you intend to keep the loan that long.`,
    });
  }
  if (loan.loanType?.toLowerCase().includes('fixed')) {
    warnings.push({
      severity: 'caution' as const,
      message: `${loan.name} appears to be fixed. Break costs on fixed-rate exits can be substantial — request a precise quote from your lender before committing.`,
    });
  }

  const monthlySavingsF = monthlySavings.toNumber();
  const lifetimeSavingsF = lifetimeSavings.toNumber();
  const switchingCostsF = switchingCosts.toNumber();

  const impacts: ScenarioImpactDecimal[] = [
    {
      label: 'Monthly repayment',
      before: currentMonthlyRepayment,
      after: newMonthlyRepayment,
      delta: monthlySavings.neg(),
      format: 'currency',
      direction: monthlySavings.gt(0) ? 'positive' : 'negative',
    },
    {
      label: 'Monthly cashflow',
      before: monthlyCashflowBefore,
      after: monthlyCashflowAfter,
      delta: monthlySavings,
      format: 'currency',
      direction: monthlySavings.gt(0) ? 'positive' : 'negative',
    },
    {
      label: 'Lifetime savings (net of costs)',
      before: new Decimal(0),
      after: lifetimeSavings,
      delta: lifetimeSavings,
      format: 'currency',
      direction: lifetimeSavings.gt(0) ? 'positive' : 'negative',
    },
  ];

  return {
    type: 'refinanceLoan',
    title: `Refinance ${loan.name} to ${(params.newRate * 100).toFixed(2)}%`,
    summary:
      monthlySavings.gt(0)
        ? `Refinancing ${loan.name} from ${(loan.interestRate * 100).toFixed(
            2,
          )}% to ${(params.newRate * 100).toFixed(2)}% would save ${formatCurrency(
            monthlySavingsF,
          )}/mo, ${formatCurrency(lifetimeSavingsF)} over the remaining term (after ${formatCurrency(
            switchingCostsF,
          )} switching costs), with break-even in ${breakEvenMonths} months.`
        : `New rate of ${(params.newRate * 100).toFixed(2)}% is not lower than the current repayment implies — no savings.`,
    impacts,
    warnings,
    assumptions: [
      `Principal (${formatCurrency(principal.toNumber())}) and remaining term (${remainingMonths} months) held constant.`,
      `Switching costs assumed at ${formatCurrency(switchingCostsF)} (legals + discharge + new application). Real costs vary by lender.`,
      'New rate held constant for the remaining term — does not model future rate changes.',
    ],
    computedAt: new Date().toISOString(),
  };
}
