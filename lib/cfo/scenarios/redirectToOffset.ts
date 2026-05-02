/**
 * Scenario: Park additional cash in an offset account.
 *
 * Reduces the effective principal of a target loan by the amount parked,
 * reducing monthly interest accrual. Uses canonical primitives.
 */

import {
  calculateEffectivePrincipal,
  calculateInterestForPeriod,
} from '@/lib/utils/calculations';
import type { ScenarioContext, ScenarioResult } from './types';

export interface RedirectToOffsetParams {
  loanId: string;
  amount: number;
}

export function redirectToOffsetScenario(
  ctx: ScenarioContext,
  params: RedirectToOffsetParams
): ScenarioResult {
  const loan = ctx.loans?.find((l) => l.id === params.loanId);

  if (!loan) {
    return {
      type: 'redirectToOffset',
      title: 'Park cash in offset',
      summary: 'Loan not found in current snapshot.',
      impacts: [],
      warnings: [{ severity: 'critical', message: `No loan with id ${params.loanId}.` }],
      assumptions: [],
      computedAt: new Date().toISOString(),
    };
  }

  const interestBefore = calculateInterestForPeriod(
    calculateEffectivePrincipal(loan.principal, loan.offsetBalance),
    loan.interestRate,
    12
  );
  const interestAfter = calculateInterestForPeriod(
    calculateEffectivePrincipal(loan.principal, loan.offsetBalance + params.amount),
    loan.interestRate,
    12
  );
  const monthlyInterestSaved = interestBefore - interestAfter;
  const annualInterestSaved = monthlyInterestSaved * 12;

  const liquidCashBefore = ctx.snapshot.quickMetrics.liquidCash;
  const liquidCashAfter = liquidCashBefore; // offset balance still counts as liquid

  const warnings = [];
  if (params.amount > liquidCashBefore) {
    warnings.push({
      severity: 'caution' as const,
      message: `You only have ${formatCurrency(
        liquidCashBefore
      )} of liquid cash. Parking ${formatCurrency(
        params.amount
      )} would require redirecting from another account.`,
    });
  }
  if (calculateEffectivePrincipal(loan.principal, loan.offsetBalance) === 0) {
    warnings.push({
      severity: 'caution' as const,
      message: `${loan.name} is already fully offset — adding more cash here produces no further interest reduction.`,
    });
  }

  return {
    type: 'redirectToOffset',
    title: `Park ${formatCurrency(params.amount)} in ${loan.name} offset`,
    summary: `Adding ${formatCurrency(
      params.amount
    )} to the offset against ${loan.name} would save ${formatCurrency(
      monthlyInterestSaved
    )}/mo (${formatCurrency(annualInterestSaved)}/yr) in interest. Cash remains liquid and accessible.`,
    impacts: [
      {
        label: 'Interest saved (monthly)',
        before: 0,
        after: monthlyInterestSaved,
        delta: monthlyInterestSaved,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Interest saved (annual)',
        before: 0,
        after: annualInterestSaved,
        delta: annualInterestSaved,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Liquid cash (unchanged — offset is still accessible)',
        before: liquidCashBefore,
        after: liquidCashAfter,
        delta: 0,
        format: 'currency',
        direction: 'neutral',
      },
    ],
    warnings,
    assumptions: [
      `Loan rate (${(loan.interestRate * 100).toFixed(2)}%) held constant.`,
      'Offset reduces interest accrual at the loan rate (which exceeds typical savings rates after tax).',
      'Annual figure assumes the offset balance is held constant for 12 months.',
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
