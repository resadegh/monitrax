/**
 * Q-DEC PR 2.E.3 — Shadow comparison adapters for `lib/cfo/decisionSupport/*`.
 *
 * Scope: pure-math helpers across all 4 decision-support files:
 *   - `propertyDecisionSupport.calculatePortfolioSummaryDecimal`
 *   - `loanDecisionSupport.calculateMonthlyPaymentDecimal`
 *   - `loanDecisionSupport.calculatePayoffMonthsDecimal`
 *   - `loanDecisionSupport.calculateTotalInterestDecimal`
 *   - `investmentDecisionSupport.calculateDividendYieldDecimal`
 *   - `investmentDecisionSupport.calculateMaxConcentrationDecimal`
 *   - `taxIntegration.calculateUnrealisedCGTDecimal`
 *   - `taxIntegration.calculateNegativeGearingBenefitDecimal`
 *
 * Categorical helpers (alert generation, performance extremes, allocation
 * analysis, rebalance actions) and the async `calculateCFO*Insights`
 * wrappers are deferred to PR 3 cutover — their outputs are presentation
 * objects (alerts / risks), not numeric.
 *
 * Re-derived Float-side helpers for shadow comparison: the Float
 * functions in the source files are mostly NOT exported (private
 * implementation detail), so we re-derive them here verbatim and tag
 * each with its source-file line range — same pattern as PR 2.E.2's
 * score-risk shadow engine.
 */

import {
  calculatePortfolioSummaryDecimal,
} from '@/lib/cfo/decisionSupport/propertyDecisionSupport';
import {
  calculateMonthlyPaymentDecimal,
  calculatePayoffMonthsDecimal,
  calculateTotalInterestDecimal,
} from '@/lib/cfo/decisionSupport/loanDecisionSupport';
import {
  calculateDividendYieldDecimal,
  calculateMaxConcentrationDecimal,
  type InvestmentHoldingDecimalInput,
} from '@/lib/cfo/decisionSupport/investmentDecisionSupport';
import {
  calculateUnrealisedCGTDecimal,
  calculateNegativeGearingBenefitDecimal,
  type CgtHoldingDecimalInput,
  type NegativeGearingPropertyDecimalInput,
} from '@/lib/cfo/decisionSupport/taxIntegration';
import { Decimal } from '@/lib/decimal';
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import type { PropertyMetrics } from '@/lib/services/masterFinancialService';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

// ---------------------------------------------------------------------------
// propertyDecisionSupport — portfolio summary (source: propertyDecisionSupport.ts:42-49)
// ---------------------------------------------------------------------------

function portfolioSummaryFloat(properties: PropertyMetrics[]) {
  if (properties.length === 0) {
    return {
      totalProperties: 0,
      totalValue: 0,
      totalEquity: 0,
      averageLVR: 0,
      totalMonthlyIncome: 0,
      totalMonthlyCashflow: 0,
    };
  }
  const totalValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const totalEquity = properties.reduce((s, p) => s + p.equity, 0);
  const totalLoanBalance = totalValue - totalEquity;
  const averageLVR = totalValue > 0 ? (totalLoanBalance / totalValue) * 100 : 0;
  const totalMonthlyIncome = properties.reduce((s, p) => s + p.annualRentalIncome / 12, 0);
  const totalMonthlyCashflow = properties.reduce((s, p) => s + p.monthlyCashflow, 0);
  return {
    totalProperties: properties.length,
    totalValue,
    totalEquity,
    averageLVR,
    totalMonthlyIncome,
    totalMonthlyCashflow,
  };
}

function makeProperty(overrides: Partial<PropertyMetrics> = {}): PropertyMetrics {
  return {
    id: 'p1',
    name: 'Test Property',
    type: 'INVESTMENT', // MON-033: PropertyMetrics now carries the type gate
    currentValue: 800_000,
    purchasePrice: 600_000,
    loanBalance: 400_000,
    equity: 400_000,
    lvr: 50,
    annualRentalIncome: 30_000,
    rentalYield: 3.75,
    monthlyExpenses: 1_500,
    monthlyCashflow: 200,
    capitalGrowth: 200_000,
    capitalGrowthPercent: 33.3,
    ...overrides,
  };
}

export const propertyPortfolioSummaryShadow: ShadowEngine<
  { properties: PropertyMetrics[] },
  ReturnType<typeof portfolioSummaryFloat>,
  ReturnType<typeof calculatePortfolioSummaryDecimal>
