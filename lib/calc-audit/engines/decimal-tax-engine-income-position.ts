/**
 * Q-DEC PR 2.D.2b — Shadow comparison adapters for `lib/tax-engine/income/*`
 * and `lib/tax-engine/position/*`.
 *
 * Two engines:
 *   - taxabilityRules.determineTaxability (classification + franking gross-up)
 *   - position.taxPositionCalculator.calculateQuickTaxPosition (composer)
 *
 * The full `calculateTaxPosition` shadow is exercised via direct contract
 * tests rather than the harness because its result type carries
 * `recommendations` / `warnings` strings that aren't numeric. The Decimal
 * path's numeric output matches the Float path field-by-field — verified
 * in the contract tests.
 *
 * `salaryProcessor` and `orchestrator/masterTaxPosition` are deferred to
 * later sub-PRs.
 */

import {
  calculateFrankingCredits,
  calculateFrankingCreditsDecimal,
} from '@/lib/tax-engine/income/taxabilityRules';
import {
  calculateQuickTaxPosition,
  calculateQuickTaxPositionDecimal,
} from '@/lib/tax-engine/position/taxPositionCalculator';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// calculateFrankingCredits
// ---------------------------------------------------------------------------

export const frankingCreditsShadow: ShadowEngine<
  { dividendAmount: number; frankingPercentage: number },
  { credits: number },
  { credits: import('@/lib/decimal').Decimal }
> = {
  name: 'tax.income.frankingCredits.shadow',
  description: 'Shadow Float vs Decimal `calculateFrankingCredits` (franking-credit formula).',
  sourcePath: 'lib/tax-engine/income/taxabilityRules.ts',
  floatExecute: ({ dividendAmount, frankingPercentage }) => ({
    credits: calculateFrankingCredits(dividendAmount, frankingPercentage),
  }),
  decimalExecute: ({ dividendAmount, frankingPercentage }) => ({
    credits: calculateFrankingCreditsDecimal(dividendAmount, frankingPercentage),
  }),
  fieldPolicy: {},
  fixtures: [
    { name: 'zero dividend', description: '', input: { dividendAmount: 0, frankingPercentage: 100 } },
    { name: 'zero franking', description: '', input: { dividendAmount: 1000, frankingPercentage: 0 } },
    { name: 'fully franked $700 dividend', description: '$700 × 1.0 × 0.4286 = ~$300', input: { dividendAmount: 700, frankingPercentage: 100 } },
    { name: 'partly franked 50% $1000 dividend', description: '', input: { dividendAmount: 1000, frankingPercentage: 50 } },
    { name: 'fractional dividend', description: '', input: { dividendAmount: 1234.56, frankingPercentage: 100 } },
  ],
};

// ---------------------------------------------------------------------------
// calculateQuickTaxPosition
// ---------------------------------------------------------------------------

export const quickTaxPositionShadow: ShadowEngine<
  { taxableIncome: number; deductions?: number; frankingCredits?: number },
  ReturnType<typeof calculateQuickTaxPosition>,
  ReturnType<typeof calculateQuickTaxPositionDecimal>
> = {
  name: 'tax.position.quickTaxPosition.shadow',
  description: 'Shadow Float vs Decimal `calculateQuickTaxPosition`.',
  sourcePath: 'lib/tax-engine/position/taxPositionCalculator.ts',
  floatExecute: ({ taxableIncome, deductions, frankingCredits }) =>
    calculateQuickTaxPosition(taxableIncome, deductions, frankingCredits),
  decimalExecute: ({ taxableIncome, deductions, frankingCredits }) =>
    calculateQuickTaxPositionDecimal(taxableIncome, deductions, frankingCredits),
  fieldPolicy: {
    effectiveRate: 'percentage',
    marginalRate: 'percentage',
  },
  fixtures: [
    { name: 'zero income', description: '', input: { taxableIncome: 0 } },
    { name: 'tax-free threshold', description: '', input: { taxableIncome: 15000 } },
    { name: 'median earner', description: '', input: { taxableIncome: 90000 } },
    { name: 'median with deductions', description: '$15k deductions reduces taxable to $75k.', input: { taxableIncome: 90000, deductions: 15000 } },
    { name: 'with franking credits', description: '', input: { taxableIncome: 90000, frankingCredits: 1500 } },
    { name: 'high earner', description: '', input: { taxableIncome: 250000 } },
    { name: 'high earner with deductions + franking', description: '', input: { taxableIncome: 250000, deductions: 35000, frankingCredits: 5000 } },
  ],
};

export const taxEngineIncomePositionShadowEngines = [
  frankingCreditsShadow,
  quickTaxPositionShadow,
] as const;
