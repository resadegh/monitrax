/**
 * Q-DEC PR 2.D.3d — Shadow comparison adapters for composer engines.
 *
 * Two engines with shadow-comparable arithmetic:
 *   - super.calculateSmsfIncomeTax (rate × income + franking offset)
 *   - income.processSalary (annualisation + PAYG + Medicare + super)
 *
 * `entityTaxRouter` and `masterTaxPosition` are aggregating composers
 * that route to engines already shipped — they'll cut over via PR 3
 * along with route handlers. No marginal benefit to a Decimal sibling
 * at the composer layer when the underlying engines are already
 * Decimal-capable.
 */

import {
  calculateSmsfIncomeTax,
  calculateSmsfIncomeTaxDecimal,
} from '@/lib/tax-engine/super/smsfIncomeTax';
import {
  processSalary,
  processSalaryDecimal,
} from '@/lib/tax-engine/income/salaryProcessor';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

const config = getCurrentTaxYearConfig();

// ---------------------------------------------------------------------------
// smsfIncomeTax
// ---------------------------------------------------------------------------

export const smsfIncomeTaxShadow: ShadowEngine<
  {
    assessableInvestmentIncome: number;
    deductions: number;
    assessableContributions: number;
    nonArmsLengthIncome: number;
    isComplying: boolean;
    isInPensionPhase: boolean;
    ecpiExemptProportion?: number;
    frankingCredits?: number;
  },
  // Float fields with `null` are skipped by the harness (non-numeric); we
  // project everything except citations/uncomputed so the numeric fields
  // line up.
  Omit<ReturnType<typeof calculateSmsfIncomeTax>, 'citations' | 'uncomputed'>,
  Omit<ReturnType<typeof calculateSmsfIncomeTaxDecimal>, 'citations' | 'uncomputed'>
> = {
  name: 'tax.super.smsfIncomeTax.shadow',
  description: 'Shadow Float vs Decimal `calculateSmsfIncomeTax` (Div 295 / ECPI / NALI / franking).',
  sourcePath: 'lib/tax-engine/super/smsfIncomeTax.ts',
  floatExecute: (input) => {
    const r = calculateSmsfIncomeTax(input, config);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  decimalExecute: (input) => {
    const r = calculateSmsfIncomeTaxDecimal(input, config);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'complying accumulation phase',
      description: 'No pension; standard 15% concessional rate.',
      input: {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 25_000,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: false,
      },
    },
    {
      name: 'complying pension phase 100% ECPI',
      description: 'Fully exempt investment income.',
      input: {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 0,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        ecpiExemptProportion: 1,
      },
    },
    {
      name: 'complying pension phase 50% ECPI',
      description: 'Half exempt, half taxed at 15%.',
      input: {
        assessableInvestmentIncome: 100_000,
        deductions: 10_000,
        assessableContributions: 20_000,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        ecpiExemptProportion: 0.5,
      },
    },
    {
      name: 'NALI taxed at top rate',
      description: 'ECPI does not apply to NALI per s295-550.',
      input: {
        assessableInvestmentIncome: 30_000,
        deductions: 0,
        assessableContributions: 15_000,
        nonArmsLengthIncome: 25_000,
        isComplying: true,
        isInPensionPhase: false,
      },
    },
    {
      name: 'complying with franking refund',
      description: 'Franking credits > tax → cash refund (pension phase).',
      input: {
        assessableInvestmentIncome: 20_000,
        deductions: 0,
        assessableContributions: 0,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        ecpiExemptProportion: 1,
        frankingCredits: 8_000,
      },
    },
    {
      name: 'non-complying top rate',
      description: 'All assessable income taxed at top rate.',
      input: {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 25_000,
        nonArmsLengthIncome: 10_000,
        isComplying: false,
        isInPensionPhase: false,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// processSalary
// ---------------------------------------------------------------------------

export const processSalaryShadow: ShadowEngine<
  {
    amount: number;
    salaryType: 'GROSS' | 'NET';
    payFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    salarySacrifice?: number;
    salarySacrificeFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    hasTaxFreeThreshold?: boolean;
  },
  Omit<ReturnType<typeof processSalary>, 'calculations'>,
  ReturnType<typeof processSalaryDecimal>
> = {
  name: 'tax.income.processSalary.shadow',
  description: 'Shadow Float vs Decimal `processSalary` (NET→GROSS reverse + PAYG + Medicare + super).',
  sourcePath: 'lib/tax-engine/income/salaryProcessor.ts',
  floatExecute: (input) => {
    const { calculations, ...rest } = processSalary(input, config);
    return rest;
  },
  decimalExecute: (input) => processSalaryDecimal(input, config),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'median GROSS annual',
      description: '$90k annual gross, no sacrifice.',
      input: { amount: 90_000, salaryType: 'GROSS', payFrequency: 'ANNUALLY' },
    },
    {
      name: 'median GROSS with salary sacrifice',
      description: '$120k gross + $6k sacrifice.',
      input: {
        amount: 120_000,
        salaryType: 'GROSS',
        payFrequency: 'ANNUALLY',
        salarySacrifice: 6_000,
        salarySacrificeFrequency: 'ANNUALLY',
      },
    },
    {
      name: 'monthly GROSS',
      description: '$7,500/month gross.',
      input: { amount: 7_500, salaryType: 'GROSS', payFrequency: 'MONTHLY' },
    },
    {
      name: 'NET annual reverse-calculated',
      description: '$67,200 net → reverse to gross via binary search.',
      input: { amount: 67_200, salaryType: 'NET', payFrequency: 'ANNUALLY' },
    },
    {
      name: 'high earner GROSS',
      description: '$250k gross.',
      input: { amount: 250_000, salaryType: 'GROSS', payFrequency: 'ANNUALLY' },
    },
  ],
};

export const taxEngineComposerShadowEngines = [
  smsfIncomeTaxShadow,
  processSalaryShadow,
] as const;
