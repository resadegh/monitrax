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
import { Decimal, toDecimal } from '@/lib/decimal';

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
  /**
   * MON-088: for a FAMILY this means "the WHOLE family holds private
   * hospital cover" (ATO all-or-nothing rule — one uncovered member makes
   * every over-threshold adult liable; a covered partner is NOT exempt
   * while their spouse is uncovered). For a SINGLE it is their own cover.
   * Default `true` is legacy behaviour kept for the estimate callers
   * (salaryProcessor / incomeNormalizer / super-optimize) — the tax-position
   * producer ALWAYS passes an explicit value from captured data.
   */
  hasPrivateHealthInsurance?: boolean;
  hasMedicareExemption?: boolean;
  familyStatus?: 'SINGLE' | 'FAMILY';
  dependentChildren?: number;
  /**
   * MON-088: the spouse's taxable income. For FAMILY, the MLS tier is
   * selected on COMBINED income (own + spouse) against the family tiers
   * (singles × multiplier, +child increase after the first), but the
   * surcharge is levied on the person's OWN taxableIncome. An adult whose
   * own income is at or below the levy low-income threshold pays no MLS
   * personally (the ATO low-earner exception).
   */
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
  const {
    taxableIncome,
    hasMedicareExemption = false,
    familyStatus = 'SINGLE',
    dependentChildren = 0,
    spouseIncome = 0,
  } = input;

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

  // MON-088: the family low-income reduction is a FAMILY-income test (ATO —
  // the reduction depends on family income, not just the individual's). The
  // tested income is own + spouse; the levy itself stays on OWN income,
  // apportioned in the shade range by income share (approximates the s8
  // spouse apportionment; exact for SINGLE and for the combined household
  // bundle where spouseIncome is 0).
  const testedIncome = familyStatus === 'FAMILY'
    ? taxableIncome + Math.max(0, spouseIncome)
    : taxableIncome;

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
  if (testedIncome <= threshold) {
    calculations.push({
      label: 'Income below threshold',
      value: 0,
      operation: '=',
      explanation: 'No Medicare Levy payable',
    });
  }
  // Shade-in range
  else if (testedIncome < shadeOutThreshold) {
    // Shade-in formula: 10% of (tested income - threshold), apportioned to
    // this person's share of the tested income.
    const excessOverThreshold = testedIncome - threshold;
    const ownShare = testedIncome > 0 ? taxableIncome / testedIncome : 1;
    medicareLevy = excessOverThreshold * 0.10 * ownShare;
    isShadeIn = true;

    calculations.push({
      label: 'Income in shade-in range',
      value: excessOverThreshold,
      explanation: `$${testedIncome.toLocaleString()} - $${threshold.toLocaleString()} = $${excessOverThreshold.toLocaleString()}`,
    });

    calculations.push({
      label: 'Shade-in Medicare Levy (10% of excess)',
      value: medicareLevy,
      operation: '=',
      explanation: 'Levy phases in gradually to avoid sudden jumps',
    });
  }
  // Above shade-out: full 2% levy on OWN income
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
 * MON-088: resolve the MLS tier RATE for an income tested against the
 * configured tiers, optionally scaled to the family thresholds
 * (singles bounds × multiplier, + child increase after the first child).
 * ONE tier table, config-driven — the family bounds are derived, never a
 * second hardcoded list.
 */
function mlsTierRate(
  testedIncome: number,
  config: TaxYearConfig,
  family: boolean,
  dependentChildren: number,
): number {
  const fam = config.medicareSurchargeFamily ?? { singleMultiplier: 2, dependentChildIncrease: 1500 };
  const childUplift = family ? Math.max(0, dependentChildren - 1) * fam.dependentChildIncrease : 0;
  const scale = family ? fam.singleMultiplier : 1;
  for (const tier of config.medicareSurchargeThresholds) {
    const min = tier.min <= 0 ? 0 : tier.min * scale + childUplift;
    const max = tier.max == null ? Infinity : tier.max * scale + childUplift;
    if (testedIncome >= min && testedIncome <= max) return tier.rate;
  }
  return 0;
}

/**
 * Calculate Medicare Levy Surcharge for those without private hospital cover.
 *
 * MON-088 (ATO "Medicare levy surcharge"): the surcharge depends on cover
 * AND income together —
 *   - SINGLE: own income tested against the singles tiers.
 *   - FAMILY: COMBINED income (own + spouse) tested against the family
 *     tiers (singles × multiplier, +$increase per child after the first);
 *     the resulting rate is levied on the person's OWN taxableIncome.
 *   - Low-earner exception: an adult whose own income is at or below the
 *     levy low-income single threshold pays no MLS personally, even in an
 *     over-threshold uncovered family.
 *   - Cover is family-all-or-nothing — the CALLER passes
 *     hasPrivateHealthInsurance = "whole family covered" for FAMILY.
 */
