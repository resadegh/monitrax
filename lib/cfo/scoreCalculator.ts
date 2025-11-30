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

// ============================================================================
// Score Weights
// ============================================================================

const SCORE_WEIGHTS = {
  cashflowStrength: 0.25,      // 25%
  debtCoverage: 0.20,          // 20%
  emergencyBuffer: 0.15,       // 15%
  investmentDiversification: 0.15, // 15%
  spendingControl: 0.15,       // 15%
  savingsRate: 0.10,           // 10%
};

// ============================================================================
// Score Calculation
// ============================================================================

export async function calculateCFOScore(userId: string): Promise<CFOScore> {
  // Fetch all required data
  const [
    accounts,
    loans,
    incomes,
    expenses,
    investments,
    properties,
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investmentAccount.findMany({
      where: { userId },
      include: { holdings: true },
    }),
    prisma.property.findMany({ where: { userId } }),
  ]);

  // Calculate component scores
  const components = calculateComponents(
    accounts,
    loans,
    incomes,
    expenses,
    investments,
    properties
  );

  // Calculate weighted overall score
  const overall = Math.round(
    components.cashflowStrength * SCORE_WEIGHTS.cashflowStrength +
    components.debtCoverage * SCORE_WEIGHTS.debtCoverage +
    components.emergencyBuffer * SCORE_WEIGHTS.emergencyBuffer +
    components.investmentDiversification * SCORE_WEIGHTS.investmentDiversification +
    components.spendingControl * SCORE_WEIGHTS.spendingControl +
    components.savingsRate * SCORE_WEIGHTS.savingsRate
  );

  // Get trend from history
  const trend = await calculateTrend(userId, overall);

  return {
    overall,
    components,
    trend,
    lastCalculated: new Date(),
    grade: getGrade(overall),
  };
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
  repaymentFrequency: string;
}

interface IncomeData {
  id: string;
  amount: number;
  frequency: string;
}

interface ExpenseData {
  id: string;
  amount: number;
  frequency: string;
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
    cashflowStrength: calculateCashflowStrength(incomes, expenses, loans),
    debtCoverage: calculateDebtCoverage(incomes, loans),
    emergencyBuffer: calculateEmergencyBuffer(accounts, expenses),
    investmentDiversification: calculateInvestmentDiversification(investments, properties),
    spendingControl: calculateSpendingControl(incomes, expenses),
    savingsRate: calculateSavingsRate(incomes, expenses),
  };
}

function annualize(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY': return amount * 52;
    case 'FORTNIGHTLY': return amount * 26;
    case 'MONTHLY': return amount * 12;
    case 'QUARTERLY': return amount * 4;
    case 'ANNUAL': return amount;
    default: return amount * 12;
  }
}

function monthlyize(amount: number, frequency: string): number {
  return annualize(amount, frequency) / 12;
}

/**
 * Cashflow Strength (0-100)
 * Measures net cashflow relative to income
 */
function calculateCashflowStrength(
  incomes: IncomeData[],
  expenses: ExpenseData[],
  loans: LoanData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);
  const monthlyLoanPayments = loans.reduce((sum, l) => sum + monthlyize(l.minRepayment, l.repaymentFrequency), 0);

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
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);
  const monthlyPayments = loans.reduce((sum, l) => sum + monthlyize(l.minRepayment, l.repaymentFrequency), 0);

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
  expenses: ExpenseData[]
): number {
  const liquidBalances = accounts
    .filter(a => ['SAVINGS', 'TRANSACTIONAL', 'OFFSET'].includes(a.type))
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const monthlyEssentialExpenses = expenses
    .filter(e => e.isEssential)
    .reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

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
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyDiscretionary = expenses
    .filter(e => !e.isEssential)
    .reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

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
 * Measures percentage of income being saved
 */
function calculateSavingsRate(
  incomes: IncomeData[],
  expenses: ExpenseData[]
): number {
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);

  if (monthlyIncome === 0) return 0;

  const savingsRate = (monthlyIncome - monthlyExpenses) / monthlyIncome;

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

// ============================================================================
// Trend & Grade Helpers
// ============================================================================

async function calculateTrend(
  userId: string,
  currentScore: number
): Promise<'improving' | 'stable' | 'declining'> {
  // For now, return stable - in production, compare against historical scores
  // This would query a CFOScoreHistory table
  return 'stable';
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

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
