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

import { Decimal, toDecimal } from '@/lib/decimal';
import type {
  ScenarioContext,
  ScenarioResult,
  ScenarioResultDecimal,
  ScenarioImpactDecimal,
  ScenarioWarning,
} from './types';
import {
  computePropertyDisposalCgt,
  resolvePropertyOwners,
  type PropertyDisposalCgtResult,
} from './propertyDisposalCgt';

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

  // Phase 47 Stage D · D6 — per-entity CGT (null on the back-compat path).
  const cgt = buildCgtForSellProperty(ctx, params.propertyId);
  const yourCgt = cgt && !cgt.isCapitalLoss ? yourCgtNumber(cgt) : 0;

  const netWorthBefore = snapshot.netWorth.netWorth;
  // Net worth absorbs selling costs + the user's own estimated CGT liability.
  const netWorthAfter = netWorthBefore - sellingCosts - yourCgt;

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
  if (cgt) {
    warnings.push(...cgtWarningLines(cgt));
  } else {
    warnings.push({
      severity: 'caution' as const,
      message:
        'Capital Gains Tax may apply on the disposal. The estimate above does not include CGT — consult the Tax tab and your accountant for a precise figure.',
    });
  }
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
        label: cgt && !cgt.isCapitalLoss ? 'Net worth (after est. CGT)' : 'Net worth (excl. CGT)',
        before: netWorthBefore,
        after: netWorthAfter,
        delta: -sellingCosts - yourCgt,
        format: 'currency',
        direction: 'negative',
      },
      ...(cgt && !cgt.isCapitalLoss
        ? [
            {
              label: 'Estimated CGT (your share)',
              before: 0,
              after: -yourCgt,
              delta: -yourCgt,
              format: 'currency' as const,
              direction: 'negative' as const,
            },
          ]
        : []),
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
      ...(cgt
        ? cgtAssumptionLines(cgt)
        : ['CGT not included — see Tax tab for portfolio-level CGT estimate.']),
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

// =============================================================================
// Phase 47 Stage D · D6 — per-entity CGT wiring
//
// Composes the canonical Div 115 engine (via `computePropertyDisposalCgt`)
// using the ownership facts the route hands in on `ctx.propertyTaxContexts`.
// When that context is absent (AI-advisor tool path, or a user with no
// structure), both siblings fall back to the prior single-line CGT flag —
// no behaviour change.
// =============================================================================

/**
 * Resolve + compute the per-entity CGT for the property being sold. Returns
 * `null` when the route didn't supply the CGT context (back-compat path).
 */
export function buildCgtForSellProperty(
  ctx: ScenarioContext,
  propertyId: string,
): PropertyDisposalCgtResult | null {
  const pCtx = ctx.propertyTaxContexts?.find((p) => p.propertyId === propertyId);
  if (!pCtx || !ctx.taxConfig || !ctx.currentFy) return null;

  const property = ctx.snapshot.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  const sellingCostsPct = DEFAULT_SELLING_COSTS_PCT; // mirrors the scenario default
  const { owners } = resolvePropertyOwners({
    ownershipContext: {
      legalOwnerEntityId: pCtx.legalOwnerEntityId,
      group: pCtx.ownershipGroup,
      override: pCtx.beneficialOverride,
    },
    candidates: pCtx.owners,
  });
  if (owners.length === 0) return null;

  return computePropertyDisposalCgt({
    proceeds: property.currentValue,
    sellingCosts: property.currentValue * sellingCostsPct,
    costBase: pCtx.costBase,
    acquisitionDate: new Date(pCtx.acquisitionDate),
    disposalDate: new Date(),
    disposalFy: ctx.currentFy,
    config: ctx.taxConfig,
    owners,
    userMarginalRate: ctx.userMarginalRate ?? 0,
  });
}

/** The user's own estimated CGT as a plain number (0 when none). */
function yourCgtNumber(cgt: PropertyDisposalCgtResult): number {
  return cgt.yourEstimatedTax.toNumber();
}

/**
 * Per-owner CGT breakdown + caveats as assumption lines (the lever surfaces
 * these in the "How we computed this" panel). Honest by construction — every
 * owner's taxable gain is shown; only the user's tax is estimated.
 */
