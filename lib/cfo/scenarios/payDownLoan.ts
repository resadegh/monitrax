/**
 * Scenario: Make extra repayments against a specific loan.
 *
 * Computes interest saved + months reduced when an extra monthly amount is
 * applied. Uses the canonical interest-period primitive
 * (`calculateInterestForPeriod`) and an amortisation walk — no new math
 * primitive added (CLAUDE.md §12.2).
 */

import { calculateInterestForPeriod } from '@/lib/utils/calculations';
import type { ScenarioContext, ScenarioResult } from './types';

export interface PayDownLoanParams {
  loanId: string;
  extraMonthly: number;
}

export function payDownLoanScenario(
  ctx: ScenarioContext,
  params: PayDownLoanParams
): ScenarioResult {
  const loan = ctx.loans?.find((l) => l.id === params.loanId);

  if (!loan) {
    return {
      type: 'payDownLoan',
      title: 'Extra repayments',
      summary: 'Loan not found in current snapshot.',
      impacts: [],
      warnings: [{ severity: 'critical', message: `No loan with id ${params.loanId}.` }],
      assumptions: [],
      computedAt: new Date().toISOString(),
    };
  }

  const baseline = walkAmortisation(loan.principal, loan.interestRate, loan.monthlyRepayment, 0);
  const accelerated = walkAmortisation(
    loan.principal,
    loan.interestRate,
    loan.monthlyRepayment,
    params.extraMonthly
  );

  const interestSaved = baseline.totalInterest - accelerated.totalInterest;
  const monthsReduced = baseline.months - accelerated.months;

  const monthlyCashflowBefore = ctx.snapshot.quickMetrics.monthlyCashflow;
  const monthlyCashflowAfter = monthlyCashflowBefore - params.extraMonthly;

  const warnings = [];
  if (monthlyCashflowAfter < 0) {
    warnings.push({
      severity: 'caution' as const,
      message: `Adding ${formatCurrency(params.extraMonthly)}/mo to repayments would push your monthly cashflow into deficit (${formatCurrency(monthlyCashflowAfter)}).`,
    });
  }
  if (loan.loanType?.toLowerCase().includes('fixed')) {
    warnings.push({
      severity: 'caution' as const,
      message: `${loan.name} appears to be on a fixed rate. Many lenders cap extra repayments on fixed loans (often $10–30k/yr) — confirm with your lender before committing.`,
    });
  }

  return {
    type: 'payDownLoan',
    title: `Extra ${formatCurrency(params.extraMonthly)}/mo on ${loan.name}`,
    summary: `Adding ${formatCurrency(
      params.extraMonthly
    )} to your monthly repayment on ${loan.name} would save ${formatCurrency(
      interestSaved
    )} in total interest and clear the loan ${monthsReduced} months sooner.`,
    impacts: [
      {
        label: 'Interest saved (lifetime)',
        before: baseline.totalInterest,
        after: accelerated.totalInterest,
        delta: -interestSaved,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Months to payoff',
        before: baseline.months,
        after: accelerated.months,
        delta: -monthsReduced,
        format: 'number',
        direction: 'positive',
      },
      {
        label: 'Monthly cashflow',
        before: monthlyCashflowBefore,
        after: monthlyCashflowAfter,
        delta: -params.extraMonthly,
        format: 'currency',
        direction: 'negative',
      },
    ],
    warnings,
    assumptions: [
      `Current rate (${(loan.interestRate * 100).toFixed(2)}%) held constant for the remaining term.`,
      'Extra payments applied each month to principal after interest accrues.',
      'No re-fix, redraw, or rate change events modelled.',
    ],
    computedAt: new Date().toISOString(),
  };
}

function walkAmortisation(
  startingPrincipal: number,
  annualRate: number,
  monthlyRepayment: number,
  extraMonthly: number
): { months: number; totalInterest: number } {
  let principal = startingPrincipal;
  let totalInterest = 0;
  let months = 0;
  const cap = 600;
  while (principal > 0.01 && months < cap) {
    const interest = calculateInterestForPeriod(principal, annualRate, 12);
    const principalPayment = Math.max(0, monthlyRepayment - interest) + extraMonthly;
    if (principalPayment <= 0) {
      months = cap;
      break;
    }
    const applied = Math.min(principalPayment, principal);
    principal -= applied;
    totalInterest += interest;
    months += 1;
  }
  return { months, totalInterest };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}
