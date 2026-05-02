/**
 * Scenario: Sell a property.
 *
 * Models the portfolio outcome of disposing of a property at its current
 * recorded value. Computes the cash freed (sale proceeds − associated loan
 * payoff − selling costs), the cashflow delta (lose rental income, lose
 * mortgage repayment, lose property expenses), and the net worth delta.
 *
 * CGT is flagged in warnings rather than computed precisely — the canonical
 * CGT figure lives in the tax engine (`lib/tax-engine/`); attempting to
 * recompute it here would violate §12.2 SSOT.
 */

import type { ScenarioContext, ScenarioResult } from './types';

export interface SellPropertyParams {
  propertyId: string;
  sellingCostsPercent?: number;
}

const DEFAULT_SELLING_COSTS_PCT = 0.025;

export function sellPropertyScenario(
  ctx: ScenarioContext,
  params: SellPropertyParams
): ScenarioResult {
  const { snapshot } = ctx;
  const property = snapshot.properties.find((p) => p.id === params.propertyId);

  if (!property) {
    return {
      type: 'sellProperty',
      title: 'Sell property',
      summary: 'Property not found in current snapshot.',
      impacts: [],
      warnings: [{ severity: 'critical', message: `No property with id ${params.propertyId}.` }],
      assumptions: [],
      computedAt: new Date().toISOString(),
    };
  }

  const sellingCostsPct = params.sellingCostsPercent ?? DEFAULT_SELLING_COSTS_PCT;
  const grossProceeds = property.currentValue;
  const sellingCosts = grossProceeds * sellingCostsPct;
  const loanPayoff = property.loanBalance;
  const netCashFreed = grossProceeds - sellingCosts - loanPayoff;

  const monthlyCashflowBefore = snapshot.quickMetrics.monthlyCashflow;
  const monthlyCashflowAfter = monthlyCashflowBefore - property.monthlyCashflow;

  const netWorthBefore = snapshot.netWorth.netWorth;
  const netWorthAfter = netWorthBefore - sellingCosts;

  const liquidCashAfter = snapshot.quickMetrics.liquidCash + netCashFreed;

  const warnings = [];
  if (property.monthlyCashflow < 0) {
    warnings.push({
      severity: 'info' as const,
      message: `${property.name} is currently negative-geared by ${formatCurrency(
        Math.abs(property.monthlyCashflow)
      )}/mo. Selling removes that drag.`,
    });
  }
  if (property.monthlyCashflow > 0) {
    warnings.push({
      severity: 'caution' as const,
      message: `${property.name} is positively-geared by ${formatCurrency(
        property.monthlyCashflow
      )}/mo. Selling removes this income stream.`,
    });
  }
  warnings.push({
    severity: 'caution' as const,
    message:
      'Capital Gains Tax may apply on the disposal. The estimate above does not include CGT — consult the Tax tab and your accountant for a precise figure.',
  });
  if (property.equity < 0) {
    warnings.push({
      severity: 'critical' as const,
      message: `${property.name} is in negative equity (loan exceeds value by ${formatCurrency(
        Math.abs(property.equity)
      )}). Sale proceeds will not cover the loan payoff.`,
    });
  }

  return {
    type: 'sellProperty',
    title: `Sell ${property.name}`,
    summary: `Disposing of ${property.name} at its current value of ${formatCurrency(
      property.currentValue
    )} would free ${formatCurrency(netCashFreed)} after selling costs and loan payoff${
      property.monthlyCashflow < 0
        ? `, and remove ${formatCurrency(Math.abs(property.monthlyCashflow))}/mo of negative cashflow`
        : property.monthlyCashflow > 0
          ? `, but you'd lose ${formatCurrency(property.monthlyCashflow)}/mo of positive cashflow`
          : ''
    }.`,
    impacts: [
      {
        label: 'Liquid cash',
        before: snapshot.quickMetrics.liquidCash,
        after: liquidCashAfter,
        delta: netCashFreed,
        format: 'currency',
        direction: netCashFreed > 0 ? 'positive' : 'negative',
      },
      {
        label: 'Monthly cashflow',
        before: monthlyCashflowBefore,
        after: monthlyCashflowAfter,
        delta: -property.monthlyCashflow,
        format: 'currency',
        direction:
          property.monthlyCashflow < 0
            ? 'positive'
            : property.monthlyCashflow > 0
              ? 'negative'
              : 'neutral',
      },
      {
        label: 'Net worth (excl. CGT)',
        before: netWorthBefore,
        after: netWorthAfter,
        delta: -sellingCosts,
        format: 'currency',
        direction: 'negative',
      },
      {
        label: 'Property portfolio value',
        before: snapshot.propertyPortfolioValue,
        after: snapshot.propertyPortfolioValue - property.currentValue,
        delta: -property.currentValue,
        format: 'currency',
        direction: 'neutral',
      },
    ],
    warnings,
    assumptions: [
      `Sale price = current recorded value (${formatCurrency(property.currentValue)}).`,
      `Selling costs = ${(sellingCostsPct * 100).toFixed(1)}% of sale price (agent fees + legals + marketing).`,
      `Loan payoff = current loan balance against this property (${formatCurrency(loanPayoff)}).`,
      'CGT not included — see Tax tab for portfolio-level CGT estimate.',
      'Excludes opportunity cost of not redeploying the freed capital.',
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
