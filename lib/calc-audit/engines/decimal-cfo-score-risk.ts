/**
 * Q-DEC PR 2.E.2 — Shadow comparison adapters for `lib/cfo/scoreCalculator`
 * + `lib/cfo/riskRadar` summary.
 *
 * `scoreCalculator` ships 6 component-tier shadow engines and a composite
 * `calculateComponentsDecimal` engine. Each component is a pure
 * step-function with linear interpolation between thresholds — the math
 * compounds (weighted average) so a real Decimal sibling matters.
 *
 * `riskRadar` ships only the summary shadow engine. Each of the 10
 * detectors is a categorical-output engine (ratio threshold → conditional
 * risk object); the actual money-math is shallow and the per-risk
 * `impact` is already rounded for display. Decimal value at the summary
 * layer — accumulates `totalImpact` without Float-rounding drift.
 *
 * No `prisma`/I-O reaches this file — the shadow engines work on pure
 * input arrays so the harness can exercise them deterministically.
 */

import {
  calculateCashflowStrengthDecimal,
  calculateDebtCoverageDecimal,
  calculateEmergencyBufferDecimal,
  calculateInvestmentDiversificationDecimal,
  calculateSpendingControlDecimal,
  calculateSavingsRateDecimal,
  calculateComponentsDecimal,
} from '@/lib/cfo/scoreCalculator';
import { calculateSummaryDecimal } from '@/lib/cfo/riskRadar';
import type {
  FinancialRisk,
  RiskSeverity,
  RiskTimeframe,
  RiskType,
} from '@/lib/cfo/types';
import { Decimal } from '@/lib/decimal';
import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// Float-side implementations re-derived for shadow comparison.
//
// The Float helpers in scoreCalculator.ts (`calculateCashflowStrength` etc.)
// are not exported. Re-deriving them here keeps the shadow harness honest:
// the Float-side functions are the canonical algorithm from the source
// file, transcribed verbatim, so any drift between paths surfaces as a
// real DIFF (not a transcription error). The Float source is referenced
// by line range in each function's doc-line.
// ---------------------------------------------------------------------------

import { toMonthly } from '@/lib/utils/frequencies';

interface IncomeF { id: string; amount: number; frequency: Frequency }
interface ExpenseF { id: string; amount: number; frequency: Frequency; isEssential: boolean }
interface LoanF { id: string; principal: number; interestRateAnnual: number; minRepayment: number; repaymentFrequency: RepaymentFrequency }
interface AccountF { id: string; currentBalance: number; type: string }
interface HoldingF { units: number; averagePrice: number; type: string }
interface InvestmentF { id: string; holdings: HoldingF[] }
interface PropertyF { id: string; currentValue: number; type: string }

/** scoreCalculator.ts:151-179 */
function calculateCashflowStrengthFloat(
  incomes: IncomeF[],
  expenses: ExpenseF[],
  loans: LoanF[],
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlyLoanPayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);
  if (monthlyIncome === 0) return 0;
  const netCashflow = monthlyIncome - monthlyExpenses - monthlyLoanPayments;
  const cashflowRatio = netCashflow / monthlyIncome;
  if (cashflowRatio >= 0.3) return 100;
  if (cashflowRatio >= 0.2) return 85 + (cashflowRatio - 0.2) * 150;
  if (cashflowRatio >= 0.1) return 70 + (cashflowRatio - 0.1) * 150;
  if (cashflowRatio >= 0) return 50 + cashflowRatio * 200;
  if (cashflowRatio >= -0.1) return 30 + (cashflowRatio + 0.1) * 200;
  if (cashflowRatio >= -0.2) return 10 + (cashflowRatio + 0.2) * 200;
  return 0;
}

/** scoreCalculator.ts:185-210 */
function calculateDebtCoverageFloat(incomes: IncomeF[], loans: LoanF[]): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);
  const monthlyPayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);
  if (monthlyIncome === 0) return totalDebt === 0 ? 100 : 0;
  const dsr = monthlyPayments / monthlyIncome;
  if (dsr <= 0.2) return 100;
  if (dsr <= 0.3) return 80 + (0.3 - dsr) * 200;
  if (dsr <= 0.4) return 60 + (0.4 - dsr) * 200;
  if (dsr <= 0.5) return 40 + (0.5 - dsr) * 200;
  if (dsr <= 0.6) return 20 + (0.6 - dsr) * 200;
  return 0;
}

const LIQUID = ['CASH', 'SAVINGS', 'TRANSACTIONAL', 'OFFSET'];

