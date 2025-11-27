/**
 * FINANCIAL HEALTH ENGINE - LAYER 1: METRIC AGGREGATION
 * Phase 12 - Section 5.1
 *
 * Collects and calculates all metrics system-wide across 7 categories:
 * - Liquidity Metrics
 * - Cashflow Metrics
 * - Debt Metrics
 * - Investment Metrics
 * - Property Metrics
 * - Risk Metrics
 * - Forecast Metrics
 *
 * Each metric includes: value, benchmark, riskBand, confidence
 */

import {
  FinancialHealthInput,
  AggregatedMetrics,
  LiquidityMetrics,
  CashflowMetrics,
  DebtMetrics,
  InvestmentMetrics,
  PropertyMetrics,
  RiskMetrics,
  ForecastMetrics,
  BaseMetric,
  RiskBand,
  scoreToRiskBand,
} from './types';

// =============================================================================
// BENCHMARKS (Australian financial planning standards)
// =============================================================================

const BENCHMARKS = {
  // Liquidity
  emergencyBufferMonths: 6,           // 6 months of expenses
  savingsRatePercent: 20,             // 20% savings rate
  liquidNetWorthRatioPercent: 20,     // 20% liquid assets
  shortTermDebtRatioMax: 0.3,         // Max 30% short-term debt to income

  // Cashflow
  minMonthlySurplus: 500,             // Minimum $500/month surplus
  maxVolatilityScore: 30,             // Lower is better
  maxFixedCostRatioPercent: 60,       // Max 60% fixed costs
  minDiscretionaryPercent: 20,        // Min 20% discretionary

  // Debt
  maxLvrPercent: 80,                  // Max 80% LVR
  maxDtiRatio: 6,                     // Max 6x debt-to-income
  maxRepaymentLoadPercent: 30,        // Max 30% of income
  maxInterestRiskScore: 50,           // Lower is better

  // Investments
  minDiversificationScore: 70,        // Higher is better
  maxConcentrationPercent: 40,        // Max 40% in one asset class
  benchmarkReturnPercent: 7,          // 7% annual return benchmark
  maxCostDragPercent: 1,              // Max 1% fee drag

  // Property
  minRentalYieldPercent: 4,           // 4% gross yield
  maxVacancyRiskScore: 30,            // Lower is better

  // Risk
  minBufferMonths: 3,                 // 3 months minimum buffer
  maxVolatilityExposure: 40,          // Lower is better

  // Forecast
  retirementRunwayYears: 25,          // 25 years of retirement funding
  sustainableWithdrawalRate: 4,       // 4% rule
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a BaseMetric from calculated values
 */
function createMetric(
  value: number,
  benchmark: number,
  higherIsBetter: boolean,
  confidence: number = 80
): BaseMetric {
  // Calculate score (0-100) based on how value compares to benchmark
  let score: number;

  if (higherIsBetter) {
    // For metrics where higher is better (e.g., savings rate)
    score = Math.min(100, (value / benchmark) * 100);
  } else {
    // For metrics where lower is better (e.g., LVR)
    if (value <= 0) {
      score = 100; // No debt/risk is excellent
    } else if (benchmark <= 0) {
      score = 0;
    } else {
      score = Math.max(0, Math.min(100, ((benchmark - value) / benchmark + 1) * 50));
    }
  }

  return {
    value,
    benchmark,
    riskBand: scoreToRiskBand(score),
    confidence,
  };
}

/**
 * Calculate monthly amounts from input data
 */
function calculateMonthlyIncome(input: FinancialHealthInput): number {
  return input.portfolioSnapshot.income.reduce((sum, i) => sum + i.monthlyAmount, 0);
}

function calculateMonthlyExpenses(input: FinancialHealthInput): number {
  return input.portfolioSnapshot.expenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
}

function calculateEssentialExpenses(input: FinancialHealthInput): number {
  return input.portfolioSnapshot.expenses
    .filter(e => e.isEssential)
    .reduce((sum, e) => sum + e.monthlyAmount, 0);
}

function calculateLiquidAssets(input: FinancialHealthInput): number {
  // Liquid = Cash accounts + liquid investments (shares, ETFs)
  const cashBalance = input.portfolioSnapshot.accounts
    .filter(a => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const liquidInvestments = input.portfolioSnapshot.investments
    .filter(i => i.type === 'SHARE' || i.type === 'ETF')
    .reduce((sum, i) => sum + i.value, 0);

  return cashBalance + liquidInvestments;
}

function calculateTotalDebt(input: FinancialHealthInput): number {
  const loanDebt = input.portfolioSnapshot.loans.reduce((sum, l) => sum + l.principal, 0);
  const creditCardDebt = input.portfolioSnapshot.accounts
    .filter(a => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + Math.abs(Math.min(0, a.balance)), 0);

  return loanDebt + creditCardDebt;
}

function calculateTotalPropertyValue(input: FinancialHealthInput): number {
  return input.portfolioSnapshot.properties.reduce((sum, p) => sum + p.currentValue, 0);
}

function calculateTotalPropertyDebt(input: FinancialHealthInput): number {
  return input.portfolioSnapshot.properties.reduce((sum, p) => sum + p.debt, 0);
}

// =============================================================================
// LIQUIDITY METRICS (Section 5.1.1)
// =============================================================================

export function calculateLiquidityMetrics(input: FinancialHealthInput): LiquidityMetrics {
  const monthlyExpenses = calculateMonthlyExpenses(input);
  const monthlyIncome = calculateMonthlyIncome(input);
  const liquidAssets = calculateLiquidAssets(input);
  const netWorth = input.portfolioSnapshot.netWorth;
  const totalDebt = calculateTotalDebt(input);

  // Emergency buffer: months of expenses covered by liquid assets
  const emergencyBufferMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 12;

  // Savings rate: (income - expenses) / income * 100
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : 0;

  // Liquid net worth ratio: liquid assets / total net worth
  const liquidNetWorthRatio = netWorth > 0 ? (liquidAssets / netWorth) * 100 : 0;

  // Short-term debt ratio: credit card debt / annual income
  const creditCardDebt = input.portfolioSnapshot.accounts
    .filter(a => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + Math.abs(Math.min(0, a.balance)), 0);
  const annualIncome = monthlyIncome * 12;
  const shortTermDebtRatio = annualIncome > 0 ? creditCardDebt / annualIncome : 0;

  return {
    emergencyBuffer: createMetric(
      emergencyBufferMonths,
      BENCHMARKS.emergencyBufferMonths,
      true,
      90
    ),
    savingsRate: createMetric(
      savingsRate,
      BENCHMARKS.savingsRatePercent,
      true,
      85
    ),
    liquidNetWorthRatio: createMetric(
      liquidNetWorthRatio,
      BENCHMARKS.liquidNetWorthRatioPercent,
      true,
      80
    ),
    shortTermDebtRatio: createMetric(
      shortTermDebtRatio,
      BENCHMARKS.shortTermDebtRatioMax,
      false,
      90
    ),
  };
}

// =============================================================================
// CASHFLOW METRICS (Section 5.1.2)
// =============================================================================

export function calculateCashflowMetrics(input: FinancialHealthInput): CashflowMetrics {
  const monthlyIncome = calculateMonthlyIncome(input);
  const monthlyExpenses = calculateMonthlyExpenses(input);
  const essentialExpenses = calculateEssentialExpenses(input);

  // Monthly surplus/deficit
  const surplus = monthlyIncome - monthlyExpenses;

  // Volatility score (simplified - based on income diversity)
  // More income sources = lower volatility
  const incomeSourceCount = input.portfolioSnapshot.income.length;
  const volatilityScore = Math.max(0, 100 - (incomeSourceCount * 20));

  // Fixed cost ratio: essential expenses / income
  const fixedCostRatio = monthlyIncome > 0 ? (essentialExpenses / monthlyIncome) * 100 : 100;

  // Discretionary sensitivity: impact if discretionary is cut
  const discretionaryExpenses = monthlyExpenses - essentialExpenses;
  const discretionaryPercent = monthlyExpenses > 0
    ? (discretionaryExpenses / monthlyExpenses) * 100
    : 0;

  return {
    surplus: createMetric(
      surplus,
      BENCHMARKS.minMonthlySurplus,
      true,
      90
    ),
    volatility: createMetric(
      volatilityScore,
      BENCHMARKS.maxVolatilityScore,
      false,
      70
    ),
    fixedCostRatio: createMetric(
      fixedCostRatio,
      BENCHMARKS.maxFixedCostRatioPercent,
      false,
      85
    ),
    discretionarySensitivity: createMetric(
      discretionaryPercent,
      BENCHMARKS.minDiscretionaryPercent,
      true,
      75
    ),
  };
}

// =============================================================================
// DEBT METRICS (Section 5.1.3)
// =============================================================================

export function calculateDebtMetrics(input: FinancialHealthInput): DebtMetrics {
  const totalPropertyValue = calculateTotalPropertyValue(input);
  const totalPropertyDebt = calculateTotalPropertyDebt(input);
  const totalDebt = calculateTotalDebt(input);
  const monthlyIncome = calculateMonthlyIncome(input);
  const annualIncome = monthlyIncome * 12;

  // LVR (Loan-to-Value Ratio)
  const lvr = totalPropertyValue > 0 ? (totalPropertyDebt / totalPropertyValue) * 100 : 0;

  // DTI (Debt-to-Income Ratio)
  const dti = annualIncome > 0 ? totalDebt / annualIncome : 0;

  // Repayment load: total repayments / income
  const totalMonthlyRepayments = input.portfolioSnapshot.loans.reduce(
    (sum, l) => sum + l.monthlyRepayment,
    0
  );
  const repaymentLoad = monthlyIncome > 0 ? (totalMonthlyRepayments / monthlyIncome) * 100 : 0;

  // Interest risk exposure (simplified based on variable rate exposure)
  const variableRateLoans = input.portfolioSnapshot.loans.filter(l => !l.isInterestOnly);
  const variableDebt = variableRateLoans.reduce((sum, l) => sum + l.principal, 0);
  const interestRiskExposure = totalDebt > 0 ? (variableDebt / totalDebt) * 100 : 0;

  // Interest-only risk (IO loans as % of total)
  const ioLoans = input.portfolioSnapshot.loans.filter(l => l.isInterestOnly);
  const ioDebt = ioLoans.reduce((sum, l) => sum + l.principal, 0);
  const ioRisk = totalDebt > 0 ? (ioDebt / totalDebt) * 100 : 0;

  return {
    lvr: createMetric(lvr, BENCHMARKS.maxLvrPercent, false, 95),
    dti: createMetric(dti, BENCHMARKS.maxDtiRatio, false, 90),
    repaymentLoad: createMetric(
      repaymentLoad,
      BENCHMARKS.maxRepaymentLoadPercent,
      false,
      90
    ),
    interestRiskExposure: createMetric(
      interestRiskExposure,
      BENCHMARKS.maxInterestRiskScore,
      false,
      75
    ),
    interestOnlyRisk: createMetric(ioRisk, 30, false, 85), // Max 30% IO is acceptable
  };
}

// =============================================================================
// INVESTMENT METRICS (Section 5.1.4)
// =============================================================================

export function calculateInvestmentMetrics(input: FinancialHealthInput): InvestmentMetrics {
  const investments = input.portfolioSnapshot.investments;
  const totalInvestmentValue = investments.reduce((sum, i) => sum + i.value, 0);

  // Diversification index (based on number and spread of holdings)
  const holdingCount = investments.length;
  const uniqueTypes = new Set(investments.map(i => i.type)).size;
  const diversificationScore = Math.min(100, (holdingCount * 10) + (uniqueTypes * 20));

  // Asset class concentration (max single type percentage)
  const typeValues: Record<string, number> = {};
  investments.forEach(i => {
    typeValues[i.type] = (typeValues[i.type] || 0) + i.value;
  });
  const maxTypeValue = Math.max(0, ...Object.values(typeValues));
  const maxConcentration = totalInvestmentValue > 0
    ? (maxTypeValue / totalInvestmentValue) * 100
    : 0;

  // Performance vs benchmark (simplified - based on unrealized gains)
  const totalCostBase = investments.reduce((sum, i) => sum + i.costBase, 0);
  const unrealizedGainPercent = totalCostBase > 0
    ? ((totalInvestmentValue - totalCostBase) / totalCostBase) * 100
    : 0;

  // Cost efficiency (placeholder - would need fee data)
  const costEfficiency = 80; // Default good score

  // Risk-adjusted return (simplified)
  const riskAdjustedReturn = Math.max(0, unrealizedGainPercent * 0.7);

  return {
    diversificationIndex: createMetric(
      diversificationScore,
      BENCHMARKS.minDiversificationScore,
      true,
      70
    ),
    assetClassConcentration: createMetric(
      maxConcentration,
      BENCHMARKS.maxConcentrationPercent,
      false,
      80
    ),
    performanceVsBenchmark: createMetric(
      unrealizedGainPercent,
      BENCHMARKS.benchmarkReturnPercent,
      true,
      60
    ),
    costEfficiency: createMetric(
      costEfficiency,
      100 - BENCHMARKS.maxCostDragPercent,
      true,
      50
    ),
    riskAdjustedReturn: createMetric(riskAdjustedReturn, 5, true, 55),
  };
}

// =============================================================================
// PROPERTY METRICS (Section 5.1.5)
// =============================================================================

export function calculatePropertyMetrics(input: FinancialHealthInput): PropertyMetrics {
  const properties = input.portfolioSnapshot.properties;
  const totalPropertyValue = calculateTotalPropertyValue(input);
  const totalPropertyDebt = calculateTotalPropertyDebt(input);

  // Valuation health (equity position)
  const totalEquity = totalPropertyValue - totalPropertyDebt;
  const equityPercent = totalPropertyValue > 0
    ? (totalEquity / totalPropertyValue) * 100
    : 100;

  // LVR stability (portfolio LVR)
  const portfolioLvr = totalPropertyValue > 0
    ? (totalPropertyDebt / totalPropertyValue) * 100
    : 0;
  const lvrStabilityScore = Math.max(0, 100 - portfolioLvr);

  // Rental yield performance (investment properties only)
  const investmentProperties = properties.filter(p => p.type === 'INVESTMENT');
  const totalInvestmentValue = investmentProperties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalRentalIncome = investmentProperties.reduce((sum, p) => sum + p.monthlyIncome * 12, 0);
  const averageYield = totalInvestmentValue > 0
    ? (totalRentalIncome / totalInvestmentValue) * 100
    : 0;

  // Vacancy risk (simplified - based on property count)
  const propertyCount = properties.length;
  const vacancyRiskScore = propertyCount > 0 ? Math.max(10, 50 - (propertyCount * 10)) : 0;

  return {
    valuationHealth: createMetric(equityPercent, 30, true, 85), // 30% equity is good
    lvrStability: createMetric(lvrStabilityScore, 50, true, 80),
    rentalYieldPerformance: createMetric(
      averageYield,
      BENCHMARKS.minRentalYieldPercent,
      true,
      70
    ),
    vacancyRiskAnalysis: createMetric(
      vacancyRiskScore,
      BENCHMARKS.maxVacancyRiskScore,
      false,
      60
    ),
  };
}

// =============================================================================
// RISK METRICS (Section 5.1.6)
// =============================================================================

export function calculateRiskMetrics(input: FinancialHealthInput): RiskMetrics {
  const monthlyExpenses = calculateMonthlyExpenses(input);
  const liquidAssets = calculateLiquidAssets(input);

  // Insurance gaps (placeholder - would need insurance data)
  // For now, assume moderate coverage
  const insuranceGapsScore = 70;

  // Buffering (liquid assets as months of expenses)
  const bufferMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 12;
  const bufferingScore = Math.min(100, (bufferMonths / BENCHMARKS.minBufferMonths) * 100);

  // Emergency runway (same as buffer but scored differently)
  const emergencyRunwayScore = Math.min(100, bufferMonths * 10);

  // Volatility exposure (based on investment types)
  const investments = input.portfolioSnapshot.investments;
  const totalInvestmentValue = investments.reduce((sum, i) => sum + i.value, 0);
  const volatileInvestments = investments
    .filter(i => i.type === 'CRYPTO')
    .reduce((sum, i) => sum + i.value, 0);
  const volatilityExposure = totalInvestmentValue > 0
    ? (volatileInvestments / totalInvestmentValue) * 100
    : 0;

  return {
    insuranceGaps: createMetric(insuranceGapsScore, 80, true, 40), // Low confidence without data
    buffering: createMetric(bufferingScore, 100, true, 90),
    emergencyRunway: createMetric(bufferMonths, BENCHMARKS.minBufferMonths, true, 90),
    volatilityExposure: createMetric(
      volatilityExposure,
      BENCHMARKS.maxVolatilityExposure,
      false,
      75
    ),
  };
}

// =============================================================================
// FORECAST METRICS (Section 5.1.7)
// =============================================================================

export function calculateForecastMetrics(input: FinancialHealthInput): ForecastMetrics {
  const netWorth = input.portfolioSnapshot.netWorth;
  const monthlyIncome = calculateMonthlyIncome(input);
  const monthlyExpenses = calculateMonthlyExpenses(input);
  const monthlySurplus = monthlyIncome - monthlyExpenses;

  // Simplified projection assumptions
  const annualGrowthRate = 0.05; // 5% annual growth
  const inflationRate = 0.025;   // 2.5% inflation

  // Net worth projections (simplified compound growth)
  const annualSavings = Math.max(0, monthlySurplus * 12);
  const netWorth5Year = netWorth * Math.pow(1 + annualGrowthRate, 5) + annualSavings * 5;
  const netWorth10Year = netWorth * Math.pow(1 + annualGrowthRate, 10) + annualSavings * 10;
  const netWorth20Year = netWorth * Math.pow(1 + annualGrowthRate, 20) + annualSavings * 20;

  // Retirement runway (years of expenses covered by net worth)
  const annualExpenses = monthlyExpenses * 12;
  const retirementRunway = annualExpenses > 0 ? netWorth20Year / annualExpenses : 0;

  // Sustainable withdrawal rate (based on 4% rule)
  const sustainableAnnualWithdrawal = netWorth * 0.04;
  const withdrawalCoveragePercent = annualExpenses > 0
    ? (sustainableAnnualWithdrawal / annualExpenses) * 100
    : 0;

  return {
    netWorth5Year: createMetric(netWorth5Year, netWorth * 1.5, true, 60),
    netWorth10Year: createMetric(netWorth10Year, netWorth * 2, true, 50),
    netWorth20Year: createMetric(netWorth20Year, netWorth * 3, true, 40),
    retirementRunway: createMetric(
      retirementRunway,
      BENCHMARKS.retirementRunwayYears,
      true,
      50
    ),
    sustainableWithdrawalRate: createMetric(
      withdrawalCoveragePercent,
      100, // 100% coverage is the goal
      true,
      55
    ),
  };
}

// =============================================================================
// MAIN AGGREGATION FUNCTION
// =============================================================================

/**
 * Aggregate all metrics from input data.
 * This is the main entry point for Layer 1.
 */
export function aggregateMetrics(input: FinancialHealthInput): AggregatedMetrics {
  return {
    liquidity: calculateLiquidityMetrics(input),
    cashflow: calculateCashflowMetrics(input),
    debt: calculateDebtMetrics(input),
    investments: calculateInvestmentMetrics(input),
    property: calculatePropertyMetrics(input),
    risk: calculateRiskMetrics(input),
    forecast: calculateForecastMetrics(input),
  };
}

/**
 * Get data quality confidence score based on completeness of input
 */
export function calculateDataConfidence(input: FinancialHealthInput): number {
  let score = 0;
  const weights = {
    income: 20,
    expenses: 20,
    properties: 15,
    loans: 15,
    accounts: 15,
    investments: 15,
  };

  if (input.portfolioSnapshot.income.length > 0) score += weights.income;
  if (input.portfolioSnapshot.expenses.length > 0) score += weights.expenses;
  if (input.portfolioSnapshot.properties.length > 0) score += weights.properties;
  if (input.portfolioSnapshot.loans.length >= 0) score += weights.loans; // Loans can be 0
  if (input.portfolioSnapshot.accounts.length > 0) score += weights.accounts;
  if (input.portfolioSnapshot.investments.length >= 0) score += weights.investments;

  // Bonus for having linkage health data
  if (input.linkageHealth && input.linkageHealth.consistencyScore > 80) {
    score = Math.min(100, score + 10);
  }

  return score;
}