> = {
  name: 'cfo.propertyDecisionSupport.portfolioSummary.shadow',
  description: 'Shadow Float vs Decimal portfolio summary (totals + weighted LVR).',
  sourcePath: 'lib/cfo/decisionSupport/propertyDecisionSupport.ts',
  floatExecute: ({ properties }) => portfolioSummaryFloat(properties),
  decimalExecute: ({ properties }) => calculatePortfolioSummaryDecimal(properties),
  fieldPolicy: {
    averageLVR: 'percentage',
  },
  fixtures: [
    {
      name: 'empty portfolio → all zeros',
      description: 'Baseline empty state.',
      input: { properties: [] },
    },
    {
      name: 'single property',
      description: 'Default test property.',
      input: { properties: [makeProperty()] },
    },
    {
      name: 'three-property portfolio mixed',
      description: 'Total / weighted LVR / monthly cashflow aggregation.',
      input: {
        properties: [
          makeProperty({ id: 'p1', currentValue: 600_000, equity: 200_000, annualRentalIncome: 24_000, monthlyCashflow: -200 }),
          makeProperty({ id: 'p2', currentValue: 900_000, equity: 500_000, annualRentalIncome: 36_000, monthlyCashflow: 150 }),
          makeProperty({ id: 'p3', currentValue: 1_200_000, equity: 800_000, annualRentalIncome: 48_000, monthlyCashflow: 300 }),
        ],
      },
    },
    {
      name: 'all-equity portfolio → 0% LVR',
      description: 'Property fully paid-off.',
      input: {
        properties: [makeProperty({ equity: 800_000, loanBalance: 0 })],
      },
    },
    {
      name: 'underwater portfolio',
      description: 'Negative equity → totalLoanBalance > totalValue.',
      input: {
        properties: [makeProperty({ currentValue: 500_000, equity: -100_000, loanBalance: 600_000 })],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// loanDecisionSupport — 3 amortisation helpers (source: 609-663)
// ---------------------------------------------------------------------------

function monthlyPaymentFloat(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0 || months === 0) {
    return months > 0 ? principal / months : 0;
  }
  const monthlyRate = annualRate / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
}

function payoffMonthsFloat(principal: number, annualRate: number, monthlyPayment: number): number {
  if (monthlyPayment <= 0) return 999;
  const monthlyRate = annualRate / 12;
  const monthlyInterest = principal * monthlyRate;
  if (monthlyPayment <= monthlyInterest) return 999;
  const months = Math.ceil(
    -Math.log(1 - (principal * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate),
  );
  return Math.min(months, 600);
}

function totalInterestFloat(principal: number, _annualRate: number, monthlyPayment: number, months: number): number {
  return Math.max(0, monthlyPayment * months - principal);
}

interface PaymentFixture {
  principal: number;
  annualRate: number;
  months: number;
}

export const monthlyPaymentShadow: ShadowEngine<PaymentFixture, number, Decimal> = {
  name: 'cfo.loanDecisionSupport.calculateMonthlyPayment.shadow',
  description: 'Shadow Float vs Decimal amortising-annuity monthly payment.',
  sourcePath: 'lib/cfo/decisionSupport/loanDecisionSupport.ts',
  floatExecute: ({ principal, annualRate, months }) =>
    monthlyPaymentFloat(principal, annualRate, months),
  decimalExecute: ({ principal, annualRate, months }) =>
    calculateMonthlyPaymentDecimal(principal, annualRate, months),
  fieldPolicy: {},
  fixtures: [
    {
      name: '$500k @ 6.5% / 300 mo',
      description: 'Standard PI repayment.',
      input: { principal: 500_000, annualRate: 0.065, months: 300 },
    },
    {
      name: '$1m @ 5.5% / 360 mo',
      description: '30-year residential mortgage.',
      input: { principal: 1_000_000, annualRate: 0.055, months: 360 },
    },
    {
      name: 'zero rate → straight-line',
      description: 'Degenerate case.',
      input: { principal: 600_000, annualRate: 0, months: 300 },
    },
    {
      name: 'zero months → 0',
      description: 'Degenerate case (different from PR 2.E.1 PI primitive).',
      input: { principal: 600_000, annualRate: 0.065, months: 0 },
    },
    {
      name: '$50k @ 12% / 60 mo personal loan',
      description: 'High rate, short term.',
      input: { principal: 50_000, annualRate: 0.12, months: 60 },
    },
  ],
};

interface PayoffFixture {
  principal: number;
  annualRate: number;
  monthlyPayment: number;
}

export const payoffMonthsShadow: ShadowEngine<PayoffFixture, number, number> = {
  name: 'cfo.loanDecisionSupport.calculatePayoffMonths.shadow',
  description: 'Shadow Float vs Decimal months-to-payoff (logarithm bridge — see jsdoc).',
  sourcePath: 'lib/cfo/decisionSupport/loanDecisionSupport.ts',
  floatExecute: ({ principal, annualRate, monthlyPayment }) =>
    payoffMonthsFloat(principal, annualRate, monthlyPayment),
  decimalExecute: ({ principal, annualRate, monthlyPayment }) =>
    calculatePayoffMonthsDecimal(principal, annualRate, monthlyPayment),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'standard residential — converges within 600 cap',
      description: '$500k @ 6.5%, $3,400/mo P&I.',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 3_400 },
    },
    {
      name: 'aggressive paydown',
      description: '$500k @ 6.5%, $5,000/mo (well above min).',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 5_000 },
    },
    {
      name: 'payment ≤ interest → 999',
      description: 'Interest exceeds payment, loan never pays off.',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 2_700 },
    },
    {
      name: 'zero payment → 999',
      description: 'Degenerate case.',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 0 },
    },
  ],
};