function cgtAssumptionLines(cgt: PropertyDisposalCgtResult): string[] {
  const costBase = cgt.costBase.toNumber();
  const lines: string[] = [];
  if (cgt.isCapitalLoss) {
    lines.push(
      `Disposal is a capital loss of ${formatCurrency(Math.abs(cgt.totalNominalGain.toNumber()))} — no CGT. The loss can offset capital gains in the same or a future year (s102-10).`,
    );
  } else {
    lines.push(
      `Capital gain split across ${cgt.owners.length} owner${cgt.owners.length === 1 ? '' : 's'}: total gain ${formatCurrency(cgt.totalNominalGain.toNumber())}, total taxable after discounts ${formatCurrency(cgt.totalTaxableGain.toNumber())}.`,
    );
    for (const o of cgt.owners) {
      const pct = Math.round(o.weight * 100);
      const discPct = Math.round(o.discountRate.toNumber() * 100);
      const taxBit =
        o.estimatedTax !== null
          ? ` Est. tax ~${formatCurrency(o.estimatedTax.toNumber())} (${o.estimatedTaxBasis})`
          : ` ${o.estimatedTaxBasis}`;
      lines.push(
        `${o.name} — ${pct}% share: ${formatCurrency(o.nominalGainShare.toNumber())} gain → ${formatCurrency(o.taxableGain.toNumber())} taxable after ${discPct}% discount${o.metHoldingPeriod ? '' : ' (held < 12 months — no discount)'}.${taxBit}`,
      );
    }
    lines.push(
      `CGT cost base = recorded purchase price (${formatCurrency(costBase)}); it excludes capital improvements and buying costs (stamp duty, legals), which would reduce the gain. Assumes this is not your main residence (a main-residence disposal may be fully CGT-exempt — s118-110).`,
    );
  }
  for (const f of cgt.flags) lines.push(f.rationale);
  return lines;
}

/**
 * CGT warnings — surfaced to the AI advisor + reports (the lever UI itself
 * renders impacts + assumptions, not warnings). Replaces the old generic
 * "CGT may apply" line with the real, per-entity picture.
 */
function cgtWarningLines(cgt: PropertyDisposalCgtResult): ScenarioWarning[] {
  if (cgt.isCapitalLoss) {
    return [
      {
        severity: 'info',
        message: `Disposal is a capital loss of ${formatCurrency(Math.abs(cgt.totalNominalGain.toNumber()))} — no CGT. The loss can offset other capital gains.`,
      },
    ];
  }
  const warnings: ScenarioWarning[] = [
    {
      severity: 'caution',
      message: `Estimated CGT on your share is ~${formatCurrency(yourCgtNumber(cgt))} (at your current marginal rate). Each co-owner's CGT is taxed in their own return. See the Tax tab for the precise figure.`,
    },
  ];
  for (const f of cgt.flags) {
    warnings.push({ severity: 'caution', message: f.rationale });
  }
  return warnings;
}

// =============================================================================
// Q-DEC PR 2.E.1 — Decimal sibling
// =============================================================================

