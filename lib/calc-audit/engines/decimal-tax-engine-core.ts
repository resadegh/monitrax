/**
 * Q-DEC PR 2.D.1 — Shadow comparison adapters for `lib/tax-engine/core/*`.
 *
 * Four engines, each composing ATO regulatory math:
 *   - incomeTax.calculate (progressive brackets)
 *   - payg.calculate (NAT 1004 Schedule 1 formula method)
 *   - medicareLevy.calculate (with shade-in + surcharge)
 *   - taxOffsets.calculateAllOffsets (LITO/SAPTO/franking/foreign)
 *
 * **Intentional rounding rules** preserved across both paths:
 *   - PAYG weekly withholding rounds to nearest WHOLE DOLLAR (ATO rule).
 *   - Income tax, Medicare levy, LITO/SAPTO offsets round to the CENT
 *     (HALF_EVEN) at output. This mirrors the Float path's
 *     `Math.round(x * 100) / 100` final step.
 *
 * Shadow tolerance: every field is currency (default 0.005). The
 * preserved regulatory rounding means most paths produce zero-diff;
 * any drift surfaces in fields the engine doesn't pre-round.
 */

import {
  calculateIncomeTax,
  calculateIncomeTaxDecimal,
} from '@/lib/tax-engine/core/incomeTaxCalculator';
import {
  calculatePAYG,
  calculatePAYGDecimal,
} from '@/lib/tax-engine/core/paygCalculator';
import {
  calculateMedicareLevy,
  calculateMedicareLevyDecimal,
} from '@/lib/tax-engine/core/medicareLevyCalculator';
import {
  calculateAllOffsets,
  calculateAllOffsetsDecimal,
} from '@/lib/tax-engine/core/taxOffsets';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

const config = getCurrentTaxYearConfig();

// ---------------------------------------------------------------------------
// incomeTax — progressive bracket walk
// ---------------------------------------------------------------------------

export const incomeTaxShadow: ShadowEngine<
  { taxableIncome: number },
  // The Float `IncomeTaxResult` carries a `calculations: CalculationStep[]`
  // array; we project the comparable scalar fields out via a wrapper so the
  // shadow harness compares only the numeric surface.
  { taxableIncome: number; taxPayable: number; effectiveRate: number; marginalRate: number },
  ReturnType<typeof calculateIncomeTaxDecimal>
> = {
  name: 'tax.incomeTax.shadow',
  description: 'Shadow Float vs Decimal `calculateIncomeTax` (progressive brackets).',
  sourcePath: 'lib/tax-engine/core/incomeTaxCalculator.ts',
  floatExecute: ({ taxableIncome }) => {
    const r = calculateIncomeTax(taxableIncome, config);
    return {
      taxableIncome: r.taxableIncome,
      taxPayable: r.taxPayable,
      effectiveRate: r.effectiveRate,
      marginalRate: r.marginalRate,
    };
  },
  decimalExecute: ({ taxableIncome }) => calculateIncomeTaxDecimal(taxableIncome, config),
  fieldPolicy: {
    effectiveRate: 'percentage',
    marginalRate: 'percentage',
  },
  fixtures: [
    { name: 'zero income', description: 'No tax.', input: { taxableIncome: 0 } },
    { name: 'tax-free threshold', description: '$15k under threshold.', input: { taxableIncome: 15000 } },
    { name: 'median bracket', description: '$90k middle bracket.', input: { taxableIncome: 90000 } },
    { name: 'high bracket', description: '$180k upper bracket.', input: { taxableIncome: 180000 } },
    { name: 'top bracket', description: '$300k top bracket.', input: { taxableIncome: 300000 } },
  ],
};

// ---------------------------------------------------------------------------
// payg — NAT 1004 formula method
// ---------------------------------------------------------------------------

type PAYGFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

export const paygShadow: ShadowEngine<
  { grossIncome: number; frequency: PAYGFrequency; hasTaxFreeThreshold?: boolean },
  { weeklyWithholding: number; fortnightlyWithholding: number; monthlyWithholding: number; annualWithholding: number },
  ReturnType<typeof calculatePAYGDecimal>
> = {
  name: 'tax.payg.shadow',
  description: 'Shadow Float vs Decimal `calculatePAYG` (NAT 1004 Schedule 1).',
  sourcePath: 'lib/tax-engine/core/paygCalculator.ts',
  floatExecute: ({ grossIncome, frequency, hasTaxFreeThreshold }) => {
    const r = calculatePAYG({ grossIncome, frequency, hasTaxFreeThreshold });
    return {
      weeklyWithholding: r.weeklyWithholding,
      fortnightlyWithholding: r.fortnightlyWithholding,
      monthlyWithholding: r.monthlyWithholding,
      annualWithholding: r.annualWithholding,
    };
  },
  decimalExecute: ({ grossIncome, frequency, hasTaxFreeThreshold }) =>
    calculatePAYGDecimal({ grossIncome, frequency, hasTaxFreeThreshold }),
  fieldPolicy: {},
  fixtures: [
    { name: 'tax-free weekly', description: 'Under threshold.', input: { grossIncome: 300, frequency: 'WEEKLY' } },
    { name: 'median weekly', description: 'Mid-bracket weekly.', input: { grossIncome: 1500, frequency: 'WEEKLY' } },
    { name: 'median annual TFT', description: '$90k annual with TFT.', input: { grossIncome: 90000, frequency: 'ANNUALLY' } },
    { name: 'median annual no-TFT', description: '$90k annual no TFT (Scale 1).', input: { grossIncome: 90000, frequency: 'ANNUALLY', hasTaxFreeThreshold: false } },
    { name: 'high earner annual', description: '$200k annual.', input: { grossIncome: 200000, frequency: 'ANNUALLY' } },
    { name: 'fortnightly average', description: '$3,200/fortnight.', input: { grossIncome: 3200, frequency: 'FORTNIGHTLY' } },
    { name: 'monthly senior', description: '$7,500/month.', input: { grossIncome: 7500, frequency: 'MONTHLY' } },
  ],
};

