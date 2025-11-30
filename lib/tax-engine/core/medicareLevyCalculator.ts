/**
 * Phase 20: Medicare Levy Calculator
 * Calculates Medicare Levy and Medicare Levy Surcharge
 *
 * Medicare Levy: 2% of taxable income with thresholds
 * - Below threshold: $0
 * - Shade-in range: 10% of excess over threshold (gradual increase)
 * - Above shade-out: Full 2% of taxable income
 *
 * Medicare Levy Surcharge: Additional 1-1.5% for high earners without private health insurance
 */

import { TaxYearConfig, CalculationStep } from '../types';
import { getCurrentTaxYearConfig } from '../config/taxYearConfig';

export interface MedicareLevyResult {
  medicareLevy: number;
  medicareSurcharge: number;
  total: number;
  calculations: CalculationStep[];
  isShadeIn: boolean;
  isExempt: boolean;
}

export interface MedicareLevyInput {
  taxableIncome: number;
  hasPrivateHealthInsurance?: boolean;
  hasMedicareExemption?: boolean;
  familyStatus?: 'SINGLE' | 'FAMILY';
  dependentChildren?: number;
  spouseIncome?: number;
}

/**
 * Calculate Medicare Levy with shade-in provisions
 */
export function calculateMedicareLevy(
  input: MedicareLevyInput,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): MedicareLevyResult {
  const calculations: CalculationStep[] = [];
  const { taxableIncome, hasMedicareExemption = false, familyStatus = 'SINGLE', dependentChildren = 0 } = input;

  // Check for exemption
  if (hasMedicareExemption) {
    return {
      medicareLevy: 0,
      medicareSurcharge: 0,
      total: 0,
      calculations: [{ label: 'Medicare Levy Exempt', value: 0 }],
      isShadeIn: false,
      isExempt: true,
    };
  }

  if (taxableIncome <= 0) {
    return {
      medicareLevy: 0,
      medicareSurcharge: 0,
      total: 0,
      calculations: [{ label: 'No taxable income', value: 0 }],
      isShadeIn: false,
      isExempt: false,
    };
  }

  // Determine applicable threshold based on family status
  let threshold = config.medicareThresholds.single;
  if (familyStatus === 'FAMILY') {
    threshold = config.medicareThresholds.family;
    // Add dependent children increase
    threshold += dependentChildren * config.medicareThresholds.dependentChildIncrease;
  }

  const shadeOutThreshold = threshold * config.medicareThresholds.shadeOutMultiplier;

  calculations.push({
    label: 'Taxable Income',
    value: taxableIncome,
  });

  calculations.push({
    label: `Medicare Levy Threshold (${familyStatus.toLowerCase()})`,
    value: threshold,
    explanation: familyStatus === 'FAMILY' && dependentChildren > 0
      ? `Includes $${(dependentChildren * config.medicareThresholds.dependentChildIncrease).toLocaleString()} for ${dependentChildren} dependent child(ren)`
      : undefined,
  });

  let medicareLevy = 0;
  let isShadeIn = false;

  // Below threshold: no levy
  if (taxableIncome <= threshold) {
    calculations.push({
      label: 'Income below threshold',
      value: 0,
      operation: '=',
      explanation: 'No Medicare Levy payable',
    });
  }
  // Shade-in range
  else if (taxableIncome < shadeOutThreshold) {
    // Shade-in formula: 10% of (income - threshold)
    const excessOverThreshold = taxableIncome - threshold;
    medicareLevy = excessOverThreshold * 0.10;
    isShadeIn = true;

    calculations.push({
      label: 'Income in shade-in range',
      value: excessOverThreshold,
      explanation: `$${taxableIncome.toLocaleString()} - $${threshold.toLocaleString()} = $${excessOverThreshold.toLocaleString()}`,
    });

    calculations.push({
      label: 'Shade-in Medicare Levy (10% of excess)',
      value: medicareLevy,
      operation: '=',
      explanation: 'Levy phases in gradually to avoid sudden jumps',
    });
  }
  // Above shade-out: full 2% levy
  else {
    medicareLevy = taxableIncome * config.medicareRate;

    calculations.push({
      label: `Full Medicare Levy (${(config.medicareRate * 100).toFixed(0)}%)`,
      value: medicareLevy,
      operation: '=',
      explanation: `$${taxableIncome.toLocaleString()} × ${(config.medicareRate * 100).toFixed(0)}%`,
    });
  }

  // Calculate Medicare Levy Surcharge
  const surchargeResult = calculateMedicareSurcharge(input, config);

  const total = medicareLevy + surchargeResult.surcharge;

  if (surchargeResult.surcharge > 0) {
    calculations.push({
      label: 'Medicare Levy Surcharge',
      value: surchargeResult.surcharge,
      operation: '+',
      explanation: surchargeResult.explanation,
    });

    calculations.push({
      label: 'Total Medicare Levy',
      value: total,
      operation: '=',
    });
  }

  return {
    medicareLevy: Math.round(medicareLevy * 100) / 100,
    medicareSurcharge: surchargeResult.surcharge,
    total: Math.round(total * 100) / 100,
    calculations,
    isShadeIn,
    isExempt: false,
  };
}

/**
 * Calculate Medicare Levy Surcharge for those without private health insurance
 */
function calculateMedicareSurcharge(
  input: MedicareLevyInput,
  config: TaxYearConfig
): { surcharge: number; explanation: string } {
  const { taxableIncome, hasPrivateHealthInsurance = true } = input;

  // No surcharge if has private health insurance
  if (hasPrivateHealthInsurance) {
    return { surcharge: 0, explanation: 'No surcharge - has private health insurance' };
  }

  // Find applicable surcharge rate
  for (const tier of config.medicareSurchargeThresholds) {
    const max = tier.max ?? Infinity;
    if (taxableIncome >= tier.min && taxableIncome <= max) {
      if (tier.rate === 0) {
        return { surcharge: 0, explanation: 'Income below surcharge threshold' };
      }

      const surcharge = taxableIncome * tier.rate;
      return {
        surcharge: Math.round(surcharge * 100) / 100,
        explanation: `${(tier.rate * 100).toFixed(2)}% surcharge - no private health insurance`,
      };
    }
  }

  return { surcharge: 0, explanation: '' };
}

/**
 * Calculate combined Medicare costs with detailed breakdown
 */
export function getMedicareSummary(
  taxableIncome: number,
  hasPrivateHealthInsurance: boolean = true,
  config: TaxYearConfig = getCurrentTaxYearConfig()
): {
  levy: number;
  surcharge: number;
  total: number;
  asPercentage: number;
  couldSaveWithPHI: number;
} {
  const withPHI = calculateMedicareLevy(
    { taxableIncome, hasPrivateHealthInsurance: true },
    config
  );

  const withoutPHI = calculateMedicareLevy(
    { taxableIncome, hasPrivateHealthInsurance: false },
    config
  );

  const actual = hasPrivateHealthInsurance ? withPHI : withoutPHI;
  const couldSaveWithPHI = withoutPHI.total - withPHI.total;

  return {
    levy: actual.medicareLevy,
    surcharge: actual.medicareSurcharge,
    total: actual.total,
    asPercentage: taxableIncome > 0 ? (actual.total / taxableIncome) * 100 : 0,
    couldSaveWithPHI: hasPrivateHealthInsurance ? 0 : couldSaveWithPHI,
  };
}
