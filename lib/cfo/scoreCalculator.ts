/**
 * Phase 17: CFO Score Calculator
 * Calculates the comprehensive CFO Score (0-100) based on multiple financial dimensions
 */

import { prisma } from '@/lib/db';
import {
  CFOScore,
  CFOScoreComponents,
  CFOScoreHistory,
} from './types';
import { toAnnual, toMonthly, toMonthlyDecimal } from '@/lib/utils/frequencies';
import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';
import { computeLiquidCash, computeLiquidCashDecimal } from '@/lib/calculations/liquidCash';
import {
  calculateTotalLiabilities,
  calculateTotalLiabilitiesDecimal,
} from '@/lib/calculations/netWorthCalculator';

// ============================================================================
// Score Weights
// ============================================================================

// MON-030 stage 2b: `SCORE_WEIGHTS` deleted — the weighting of the former competing
// CFO overall score. The displayed score is the ONE canonical health score
// (generateHealthReport); these 6 components are now advisor action-signals with
// no weighted roll-up.

// ============================================================================
// Component Calculation (advisor action-signals — MON-030 stage 2b)
// ============================================================================

/**
 * MON-030 stage 2b: the 6 CFO component sub-scores — the advisor's granular
 * ACTION SIGNALS (each maps to a concrete improvement recommendation via
 * `generateActions` → `findWeakAreas`). These are NOT a "score": the displayed
 * health score is the ONE canonical `generateHealthReport` value (My Guide ==
 * Home). The former `calculateCFOScore` overall/grade — a competing weighted
 * score — was DELETED here (dead once the display de-duped in stage 2a); this
 * function keeps only the granular signals, which are more actionable than the
 * coarser 7 health categories (Reza-approved reframe 2026-07-13).
 */
export async function computeCFOComponents(userId: string): Promise<CFOScoreComponents> {
  const [accounts, loans, incomes, expenses, investments, properties] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investmentAccount.findMany({ where: { userId }, include: { holdings: true } }),
    prisma.property.findMany({ where: { userId } }),
  ]);

  return calculateComponents(accounts, loans, incomes, expenses, investments, properties);
}

// ============================================================================
// Component Calculations
// ============================================================================

interface AccountData {
  id: string;
  currentBalance: number;
  type: string;
}

interface LoanData {
  id: string;
  principal: number;
  interestRateAnnual: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  /** MON-031/064: needed to classify CREDIT_CARD loans into revolving credit. */
  type?: string;
}

interface IncomeData {
  id: string;
  amount: number;
  frequency: Frequency;
}

interface ExpenseData {
  id: string;
  amount: number;
  frequency: Frequency;
  isEssential: boolean;
}

interface InvestmentData {
  id: string;
  holdings: { units: number; averagePrice: number; type: string }[];
}

interface PropertyData {
  id: string;
  currentValue: number;
  type: string;
}

function calculateComponents(
  accounts: AccountData[],
  loans: LoanData[],
  incomes: IncomeData[],
  expenses: ExpenseData[],
  investments: InvestmentData[],
  properties: PropertyData[]
): CFOScoreComponents {
  return {
    cashflowStrength: Math.round(calculateCashflowStrength(incomes, expenses, loans)),
    debtCoverage: Math.round(calculateDebtCoverage(incomes, loans)),
    emergencyBuffer: Math.round(calculateEmergencyBuffer(accounts, expenses, loans)),
    investmentDiversification: Math.round(calculateInvestmentDiversification(investments, properties)),
    spendingControl: Math.round(calculateSpendingControl(incomes, expenses)),
    savingsRate: Math.round(calculateSavingsRate(incomes, expenses, loans)),
  };
}

// Use centralized frequency utilities from lib/utils/frequencies.ts

/**
 * Cashflow Strength (0-100)
 * Measures net cashflow relative to income
 */