/** scoreCalculator.ts:216-242 */
function calculateEmergencyBufferFloat(accounts: AccountF[], expenses: ExpenseF[]): number {
  const liquidBalances = accounts
    .filter((a) => LIQUID.includes(a.type))
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const monthlyEssentialExpenses = expenses
    .filter((e) => e.isEssential)
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  if (monthlyEssentialExpenses === 0) return liquidBalances > 0 ? 100 : 50;
  const monthsCovered = liquidBalances / monthlyEssentialExpenses;
  if (monthsCovered >= 6) return 100;
  if (monthsCovered >= 3) return 75 + (monthsCovered - 3) * (25 / 3);
  if (monthsCovered >= 1) return 40 + (monthsCovered - 1) * (35 / 2);
  return monthsCovered * 40;
}

/** scoreCalculator.ts:248-309 */
function calculateInvestmentDiversificationFloat(
  investments: InvestmentF[],
  properties: PropertyF[],
): number {
  let hasEquities = false;
  let hasBonds = false;
  const hasProperty = properties.length > 0;
  let hasCrypto = false;
  for (const account of investments) {
    for (const holding of account.holdings) {
      if (['SHARE', 'ETF'].includes(holding.type)) hasEquities = true;
      if (holding.type === 'MANAGED_FUND') hasBonds = true;
      if (holding.type === 'CRYPTO') hasCrypto = true;
    }
  }
  let equityValue = 0;
  let otherValue = 0;
  const propertyValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  for (const account of investments) {
    for (const holding of account.holdings) {
      const value = holding.units * holding.averagePrice;
      if (['SHARE', 'ETF'].includes(holding.type)) equityValue += value;
      else otherValue += value;
    }
  }
  const totalValue = equityValue + otherValue + propertyValue;
  if (totalValue === 0) return 50;
  const assetClassCount = [hasEquities, hasBonds, hasProperty, hasCrypto].filter(Boolean).length;
  const classScore = Math.min(40, assetClassCount * 10);
  const concentrations = [
    equityValue / totalValue,
    otherValue / totalValue,
    propertyValue / totalValue,
  ].filter((c) => c > 0);
  const maxConcentration = Math.max(...concentrations, 0);
  const balanceScore = maxConcentration > 0.8 ? 0 : maxConcentration > 0.6 ? 20 : 40;
  const concentrationPenalty = maxConcentration > 0.8 ? 0 : 20;
  return Math.min(100, classScore + balanceScore + concentrationPenalty);
}

/** scoreCalculator.ts:315-340 */
function calculateSpendingControlFloat(incomes: IncomeF[], expenses: ExpenseF[]): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyDiscretionary = expenses
    .filter((e) => !e.isEssential)
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  if (monthlyIncome === 0) return monthlyDiscretionary === 0 ? 100 : 0;
  const discretionaryRatio = monthlyDiscretionary / monthlyIncome;
  if (discretionaryRatio <= 0.1) return 100;
  if (discretionaryRatio <= 0.2) return 80 + (0.2 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.3) return 60 + (0.3 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.4) return 40 + (0.4 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.5) return 20 + (0.5 - discretionaryRatio) * 200;
  return Math.max(0, 20 - (discretionaryRatio - 0.5) * 40);
}

