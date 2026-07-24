/**
 * Phase 17A: Tax Integration for CFO Dashboard
 * Integrates tax position data into the Personal CFO Engine
 *
 * All data is derived from REAL database records and deterministic calculations.
 * AI is only used for explanation/formatting, NEVER for inventing numbers.
 */

// MON-020: the tax position now comes from the ONE user-level source (shared
// with /cashflow) — this file no longer fetches data or calls calculateTaxPosition itself.
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { Decimal, toDecimal } from '@/lib/decimal';

// ============================================================================
// Types
// ============================================================================

export interface CFOTaxInsights {
  // Tax Position Summary
  taxPositionSnapshot: {
    estimatedRefund: number;          // or owing if negative
    confidenceLevel: number;          // 0-100%
    daysUntilEOFY: number;
    actionRequiredBeforeEOFY: boolean;
    financialYear: string;
  };

  // Deduction Summary
  deductionsSummary: {
    totalDeductions: number;
    propertyDeductions: number;
    investmentDeductions: number;
    workRelatedDeductions: number;
    depreciationDeductions: number;
    potentialMissedDeductions: string[];
  };

  // Tax Risks (passed to Risk Radar)
  taxRisks: TaxRisk[];

  // Key Metrics
  keyTaxMetrics: {
    effectiveTaxRate: number;
    marginalRate: number;
    negativeGearingBenefit: number;
    frankingCreditsAvailable: number;
    unrealisedCGT: number;
    paygWithheld: number;
    medicareLevy: number; // MON-039a
  };

  // Metadata
  metadata: {
    calculatedAt: Date;
    incomeCount: number;
    expenseCount: number;
    depreciationCount: number;
  };
}

export interface TaxRisk {
  type: TaxRiskType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number;
  action: string;
}

export type TaxRiskType =
  | 'cgt_exposure_high'
  | 'super_cap_approaching'
  | 'div293_threshold'
  | 'eofy_action_required'
  | 'depreciation_unclaimed'
  | 'franking_credits_unused'
  | 'negative_gearing_review'
  | 'tax_refund_opportunity';

// ============================================================================
// Tax Insights Calculator
// ============================================================================

