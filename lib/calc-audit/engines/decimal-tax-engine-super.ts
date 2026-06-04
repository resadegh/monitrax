/**
 * Q-DEC PR 2.D.2 — Shadow comparison adapters for `lib/tax-engine/super/*`.
 *
 * Three engines (the salary-sacrifice critical path):
 *   - capTracker.trackContributionCaps (H3 hardening anchor)
 *   - contributionCalculator.calculateSuperContributions
 *   - highIncomeSuperTax.calculateHighIncomeSuperTax (Div 293 + Div 296 + TBC)
 *
 * smsfIncomeTax deferred to PR 2.D.3 (SMSF-specific, off the salary-
 * sacrifice path).
 */

import {
  trackContributionCaps,
  trackContributionCapsDecimal,
} from '@/lib/tax-engine/super/capTracker';
import {
  calculateSuperContributions,
  calculateSuperContributionsDecimal,
} from '@/lib/tax-engine/super/contributionCalculator';
import {
  calculateHighIncomeSuperTax,
  calculateHighIncomeSuperTaxDecimal,
} from '@/lib/tax-engine/super/highIncomeSuperTax';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

const config = getCurrentTaxYearConfig();

// ---------------------------------------------------------------------------
// capTracker — H3 hardening anchor
// ---------------------------------------------------------------------------

export const capTrackerShadow: ShadowEngine<
  {
    concessionalYTD: number;
    nonConcessionalYTD: number;
    carryForwardAmounts?: { financialYear: string; unusedAmount: number }[];
    totalSuperBalance?: number;
  },
  Omit<ReturnType<typeof trackContributionCaps>, 'warnings' | 'financialYear'>,
  Omit<ReturnType<typeof trackContributionCapsDecimal>, 'warnings' | 'financialYear'>
> = {
  name: 'tax.super.capTracker.shadow',
  description: 'Shadow Float vs Decimal `trackContributionCaps` (Phase 45 H3 anchor).',
  sourcePath: 'lib/tax-engine/super/capTracker.ts',
  floatExecute: (input) => {
    const r = trackContributionCaps(input, config);
    return {
      concessional: r.concessional,
      nonConcessional: r.nonConcessional,
      excessContributionsTax: r.excessContributionsTax,
    };
  },
  decimalExecute: (input) => {
    const r = trackContributionCapsDecimal(input, config);
    return {
      concessional: r.concessional,
      nonConcessional: r.nonConcessional,
      excessContributionsTax: r.excessContributionsTax,
    };
  },
  fieldPolicy: {
    'concessional.percentageUsed': 'percentage',
    'nonConcessional.percentageUsed': 'percentage',
  },
  fixtures: [
    {
      name: 'zero YTD — full headroom',
      description: 'No contributions yet.',
      input: { concessionalYTD: 0, nonConcessionalYTD: 0 },
    },
    {
      name: 'partial usage SG-only',
      description: 'SG-equivalent in concessional, no NCC.',
      input: { concessionalYTD: 11500, nonConcessionalYTD: 0 },
    },
    {
      name: 'at-cap warning band',
      description: 'Concessional at 95% of cap.',
      input: { concessionalYTD: 28500, nonConcessionalYTD: 0 },
    },
    {
      name: 'concessional excess',
      description: 'Over the concessional cap — excessAmount > 0.',
      input: { concessionalYTD: 35000, nonConcessionalYTD: 0 },
    },
    {
      name: 'non-concessional excess',
      description: 'Over the non-concessional cap.',
      input: { concessionalYTD: 0, nonConcessionalYTD: 150000 },
    },
    {
      name: 'with carry-forward eligible',
      description: 'Low TSB + unused prior-year caps.',
      input: {
        concessionalYTD: 30000,
        nonConcessionalYTD: 0,
        carryForwardAmounts: [
          { financialYear: '2023-24', unusedAmount: 5000 },
          { financialYear: '2024-25', unusedAmount: 10000 },
        ],
        totalSuperBalance: 250000,
      },
    },
    {
      name: 'TSB blocks carry-forward',
      description: 'TSB above $500k threshold.',
      input: {
        concessionalYTD: 30000,
        nonConcessionalYTD: 0,
        carryForwardAmounts: [{ financialYear: '2024-25', unusedAmount: 10000 }],
        totalSuperBalance: 600000,
      },
    },
    {
      name: 'TSB blocks bring-forward (NCC)',
      description: 'TSB > $1.9M → no bring-forward.',
      input: { concessionalYTD: 0, nonConcessionalYTD: 100000, totalSuperBalance: 2000000 },
    },
  ],
};

// ---------------------------------------------------------------------------
// contributionCalculator — calculateSuperContributions
// ---------------------------------------------------------------------------