interface InterestFixture {
  principal: number;
  annualRate: number;
  monthlyPayment: number;
  months: number;
}

export const totalInterestShadow: ShadowEngine<InterestFixture, number, Decimal> = {
  name: 'cfo.loanDecisionSupport.calculateTotalInterest.shadow',
  description: 'Shadow Float vs Decimal total interest over a fixed term.',
  sourcePath: 'lib/cfo/decisionSupport/loanDecisionSupport.ts',
  floatExecute: ({ principal, annualRate, monthlyPayment, months }) =>
    totalInterestFloat(principal, annualRate, monthlyPayment, months),
  decimalExecute: ({ principal, annualRate, monthlyPayment, months }) =>
    calculateTotalInterestDecimal(principal, annualRate, monthlyPayment, months),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'standard 30-yr term',
      description: '$500k principal, $3,400/mo × 360 mo.',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 3_400, months: 360 },
    },
    {
      name: 'no interest paid — payments < principal floor',
      description: 'Payments × months < principal → floored at 0.',
      input: { principal: 500_000, annualRate: 0.065, monthlyPayment: 1_000, months: 100 },
    },
    {
      name: 'short-term high-rate',
      description: '$50k @ 12% personal loan.',
      input: { principal: 50_000, annualRate: 0.12, monthlyPayment: 1_112, months: 60 },
    },
  ],
};

// ---------------------------------------------------------------------------
// investmentDecisionSupport — dividend yield + concentration
// ---------------------------------------------------------------------------

function dividendYieldFloat(
  holdings: InvestmentHoldingDecimalInput[],
  totalValue: number,
): number {
  if (totalValue === 0) return 0;
  const frankedValue = holdings
    .filter((h) => h.frankingPercentage !== null && h.frankingPercentage !== undefined && h.frankingPercentage > 0)
    .reduce((sum, h) => sum + Number(h.currentValue), 0);
  const estimatedDividends = frankedValue * 0.04 + (totalValue - frankedValue) * 0.02;
  return (estimatedDividends / totalValue) * 100;
}

function maxConcentrationFloat(
  holdings: InvestmentHoldingDecimalInput[],
  totalValue: number,
): number {
  if (totalValue === 0 || holdings.length === 0) return 0;
  let maxPct = 0;
  for (const h of holdings) {
    const pct = (Number(h.currentValue) / totalValue) * 100;
    if (pct > maxPct) maxPct = pct;
  }
  return maxPct;
}

interface YieldFixture {
  holdings: InvestmentHoldingDecimalInput[];
  totalValue: number;
}

