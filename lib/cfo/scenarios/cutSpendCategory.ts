/**
 * Scenario: Reduce spending in a category by a fixed monthly amount.
 *
 * Looks up the current monthly spend for the category from the snapshot's
 * canonical expense breakdown, computes the reduction, and projects the
 * downstream effects on monthly cashflow, savings rate, and emergency fund
 * months covered.
 */

import { Decimal, toDecimal } from '@/lib/decimal';
import type { ScenarioContext, ScenarioResult, ScenarioResultDecimal, ScenarioImpactDecimal } from './types';

export interface CutSpendCategoryParams {
  category: string;
  monthlyReduction: number;
}

export function cutSpendCategoryScenario(
  ctx: ScenarioContext,
  params: CutSpendCategoryParams
): ScenarioResult {
  const { snapshot } = ctx;
  const categoryNorm = params.category.toLowerCase();
  const categoryRow = snapshot.expenses.monthly.byCategory.find(
    (c) => c.category.toLowerCase() === categoryNorm
  );
  const currentMonthlySpend = categoryRow?.amount ?? 0;

  const realisedReduction = Math.min(params.monthlyReduction, currentMonthlySpend);

  const monthlyCashflowBefore = snapshot.quickMetrics.monthlyCashflow;
  const monthlyCashflowAfter = monthlyCashflowBefore + realisedReduction;

  const monthlyExpensesBefore = snapshot.quickMetrics.monthlyExpenses;
  const monthlyExpensesAfter = monthlyExpensesBefore - realisedReduction;

  const monthlyIncome = snapshot.quickMetrics.monthlyIncome;
  const savingsRateBefore = snapshot.quickMetrics.savingsRate;
  const savingsRateAfter =
    monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpensesAfter - snapshot.quickMetrics.monthlyLoanRepayments) /
          monthlyIncome) *
        100
      : 0;

  const emergencyMonthsBefore = snapshot.emergencyFund.monthsCovered;
  const emergencyMonthsAfter =
    monthlyExpensesAfter > 0 ? snapshot.emergencyFund.liquidCash / monthlyExpensesAfter : 0;

  const warnings = [];
  if (currentMonthlySpend === 0) {
    warnings.push({
      severity: 'caution' as const,
      message: `No recorded spending in category "${params.category}" — the snapshot has nothing to reduce. Check the category name matches an existing budget category.`,
    });
  }
  if (params.monthlyReduction > currentMonthlySpend) {
    warnings.push({
      severity: 'info' as const,
      message: `Requested ${formatCurrency(
        params.monthlyReduction
      )}/mo reduction exceeds current spend (${formatCurrency(
        currentMonthlySpend
      )}). Capped at the actual spend.`,
    });
  }

  return {
    type: 'cutSpendCategory',
    title: `Cut ${formatCurrency(realisedReduction)}/mo from ${params.category}`,
    summary: `Reducing ${params.category} spending by ${formatCurrency(
      realisedReduction
    )}/mo would lift your monthly cashflow to ${formatCurrency(
      monthlyCashflowAfter
    )} and improve your savings rate from ${savingsRateBefore.toFixed(
      1
    )}% to ${savingsRateAfter.toFixed(1)}%.`,
    impacts: [
      {
        label: 'Monthly cashflow',
        before: monthlyCashflowBefore,
        after: monthlyCashflowAfter,
        delta: realisedReduction,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Annual saving',
        before: 0,
        after: realisedReduction * 12,
        delta: realisedReduction * 12,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Savings rate',
        before: savingsRateBefore,
        after: savingsRateAfter,
        delta: savingsRateAfter - savingsRateBefore,
        format: 'percent',
        direction: 'positive',
      },
      {
        label: 'Emergency fund months',
        before: emergencyMonthsBefore,
        after: emergencyMonthsAfter,
        delta: emergencyMonthsAfter - emergencyMonthsBefore,
        format: 'number',
        direction: 'positive',
      },
    ],
    warnings,
    assumptions: [
      `Current ${params.category} spend = ${formatCurrency(currentMonthlySpend)}/mo (from snapshot).`,
      'Other income, expenses, and loan repayments held constant.',
      'Annual figure = monthly reduction × 12.',
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

export function cutSpendCategoryScenarioDecimal(
  ctx: ScenarioContext,
  params: CutSpendCategoryParams,
): ScenarioResultDecimal {
  const { snapshot } = ctx;
  const categoryNorm = params.category.toLowerCase();
  const categoryRow = snapshot.expenses.monthly.byCategory.find(
    (c) => c.category.toLowerCase() === categoryNorm,
  );
  const currentMonthlySpend = toDecimal(categoryRow?.amount ?? 0) ?? new Decimal(0);
  const requestedReduction = toDecimal(params.monthlyReduction) ?? new Decimal(0);

  const realisedReduction = Decimal.min(requestedReduction, currentMonthlySpend);

  const monthlyCashflowBefore = toDecimal(snapshot.quickMetrics.monthlyCashflow) ?? new Decimal(0);
  const monthlyCashflowAfter = monthlyCashflowBefore.plus(realisedReduction);

  const monthlyExpensesBefore = toDecimal(snapshot.quickMetrics.monthlyExpenses) ?? new Decimal(0);
  const monthlyExpensesAfter = monthlyExpensesBefore.minus(realisedReduction);

  const monthlyIncome = toDecimal(snapshot.quickMetrics.monthlyIncome) ?? new Decimal(0);
  const monthlyLoanRepayments = toDecimal(snapshot.quickMetrics.monthlyLoanRepayments) ?? new Decimal(0);
  const savingsRateBefore = toDecimal(snapshot.quickMetrics.savingsRate) ?? new Decimal(0);
  const savingsRateAfter = monthlyIncome.gt(0)
    ? monthlyIncome
        .minus(monthlyExpensesAfter)
        .minus(monthlyLoanRepayments)
        .div(monthlyIncome)
        .times(100)
    : new Decimal(0);

  const emergencyMonthsBefore = toDecimal(snapshot.emergencyFund.monthsCovered) ?? new Decimal(0);
  const emergencyLiquidCash = toDecimal(snapshot.emergencyFund.liquidCash) ?? new Decimal(0);
  const emergencyMonthsAfter = monthlyExpensesAfter.gt(0)
    ? emergencyLiquidCash.div(monthlyExpensesAfter)
    : new Decimal(0);

  const warnings = [];
  if (currentMonthlySpend.isZero()) {
    warnings.push({
      severity: 'caution' as const,
      message: `No recorded spending in category "${params.category}" — the snapshot has nothing to reduce. Check the category name matches an existing budget category.`,
    });
  }
  if (requestedReduction.gt(currentMonthlySpend)) {
    warnings.push({
      severity: 'info' as const,
      message: `Requested ${formatCurrency(
        params.monthlyReduction,
      )}/mo reduction exceeds current spend (${formatCurrency(
        currentMonthlySpend.toNumber(),
      )}). Capped at the actual spend.`,
    });
  }

  const impacts: ScenarioImpactDecimal[] = [
    {
      label: 'Monthly cashflow',
      before: monthlyCashflowBefore,
      after: monthlyCashflowAfter,
      delta: realisedReduction,
      format: 'currency',
      direction: 'positive',
    },
    {
      label: 'Annual saving',
      before: new Decimal(0),
      after: realisedReduction.times(12),
      delta: realisedReduction.times(12),
      format: 'currency',
      direction: 'positive',
    },
    {
      label: 'Savings rate',
      before: savingsRateBefore,
      after: savingsRateAfter,
      delta: savingsRateAfter.minus(savingsRateBefore),
      format: 'percent',
      direction: 'positive',
    },
    {
      label: 'Emergency fund months',
      before: emergencyMonthsBefore,
      after: emergencyMonthsAfter,
      delta: emergencyMonthsAfter.minus(emergencyMonthsBefore),
      format: 'number',
      direction: 'positive',
    },
  ];

  return {
    type: 'cutSpendCategory',
    title: `Cut ${formatCurrency(realisedReduction.toNumber())}/mo from ${params.category}`,
    summary: `Reducing ${params.category} spending by ${formatCurrency(
      realisedReduction.toNumber(),
    )}/mo would lift your monthly cashflow to ${formatCurrency(
      monthlyCashflowAfter.toNumber(),
    )} and improve your savings rate from ${savingsRateBefore.toNumber().toFixed(
      1,
    )}% to ${savingsRateAfter.toNumber().toFixed(1)}%.`,
    impacts,
    warnings,
    assumptions: [
      `Current ${params.category} spend = ${formatCurrency(currentMonthlySpend.toNumber())}/mo (from snapshot).`,
      'Other income, expenses, and loan repayments held constant.',
      'Annual figure = monthly reduction × 12.',
    ],
    computedAt: new Date().toISOString(),
  };
}