/** scoreCalculator.ts:347-377 */
function calculateSavingsRateFloat(
  incomes: IncomeF[],
  expenses: ExpenseF[],
  loans: LoanF[],
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlyLoanRepayments = loans.reduce(
    (sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency),
    0,
  );
  if (monthlyIncome === 0) return 0;
  const savingsRate = (monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome;
  if (savingsRate >= 0.3) return 100;
  if (savingsRate >= 0.2) return 80 + (savingsRate - 0.2) * 200;
  if (savingsRate >= 0.1) return 60 + (savingsRate - 0.1) * 200;
  if (savingsRate >= 0.05) return 40 + (savingsRate - 0.05) * 400;
  if (savingsRate >= 0) return 20 + savingsRate * 400;
  return 0;
}

// ---------------------------------------------------------------------------
// Common fixture builder
// ---------------------------------------------------------------------------

function builders(
  income: number,
  expensesEssential: number,
  expensesDiscretionary: number,
  loanPrincipal: number,
  loanRepayment: number,
) {
  return {
    incomes: [{ id: 'i1', amount: income, frequency: 'MONTHLY' as Frequency }],
    expenses: [
      { id: 'e1', amount: expensesEssential, frequency: 'MONTHLY' as Frequency, isEssential: true },
      { id: 'e2', amount: expensesDiscretionary, frequency: 'MONTHLY' as Frequency, isEssential: false },
    ],
    loans: loanPrincipal > 0
      ? [
          {
            id: 'l1',
            principal: loanPrincipal,
            interestRateAnnual: 0.06,
            minRepayment: loanRepayment,
            repaymentFrequency: 'MONTHLY' as RepaymentFrequency,
          },
        ]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Component-tier shadow engines
// ---------------------------------------------------------------------------

interface ComponentFixtureInput {
  incomes: IncomeF[];
  expenses: ExpenseF[];
  loans: LoanF[];
  accounts?: AccountF[];
  investments?: InvestmentF[];
  properties?: PropertyF[];
}

export const cashflowStrengthShadow: ShadowEngine<
  ComponentFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.cashflowStrength.shadow',
  description: 'Shadow Float vs Decimal `calculateCashflowStrength` (cashflow-ratio step function).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ incomes, expenses, loans }) =>
    calculateCashflowStrengthFloat(incomes, expenses, loans),
  decimalExecute: ({ incomes, expenses, loans }) =>
    calculateCashflowStrengthDecimal(incomes, expenses, loans),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'strong surplus → 100',
      description: '$8k income, $3k expenses, no loan → ratio 0.625 ≥ 0.3.',
      input: builders(8_000, 2_000, 1_000, 0, 0),
    },
    {
      name: '20% surplus → step',
      description: 'Tight tier — ratio exactly 0.2 boundary.',
      input: builders(5_000, 2_000, 2_000, 0, 0),
    },
    {
      name: 'break-even → 50',
      description: 'Income == expenses → ratio 0.',
      input: builders(5_000, 3_000, 2_000, 0, 0),
    },
    {
      name: 'mild deficit',
      description: 'Cashflow slightly negative (−0.06 ratio).',
      input: builders(5_000, 3_000, 2_300, 0, 0),
    },
    {
      name: 'severe deficit floored',
      description: 'Deficit beyond −0.2 → floor at 0.',
      input: builders(5_000, 5_000, 2_000, 0, 0),
    },
    {
      name: 'zero income → 0',
      description: 'Divide-by-zero guard.',
      input: builders(0, 1_000, 500, 0, 0),
    },
  ],
};

export const debtCoverageShadow: ShadowEngine<
  ComponentFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.debtCoverage.shadow',
  description: 'Shadow Float vs Decimal `calculateDebtCoverage` (DSR step function).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ incomes, loans }) => calculateDebtCoverageFloat(incomes, loans),
  decimalExecute: ({ incomes, loans }) => calculateDebtCoverageDecimal(incomes, loans),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'DSR 0 → 100',
      description: 'No loans.',
      input: builders(8_000, 2_000, 1_000, 0, 0),
    },
    {
      name: 'DSR 25%',
      description: 'Mid-band — interpolated.',
      input: builders(8_000, 2_000, 1_000, 400_000, 2_000),
    },
    {
      name: 'DSR critical → 40-60 zone',
      description: 'Heavy DSR (45%).',
      input: builders(6_000, 1_500, 1_000, 400_000, 2_700),
    },
    {
      name: 'DSR > 60% → 0',
      description: 'Beyond critical.',
      input: builders(5_000, 1_000, 500, 500_000, 3_500),
    },
    {
      name: 'zero income with loan → 0',
      description: 'Divide-by-zero guard.',
      input: builders(0, 0, 0, 100_000, 500),
    },
    {
      name: 'zero income, zero loan → 100',
      description: 'Debt-free no-income special case.',
      input: builders(0, 0, 0, 0, 0),
    },
  ],
};

interface BufferFixtureInput {
  accounts: AccountF[];
  expenses: ExpenseF[];
}

