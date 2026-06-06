/**
 * Scenario: Begin (or increase) a regular investment contribution.
 *
 * Projects the future value of a monthly contribution at an assumed annual
 * return, and reports the impact on monthly cashflow.
 */

import { Decimal, toDecimal } from '@/lib/decimal';
import type { ScenarioContext, ScenarioResult, ScenarioResultDecimal, ScenarioImpactDecimal } from './types';

export interface AddInvestmentParams {
  monthlyAmount: number;
  expectedAnnualReturn?: number; // decimal, e.g. 0.07
  years?: number;
}

const DEFAULT_RETURN = 0.07;
const DEFAULT_YEARS = 10;

export function addInvestmentScenario(
  ctx: ScenarioContext,
  params: AddInvestmentParams
): ScenarioResult {
  const { snapshot } = ctx;
  const annualReturn = params.expectedAnnualReturn ?? DEFAULT_RETURN;
  const years = params.years ?? DEFAULT_YEARS;
  const months = years * 12;
  const monthlyReturn = annualReturn / 12;

  // Future value of a monthly annuity (ordinary annuity).
  const futureValue =
    monthlyReturn === 0
      ? params.monthlyAmount * months
      : params.monthlyAmount * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

  const totalContributions = params.monthlyAmount * months;
  const projectedGrowth = futureValue - totalContributions;

  const monthlyCashflowBefore = snapshot.quickMetrics.monthlyCashflow;
  const monthlyCashflowAfter = monthlyCashflowBefore - params.monthlyAmount;

  const warnings = [];
  if (monthlyCashflowAfter < 0) {
    warnings.push({
      severity: 'caution' as const,
      message: `A ${formatCurrency(
        params.monthlyAmount
      )}/mo contribution would push your cashflow into deficit (${formatCurrency(
        monthlyCashflowAfter
      )}). Consider building emergency fund and clearing high-interest debt first.`,
    });
  }
  if (snapshot.emergencyFund.monthsCovered < 3) {
    warnings.push({
      severity: 'caution' as const,
      message: `Your emergency fund covers only ${snapshot.emergencyFund.monthsCovered.toFixed(
        1
      )} months. The TRAIL framework prioritises 3 months of buffer (Anchor stage) before scaling Invest stage.`,
    });
  }

  return {
    type: 'addInvestment',
    title: `Invest ${formatCurrency(params.monthlyAmount)}/mo`,
    summary: `Contributing ${formatCurrency(
      params.monthlyAmount
    )}/mo for ${years} years at an assumed ${(annualReturn * 100).toFixed(
      1
    )}% annual return would grow to ${formatCurrency(
      futureValue
    )} — ${formatCurrency(projectedGrowth)} of that is compounding growth on top of your ${formatCurrency(
      totalContributions
    )} in contributions.`,
    impacts: [
      {
        label: 'Projected portfolio in ' + years + 'yr',
        before: snapshot.investments.totalValue,
        after: snapshot.investments.totalValue + futureValue,
        delta: futureValue,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Of which is compounding growth',
        before: 0,
        after: projectedGrowth,
        delta: projectedGrowth,
        format: 'currency',
        direction: 'positive',
      },
      {
        label: 'Monthly cashflow',
        before: monthlyCashflowBefore,
        after: monthlyCashflowAfter,
        delta: -params.monthlyAmount,
        format: 'currency',
        direction: monthlyCashflowAfter < 0 ? 'negative' : 'neutral',
      },
    ],
    warnings,
    assumptions: [
      `Assumed annual return: ${(annualReturn * 100).toFixed(1)}% (constant).`,
      `Time horizon: ${years} years.`,
      'Contributions made at end of each month, compounded monthly.',
      'Excludes fees, tax on dividends, and capital-gains tax on disposal.',
      'Past performance is not indicative of future returns.',
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

export function addInvestmentScenarioDecimal(
  ctx: ScenarioContext,
  params: AddInvestmentParams,
): ScenarioResultDecimal {
  const { snapshot } = ctx;
  const annualReturn = toDecimal(params.expectedAnnualReturn ?? DEFAULT_RETURN) ?? new Decimal(0);
  const years = params.years ?? DEFAULT_YEARS;
  const months = years * 12;
  const monthlyReturn = annualReturn.div(12);
  const monthlyAmount = toDecimal(params.monthlyAmount) ?? new Decimal(0);

  // Future value of a monthly annuity (ordinary annuity) — Decimal.pow with
  // integer exponent keeps it exact.
  const futureValue = monthlyReturn.isZero()
    ? monthlyAmount.times(months)
    : monthlyAmount.times(new Decimal(1).plus(monthlyReturn).pow(months).minus(1).div(monthlyReturn));

  const totalContributions = monthlyAmount.times(months);
  const projectedGrowth = futureValue.minus(totalContributions);

  const monthlyCashflowBefore = toDecimal(snapshot.quickMetrics.monthlyCashflow) ?? new Decimal(0);
  const monthlyCashflowAfter = monthlyCashflowBefore.minus(monthlyAmount);

  const warnings = [];
  if (monthlyCashflowAfter.lt(0)) {
    warnings.push({
      severity: 'caution' as const,
      message: `A ${formatCurrency(
        params.monthlyAmount,
      )}/mo contribution would push your cashflow into deficit (${formatCurrency(
        monthlyCashflowAfter.toNumber(),
      )}). Consider building emergency fund and clearing high-interest debt first.`,
    });
  }
  if (snapshot.emergencyFund.monthsCovered < 3) {
    warnings.push({
      severity: 'caution' as const,
      message: `Your emergency fund covers only ${snapshot.emergencyFund.monthsCovered.toFixed(
        1,
      )} months. The TRAIL framework prioritises 3 months of buffer (Anchor stage) before scaling Invest stage.`,
    });
  }

  const investmentsTotalValue = toDecimal(snapshot.investments.totalValue) ?? new Decimal(0);

  const impacts: ScenarioImpactDecimal[] = [
    {
      label: 'Projected portfolio in ' + years + 'yr',
      before: investmentsTotalValue,
      after: investmentsTotalValue.plus(futureValue),
      delta: futureValue,
      format: 'currency',
      direction: 'positive',
    },
    {
      label: 'Of which is compounding growth',
      before: new Decimal(0),
      after: projectedGrowth,
      delta: projectedGrowth,
      format: 'currency',
      direction: 'positive',
    },
    {
      label: 'Monthly cashflow',
      before: monthlyCashflowBefore,
      after: monthlyCashflowAfter,
      delta: monthlyAmount.neg(),
      format: 'currency',
      direction: monthlyCashflowAfter.lt(0) ? 'negative' : 'neutral',
    },
  ];

  return {
    type: 'addInvestment',
    title: `Invest ${formatCurrency(params.monthlyAmount)}/mo`,
    summary: `Contributing ${formatCurrency(
      params.monthlyAmount,
    )}/mo for ${years} years at an assumed ${(annualReturn.toNumber() * 100).toFixed(
      1,
    )}% annual return would grow to ${formatCurrency(
      futureValue.toNumber(),
    )} — ${formatCurrency(projectedGrowth.toNumber())} of that is compounding growth on top of your ${formatCurrency(
      totalContributions.toNumber(),
    )} in contributions.`,
    impacts,
    warnings,
    assumptions: [
      `Assumed annual return: ${(annualReturn.toNumber() * 100).toFixed(1)}% (constant).`,
      `Time horizon: ${years} years.`,
      'Contributions made at end of each month, compounded monthly.',
      'Excludes fees, tax on dividends, and capital-gains tax on disposal.',
      'Past performance is not indicative of future returns.',
    ],
    computedAt: new Date().toISOString(),
  };
}