function calculateMedicareSurcharge(
  input: MedicareLevyInput,
  config: TaxYearConfig
): { surcharge: number; explanation: string } {
  const {
    taxableIncome,
    hasPrivateHealthInsurance = true,
    familyStatus = 'SINGLE',
    dependentChildren = 0,
    spouseIncome = 0,
  } = input;

  // No surcharge when the family (or the single person) holds hospital cover.
  if (hasPrivateHealthInsurance) {
    return { surcharge: 0, explanation: 'No surcharge - has private health insurance' };
  }

  const family = familyStatus === 'FAMILY';

  // ATO low-earner exception: own income at/below the levy low-income single
  // threshold → no MLS for this person, whatever the family income.
  if (family && taxableIncome <= config.medicareThresholds.single) {
    return { surcharge: 0, explanation: 'No surcharge - own income below the low-earner threshold' };
  }

  const testedIncome = family ? taxableIncome + Math.max(0, spouseIncome) : taxableIncome;
  const rate = mlsTierRate(testedIncome, config, family, dependentChildren);
  if (rate === 0) {
    return { surcharge: 0, explanation: 'Income below surcharge threshold' };
  }

  // The rate from the (combined for FAMILY) tier applies to OWN income.
  const surcharge = taxableIncome * rate;
  return {
    surcharge: Math.round(surcharge * 100) / 100,
    explanation: `${(rate * 100).toFixed(2)}% surcharge - no private hospital cover${family ? ' (family income tested)' : ''}`,
  };
}

// =============================================================================
// Q-DEC PR 2.D.1 — Decimal sibling path
// =============================================================================

export interface MedicareLevyResultDecimal {
  medicareLevy: Decimal;
  medicareSurcharge: Decimal;
  total: Decimal;
  isShadeIn: boolean;
  isExempt: boolean;
}

/**
 * Decimal-accepting input. Same shape as `MedicareLevyInput` but
 * `taxableIncome` accepts number/string/Decimal.
 */
export interface MedicareLevyInputDecimal {
  taxableIncome: number | string | Decimal;
  hasPrivateHealthInsurance?: boolean;
  hasMedicareExemption?: boolean;
  familyStatus?: 'SINGLE' | 'FAMILY';
  dependentChildren?: number;
  spouseIncome?: number;
}

function calculateMedicareSurchargeDecimal(
  input: MedicareLevyInputDecimal,
  config: TaxYearConfig,
): { surcharge: Decimal } {
  const {
    taxableIncome,
    hasPrivateHealthInsurance = true,
    familyStatus = 'SINGLE',
    dependentChildren = 0,
    spouseIncome = 0,
  } = input;
  if (hasPrivateHealthInsurance) return { surcharge: new Decimal(0) };

  const taxableDec = toDecimal(taxableIncome) ?? new Decimal(0);
  const taxableNumber = taxableDec.toNumber();
  const family = familyStatus === 'FAMILY';

  // MON-088 — mirror Float exactly: low-earner exception, then the
  // combined-income tier lookup (family bounds derived from the ONE table),
  // rate applied to OWN income.
  if (family && taxableNumber <= config.medicareThresholds.single) {
    return { surcharge: new Decimal(0) };
  }
  const testedIncome = family ? taxableNumber + Math.max(0, spouseIncome) : taxableNumber;
  const rate = mlsTierRate(testedIncome, config, family, dependentChildren);
  if (rate === 0) return { surcharge: new Decimal(0) };
  // Mirror Float's `Math.round(surcharge * 100) / 100` rounding.
  const surcharge = taxableDec.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  return { surcharge };
}

export function calculateMedicareLevyDecimal(
  input: MedicareLevyInputDecimal,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): MedicareLevyResultDecimal {
  const {
    hasMedicareExemption = false,
    familyStatus = 'SINGLE',
    dependentChildren = 0,
    spouseIncome = 0,
  } = input;
  const taxableDec = toDecimal(input.taxableIncome) ?? new Decimal(0);

  if (hasMedicareExemption) {
    return {
      medicareLevy: new Decimal(0),
      medicareSurcharge: new Decimal(0),
      total: new Decimal(0),
      isShadeIn: false,
      isExempt: true,
    };
  }

  if (taxableDec.lte(0)) {
    return {
      medicareLevy: new Decimal(0),
      medicareSurcharge: new Decimal(0),
      total: new Decimal(0),
      isShadeIn: false,
      isExempt: false,
    };
  }

  // Threshold determination — keep config values as numbers (they're
  // constants), compute the threshold as a Decimal.
  const baseThreshold = familyStatus === 'FAMILY'
    ? config.medicareThresholds.family + dependentChildren * config.medicareThresholds.dependentChildIncrease
    : config.medicareThresholds.single;
  const threshold = new Decimal(baseThreshold);
  const shadeOutThreshold = threshold.times(config.medicareThresholds.shadeOutMultiplier);

  // MON-088 — mirror Float: family low-income test on COMBINED income; the
  // levy stays on OWN income, apportioned by share in the shade range.
  const testedDec = familyStatus === 'FAMILY'
    ? taxableDec.plus(Math.max(0, spouseIncome))
    : taxableDec;

  let medicareLevy = new Decimal(0);
  let isShadeIn = false;

  if (testedDec.lte(threshold)) {
    // No levy.
  } else if (testedDec.lt(shadeOutThreshold)) {
    // Shade-in: 10% of excess of the tested income, × own share.
    const ownShare = testedDec.gt(0) ? taxableDec.div(testedDec) : new Decimal(1);
    medicareLevy = testedDec.minus(threshold).times('0.10').times(ownShare);
    isShadeIn = true;
  } else {
    medicareLevy = taxableDec.times(config.medicareRate);
  }

  const surchargeResult = calculateMedicareSurchargeDecimal(input, config);

  // Mirror Float's `Math.round(x * 100) / 100` rounding at output.
  const roundedLevy = medicareLevy.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  const total = roundedLevy.plus(surchargeResult.surcharge).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  return {
    medicareLevy: roundedLevy,
    medicareSurcharge: surchargeResult.surcharge,
    total,
    isShadeIn,
    isExempt: false,
  };
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
