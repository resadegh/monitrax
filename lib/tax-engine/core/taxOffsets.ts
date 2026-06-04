/**
 * Phase 20: Tax Offsets Calculator
 * Calculates various Australian tax offsets (LITO, SAPTO, Franking Credits, etc.)
 */

import { TaxYearConfig, TaxOffsets, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';
import { Decimal, toDecimal } from '@/lib/decimal';

export interface TaxOffsetsResult {
  offsets: TaxOffsets;
  calculations: CalculationStep[];
}

export interface TaxOffsetsInput {
  taxableIncome: number;
  frankingCredits?: number;
  foreignTaxPaid?: number;
  isSenior?: boolean;
  isCouple?: boolean;
  hasSpouse?: boolean;
  spouseIncome?: number;
}

/**
 * Calculate Low Income Tax Offset (LITO)
 *
 * For 2024-25 (ATO two-tier phase-out):
 * - Full $700 offset for income up to $37,500
 * - Tier 1: Reduces by 5 cents per dollar from $37,500 to $45,000 (max reduction $375)
 * - Tier 2: Reduces by 1.5 cents per dollar from $45,000 to $66,667 (max reduction $325)
 * - Phases out completely at $66,667
 *
 * Reference: ATO Individual Income Tax Rates
 */
export function calculateLITO(
  taxableIncome: number,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { offset: number; explanation: string } {
  const { lito } = config;

  if (taxableIncome <= 0) {
    return { offset: 0, explanation: 'No income' };
  }

  // Full LITO if under threshold
  if (taxableIncome <= lito.fullThreshold) {
    return {
      offset: lito.maxOffset,
      explanation: `Full LITO - income under $${lito.fullThreshold.toLocaleString()}`,
    };
  }

  // No LITO if over cutoff
  if (taxableIncome >= lito.cutoffThreshold) {
    return {
      offset: 0,
      explanation: `No LITO - income over $${lito.cutoffThreshold.toLocaleString()}`,
    };
  }

  // Two-tier withdrawal calculation
  let reduction = 0;

  // Tier 1: 5c per dollar from fullThreshold to tier1.threshold
  if (taxableIncome > lito.fullThreshold) {
    const tier1Income = Math.min(taxableIncome, lito.tier1.threshold) - lito.fullThreshold;
    reduction += tier1Income * lito.tier1.withdrawalRate;
  }

  // Tier 2: 1.5c per dollar from tier1.threshold to cutoffThreshold
  if (taxableIncome > lito.tier1.threshold) {
    const tier2Income = taxableIncome - lito.tier1.threshold;
    reduction += tier2Income * lito.tier2.withdrawalRate;
  }

  const offset = Math.max(0, lito.maxOffset - reduction);

  // Build explanation based on which tiers apply
  let explanation: string;
  if (taxableIncome <= lito.tier1.threshold) {
    explanation = `Reduced LITO - $${lito.maxOffset} minus ${(lito.tier1.withdrawalRate * 100).toFixed(0)}c per $ over $${lito.fullThreshold.toLocaleString()}`;
  } else {
    explanation = `Reduced LITO - two-tier phase-out: ${(lito.tier1.withdrawalRate * 100).toFixed(0)}c/$ to $${lito.tier1.threshold.toLocaleString()}, then ${(lito.tier2.withdrawalRate * 100).toFixed(1)}c/$`;
  }

  return {
    offset: Math.round(offset * 100) / 100,
    explanation,
  };
}

/**
 * Calculate Senior Australians and Pensioners Tax Offset (SAPTO)
 *
 * Available to those who meet the age and income requirements.
 * This is a simplified calculation - full SAPTO has complex eligibility rules.
 */
export function calculateSAPTO(
  taxableIncome: number,
  isSingle: boolean = true,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): { offset: number; explanation: string } {
  // SAPTO thresholds (simplified - actual rules are more complex)
  const maxOffset = isSingle ? config.saptoSingle : config.saptoCoupleEach;
  const shadeOutThreshold = isSingle ? 32279 : 28974;
  const cutoffThreshold = isSingle ? 50119 : 41790;

  if (taxableIncome <= shadeOutThreshold) {
    return {
      offset: maxOffset,
      explanation: 'Full SAPTO',
    };
  }

  if (taxableIncome >= cutoffThreshold) {
    return {
      offset: 0,
      explanation: 'Income too high for SAPTO',
    };
  }

  // Reduce at 12.5 cents per dollar over threshold
  const excess = taxableIncome - shadeOutThreshold;
  const reduction = excess * 0.125;
  const offset = Math.max(0, maxOffset - reduction);

  return {
    offset: Math.round(offset * 100) / 100,
    explanation: 'Reduced SAPTO',
  };
}

/**
 * Calculate franking credit offset
 * Franking credits can reduce tax payable (and may result in a refund)
 */
export function calculateFrankingCreditOffset(
  frankingCredits: number
): { offset: number; explanation: string } {
  if (frankingCredits <= 0) {
    return { offset: 0, explanation: 'No franking credits' };
  }

  return {
    offset: frankingCredits,
    explanation: `Franking credits from Australian dividends`,
  };
}

/**
 * Calculate foreign income tax offset
 * Credit for tax paid on foreign income
 */
export function calculateForeignTaxOffset(
  foreignTaxPaid: number,
  australianTaxOnForeignIncome: number
): { offset: number; explanation: string } {
  if (foreignTaxPaid <= 0) {
    return { offset: 0, explanation: 'No foreign tax paid' };
  }

  // Offset is limited to the Australian tax that would be payable on the foreign income
  const offset = Math.min(foreignTaxPaid, australianTaxOnForeignIncome);

  return {
    offset,
    explanation:
      offset < foreignTaxPaid
        ? `Limited to Australian tax on foreign income ($${australianTaxOnForeignIncome.toFixed(2)})`
        : 'Full credit for foreign tax paid',
  };
}

/**
 * Calculate all applicable tax offsets
 */
export function calculateAllOffsets(
  input: TaxOffsetsInput,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): TaxOffsetsResult {
  const calculations: CalculationStep[] = [];

  // LITO
  const litoResult = calculateLITO(input.taxableIncome, config);
  calculations.push({
    label: 'Low Income Tax Offset (LITO)',
    value: litoResult.offset,
    explanation: litoResult.explanation,
  });

  // SAPTO (if applicable)
  let saptoOffset = 0;
  if (input.isSenior) {
    const saptoResult = calculateSAPTO(
      input.taxableIncome,
      !input.hasSpouse,
      config
    );
    saptoOffset = saptoResult.offset;
    calculations.push({
      label: 'Senior Australians Tax Offset (SAPTO)',
      value: saptoOffset,
      explanation: saptoResult.explanation,
    });
  }

  // Franking credits
  const frankingResult = calculateFrankingCreditOffset(input.frankingCredits || 0);
  calculations.push({
    label: 'Franking Credit Offset',
    value: frankingResult.offset,
    explanation: frankingResult.explanation,
  });

  // Foreign tax offset (simplified)
  let foreignTaxOffset = 0;
  if (input.foreignTaxPaid && input.foreignTaxPaid > 0) {
    // Simplified: assume full offset is available
    foreignTaxOffset = input.foreignTaxPaid;
    calculations.push({
      label: 'Foreign Income Tax Offset',
      value: foreignTaxOffset,
      explanation: 'Credit for tax paid overseas',
    });
  }

  const totalOffsets =
    litoResult.offset + saptoOffset + frankingResult.offset + foreignTaxOffset;

  calculations.push({
    label: 'Total Tax Offsets',
    value: totalOffsets,
    operation: '=',
  });

  return {
    offsets: {
      lito: litoResult.offset,
      sapto: saptoOffset,
      frankingCredits: frankingResult.offset,
      foreignTax: foreignTaxOffset,
      other: 0,
      total: totalOffsets,
    },
    calculations,
  };
}

// =============================================================================
// Q-DEC PR 2.D.1 — Decimal sibling path
// =============================================================================

export interface TaxOffsetsDecimal {
  lito: Decimal;
  sapto: Decimal;
  frankingCredits: Decimal;
  foreignTax: Decimal;
  other: Decimal;
  total: Decimal;
}

export interface TaxOffsetsResultDecimal {
  offsets: TaxOffsetsDecimal;
}

/**
 * Decimal-accepting input. Same shape as `TaxOffsetsInput` but numeric
 * fields accept number/string/Decimal.
 */
export interface TaxOffsetsInputDecimal {
  taxableIncome: number | string | Decimal;
  frankingCredits?: number | string | Decimal;
  foreignTaxPaid?: number | string | Decimal;
  isSenior?: boolean;
  isCouple?: boolean;
  hasSpouse?: boolean;
  spouseIncome?: number;
}

export function calculateLITODecimal(
  taxableIncome: number | string | Decimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): { offset: Decimal } {
  const taxableDec = toDecimal(taxableIncome) ?? new Decimal(0);
  const { lito } = config;

  if (taxableDec.lte(0)) return { offset: new Decimal(0) };
  if (taxableDec.lte(lito.fullThreshold)) return { offset: new Decimal(lito.maxOffset) };
  if (taxableDec.gte(lito.cutoffThreshold)) return { offset: new Decimal(0) };

  let reduction = new Decimal(0);
  if (taxableDec.gt(lito.fullThreshold)) {
    const tier1Cap = Decimal.min(taxableDec, new Decimal(lito.tier1.threshold));
    const tier1Income = tier1Cap.minus(lito.fullThreshold);
    reduction = reduction.plus(tier1Income.times(lito.tier1.withdrawalRate));
  }
  if (taxableDec.gt(lito.tier1.threshold)) {
    const tier2Income = taxableDec.minus(lito.tier1.threshold);
    reduction = reduction.plus(tier2Income.times(lito.tier2.withdrawalRate));
  }

  // Mirror Float's `Math.max(0, ...)` floor + `Math.round(offset * 100) / 100`.
  const offset = Decimal.max(new Decimal(0), new Decimal(lito.maxOffset).minus(reduction))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  return { offset };
}

export function calculateSAPTODecimal(
  taxableIncome: number | string | Decimal,
  isSingle: boolean = true,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): { offset: Decimal } {
  const taxableDec = toDecimal(taxableIncome) ?? new Decimal(0);
  const maxOffset = new Decimal(isSingle ? config.saptoSingle : config.saptoCoupleEach);
  const shadeOutThreshold = new Decimal(isSingle ? 32279 : 28974);
  const cutoffThreshold = new Decimal(isSingle ? 50119 : 41790);

  if (taxableDec.lte(shadeOutThreshold)) return { offset: maxOffset };
  if (taxableDec.gte(cutoffThreshold)) return { offset: new Decimal(0) };

  const excess = taxableDec.minus(shadeOutThreshold);
  const reduction = excess.times('0.125');
  const offset = Decimal.max(new Decimal(0), maxOffset.minus(reduction))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  return { offset };
}

export function calculateFrankingCreditOffsetDecimal(
  frankingCredits: number | string | Decimal,
): { offset: Decimal } {
  const fcDec = toDecimal(frankingCredits) ?? new Decimal(0);
  if (fcDec.lte(0)) return { offset: new Decimal(0) };
  return { offset: fcDec };
}

export function calculateForeignTaxOffsetDecimal(
  foreignTaxPaid: number | string | Decimal,
  australianTaxOnForeignIncome: number | string | Decimal,
): { offset: Decimal } {
  const foreignDec = toDecimal(foreignTaxPaid) ?? new Decimal(0);
  if (foreignDec.lte(0)) return { offset: new Decimal(0) };
  const austDec = toDecimal(australianTaxOnForeignIncome) ?? new Decimal(0);
  return { offset: Decimal.min(foreignDec, austDec) };
}

export function calculateAllOffsetsDecimal(
  input: TaxOffsetsInputDecimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): TaxOffsetsResultDecimal {
  const litoResult = calculateLITODecimal(input.taxableIncome, config);

  let saptoOffset = new Decimal(0);
  if (input.isSenior) {
    const saptoResult = calculateSAPTODecimal(input.taxableIncome, !input.hasSpouse, config);
    saptoOffset = saptoResult.offset;
  }

  const frankingResult = calculateFrankingCreditOffsetDecimal(input.frankingCredits ?? 0);

  let foreignTaxOffset = new Decimal(0);
  if (input.foreignTaxPaid != null) {
    const foreignDec = toDecimal(input.foreignTaxPaid);
    if (foreignDec !== null && foreignDec.gt(0)) {
      foreignTaxOffset = foreignDec;
    }
  }

  const total = litoResult.offset.plus(saptoOffset).plus(frankingResult.offset).plus(foreignTaxOffset);

  return {
    offsets: {
      lito: litoResult.offset,
      sapto: saptoOffset,
      frankingCredits: frankingResult.offset,
      foreignTax: foreignTaxOffset,
      other: new Decimal(0),
      total,
    },
  };
}

/**
 * Decimal sibling of `applyOffsets`.
 * Non-refundable offsets reduce tax to $0; franking credits can refund.
 */
export function applyOffsetsDecimal(
  grossTax: number | string | Decimal,
  offsets: TaxOffsetsDecimal,
): {
  netTax: Decimal;
  refundableAmount: Decimal;
  usedOffsets: TaxOffsetsDecimal;
} {
  const grossDec = toDecimal(grossTax) ?? new Decimal(0);
  const zero = new Decimal(0);

  const nonRefundableOffsets = offsets.lito.plus(offsets.sapto).plus(offsets.foreignTax).plus(offsets.other);
  const nonRefundableUsed = Decimal.min(nonRefundableOffsets, grossDec);
  const taxAfterNonRefundable = grossDec.minus(nonRefundableUsed);
  const netTax = taxAfterNonRefundable.minus(offsets.frankingCredits);

  const usedLito = Decimal.min(offsets.lito, grossDec);
  const usedSapto = Decimal.min(offsets.sapto, Decimal.max(zero, grossDec.minus(offsets.lito)));
  const usedForeign = Decimal.min(
    offsets.foreignTax,
    Decimal.max(zero, grossDec.minus(offsets.lito).minus(offsets.sapto)),
  );
  const usedOther = Decimal.min(
    offsets.other,
    Decimal.max(zero, grossDec.minus(offsets.lito).minus(offsets.sapto).minus(offsets.foreignTax)),
  );
  const usedTotal = usedLito.plus(usedSapto).plus(offsets.frankingCredits).plus(usedForeign).plus(usedOther);

  return {
    netTax,
    refundableAmount: netTax.lt(0) ? netTax.abs() : zero,
    usedOffsets: {
      lito: usedLito,
      sapto: usedSapto,
      frankingCredits: offsets.frankingCredits,
      foreignTax: usedForeign,
      other: usedOther,
      total: usedTotal,
    },
  };
}

/**
 * Apply offsets to gross tax to get net tax payable
 * Note: Some offsets are non-refundable (can only reduce tax to $0)
 * While franking credits are refundable
 */
export function applyOffsets(
  grossTax: number,
  offsets: TaxOffsets
): {
  netTax: number;
  refundableAmount: number;
  usedOffsets: TaxOffsets;
} {
  // Non-refundable offsets (LITO, SAPTO) can only reduce tax to $0
  const nonRefundableOffsets = offsets.lito + offsets.sapto + offsets.foreignTax + offsets.other;
  const nonRefundableUsed = Math.min(nonRefundableOffsets, grossTax);

  let taxAfterNonRefundable = grossTax - nonRefundableUsed;

  // Refundable offsets (franking credits) can result in a refund
  const refundableOffsets = offsets.frankingCredits;
  const netTax = taxAfterNonRefundable - refundableOffsets;

  // Calculate actual amounts used
  const usedOffsets: TaxOffsets = {
    lito: Math.min(offsets.lito, grossTax),
    sapto: Math.min(offsets.sapto, Math.max(0, grossTax - offsets.lito)),
    frankingCredits: offsets.frankingCredits,
    foreignTax: Math.min(
      offsets.foreignTax,
      Math.max(0, grossTax - offsets.lito - offsets.sapto)
    ),
    other: Math.min(
      offsets.other,
      Math.max(0, grossTax - offsets.lito - offsets.sapto - offsets.foreignTax)
    ),
    total: 0,
  };
  usedOffsets.total =
    usedOffsets.lito +
    usedOffsets.sapto +
    usedOffsets.frankingCredits +
    usedOffsets.foreignTax +
    usedOffsets.other;

  return {
    netTax,
    refundableAmount: netTax < 0 ? Math.abs(netTax) : 0,
    usedOffsets,
  };
}