function calculateCashflowStrength(
  incomes: IncomeData[],
  expenses: ExpenseData[],
  loans: LoanData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlyLoanPayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);

  if (monthlyIncome === 0) return 0;

  const netCashflow = monthlyIncome - monthlyExpenses - monthlyLoanPayments;
  const cashflowRatio = netCashflow / monthlyIncome;

  // Score based on cashflow ratio
  // >= 30% surplus = 100
  // 20% surplus = 85
  // 10% surplus = 70
  // 0% (break even) = 50
  // -10% = 30
  // -20% or worse = 0
  if (cashflowRatio >= 0.3) return 100;
  if (cashflowRatio >= 0.2) return 85 + (cashflowRatio - 0.2) * 150;
  if (cashflowRatio >= 0.1) return 70 + (cashflowRatio - 0.1) * 150;
  if (cashflowRatio >= 0) return 50 + cashflowRatio * 200;
  if (cashflowRatio >= -0.1) return 30 + (cashflowRatio + 0.1) * 200;
  if (cashflowRatio >= -0.2) return 10 + (cashflowRatio + 0.2) * 200;
  return 0;
}

/**
 * Debt Coverage (0-100)
 * Measures ability to service debt from income
 */
function calculateDebtCoverage(
  incomes: IncomeData[],
  loans: LoanData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);
  const monthlyPayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);

  if (monthlyIncome === 0) return totalDebt === 0 ? 100 : 0;

  // Debt Service Ratio (DSR)
  const dsr = monthlyPayments / monthlyIncome;

  // Score based on DSR
  // <= 20% = 100 (excellent)
  // 30% = 80
  // 40% = 60 (standard max for lenders)
  // 50% = 40
  // >= 60% = 0 (dangerous)
  if (dsr <= 0.2) return 100;
  if (dsr <= 0.3) return 80 + (0.3 - dsr) * 200;
  if (dsr <= 0.4) return 60 + (0.4 - dsr) * 200;
  if (dsr <= 0.5) return 40 + (0.5 - dsr) * 200;
  if (dsr <= 0.6) return 20 + (0.6 - dsr) * 200;
  return 0;
}

/**
 * Emergency Buffer (0-100)
 * Measures months of expenses covered by liquid savings
 */
function calculateEmergencyBuffer(
  accounts: AccountData[],
  expenses: ExpenseData[],
  loans: LoanData[] = []
): number {
  // MON-031/064 (VR-017 re-fix): the ONE canonical deployable liquid cash —
  // spendable-account balances NET of revolving credit in BOTH representations
  // (CREDIT_CARD loans + negative-balance CREDIT_CARD accounts). Same producer
  // as quickMetrics.liquidCash; no local gross re-sum (§12.2.1).
  const liquidBalances = computeLiquidCash(
    accounts,
    calculateTotalLiabilities(loans).creditCards,
  ).net;

  const monthlyEssentialExpenses = expenses
    .filter(e => e.isEssential)
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);

  if (monthlyEssentialExpenses === 0) return liquidBalances > 0 ? 100 : 50;

  const monthsCovered = liquidBalances / monthlyEssentialExpenses;

  // Score based on months covered
  // >= 6 months = 100
  // 3 months = 75
  // 1 month = 40
  // 0 months = 0
  if (monthsCovered >= 6) return 100;
  if (monthsCovered >= 3) return 75 + (monthsCovered - 3) * (25 / 3);
  if (monthsCovered >= 1) return 40 + (monthsCovered - 1) * (35 / 2);
  return monthsCovered * 40;
}

/**
 * Investment Diversification (0-100)
 * Measures diversification across asset classes
 */
function calculateInvestmentDiversification(
  investments: InvestmentData[],
  properties: PropertyData[]
): number {
  // Count asset classes
  const holdingTypes = new Set<string>();
  let hasEquities = false;
  let hasBonds = false;
  let hasProperty = properties.length > 0;
  let hasCrypto = false;
  let hasSuper = false;

  for (const account of investments) {
    for (const holding of account.holdings) {
      holdingTypes.add(holding.type);
      if (['SHARE', 'ETF'].includes(holding.type)) hasEquities = true;
      if (holding.type === 'MANAGED_FUND') hasBonds = true; // Approximation
      if (holding.type === 'CRYPTO') hasCrypto = true;
    }
  }

  // Calculate total value by class
  let equityValue = 0;
  let otherValue = 0;
  const propertyValue = properties.reduce((sum, p) => sum + p.currentValue, 0);

  for (const account of investments) {
    for (const holding of account.holdings) {
      const value = holding.units * holding.averagePrice;
      if (['SHARE', 'ETF'].includes(holding.type)) {
        equityValue += value;
      } else {
        otherValue += value;
      }
    }
  }

  const totalValue = equityValue + otherValue + propertyValue;
  if (totalValue === 0) return 50; // No investments = neutral

  // Diversification score factors:
  // 1. Number of asset classes (max 40 points)
  // 2. Balance between classes (max 40 points)
  // 3. No single class > 80% (max 20 points)

  const assetClassCount = [hasEquities, hasBonds, hasProperty, hasCrypto].filter(Boolean).length;
  const classScore = Math.min(40, assetClassCount * 10);

  // Balance score - penalize concentration
  const concentrations = [
    equityValue / totalValue,
    otherValue / totalValue,
    propertyValue / totalValue,
  ].filter(c => c > 0);

  const maxConcentration = Math.max(...concentrations, 0);
  const balanceScore = maxConcentration > 0.8 ? 0 : maxConcentration > 0.6 ? 20 : 40;

  const concentrationPenalty = maxConcentration > 0.8 ? 0 : 20;

  return Math.min(100, classScore + balanceScore + concentrationPenalty);
}