export const superContributionsShadow: ShadowEngine<
  {
    grossSalary: number;
    salarySacrifice?: number;
    personalDeductible?: number;
    personalNonDeductible?: number;
    spouseContribution?: number;
    marginalRate: number;
  },
  Omit<ReturnType<typeof calculateSuperContributions>, 'calculations'>,
  ReturnType<typeof calculateSuperContributionsDecimal>
> = {
  name: 'tax.super.contributions.shadow',
  description: 'Shadow Float vs Decimal `calculateSuperContributions` (SG + salary-sacrifice + Div 293).',
  sourcePath: 'lib/tax-engine/super/contributionCalculator.ts',
  floatExecute: ({ marginalRate, ...input }) => {
    const r = calculateSuperContributions(input, marginalRate, config);
    const { calculations, ...rest } = r;
    return rest;
  },
  decimalExecute: ({ marginalRate, ...input }) =>
    calculateSuperContributionsDecimal(input, marginalRate, config),
  fieldPolicy: {
    superGuaranteeRate: 'rate',
  },
  fixtures: [
    {
      name: 'median earner no sacrifice',
      description: '$90k gross, SG only.',
      input: { grossSalary: 90000, marginalRate: 0.32 },
    },
    {
      name: 'median earner with $500/mo sacrifice',
      description: 'Phase 45 showcase: $6k/yr salary sacrifice.',
      input: { grossSalary: 90000, salarySacrifice: 6000, marginalRate: 0.32 },
    },
    {
      name: 'high earner Div 293 territory',
      description: '$260k gross + concessional → Div 293 triggers.',
      input: { grossSalary: 260000, salarySacrifice: 10000, marginalRate: 0.45 },
    },
    {
      name: 'high earner at SG max base',
      description: 'Salary above max super contribution base.',
      input: { grossSalary: 300000, marginalRate: 0.45 },
    },
    {
      name: 'full mix — concessional + NCC + spouse',
      description: 'Every contribution channel exercised.',
      input: {
        grossSalary: 120000,
        salarySacrifice: 5000,
        personalDeductible: 3000,
        personalNonDeductible: 20000,
        spouseContribution: 3000,
        marginalRate: 0.32,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// highIncomeSuperTax — Div 293 + Div 296 + TBC
// ---------------------------------------------------------------------------

export const highIncomeSuperTaxShadow: ShadowEngine<
  {
    div293Income: number;
    concessionalContributions: number;
    totalSuperBalance: number;
    tsbEarnings?: number;
    transferBalanceUsed?: number;
  },
  Omit<ReturnType<typeof calculateHighIncomeSuperTax>, 'citations' | 'uncomputed'>,
  Omit<ReturnType<typeof calculateHighIncomeSuperTaxDecimal>, 'citations' | 'uncomputed'>
> = {
  name: 'tax.super.highIncomeSuperTax.shadow',
  description: 'Shadow Float vs Decimal `calculateHighIncomeSuperTax` (Div 293 + Div 296 gated + TBC).',
  sourcePath: 'lib/tax-engine/super/highIncomeSuperTax.ts',
  floatExecute: (input) => {
    const r = calculateHighIncomeSuperTax(input, config);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  decimalExecute: (input) => {
    const r = calculateHighIncomeSuperTaxDecimal(input, config);
    const { citations, uncomputed, ...rest } = r;
    return rest;
  },
  // div296.excessTsbProportion is a 0-1 ratio; tbc.* are currency.
  fieldPolicy: {
    'div296.excessTsbProportion': 'percentage',
  },
  fixtures: [
    {
      name: 'below Div 293 threshold',
      description: 'Income under $250k → no Div 293.',
      input: { div293Income: 200000, concessionalContributions: 25000, totalSuperBalance: 500000 },
    },
    {
      name: 'over Div 293 threshold',
      description: '$300k income → Div 293 triggered.',
      input: { div293Income: 300000, concessionalContributions: 30000, totalSuperBalance: 800000 },
    },
    {
      name: 'TSB near TBC',
      description: 'TSB approaches transfer balance cap.',
      input: { div293Income: 200000, concessionalContributions: 25000, totalSuperBalance: 1500000, transferBalanceUsed: 1800000 },
    },
    {
      name: 'TBC exceeded',
      description: 'Transfer balance > cap (uncomputed surfaced).',
      input: { div293Income: 100000, concessionalContributions: 0, totalSuperBalance: 2500000, transferBalanceUsed: 2100000 },
    },
    {
      name: 'TSB > $3M Div 296 pending',
      description: 'TSB over Div 296 threshold but commencement gated.',
      input: { div293Income: 200000, concessionalContributions: 25000, totalSuperBalance: 4000000, tsbEarnings: 200000 },
    },
  ],
};

export const taxEngineSuperShadowEngines = [
  capTrackerShadow,
  superContributionsShadow,
  highIncomeSuperTaxShadow,
] as const;