// ---------------------------------------------------------------------------
// medicareLevy
// ---------------------------------------------------------------------------

export const medicareLevyShadow: ShadowEngine<
  { taxableIncome: number; hasPrivateHealthInsurance?: boolean; familyStatus?: 'SINGLE' | 'FAMILY'; dependentChildren?: number },
  { medicareLevy: number; medicareSurcharge: number; total: number },
  Omit<ReturnType<typeof calculateMedicareLevyDecimal>, 'isShadeIn' | 'isExempt'>
> = {
  name: 'tax.medicareLevy.shadow',
  description: 'Shadow Float vs Decimal `calculateMedicareLevy` (with shade-in + surcharge).',
  sourcePath: 'lib/tax-engine/core/medicareLevyCalculator.ts',
  floatExecute: (input) => {
    const r = calculateMedicareLevy(input, config);
    return { medicareLevy: r.medicareLevy, medicareSurcharge: r.medicareSurcharge, total: r.total };
  },
  decimalExecute: (input) => {
    const r = calculateMedicareLevyDecimal(input, config);
    return { medicareLevy: r.medicareLevy, medicareSurcharge: r.medicareSurcharge, total: r.total };
  },
  fieldPolicy: {},
  fixtures: [
    { name: 'below threshold', description: 'No levy.', input: { taxableIncome: 15000 } },
    { name: 'shade-in range', description: 'Partial levy.', input: { taxableIncome: 27000 } },
    { name: 'full levy single', description: '2% levy.', input: { taxableIncome: 90000 } },
    { name: 'family with deps', description: 'Family threshold + child uplift.', input: { taxableIncome: 90000, familyStatus: 'FAMILY', dependentChildren: 2 } },
    { name: 'high earner no PHI', description: 'Triggers surcharge.', input: { taxableIncome: 150000, hasPrivateHealthInsurance: false } },
    { name: 'high earner with PHI', description: 'No surcharge.', input: { taxableIncome: 150000, hasPrivateHealthInsurance: true } },
  ],
};

// ---------------------------------------------------------------------------
// taxOffsets — calculateAllOffsets composer
// ---------------------------------------------------------------------------

export const taxOffsetsShadow: ShadowEngine<
  { taxableIncome: number; frankingCredits?: number; foreignTaxPaid?: number; isSenior?: boolean; hasSpouse?: boolean },
  { offsets: { lito: number; sapto: number; frankingCredits: number; foreignTax: number; other: number; total: number } },
  { offsets: { lito: import('@/lib/decimal').Decimal; sapto: import('@/lib/decimal').Decimal; frankingCredits: import('@/lib/decimal').Decimal; foreignTax: import('@/lib/decimal').Decimal; other: import('@/lib/decimal').Decimal; total: import('@/lib/decimal').Decimal } }
> = {
  name: 'tax.offsets.shadow',
  description: 'Shadow Float vs Decimal `calculateAllOffsets` (LITO/SAPTO/franking/foreign).',
  sourcePath: 'lib/tax-engine/core/taxOffsets.ts',
  floatExecute: (input) => {
    const r = calculateAllOffsets(input, config);
    return { offsets: r.offsets };
  },
  decimalExecute: (input) => {
    const r = calculateAllOffsetsDecimal(input, config);
    return { offsets: r.offsets };
  },
  fieldPolicy: {},
  fixtures: [
    { name: 'full LITO', description: 'Below full threshold.', input: { taxableIncome: 30000 } },
    { name: 'phased LITO tier 1', description: 'In tier-1 phaseout.', input: { taxableIncome: 42000 } },
    { name: 'phased LITO tier 2', description: 'In tier-2 phaseout.', input: { taxableIncome: 55000 } },
    { name: 'no LITO + franking', description: 'Above cutoff + franking credits.', input: { taxableIncome: 80000, frankingCredits: 1500 } },
    { name: 'senior SAPTO single', description: 'SAPTO eligible.', input: { taxableIncome: 30000, isSenior: true } },
    { name: 'foreign tax credit', description: 'Foreign tax paid.', input: { taxableIncome: 90000, foreignTaxPaid: 2000 } },
  ],
};

// ---------------------------------------------------------------------------
// Convenience: full set
// ---------------------------------------------------------------------------

export const taxEngineCoreShadowEngines = [
  incomeTaxShadow,
  paygShadow,
  medicareLevyShadow,
  taxOffsetsShadow,
] as const;