export const emergencyBufferShadow: ShadowEngine<
  BufferFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.emergencyBuffer.shadow',
  description: 'Shadow Float vs Decimal `calculateEmergencyBuffer` (months-covered step function).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ accounts, expenses }) => calculateEmergencyBufferFloat(accounts, expenses),
  decimalExecute: ({ accounts, expenses }) => calculateEmergencyBufferDecimal(accounts, expenses),
  fieldPolicy: {},
  fixtures: [
    {
      name: '6+ months → 100',
      description: '$18k savings, $2k essential expenses/mo.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 18_000, type: 'SAVINGS' }],
        expenses: [{ id: 'e1', amount: 2_000, frequency: 'MONTHLY' as Frequency, isEssential: true }],
      },
    },
    {
      name: '3 months → 75',
      description: 'Boundary case.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 6_000, type: 'SAVINGS' }],
        expenses: [{ id: 'e1', amount: 2_000, frequency: 'MONTHLY' as Frequency, isEssential: true }],
      },
    },
    {
      name: '1 month — interpolated',
      description: 'Bottom of mid-band.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 2_000, type: 'SAVINGS' }],
        expenses: [{ id: 'e1', amount: 2_000, frequency: 'MONTHLY' as Frequency, isEssential: true }],
      },
    },
    {
      name: '<1 month linear',
      description: 'Half a month covered.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 1_000, type: 'SAVINGS' }],
        expenses: [{ id: 'e1', amount: 2_000, frequency: 'MONTHLY' as Frequency, isEssential: true }],
      },
    },
    {
      name: 'non-liquid account excluded',
      description: 'INVESTMENT account doesn\'t count as liquid → 0 covered.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 100_000, type: 'INVESTMENT' }],
        expenses: [{ id: 'e1', amount: 2_000, frequency: 'MONTHLY' as Frequency, isEssential: true }],
      },
    },
    {
      name: 'no essential expenses, has liquid → 100',
      description: 'Special case.',
      input: {
        accounts: [{ id: 'a1', currentBalance: 5_000, type: 'SAVINGS' }],
        expenses: [{ id: 'e1', amount: 500, frequency: 'MONTHLY' as Frequency, isEssential: false }],
      },
    },
    {
      name: 'no essential expenses, no liquid → 50',
      description: 'Special case.',
      input: {
        accounts: [],
        expenses: [{ id: 'e1', amount: 500, frequency: 'MONTHLY' as Frequency, isEssential: false }],
      },
    },
  ],
};

interface DiversificationFixtureInput {
  investments: InvestmentF[];
  properties: PropertyF[];
}

export const investmentDiversificationShadow: ShadowEngine<
  DiversificationFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.investmentDiversification.shadow',
  description: 'Shadow Float vs Decimal `calculateInvestmentDiversification` (asset-class + balance + concentration).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ investments, properties }) =>
    calculateInvestmentDiversificationFloat(investments, properties),
  decimalExecute: ({ investments, properties }) =>
    calculateInvestmentDiversificationDecimal(investments, properties),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'no investments → 50',
      description: 'Neutral baseline.',
      input: { investments: [], properties: [] },
    },
    {
      name: 'balanced 3-class portfolio',
      description: 'ETF + property + crypto in rough balance.',
      input: {
        investments: [
          {
            id: 'inv1',
            holdings: [
              { units: 100, averagePrice: 100, type: 'ETF' },
              { units: 1, averagePrice: 10_000, type: 'CRYPTO' },
            ],
          },
        ],
        properties: [{ id: 'p1', currentValue: 30_000, type: 'OWNER_OCCUPIED' }],
      },
    },
    {
      name: 'concentrated 90% property → penalty',
      description: 'Property dominates → max concentration triggers penalty.',
      input: {
        investments: [
          {
            id: 'inv1',
            holdings: [{ units: 100, averagePrice: 100, type: 'ETF' }],
          },
        ],
        properties: [{ id: 'p1', currentValue: 1_000_000, type: 'INVESTMENT' }],
      },
    },
    {
      name: 'equities-only single class',
      description: 'No property, no other → 1 asset class only.',
      input: {
        investments: [
          {
            id: 'inv1',
            holdings: [{ units: 100, averagePrice: 100, type: 'ETF' }],
          },
        ],
        properties: [],
      },
    },
  ],
};

export const spendingControlShadow: ShadowEngine<
  ComponentFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.spendingControl.shadow',
  description: 'Shadow Float vs Decimal `calculateSpendingControl` (discretionary-ratio step function).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ incomes, expenses }) => calculateSpendingControlFloat(incomes, expenses),
  decimalExecute: ({ incomes, expenses }) => calculateSpendingControlDecimal(incomes, expenses),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'no discretionary → 100',
      description: 'Saint-level discipline.',
      input: builders(7_000, 3_000, 0, 0, 0),
    },
    {
      name: '15% discretionary — interpolated',
      description: 'Mid 0.1-0.2 tier.',
      input: builders(8_000, 3_000, 1_200, 0, 0),
    },
    {
      name: '35% discretionary — mid-band',
      description: 'In the 0.3-0.4 tier.',
      input: builders(6_000, 2_000, 2_100, 0, 0),
    },
    {
      name: '60% discretionary — beyond 0.5 floor',
      description: 'Falls through to linear-decay floor.',
      input: builders(5_000, 1_000, 3_000, 0, 0),
    },
    {
      name: 'zero income, no discretionary → 100',
      description: 'Special case.',
      input: builders(0, 1_000, 0, 0, 0),
    },
    {
      name: 'zero income with discretionary → 0',
      description: 'Special case.',
      input: builders(0, 1_000, 500, 0, 0),
    },
  ],
};