export const dividendYieldShadow: ShadowEngine<YieldFixture, number, Decimal> = {
  name: 'cfo.investmentDecisionSupport.calculateDividendYield.shadow',
  description: 'Shadow Float vs Decimal dividend yield estimator (franked @ 4%, unfranked @ 2%).',
  sourcePath: 'lib/cfo/decisionSupport/investmentDecisionSupport.ts',
  floatExecute: ({ holdings, totalValue }) => dividendYieldFloat(holdings, totalValue),
  decimalExecute: ({ holdings, totalValue }) => calculateDividendYieldDecimal(holdings, totalValue),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'all unfranked → 2%',
      description: 'No franking → 2% blended rate.',
      input: {
        holdings: [
          { currentValue: 50_000, frankingPercentage: 0 },
          { currentValue: 50_000, frankingPercentage: null },
        ],
        totalValue: 100_000,
      },
    },
    {
      name: 'all franked → 4%',
      description: 'Full franking on full portfolio.',
      input: {
        holdings: [
          { currentValue: 50_000, frankingPercentage: 100 },
          { currentValue: 50_000, frankingPercentage: 70 },
        ],
        totalValue: 100_000,
      },
    },
    {
      name: 'mixed franking',
      description: 'Half franked, half not → blended yield.',
      input: {
        holdings: [
          { currentValue: 60_000, frankingPercentage: 100 },
          { currentValue: 40_000, frankingPercentage: null },
        ],
        totalValue: 100_000,
      },
    },
    {
      name: 'zero total value → 0',
      description: 'Divide-by-zero guard.',
      input: { holdings: [], totalValue: 0 },
    },
  ],
};

interface ConcentrationFixture {
  holdings: InvestmentHoldingDecimalInput[];
  totalValue: number;
}

export const maxConcentrationShadow: ShadowEngine<ConcentrationFixture, number, Decimal> = {
  name: 'cfo.investmentDecisionSupport.calculateMaxConcentration.shadow',
  description: 'Shadow Float vs Decimal max single-holding concentration (% of portfolio).',
  sourcePath: 'lib/cfo/decisionSupport/investmentDecisionSupport.ts',
  floatExecute: ({ holdings, totalValue }) => maxConcentrationFloat(holdings, totalValue),
  decimalExecute: ({ holdings, totalValue }) =>
    calculateMaxConcentrationDecimal(holdings, totalValue),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'balanced 4-stock portfolio → 25%',
      description: 'Equal weights.',
      input: {
        holdings: [
          { currentValue: 25_000, frankingPercentage: null },
          { currentValue: 25_000, frankingPercentage: null },
          { currentValue: 25_000, frankingPercentage: null },
          { currentValue: 25_000, frankingPercentage: null },
        ],
        totalValue: 100_000,
      },
    },
    {
      name: 'concentrated 60% in one',
      description: 'One holding dominates.',
      input: {
        holdings: [
          { currentValue: 60_000, frankingPercentage: null },
          { currentValue: 30_000, frankingPercentage: null },
          { currentValue: 10_000, frankingPercentage: null },
        ],
        totalValue: 100_000,
      },
    },
    {
      name: 'empty portfolio',
      description: 'No holdings → 0.',
      input: { holdings: [], totalValue: 0 },
    },
  ],
};

// ---------------------------------------------------------------------------
// taxIntegration — unrealised CGT + negative gearing benefit
// ---------------------------------------------------------------------------

function unrealisedCGTFloat(holdings: CgtHoldingDecimalInput[]): number {
  let totalUnrealisedGains = 0;
  for (const holding of holdings) {
    const units = Number(holding.units);
    const avg = Number(holding.averagePrice);
    const cur = Number(holding.currentPrice ?? avg);
    const currentValue = units * cur;
    const costBase = units * avg;
    const gain = currentValue - costBase;
    if (gain > 0) totalUnrealisedGains += gain * 0.5;
  }
  return totalUnrealisedGains;
}

function negativeGearingBenefitFloat(
  properties: NegativeGearingPropertyDecimalInput[],
  marginalRate: number,
): number {
  let total = 0;
  for (const property of properties) {
    if (property.type !== 'INVESTMENT') continue;
    const annualIncome = property.income.reduce(
      (sum, i) => sum + toAnnual(Number(i.amount), i.frequency as Frequency),
      0,
    );
    const annualExpenses = property.expenses.reduce(
      (sum, e) => sum + toAnnual(Number(e.amount), e.frequency as Frequency),
      0,
    );
    const annualLoanInterest = property.loans.reduce(
      (sum, l) => sum + Number(l.principal) * Number(l.interestRateAnnual ?? 0),
      0,
    );
    const netPropertyIncome = annualIncome - annualExpenses - annualLoanInterest;
    if (netPropertyIncome < 0) {
      total += Math.abs(netPropertyIncome) * (marginalRate / 100);
    }
  }
  return total;
}

export const unrealisedCGTShadow: ShadowEngine<
  { holdings: CgtHoldingDecimalInput[] },
  number,
  Decimal
