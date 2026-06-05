/**
 * Q-DEC PR 2.D.3c — Shadow comparison adapter for `negativeGearing`.
 *
 * Only `negativeGearing` has shadow-comparable arithmetic. The 4 other
 * engines in PR 2.D.3c are categorical (companyLossRules, trustLossRules)
 * or stage-1 skeletons (trustMinimumTax, lossRefundability) — exercised
 * via direct contract tests rather than shadow comparison.
 */

import {
  applyNegativeGearing,
  applyNegativeGearingDecimal,
} from '@/lib/tax-engine/divisions/negativeGearing';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

export const negativeGearingShadow: ShadowEngine<
  {
    entityType: import('@/lib/tax-engine/divisions/negativeGearing').LossTreatmentEntity;
    grossIncome: number;
    deductibleExpenses: number;
    otherIncome: number;
    regime?: import('@/lib/tax-engine/divisions/negativeGearingRegime').NegativeGearingRegime;
  },
  Omit<ReturnType<typeof applyNegativeGearing>, 'citations' | 'uncomputed' | 'reason'>,
  Omit<ReturnType<typeof applyNegativeGearingDecimal>, 'citations' | 'uncomputed' | 'reason'>
> = {
  name: 'tax.divisions.negativeGearing.shadow',
  description: 'Shadow Float vs Decimal `applyNegativeGearing` (Div 36 entity-aware loss treatment).',
  sourcePath: 'lib/tax-engine/divisions/negativeGearing.ts',
  floatExecute: (input) => {
    const r = applyNegativeGearing(input);
    return {
      netResult: r.netResult,
      lossTreatment: r.lossTreatment,
      lossAbsorbedThisFy: r.lossAbsorbedThisFy,
      lossCarriedForward: r.lossCarriedForward,
      taxableIncomeAtEntity: r.taxableIncomeAtEntity,
    };
  },
  decimalExecute: (input) => {
    const r = applyNegativeGearingDecimal(input);
    return {
      netResult: r.netResult,
      lossTreatment: r.lossTreatment,
      lossAbsorbedThisFy: r.lossAbsorbedThisFy,
      lossCarriedForward: r.lossCarriedForward,
      taxableIncomeAtEntity: r.taxableIncomeAtEntity,
    };
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'individual net gain',
      description: 'Rental $24k, expenses $20k → $4k net income.',
      input: { entityType: 'PERSONAL_NAME', grossIncome: 24_000, deductibleExpenses: 20_000, otherIncome: 90_000 },
    },
    {
      name: 'individual negative geared (loss < otherIncome)',
      description: '$10k loss absorbs against $90k salary.',
      input: { entityType: 'PERSONAL_NAME', grossIncome: 24_000, deductibleExpenses: 34_000, otherIncome: 90_000 },
    },
    {
      name: 'individual loss exceeds otherIncome',
      description: '$120k loss vs $90k income → $30k carry-forward.',
      input: { entityType: 'PERSONAL_NAME', grossIncome: 24_000, deductibleExpenses: 144_000, otherIncome: 90_000 },
    },
    {
      name: 'discretionary trust trapped',
      description: 'Trust loss carries forward, does NOT offset other entity income.',
      input: { entityType: 'DISCRETIONARY_TRUST', grossIncome: 24_000, deductibleExpenses: 34_000, otherIncome: 50_000 },
    },
    {
      name: 'company trapped',
      description: 'Company loss → Div 165 carry-forward.',
      input: { entityType: 'COMPANY', grossIncome: 100_000, deductibleExpenses: 120_000, otherIncome: 0 },
    },
    {
      name: 'SMSF offsets fund income',
      description: 'SMSF investment loss offsets other fund income.',
      input: { entityType: 'SMSF', grossIncome: 20_000, deductibleExpenses: 35_000, otherIncome: 100_000 },
    },
    {
      name: 'POST_REFORM_RESTRICTED individual quarantined',
      description: 'FW-1 Measure 1 — even individual loss quarantined.',
      input: { entityType: 'PERSONAL_NAME', grossIncome: 24_000, deductibleExpenses: 34_000, otherIncome: 90_000, regime: 'POST_REFORM_RESTRICTED' },
    },
    {
      name: 'fractional values',
      description: 'Mid-cent precision exercise.',
      input: { entityType: 'PERSONAL_NAME', grossIncome: 23_456.78, deductibleExpenses: 32_109.55, otherIncome: 87_654.32 },
    },
  ],
};

export const taxEngineLossShadowEngines = [negativeGearingShadow] as const;
