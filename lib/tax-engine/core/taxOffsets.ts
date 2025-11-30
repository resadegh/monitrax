/**
 * Phase 20: Tax Offsets Calculator
 * Calculates various Australian tax offsets (LITO, SAPTO, Franking Credits, etc.)
 */

import { TaxYearConfig, TaxOffsets, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

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
 * For 2024-25:
 * - Full $700 offset for income up to $37,500
 * - Reduces by 5 cents for each dollar over $37,500
 * - Phases out completely at $66,667
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

  // Partial LITO - reduce by withdrawal rate
  const excess = taxableIncome - lito.fullThreshold;
  const reduction = excess * lito.withdrawalRate;
  const offset = Math.max(0, lito.maxOffset - reduction);

  return {
    offset: Math.round(offset * 100) / 100,
    explanation: `Reduced LITO - $${lito.maxOffset} minus ${(lito.withdrawalRate * 100).toFixed(0)}c per $ over $${lito.fullThreshold.toLocaleString()}`,
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