export async function calculateCFOTaxInsights(userId: string): Promise<CFOTaxInsights> {
  const daysUntilEOFY = calculateDaysUntilEOFY();

  // MON-020: the canonical tax position (Medicare + full deductions + offsets)
  // comes from the ONE user-level source, shared with /cashflow so both
  // surfaces show the SAME tax number (§12.2.1). The raw rows come back too so
  // the CFO-specific extras (CGT, negative gearing, risks) don't re-fetch.
  const {
    taxPosition,
    financialYear,
    incomes,
    expenses,
    depreciations,
    properties,
    superTotals,
    holdings,
  } = await getUserTaxPosition(userId);

  // Calculate unrealised CGT from holdings
  const unrealisedCGT = calculateUnrealisedCGT(holdings);

  // MON-045: negative-gearing benefit is DERIVED from the canonical tax
  // position, not re-computed from raw property rows. The engine already
  // holds the one deductible-interest rule (auto-derived per property loan,
  // actuals-first, HOME excluded — lib/tax-engine/deductions/propertyLoanInterest.ts),
  // so the benefit is simply the property loss sheltered at the marginal rate:
  //   max(0, property deductions − rental income) × marginalRate.
  // The previous local producer (Σ principal×rate per property, declared-only)
  // was the rogue duplicate this issue deletes (§12.2.1 — one producer).
  const negativeGearingBenefit =
    Math.max(0, taxPosition.deductions.property - taxPosition.income.rental) *
    (taxPosition.tax.marginalRate / 100);

  // Detect tax risks
  const taxRisks = detectTaxRisks({
    taxPosition,
    superTotals,
    unrealisedCGT,
    daysUntilEOFY,
    properties,
    depreciations,
  });

  // Identify potential missed deductions
  const potentialMissedDeductions = identifyMissedDeductions(expenses, properties, depreciations);

  // Calculate confidence level based on data completeness
  const confidenceLevel = calculateConfidenceLevel(incomes, expenses, depreciations);

  return {
    taxPositionSnapshot: {
      estimatedRefund: taxPosition.estimatedRefund,
      confidenceLevel,
      daysUntilEOFY,
      actionRequiredBeforeEOFY: daysUntilEOFY <= 30 && taxRisks.some(r => r.type === 'eofy_action_required'),
      financialYear,
    },
    deductionsSummary: {
      totalDeductions: Math.round(taxPosition.deductions.total),
      propertyDeductions: Math.round(taxPosition.deductions.property),
      investmentDeductions: Math.round(taxPosition.deductions.investment),
      workRelatedDeductions: Math.round(taxPosition.deductions.workRelated),
      depreciationDeductions: Math.round(taxPosition.deductions.depreciation),
      potentialMissedDeductions,
    },
    taxRisks,
    keyTaxMetrics: {
      effectiveTaxRate: taxPosition.tax.effectiveRate,
      marginalRate: taxPosition.tax.marginalRate,
      negativeGearingBenefit: Math.round(negativeGearingBenefit),
      frankingCreditsAvailable: Math.round(taxPosition.income.frankingCredits),
      unrealisedCGT: Math.round(unrealisedCGT),
      paygWithheld: taxPosition.paygWithheld,
      medicareLevy: Math.round(taxPosition.tax.medicareLevy), // MON-039a: itemise the Medicare component
    },
    metadata: {
      calculatedAt: new Date(),
      incomeCount: incomes.length,
      expenseCount: expenses.length,
      depreciationCount: depreciations.length,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDaysUntilEOFY(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // EOFY is June 30
  let eofyYear = currentYear;
  if (currentMonth >= 6) { // July onwards
    eofyYear = currentYear + 1;
  }

  const eofy = new Date(eofyYear, 5, 30); // June 30
  const diffTime = eofy.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateUnrealisedCGT(holdings: any[]): number {
  let totalUnrealisedGains = 0;

  for (const holding of holdings) {
    const currentValue = holding.units * (holding.currentPrice || holding.averagePrice);
    const costBase = holding.units * holding.averagePrice;
    const gain = currentValue - costBase;

    if (gain > 0) {
      // Apply 50% CGT discount for holdings over 12 months (simplified)
      totalUnrealisedGains += gain * 0.5;
    }
  }

  return totalUnrealisedGains;
}

interface TaxRiskDetectionParams {
  taxPosition: any;
  superTotals: { concessional: number; nonConcessional: number };
  unrealisedCGT: number;
  daysUntilEOFY: number;
  properties: any[];
  depreciations: any[];
}

function detectTaxRisks(params: TaxRiskDetectionParams): TaxRisk[] {
  const { taxPosition, superTotals, unrealisedCGT, daysUntilEOFY, properties, depreciations } = params;
  const risks: TaxRisk[] = [];
  const config = getCurrentTaxYearConfig();

  // 1. High CGT exposure
  if (unrealisedCGT > 50000) {
    risks.push({
      type: 'cgt_exposure_high',
      severity: unrealisedCGT > 100000 ? 'high' : 'medium',
      title: 'Significant unrealised capital gains',
      description: `You have approximately $${unrealisedCGT.toLocaleString()} in unrealised capital gains. Consider timing of sales.`,
      impact: unrealisedCGT * (taxPosition.tax.marginalRate / 100),
      action: 'Review CGT timing strategy',
    });
  }

  // 2. Super cap approaching
  const concessionalCap = config.concessionalCap;
  const superCapUtilisation = superTotals.concessional / concessionalCap;
  if (superCapUtilisation > 0.8 && superCapUtilisation < 1) {
    risks.push({
      type: 'super_cap_approaching',
      severity: 'medium',
      title: 'Concessional super cap nearly reached',
      description: `You've used ${(superCapUtilisation * 100).toFixed(0)}% of your $${concessionalCap.toLocaleString()} concessional cap.`,
      impact: (concessionalCap - superTotals.concessional) * (taxPosition.tax.marginalRate / 100),
      action: 'Consider maximising contributions before EOFY',
    });
  } else if (superCapUtilisation >= 1) {
    risks.push({
      type: 'super_cap_approaching',
      severity: 'high',
      title: 'Concessional super cap exceeded',
      description: `You've exceeded your concessional cap by $${(superTotals.concessional - concessionalCap).toLocaleString()}. Excess will be taxed at marginal rate.`,
      impact: (superTotals.concessional - concessionalCap) * (taxPosition.tax.marginalRate / 100),
      action: 'Consult tax advisor about excess contributions',
    });
  }

  // 3. Division 293 threshold
  const div293Threshold = config.division293Threshold;
  const assessableIncome = taxPosition.tax.assessableIncome;
  if (assessableIncome > div293Threshold * 0.9 && assessableIncome < div293Threshold) {
    risks.push({
      type: 'div293_threshold',
      severity: 'medium',
      title: 'Approaching Division 293 threshold',
      description: `Income of $${assessableIncome.toLocaleString()} is within 10% of the $${div293Threshold.toLocaleString()} Division 293 threshold.`,
      impact: superTotals.concessional * config.superContributionsTaxRate,
      action: 'Consider strategies to manage income timing',
    });
  } else if (assessableIncome >= div293Threshold) {
    risks.push({
      type: 'div293_threshold',
      severity: 'high',
      title: 'Division 293 tax applies',
      description: `Income of $${assessableIncome.toLocaleString()} exceeds $${div293Threshold.toLocaleString()}. Additional ${config.superContributionsTaxRate * 100}% tax on super contributions.`,
      impact: superTotals.concessional * config.superContributionsTaxRate,
      action: 'Division 293 tax will be assessed',
    });
  }

  // 4. EOFY action required
  if (daysUntilEOFY <= 30) {
    const hasOpportunity =
      superCapUtilisation < 0.8 || // Can contribute more super
      taxPosition.estimatedRefund < 0; // Owing money - prepayments could help

    if (hasOpportunity) {
      risks.push({
        type: 'eofy_action_required',
        severity: daysUntilEOFY <= 7 ? 'high' : 'medium',
        title: `${daysUntilEOFY} days until EOFY`,
        description: 'End of financial year approaching. Review opportunities for deductions and super contributions.',
        impact: (concessionalCap - superTotals.concessional) * (taxPosition.tax.marginalRate / 100),
        action: 'Review EOFY tax planning opportunities',
      });
    }
  }

  // 5. Depreciation unclaimed
  const investmentProperties = properties.filter((p: any) => p.type === 'INVESTMENT');
  const propertiesWithDepreciation = new Set(depreciations.map((d: any) => d.propertyId));
  const propertiesWithoutDepreciation = investmentProperties.filter(
    (p: any) => !propertiesWithDepreciation.has(p.id)
  );

  if (propertiesWithoutDepreciation.length > 0) {
    // UNCOMPUTED `UC-PROPERTY-DEPRECIATION` per
    // PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md §10.3 — flagged heuristic.
    // Real Div 40 + Div 43 capital-allowance calc requires depreciation
    // schedule data we do not yet capture; this $3k/property impact is
    // a heuristic estimate intended to direct the user to a quantity
    // surveyor, not a precise tax saving.
    const HEURISTIC_PROPERTY_DEPRECIATION_PER_YEAR = 3000;
    risks.push({
      type: 'depreciation_unclaimed',
      severity: 'medium',
      title: 'Investment properties without depreciation',
      description: `${propertiesWithoutDepreciation.length} investment property(ies) have no depreciation schedule. You may be missing deductions.`,
      impact: propertiesWithoutDepreciation.length * HEURISTIC_PROPERTY_DEPRECIATION_PER_YEAR,
      action: 'Consider getting a depreciation schedule',
    });
  }

  // 6. Franking credits unused (refund opportunity)
  if (taxPosition.income.frankingCredits > 0 && taxPosition.tax.netTax < taxPosition.income.frankingCredits) {
    const excessCredits = taxPosition.income.frankingCredits - taxPosition.tax.netTax;
    risks.push({
      type: 'franking_credits_unused',
      severity: 'low',
      title: 'Excess franking credits',
      description: `You have $${excessCredits.toLocaleString()} in franking credits exceeding tax liability. These will be refunded.`,
      impact: excessCredits,
      action: 'Franking credits will be refunded',
    });
  }

  // 7. Tax refund opportunity
  if (taxPosition.estimatedRefund > 1000) {
    risks.push({
      type: 'tax_refund_opportunity',
      severity: 'low',
      title: 'Estimated tax refund',
      description: `You're estimated to receive a $${taxPosition.estimatedRefund.toLocaleString()} tax refund.`,
      impact: taxPosition.estimatedRefund,
      action: 'Consider adjusting PAYG withholding',
    });
  }

  return risks;
}

/**
 * MON-077: the advisory reconciles against the CANONICAL tax position —
 * never a raw-row re-derivation (§12.2.1). The pre-MON-045 "loan interest
 * for X" heuristic assumed interest only enters the position via a logged
 * INTEREST expense row; since MON-045 (#1425) property loan interest is
 * AUTO-CLAIMED into `taxPosition.deductions.property` straight from the
 * loans, so it is structurally never missable — the suggestion was a false
 * positive for every loan-bearing investment property, contradicting the
 * deductions shown right above the panel. Removed. The remaining items are
 * the GENUINE gaps the canonical position cannot fill on its own:
 * depreciation (needs a schedule) and work-related expenses (need rows).
 */
export function identifyMissedDeductions(
  expenses: any[],
  properties: any[],
  depreciations: any[]
): string[] {
  const missed: string[] = [];

  // Check for common missed deductions
  const hasWorkRelated = expenses.some((e: any) =>
    e.isTaxDeductible &&
    ['WORK', 'PROFESSIONAL', 'EDUCATION'].includes(e.category?.toUpperCase())
  );

  if (!hasWorkRelated) {
    missed.push('Work-related expenses (home office, uniforms, tools)');
  }

  // Check for depreciation — genuinely not auto-claimed without a schedule
  // (the tax page itself recommends obtaining one).
  const investmentProperties = properties.filter((p: any) => p.type === 'INVESTMENT');
  const propertiesWithDepreciation = new Set(depreciations.map((d: any) => d.propertyId));
  for (const prop of investmentProperties) {
    if (!propertiesWithDepreciation.has(prop.id)) {
      missed.push(`Depreciation for ${prop.name}`);
    }
  }

  return missed.slice(0, 5); // Limit to top 5
}

function calculateConfidenceLevel(
  incomes: any[],
  expenses: any[],
  depreciations: any[]
): number {
  let confidence = 50; // Base confidence

  // More data = higher confidence
  if (incomes.length > 0) confidence += 15;
  if (incomes.some((i: any) => i.type === 'SALARY' && i.paygWithholding)) confidence += 10;
  if (expenses.length > 5) confidence += 10;
  if (expenses.some((e: any) => e.isTaxDeductible)) confidence += 5;
  if (depreciations.length > 0) confidence += 10;

  return Math.min(confidence, 95); // Cap at 95%
}

// ============================================================================
// Exports
// ============================================================================

export { calculateDaysUntilEOFY };

// ============================================================================
// Q-DEC PR 2.E.3 — Decimal sibling helpers
// ============================================================================

/**
 * Compact shape compatible with `getDetailedHoldings` rows — only the
 * fields `calculateUnrealisedCGT` reads. Avoids exporting `any[]`.
 */
export interface CgtHoldingDecimalInput {
  units: number | string | Decimal;
  averagePrice: number | string | Decimal;
  currentPrice: number | string | Decimal | null;
}

/**
 * Decimal sibling of the private `calculateUnrealisedCGT`. Per-holding
 * gain = `units × (currentPrice ?? averagePrice − averagePrice) × units`;
 * 50% CGT discount applied to positive gains only. Returns total
 * unrealised CGT-discountable gain in Decimal.
 *
 * Note this preserves the Float-side simplification — it ALWAYS applies
 * the 50% discount, NOT conditionally on the >12-month hold (per the
 * Float-side comment "simplified"). The reform-aware CGT engines in
 * `lib/tax-engine/divisions/cgt*` are the SSOT for proper holding-period
 * + regime gating; this helper is a portfolio-overview heuristic only.
 */
export function calculateUnrealisedCGTDecimal(
  holdings: CgtHoldingDecimalInput[],
): Decimal {
  const zero = new Decimal(0);
  let total = zero;
  for (const h of holdings) {
    const units = toDecimal(h.units) ?? zero;
    const avg = toDecimal(h.averagePrice) ?? zero;
    const cur = toDecimal(h.currentPrice ?? avg) ?? avg;
    const currentValue = units.times(cur);
    const costBase = units.times(avg);
    const gain = currentValue.minus(costBase);
    if (gain.gt(0)) {
      total = total.plus(gain.times('0.5'));
    }
  }
  return total;
}

// MON-045: `calculateNegativeGearingBenefit` (Float) + its Decimal sibling and
// input shape were DELETED here — they were a rogue duplicate producer
// (Σ principal×rate per property from raw rows, declared-only, no offset, no
// HOME/fraction handling). The negative-gearing benefit is now derived from
// the canonical tax position in `calculateCFOTaxInsights` above; the ONE
// deductible-interest producer is lib/tax-engine/deductions/propertyLoanInterest.ts.
