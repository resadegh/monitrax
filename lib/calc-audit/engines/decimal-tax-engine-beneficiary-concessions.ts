/**
 * Q-DEC PR 2.D.3c2 — Shadow comparison adapters for beneficiary
 * allocation + business concessions.
 *
 * Three engines:
 *   - trustDistribution.allocateTrustDistribution
 *   - div7aLoanClassifier.classifyDiv7ALoans (+ MRP annuity formula)
 *   - div152SmallBusinessConcessions.applyDiv152
 *
 * Float Math.pow / Math.round / Math.max preserved as Decimal
 * .pow / .toDecimalPlaces / Decimal.max. Per-engine field policies
 * are mostly currency; div7a MRP can be sub-cent (annuity formula
 * produces fractional cents naturally) but Float doesn't pre-round
 * MRP either, so both paths stay in the noise.
 */

import {
  allocateTrustDistribution,
  allocateTrustDistributionDecimal,
} from '@/lib/tax-engine/divisions/trustDistribution';
import {
  classifyDiv7ALoans,
  classifyDiv7ALoansDecimal,
  calculateMinimumYearlyRepayment,
  calculateMinimumYearlyRepaymentDecimal,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';
import {
  applyDiv152,
  applyDiv152Decimal,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// trustDistribution — beneficiary allocation
// ---------------------------------------------------------------------------

export const trustDistributionShadow: ShadowEngine<
  {
    trustNetIncome: number;
    beneficiaries: Array<{
      id: string;
      name: string;
      presentlyEntitledShare: number;
      isNonResidentOrDisabled?: boolean;
    }>;
    hasFamilyTrustElection?: boolean;
  },
  {
    trusteeRetainedAmount: number;
    trusteePenaltyTax: number;
    totalAccountedFor: number;
  },
  {
    trusteeRetainedAmount: import('@/lib/decimal').Decimal;
    trusteePenaltyTax: import('@/lib/decimal').Decimal;
    totalAccountedFor: import('@/lib/decimal').Decimal;
  }
> = {
  name: 'tax.divisions.trustDistribution.shadow',
  description: 'Shadow Float vs Decimal `allocateTrustDistribution` (Div 6 basic).',
  sourcePath: 'lib/tax-engine/divisions/trustDistribution.ts',
  floatExecute: (input) => {
    const r = allocateTrustDistribution(input);
    return {
      trusteeRetainedAmount: r.trusteeRetainedAmount,
      trusteePenaltyTax: r.trusteePenaltyTax,
      totalAccountedFor: r.totalAccountedFor,
    };
  },
  decimalExecute: (input) => {
    const r = allocateTrustDistributionDecimal(input);
    return {
      trusteeRetainedAmount: r.trusteeRetainedAmount,
      trusteePenaltyTax: r.trusteePenaltyTax,
      totalAccountedFor: r.totalAccountedFor,
    };
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'single beneficiary 100%',
      description: 'Full distribution, no trustee retained.',
      input: {
        trustNetIncome: 100_000,
        beneficiaries: [{ id: 'b1', name: 'Alice', presentlyEntitledShare: 1 }],
      },
    },
    {
      name: 'two beneficiaries 60/40',
      description: 'Mixed shares; trustee retained = 0.',
      input: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.6 },
          { id: 'b2', name: 'Bob', presentlyEntitledShare: 0.4 },
        ],
      },
    },
    {
      name: 'partial distribution → trustee retained',
      description: '70% distributed → 30% × $100k = $30k retained, $14.1k penalty.',
      input: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.5 },
          { id: 'b2', name: 'Bob', presentlyEntitledShare: 0.2 },
        ],
      },
    },
    {
      name: 'no beneficiaries presently entitled',
      description: 'Empty list with positive net income → full s99A penalty.',
      input: { trustNetIncome: 100_000, beneficiaries: [] },
    },
    {
      name: 'fractional precision exercise',
      description: 'Non-clean shares (1/3 split).',
      input: {
        trustNetIncome: 99_999,
        beneficiaries: [
          { id: 'b1', name: 'Alice', presentlyEntitledShare: 1 / 3 },
          { id: 'b2', name: 'Bob', presentlyEntitledShare: 1 / 3 },
          { id: 'b3', name: 'Carol', presentlyEntitledShare: 1 / 3 },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// div7aLoanClassifier — MRP annuity formula
// ---------------------------------------------------------------------------

export const div7aLoanShadow: ShadowEngine<
  {
    loans: Array<{
      loanId: string;
      openingBalance: number;
      yearsRemaining: number;
      benchmarkRate: number;
      paymentsMadeThisFy: number;
      hasComplianceAgreement: boolean;
      isSubTrustUpe?: boolean;
    }>;
    distributableSurplus?: number;
  },
  { totalDeemedDividend: number },
  { totalDeemedDividend: import('@/lib/decimal').Decimal }
> = {
  name: 'tax.divisions.div7a.shadow',
  description: 'Shadow Float vs Decimal `classifyDiv7ALoans` (totalDeemedDividend + surplus cap).',
  sourcePath: 'lib/tax-engine/divisions/div7aLoanClassifier.ts',
  floatExecute: ({ loans, distributableSurplus }) => {
    const r = classifyDiv7ALoans(loans, { distributableSurplus });
    return { totalDeemedDividend: r.totalDeemedDividend };
  },
  decimalExecute: ({ loans, distributableSurplus }) => {
    const r = classifyDiv7ALoansDecimal(loans, { distributableSurplus });
    return { totalDeemedDividend: r.totalDeemedDividend };
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'compliant loan',
      description: 'Payments meet MRP → no deemed dividend.',
      input: {
        loans: [
          { loanId: 'l1', openingBalance: 100_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 30_000, hasComplianceAgreement: true },
        ],
      },
    },
    {
      name: 'no agreement → full balance deemed dividend',
      description: '$50k balance, no agreement → $50k deemed.',
      input: {
        loans: [
          { loanId: 'l1', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
        ],
      },
    },
    {
      name: 'MRP shortfall',
      description: 'Payments < MRP → shortfall deemed.',
      input: {
        loans: [
          { loanId: 'l1', openingBalance: 100_000, yearsRemaining: 7, benchmarkRate: 0.0837, paymentsMadeThisFy: 10_000, hasComplianceAgreement: true },
        ],
      },
    },
    {
      name: 'multi-loan with surplus cap',
      description: 'Two loans both no-agreement; surplus $30k caps aggregate.',
      input: {
        loans: [
          { loanId: 'l1', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
          { loanId: 'l2', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
        ],
        distributableSurplus: 30_000,
      },
    },
    {
      name: 'zero rate degenerate case',
      description: 'benchmarkRate=0 → straight-line MRP balance/n.',
      input: {
        loans: [
          { loanId: 'l1', openingBalance: 70_000, yearsRemaining: 7, benchmarkRate: 0, paymentsMadeThisFy: 10_000, hasComplianceAgreement: true },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// div152 — SBC concessions stack
// ---------------------------------------------------------------------------

export const div152Shadow: ShadowEngine<
  import('@/lib/tax-engine/divisions/div152SmallBusinessConcessions').Div152Input,
  {
    basicConditionsMet: boolean;
    fifteenYearExemptionApplied: boolean;
    activeAssetReductionApplied: boolean;
    retirementExemptionApplied: number;
    rolloverApplied: number;
    assessableGain: number;
  },
  {
    basicConditionsMet: boolean;
    fifteenYearExemptionApplied: boolean;
    activeAssetReductionApplied: boolean;
    retirementExemptionApplied: import('@/lib/decimal').Decimal;
    rolloverApplied: import('@/lib/decimal').Decimal;
    assessableGain: import('@/lib/decimal').Decimal;
  }
> = {
  name: 'tax.divisions.div152.shadow',
  description: 'Shadow Float vs Decimal `applyDiv152` (15-yr + 50% + retirement + rollover stacking).',
  sourcePath: 'lib/tax-engine/divisions/div152SmallBusinessConcessions.ts',
  floatExecute: (input) => {
    const r = applyDiv152(input);
    return {
      basicConditionsMet: r.basicConditionsMet,
      fifteenYearExemptionApplied: r.fifteenYearExemptionApplied,
      activeAssetReductionApplied: r.activeAssetReductionApplied,
      retirementExemptionApplied: r.retirementExemptionApplied,
      rolloverApplied: r.rolloverApplied,
      assessableGain: r.assessableGain,
    };
  },
  decimalExecute: (input) => {
    const r = applyDiv152Decimal(input);
    return {
      basicConditionsMet: r.basicConditionsMet,
      fifteenYearExemptionApplied: r.fifteenYearExemptionApplied,
      activeAssetReductionApplied: r.activeAssetReductionApplied,
      retirementExemptionApplied: r.retirementExemptionApplied,
      rolloverApplied: r.rolloverApplied,
      assessableGain: r.assessableGain,
    };
  },
  fieldPolicy: {},
  fixtures: [
    {
      name: 'basic conditions not met',
      description: 'Inactive asset → no concessions.',
      input: {
        gainAfterDiv115: 500_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: false,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
      },
    },
    {
      name: '15-year exemption applies → gain disregarded',
      description: 'Held 16 years + retirement.',
      input: {
        gainAfterDiv115: 800_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: true,
        monthsHeld: 16 * 12,
        isRetirementOrIncapacity: true,
      },
    },
    {
      name: '50% active asset reduction only',
      description: 'No retirement/rollover; $200k → $100k.',
      input: {
        gainAfterDiv115: 200_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: true,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
      },
    },
    {
      name: '50% + retirement exemption (within cap)',
      description: '$200k gain → $100k after 50% → $100k retirement (under $500k cap).',
      input: {
        gainAfterDiv115: 200_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: true,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
        electRetirementExemption: true,
      },
    },
    {
      name: 'retirement cap binding',
      description: 'Lifetime used $400k → only $100k left → $50k spillover assessable.',
      input: {
        gainAfterDiv115: 600_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: true,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 400_000,
      },
    },
    {
      name: 'full stack — 50% + retirement + rollover',
      description: '$600k → $300k → $200k retirement → $100k rollover.',
      input: {
        gainAfterDiv115: 600_000,
        maxNetAssetValue: 3_000_000,
        aggregatedTurnover: 1_000_000,
        isActiveAsset: true,
        monthsHeld: 60,
        isRetirementOrIncapacity: false,
        electRetirementExemption: true,
        retirementExemptionUsedToDate: 300_000,
        electRollover: true,
      },
    },
  ],
};

export const taxEngineBeneficiaryConcessionsShadowEngines = [
  trustDistributionShadow,
  div7aLoanShadow,
  div152Shadow,
] as const;