/**
 * Spending Control (0-100)
 * Measures discretionary spending vs income
 */
function calculateSpendingControl(
  incomes: IncomeData[],
  expenses: ExpenseData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyDiscretionary = expenses
    .filter(e => !e.isEssential)
    .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);

  if (monthlyIncome === 0) return monthlyDiscretionary === 0 ? 100 : 0;

  const discretionaryRatio = monthlyDiscretionary / monthlyIncome;

  // Score based on discretionary spending ratio
  // <= 10% = 100
  // 20% = 80
  // 30% = 60
  // 40% = 40
  // >= 50% = 20
  if (discretionaryRatio <= 0.1) return 100;
  if (discretionaryRatio <= 0.2) return 80 + (0.2 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.3) return 60 + (0.3 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.4) return 40 + (0.4 - discretionaryRatio) * 200;
  if (discretionaryRatio <= 0.5) return 20 + (0.5 - discretionaryRatio) * 200;
  return Math.max(0, 20 - (discretionaryRatio - 0.5) * 40);
}

/**
 * Savings Rate (0-100)
 * Measures percentage of income being saved after expenses AND loan repayments
 * Formula: (Income - Expenses - Loan Repayments) / Income
 */
function calculateSavingsRate(
  incomes: IncomeData[],
  expenses: ExpenseData[],
  loans: LoanData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  const monthlyLoanRepayments = loans.reduce(
    (sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency),
    0
  );

  if (monthlyIncome === 0) return 0;

  // Savings Rate = (Income - Expenses - Loan Repayments) / Income
  const savingsRate = (monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome;

  // Score based on savings rate
  // >= 30% = 100
  // 20% = 80
  // 10% = 60
  // 5% = 40
  // 0% = 20
  // negative = 0
  if (savingsRate >= 0.3) return 100;
  if (savingsRate >= 0.2) return 80 + (savingsRate - 0.2) * 200;
  if (savingsRate >= 0.1) return 60 + (savingsRate - 0.1) * 200;
  if (savingsRate >= 0.05) return 40 + (savingsRate - 0.05) * 400;
  if (savingsRate >= 0) return 20 + savingsRate * 400;
  return 0;
}

// MON-030 stage 2b: `calculateTrend` + `getGrade` deleted — they only served the
// former `calculateCFOScore` overall/grade (a competing displayed score, removed
// when the display de-duped onto the canonical health score in stage 2a).

// ============================================================================
// Score History
// ============================================================================

export async function getCFOScoreHistory(
  userId: string,
  days: number = 30
): Promise<CFOScoreHistory[]> {
  // In production, this would fetch from a CFOScoreHistory table
  // For now, return empty array
  return [];
}

export async function saveCFOScore(
  userId: string,
  score: CFOScore
): Promise<void> {
  // In production, this would save to a CFOScoreHistory table
  // For now, no-op
}

// ============================================================================
// Q-DEC PR 2.E.2 — Decimal sibling pure-math functions
// ============================================================================

/**
 * Decimal-typed mirror of `CFOScoreComponents`. Component sub-scores
 * are computed in Decimal first; the public `CFOScore.components` rounds
 * to integer 0-100 at the API boundary. Decimal consumers (intelligence
 * engine, PR 2.E.4) read these without the boundary rounding.
 */
export interface CFOScoreComponentsDecimal {
  cashflowStrength: Decimal;
  debtCoverage: Decimal;
  emergencyBuffer: Decimal;
  investmentDiversification: Decimal;
  spendingControl: Decimal;
  savingsRate: Decimal;
}

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const ONE = new Decimal(1);

function sumMonthlyDecimal<T extends { amount: number; frequency: Frequency | RepaymentFrequency | string }>(
  items: T[],
  amountKey: keyof T,
  freqKey: keyof T,
): Decimal {
  return items.reduce((acc, item) => {
    const amount = item[amountKey] as unknown as number;
    const freq = item[freqKey] as unknown as Frequency;
    return acc.plus(toMonthlyDecimal(amount, freq));
  }, ZERO);
}

/**
 * Decimal sibling of `calculateCashflowStrength`. Same step-function with
 * linear interpolation between thresholds; preserves the divide-by-zero
 * floor (`monthlyIncome === 0 → 0`).
 */
export function calculateCashflowStrengthDecimal(
  incomes: IncomeData[],
  expenses: ExpenseData[],
  loans: LoanData[],
): Decimal {
  const monthlyIncome = incomes.reduce(
    (acc, i) => acc.plus(toMonthlyDecimal(i.amount, i.frequency)),
    ZERO,
  );
  const monthlyExpenses = expenses.reduce(
    (acc, e) => acc.plus(toMonthlyDecimal(e.amount, e.frequency)),
    ZERO,
  );
  const monthlyLoanPayments = loans.reduce(
    (acc, l) => acc.plus(toMonthlyDecimal(l.minRepayment, l.repaymentFrequency)),
    ZERO,
  );

  if (monthlyIncome.isZero()) return ZERO;

  const netCashflow = monthlyIncome.minus(monthlyExpenses).minus(monthlyLoanPayments);
  const cashflowRatio = netCashflow.div(monthlyIncome);

  if (cashflowRatio.gte('0.3')) return HUNDRED;
  if (cashflowRatio.gte('0.2')) return new Decimal(85).plus(cashflowRatio.minus('0.2').times(150));
  if (cashflowRatio.gte('0.1')) return new Decimal(70).plus(cashflowRatio.minus('0.1').times(150));
  if (cashflowRatio.gte(0)) return new Decimal(50).plus(cashflowRatio.times(200));
  if (cashflowRatio.gte('-0.1')) return new Decimal(30).plus(cashflowRatio.plus('0.1').times(200));
  if (cashflowRatio.gte('-0.2')) return new Decimal(10).plus(cashflowRatio.plus('0.2').times(200));
  return ZERO;
}

/**
 * Decimal sibling of `calculateDebtCoverage`. DSR-based step function.
 * Preserves the `monthlyIncome === 0` branch: returns 100 when totalDebt
 * is also 0 (debt-free), else 0.
 */
export function calculateDebtCoverageDecimal(
  incomes: IncomeData[],
  loans: LoanData[],
): Decimal {
  const monthlyIncome = incomes.reduce(
    (acc, i) => acc.plus(toMonthlyDecimal(i.amount, i.frequency)),
    ZERO,
  );
  const totalDebt = loans.reduce((acc, l) => acc.plus(toDecimal(l.principal) ?? ZERO), ZERO);
  const monthlyPayments = loans.reduce(
    (acc, l) => acc.plus(toMonthlyDecimal(l.minRepayment, l.repaymentFrequency)),
    ZERO,
  );

  if (monthlyIncome.isZero()) return totalDebt.isZero() ? HUNDRED : ZERO;

  const dsr = monthlyPayments.div(monthlyIncome);

  if (dsr.lte('0.2')) return HUNDRED;
  if (dsr.lte('0.3')) return new Decimal(80).plus(new Decimal('0.3').minus(dsr).times(200));
  if (dsr.lte('0.4')) return new Decimal(60).plus(new Decimal('0.4').minus(dsr).times(200));
  if (dsr.lte('0.5')) return new Decimal(40).plus(new Decimal('0.5').minus(dsr).times(200));
  if (dsr.lte('0.6')) return new Decimal(20).plus(new Decimal('0.6').minus(dsr).times(200));
  return ZERO;
}

/**
 * Decimal sibling of `calculateEmergencyBuffer`. Months-covered step
 * function. Same divide-by-zero special-case:
 *   monthlyEssentialExpenses === 0 →
 *     liquidBalances > 0 ? 100 : 50.
 */
export function calculateEmergencyBufferDecimal(
  accounts: AccountData[],
  expenses: ExpenseData[],
  loans: LoanData[] = [],
): Decimal {
  // MON-031/064 (VR-017 re-fix): same canonical deployable-liquid producer as
  // the Float path — net of revolving credit in both card representations.
  const liquidBalances = computeLiquidCashDecimal(
    accounts,
    calculateTotalLiabilitiesDecimal(loans).creditCards,
  ).net;

  const monthlyEssentialExpenses = expenses
    .filter((e) => e.isEssential)
    .reduce((acc, e) => acc.plus(toMonthlyDecimal(e.amount, e.frequency)), ZERO);

  if (monthlyEssentialExpenses.isZero()) {
    return liquidBalances.gt(0) ? HUNDRED : new Decimal(50);
  }

  const monthsCovered = liquidBalances.div(monthlyEssentialExpenses);

  if (monthsCovered.gte(6)) return HUNDRED;
  if (monthsCovered.gte(3)) {
    return new Decimal(75).plus(monthsCovered.minus(3).times(new Decimal(25).div(3)));
  }
  if (monthsCovered.gte(1)) {
    return new Decimal(40).plus(monthsCovered.minus(1).times(new Decimal(35).div(2)));
  }
  return monthsCovered.times(40);
}

/**
 * Decimal sibling of `calculateInvestmentDiversification`. Asset-class
 * count + balance-by-class + concentration penalty. Categorical
 * components (asset-class booleans) stay JS-native; only the monetary
 * concentrations and final score arithmetic move to Decimal.
 */
export function calculateInvestmentDiversificationDecimal(
  investments: InvestmentData[],
  properties: PropertyData[],
): Decimal {
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

  let equityValue = ZERO;
  let otherValue = ZERO;
  const propertyValue = properties.reduce(
    (acc, p) => acc.plus(toDecimal(p.currentValue) ?? ZERO),
    ZERO,
  );

  for (const account of investments) {
    for (const holding of account.holdings) {
      const units = toDecimal(holding.units) ?? ZERO;
      const price = toDecimal(holding.averagePrice) ?? ZERO;
      const value = units.times(price);
      if (['SHARE', 'ETF'].includes(holding.type)) {
        equityValue = equityValue.plus(value);
      } else {
        otherValue = otherValue.plus(value);
      }
    }
  }

  const totalValue = equityValue.plus(otherValue).plus(propertyValue);
  if (totalValue.isZero()) return new Decimal(50);

  const assetClassCount = [hasEquities, hasBonds, hasProperty, hasCrypto].filter(Boolean).length;
  const classScore = new Decimal(Math.min(40, assetClassCount * 10));

  const concentrations = [
    equityValue.div(totalValue),
    otherValue.div(totalValue),
    propertyValue.div(totalValue),
  ].filter((c) => c.gt(0));

  const maxConcentration = concentrations.length > 0
    ? concentrations.reduce((max, c) => (c.gt(max) ? c : max), ZERO)
    : ZERO;

  const balanceScore = maxConcentration.gt('0.8')
    ? ZERO
    : maxConcentration.gt('0.6')
      ? new Decimal(20)
      : new Decimal(40);
  const concentrationPenalty = maxConcentration.gt('0.8') ? ZERO : new Decimal(20);

  return Decimal.min(HUNDRED, classScore.plus(balanceScore).plus(concentrationPenalty));
}

/**
 * Decimal sibling of `calculateSpendingControl`. Discretionary ratio
 * step function. Preserves the `monthlyIncome === 0` branch:
 *   monthlyDiscretionary === 0 ? 100 : 0.
 */
export function calculateSpendingControlDecimal(
  incomes: IncomeData[],
  expenses: ExpenseData[],
): Decimal {
  const monthlyIncome = incomes.reduce(
    (acc, i) => acc.plus(toMonthlyDecimal(i.amount, i.frequency)),
    ZERO,
  );
  const monthlyDiscretionary = expenses
    .filter((e) => !e.isEssential)
    .reduce((acc, e) => acc.plus(toMonthlyDecimal(e.amount, e.frequency)), ZERO);

  if (monthlyIncome.isZero()) return monthlyDiscretionary.isZero() ? HUNDRED : ZERO;

  const ratio = monthlyDiscretionary.div(monthlyIncome);

  if (ratio.lte('0.1')) return HUNDRED;
  if (ratio.lte('0.2')) return new Decimal(80).plus(new Decimal('0.2').minus(ratio).times(200));
  if (ratio.lte('0.3')) return new Decimal(60).plus(new Decimal('0.3').minus(ratio).times(200));
  if (ratio.lte('0.4')) return new Decimal(40).plus(new Decimal('0.4').minus(ratio).times(200));
  if (ratio.lte('0.5')) return new Decimal(20).plus(new Decimal('0.5').minus(ratio).times(200));
  // Beyond 0.5 — falls off linearly, floored at 0.
  return Decimal.max(ZERO, new Decimal(20).minus(ratio.minus('0.5').times(40)));
}

/**
 * Decimal sibling of `calculateSavingsRate`. Savings rate after expenses
 * AND loan repayments. Preserves the `monthlyIncome === 0 → 0` floor
 * and the negative-savings-rate → 0 floor.
 */
export function calculateSavingsRateDecimal(
  incomes: IncomeData[],
  expenses: ExpenseData[],
  loans: LoanData[],
): Decimal {
  const monthlyIncome = incomes.reduce(
    (acc, i) => acc.plus(toMonthlyDecimal(i.amount, i.frequency)),
    ZERO,
  );
  const monthlyExpenses = expenses.reduce(
    (acc, e) => acc.plus(toMonthlyDecimal(e.amount, e.frequency)),
    ZERO,
  );
  const monthlyLoanRepayments = loans.reduce(
    (acc, l) => acc.plus(toMonthlyDecimal(l.minRepayment, l.repaymentFrequency)),
    ZERO,
  );

  if (monthlyIncome.isZero()) return ZERO;

  const savingsRate = monthlyIncome
    .minus(monthlyExpenses)
    .minus(monthlyLoanRepayments)
    .div(monthlyIncome);

  if (savingsRate.gte('0.3')) return HUNDRED;
  if (savingsRate.gte('0.2')) return new Decimal(80).plus(savingsRate.minus('0.2').times(200));
  if (savingsRate.gte('0.1')) return new Decimal(60).plus(savingsRate.minus('0.1').times(200));
  if (savingsRate.gte('0.05')) return new Decimal(40).plus(savingsRate.minus('0.05').times(400));
  if (savingsRate.gte(0)) return new Decimal(20).plus(savingsRate.times(400));
  return ZERO;
}

/**
 * Decimal sibling of `calculateComponents` — returns Decimal-typed
 * sub-scores (NOT pre-rounded to integer, unlike the Float path which
 * rounds at this layer). Rounding happens at the API boundary (where
 * `CFOScoreComponents` is consumed).
 */
export function calculateComponentsDecimal(
  accounts: AccountData[],
  loans: LoanData[],
  incomes: IncomeData[],
  expenses: ExpenseData[],
  investments: InvestmentData[],
  properties: PropertyData[],
): CFOScoreComponentsDecimal {
  return {
    cashflowStrength: calculateCashflowStrengthDecimal(incomes, expenses, loans),
    debtCoverage: calculateDebtCoverageDecimal(incomes, loans),
    emergencyBuffer: calculateEmergencyBufferDecimal(accounts, expenses, loans),
    investmentDiversification: calculateInvestmentDiversificationDecimal(investments, properties),
    spendingControl: calculateSpendingControlDecimal(incomes, expenses),
    savingsRate: calculateSavingsRateDecimal(incomes, expenses, loans),
  };
}

/**
 * Decimal sibling of the weighted-overall computation. Takes the
 * UN-rounded Decimal component sub-scores and produces the weighted
 * overall (also UN-rounded — callers round at the boundary).
 *
 * Note the Float path rounds each component BEFORE weighting; this
 * Decimal path weights the raw sub-scores then rounds at the API
 * boundary. For shadow comparison, the comparator rounds the Decimal
 * result to align the precision.
 */
// MON-030 stage 2b: `calculateOverallScoreDecimal` deleted — the Decimal mirror of
// the former competing overall score, dead once the display de-duped onto the
// canonical health score (stage 2a). The Decimal COMPONENT siblings above stay —
// they back the granular action-signals the advisor still uses.