> = {
  name: 'cfo.taxIntegration.calculateUnrealisedCGT.shadow',
  description: 'Shadow Float vs Decimal unrealised-CGT-discountable gain.',
  sourcePath: 'lib/cfo/decisionSupport/taxIntegration.ts',
  floatExecute: ({ holdings }) => unrealisedCGTFloat(holdings),
  decimalExecute: ({ holdings }) => calculateUnrealisedCGTDecimal(holdings),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty holdings → 0',
      description: 'Baseline.',
      input: { holdings: [] },
    },
    {
      name: 'single gain @ 50% discount',
      description: '100 units @ $50 avg, $80 current → $3,000 gain → $1,500 discountable.',
      input: {
        holdings: [{ units: 100, averagePrice: 50, currentPrice: 80 }],
      },
    },
    {
      name: 'loss excluded from total',
      description: 'Losses do not contribute.',
      input: {
        holdings: [
          { units: 100, averagePrice: 50, currentPrice: 80 }, // +$3000 → +$1500
          { units: 50, averagePrice: 100, currentPrice: 70 }, // -$1500 → excluded
        ],
      },
    },
    {
      name: 'currentPrice null falls back to avg → 0 gain',
      description: 'Without market price, gain = 0.',
      input: {
        holdings: [{ units: 100, averagePrice: 50, currentPrice: null }],
      },
    },
  ],
};

interface NegativeGearingFixture {
  properties: NegativeGearingPropertyDecimalInput[];
  marginalRate: number;
}

export const negativeGearingBenefitShadow: ShadowEngine<
  NegativeGearingFixture,
  number,
  Decimal
> = {
  name: 'cfo.taxIntegration.calculateNegativeGearingBenefit.shadow',
  description: 'Shadow Float vs Decimal negative-gearing benefit aggregation.',
  sourcePath: 'lib/cfo/decisionSupport/taxIntegration.ts',
  floatExecute: ({ properties, marginalRate }) =>
    negativeGearingBenefitFloat(properties, marginalRate),
  decimalExecute: ({ properties, marginalRate }) =>
    calculateNegativeGearingBenefitDecimal(properties, marginalRate),
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty properties → 0',
      description: 'Baseline.',
      input: { properties: [], marginalRate: 37 },
    },
    {
      name: 'OO property excluded',
      description: 'Only INVESTMENT properties contribute.',
      input: {
        properties: [
          {
            type: 'OWNER_OCCUPIED',
            income: [],
            expenses: [{ amount: 1_000, frequency: 'MONTHLY' }],
            loans: [{ principal: 500_000, interestRateAnnual: 0.065 }],
          },
        ],
        marginalRate: 37,
      },
    },
    {
      name: 'negative-geared IP at 37%',
      description: 'Rental short of costs → tax deduction at marginal rate.',
      input: {
        properties: [
          {
            type: 'INVESTMENT',
            income: [{ amount: 2_000, frequency: 'MONTHLY' }],
            expenses: [{ amount: 800, frequency: 'MONTHLY' }],
            loans: [{ principal: 400_000, interestRateAnnual: 0.06 }],
          },
        ],
        marginalRate: 37,
      },
    },
    {
      name: 'positively-geared IP → 0 benefit',
      description: 'Net positive income → no negative-gearing benefit.',
      input: {
        properties: [
          {
            type: 'INVESTMENT',
            income: [{ amount: 3_000, frequency: 'MONTHLY' }],
            expenses: [{ amount: 500, frequency: 'MONTHLY' }],
            loans: [{ principal: 200_000, interestRateAnnual: 0.05 }],
          },
        ],
        marginalRate: 45,
      },
    },
    {
      name: 'multi-IP portfolio at 45%',
      description: 'Mixed pos+neg IPs, top marginal rate.',
      input: {
        properties: [
          {
            type: 'INVESTMENT',
            income: [{ amount: 2_500, frequency: 'MONTHLY' }],
            expenses: [{ amount: 1_000, frequency: 'MONTHLY' }],
            loans: [{ principal: 500_000, interestRateAnnual: 0.065 }],
          },
          {
            type: 'INVESTMENT',
            income: [{ amount: 3_000, frequency: 'MONTHLY' }],
            expenses: [{ amount: 600, frequency: 'MONTHLY' }],
            loans: [{ principal: 200_000, interestRateAnnual: 0.05 }],
          },
        ],
        marginalRate: 45,
      },
    },
  ],
};

export const cfoDecisionSupportShadowEngines = [
  propertyPortfolioSummaryShadow,
  monthlyPaymentShadow,
  payoffMonthsShadow,
  totalInterestShadow,
  dividendYieldShadow,
  maxConcentrationShadow,
  unrealisedCGTShadow,
  negativeGearingBenefitShadow,
] as const;