export const savingsRateShadow: ShadowEngine<
  ComponentFixtureInput,
  number,
  Decimal
> = {
  name: 'cfo.scoreCalculator.savingsRate.shadow',
  description: 'Shadow Float vs Decimal `calculateSavingsRate` (post-loan savings-rate step function).',
  sourcePath: 'lib/cfo/scoreCalculator.ts',
  floatExecute: ({ incomes, expenses, loans }) =>
    calculateSavingsRateFloat(incomes, expenses, loans),
  decimalExecute: ({ incomes, expenses, loans }) =>
    calculateSavingsRateDecimal(incomes, expenses, loans),
  fieldPolicy: {},
  fixtures: [
    {
      name: '30%+ savings → 100',
      description: 'High earner, low spend.',
      input: builders(10_000, 3_000, 1_000, 0, 0),
    },
    {
      name: '15% savings — mid-band',
      description: 'Interpolated 0.1-0.2.',
      input: builders(7_000, 3_000, 1_950, 0, 0),
    },
    {
      name: '7% — narrow band 0.05-0.1',
      description: 'Different rate slope (×400).',
      input: builders(7_000, 3_000, 2_500, 0, 0),
    },
    {
      name: 'negative savings rate → 0',
      description: 'Below baseline floor.',
      input: builders(5_000, 4_000, 1_500, 0, 0),
    },
    {
      name: 'zero income → 0',
      description: 'Divide-by-zero guard.',
      input: builders(0, 1_000, 500, 0, 0),
    },
    {
      name: 'with loan repayments',
      description: 'Loan repayments subtracted from income before ratio.',
      input: builders(8_000, 3_000, 1_500, 300_000, 1_500),
    },
  ],
};


// ---------------------------------------------------------------------------
// Risk summary
// ---------------------------------------------------------------------------

function buildRisk(severity: RiskSeverity, impact: number, idx: number): FinancialRisk {
  return {
    id: `risk-${idx}`,
    type: 'low_balance' as RiskType,
    severity,
    timeframe: 'short' as RiskTimeframe,
    title: 'test',
    description: 'test',
    impact,
    probability: 0.5,
    detectedAt: new Date(),
    relatedEntities: [],
    suggestedActions: [],
  };
}

// Float-side summary (re-derived; matches riskRadar.ts:600-609).
function calculateSummaryFloat(risks: FinancialRisk[]) {
  return {
    critical: risks.filter((r) => r.severity === 'critical').length,
    high: risks.filter((r) => r.severity === 'high').length,
    medium: risks.filter((r) => r.severity === 'medium').length,
    low: risks.filter((r) => r.severity === 'low').length,
    totalImpact: risks.reduce((sum, r) => sum + r.impact, 0),
    topRisk: risks[0] || null,
  };
}

export const riskSummaryShadow: ShadowEngine<
  { risks: FinancialRisk[] },
  ReturnType<typeof calculateSummaryFloat>,
  ReturnType<typeof calculateSummaryDecimal>
> = {
  name: 'cfo.riskRadar.summary.shadow',
  description: 'Shadow Float vs Decimal `calculateSummary` (counts unchanged; totalImpact accumulated in Decimal).',
  sourcePath: 'lib/cfo/riskRadar.ts',
  floatExecute: ({ risks }) => calculateSummaryFloat(risks),
  decimalExecute: ({ risks }) => calculateSummaryDecimal(risks),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty risks → all zero',
      description: 'Baseline.',
      input: { risks: [] },
    },
    {
      name: 'mixed severity counts',
      description: '1 of each severity, total impact sums.',
      input: {
        risks: [
          buildRisk('critical', 5_000, 1),
          buildRisk('high', 3_000, 2),
          buildRisk('medium', 1_500, 3),
          buildRisk('low', 500, 4),
        ],
      },
    },
    {
      name: 'many small impacts — accumulator precision',
      description: '10 risks at $123.45 each — Float would drift; Decimal accumulator stays exact.',
      input: {
        risks: Array.from({ length: 10 }, (_, i) => buildRisk('medium', 123.45, i)),
      },
    },
    {
      name: 'large single impact',
      description: 'One critical risk dominates.',
      input: { risks: [buildRisk('critical', 1_500_000, 1)] },
    },
  ],
};

export const cfoScoreRiskShadowEngines = [
  cashflowStrengthShadow,
  debtCoverageShadow,
  emergencyBufferShadow,
  investmentDiversificationShadow,
  spendingControlShadow,
  savingsRateShadow,
  riskSummaryShadow,
] as const;