export function sellPropertyScenarioDecimal(
  ctx: ScenarioContext,
  params: SellPropertyParams,
): ScenarioResultDecimal {
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

  const sellingCostsPct = toDecimal(params.sellingCostsPercent ?? DEFAULT_SELLING_COSTS_PCT) ?? new Decimal(0);
  const grossProceeds = toDecimal(property.currentValue) ?? new Decimal(0);
  const sellingCosts = grossProceeds.times(sellingCostsPct);
  const loanPayoff = toDecimal(property.loanBalance) ?? new Decimal(0);
  const netCashFreed = grossProceeds.minus(sellingCosts).minus(loanPayoff);

  const monthlyCashflowBefore = toDecimal(snapshot.quickMetrics.monthlyCashflow) ?? new Decimal(0);
  const propertyMonthlyCashflow = toDecimal(property.monthlyCashflow) ?? new Decimal(0);
  const monthlyCashflowAfter = monthlyCashflowBefore.minus(propertyMonthlyCashflow);

  // Phase 47 Stage D · D6 — per-entity CGT (null on the back-compat path).
  const cgt = buildCgtForSellProperty(ctx, params.propertyId);
  const yourCgt = cgt && !cgt.isCapitalLoss ? cgt.yourEstimatedTax : new Decimal(0);
  const cgtComputed = cgt !== null && !cgt.isCapitalLoss;

  const netWorthBefore = toDecimal(snapshot.netWorth.netWorth) ?? new Decimal(0);
  // Net worth absorbs selling costs + the user's own estimated CGT liability.
  const netWorthAfter = netWorthBefore.minus(sellingCosts).minus(yourCgt);

  const liquidCashBefore = toDecimal(snapshot.quickMetrics.liquidCash) ?? new Decimal(0);
  const liquidCashAfter = liquidCashBefore.plus(netCashFreed);

  const propertyEquity = toDecimal(property.equity) ?? new Decimal(0);
  const propertyPortfolioValueBefore = toDecimal(snapshot.propertyPortfolioValue) ?? new Decimal(0);
  const propertyPortfolioValueAfter = propertyPortfolioValueBefore.minus(grossProceeds);

  const warnings = [];
  if (propertyMonthlyCashflow.lt(0)) {
    warnings.push({
      severity: 'info' as const,
      message: `${property.name} is currently negative-geared by ${formatCurrency(
        Math.abs(property.monthlyCashflow),
      )}/mo. Selling removes that drag.`,
    });
  }
  if (propertyMonthlyCashflow.gt(0)) {
    warnings.push({
      severity: 'caution' as const,
      message: `${property.name} is positively-geared by ${formatCurrency(
        property.monthlyCashflow,
      )}/mo. Selling removes this income stream.`,
    });
  }
  if (cgt) {
    warnings.push(...cgtWarningLines(cgt));
  } else {
    warnings.push({
      severity: 'caution' as const,
      message:
        'Capital Gains Tax may apply on the disposal. The estimate above does not include CGT — consult the Tax tab and your accountant for a precise figure.',
    });
  }
  if (propertyEquity.lt(0)) {
    warnings.push({
      severity: 'critical' as const,
      message: `${property.name} is in negative equity (loan exceeds value by ${formatCurrency(
        Math.abs(property.equity),
      )}). Sale proceeds will not cover the loan payoff.`,
    });
  }

  const impacts: ScenarioImpactDecimal[] = [
    {
      label: 'Liquid cash',
      before: liquidCashBefore,
      after: liquidCashAfter,
      delta: netCashFreed,
      format: 'currency',
      direction: netCashFreed.gt(0) ? 'positive' : 'negative',
    },
    {
      label: 'Monthly cashflow',
      before: monthlyCashflowBefore,
      after: monthlyCashflowAfter,
      delta: propertyMonthlyCashflow.neg(),
      format: 'currency',
      direction: propertyMonthlyCashflow.lt(0)
        ? 'positive'
        : propertyMonthlyCashflow.gt(0)
          ? 'negative'
          : 'neutral',
    },
    {
      label: cgtComputed ? 'Net worth (after est. CGT)' : 'Net worth (excl. CGT)',
      before: netWorthBefore,
      after: netWorthAfter,
      delta: sellingCosts.neg().minus(yourCgt),
      format: 'currency',
      direction: 'negative',
    },
    ...(cgtComputed
      ? [
          {
            label: 'Estimated CGT (your share)',
            before: new Decimal(0),
            after: yourCgt.neg(),
            delta: yourCgt.neg(),
            format: 'currency' as const,
            direction: 'negative' as const,
          },
        ]
      : []),
    {
      label: 'Property portfolio value',
      before: propertyPortfolioValueBefore,
      after: propertyPortfolioValueAfter,
      delta: grossProceeds.neg(),
      format: 'currency',
      direction: 'neutral',
    },
  ];

  return {
    type: 'sellProperty',
    title: `Sell ${property.name}`,
    summary: `Disposing of ${property.name} at its current value of ${formatCurrency(
      property.currentValue,
    )} would free ${formatCurrency(netCashFreed.toNumber())} after selling costs and loan payoff${
      propertyMonthlyCashflow.lt(0)
        ? `, and remove ${formatCurrency(Math.abs(property.monthlyCashflow))}/mo of negative cashflow`
        : propertyMonthlyCashflow.gt(0)
          ? `, but you'd lose ${formatCurrency(property.monthlyCashflow)}/mo of positive cashflow`
          : ''
    }.`,
    impacts,
    warnings,
    assumptions: [
      `Sale price = current recorded value (${formatCurrency(property.currentValue)}).`,
      `Selling costs = ${(sellingCostsPct.toNumber() * 100).toFixed(1)}% of sale price (agent fees + legals + marketing).`,
      `Loan payoff = current loan balance against this property (${formatCurrency(loanPayoff.toNumber())}).`,
      ...(cgt
        ? cgtAssumptionLines(cgt)
        : ['CGT not included — see Tax tab for portfolio-level CGT estimate.']),
      'Excludes opportunity cost of not redeploying the freed capital.',
    ],
    computedAt: new Date().toISOString(),
  };
}
