/**
 * FORECAST ENGINE
 * Phase 11 - Stage 5: Multi-Year Forecasting
 *
 * Generates 5-30 year financial projections based on:
 * - Current portfolio state
 * - Historical trends
 * - Configurable assumptions
 * - Best/worst case scenarios
 */

import type { StrategyDataPacket } from '../core/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ForecastAssumptions {
  // Growth rates (annual %)
  propertyGrowthRate: number;      // e.g., 0.05 for 5%
  stockMarketReturn: number;        // e.g., 0.08 for 8%
  inflationRate: number;            // e.g., 0.03 for 3%
  salaryGrowthRate: number;         // e.g., 0.04 for 4%

  // Interest rates
  mortgageRate: number;             // Average mortgage rate
  savingsRate: number;              // Savings account rate

  // Behavioral assumptions
  annualSavingsIncrease: number;    // Extra savings per year
  retirementAge: number;            // Target retirement age
  lifeExpectancy: number;           // Planning horizon

  // Scenario modifier (-1 to 1, 0 = default)
  scenarioAdjustment: number;       // -1 = worst, 0 = default, 1 = best
}

export interface YearlyProjection {
  year: number;
  age: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashflow: {
    income: number;
    expenses: number;
    surplus: number;
  };
  breakdown: {
    propertyValue: number;
    investmentValue: number;
    cashValue: number;
    debtValue: number;
  };
}

export interface ForecastResult {
  userId: string;
  generatedAt: Date;
  assumptions: ForecastAssumptions;
  scenario: 'CONSERVATIVE' | 'DEFAULT' | 'AGGRESSIVE';
  projections: YearlyProjection[];
  summary: {
    currentAge: number;
    retirementAge: number;
    yearsToRetirement: number;
    netWorthAtRetirement: number;
    projectedRetirementIncome: number;
    replacementRatio: number; // Retirement income / current income
    canRetireComfortably: boolean;
  };
}

// =============================================================================
// DEFAULT ASSUMPTIONS
// =============================================================================

const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  propertyGrowthRate: 0.05,      // 5% p.a.
  stockMarketReturn: 0.08,        // 8% p.a.
  inflationRate: 0.03,            // 3% p.a.
  salaryGrowthRate: 0.04,         // 4% p.a.
  mortgageRate: 0.045,            // 4.5%
  savingsRate: 0.02,              // 2%
  annualSavingsIncrease: 5000,    // $5k extra per year
  retirementAge: 65,
  lifeExpectancy: 90,
  scenarioAdjustment: 0,          // Default scenario
};

const CONSERVATIVE_ADJUSTMENT = -0.3;  // 30% worse than default
const AGGRESSIVE_ADJUSTMENT = 0.3;     // 30% better than default

// =============================================================================
// FORECAST GENERATION
// =============================================================================

/**
 * Generate multi-year financial forecast
 */
export function generateForecast(
  data: StrategyDataPacket,
  customAssumptions?: Partial<ForecastAssumptions>,
  scenario: 'CONSERVATIVE' | 'DEFAULT' | 'AGGRESSIVE' = 'DEFAULT'
): ForecastResult {
  // Build assumptions based on scenario
  const baseAssumptions = { ...DEFAULT_ASSUMPTIONS, ...customAssumptions };
  const scenarioAdjustment =
    scenario === 'CONSERVATIVE' ? CONSERVATIVE_ADJUSTMENT :
    scenario === 'AGGRESSIVE' ? AGGRESSIVE_ADJUSTMENT : 0;

  const assumptions = applyScenarioAdjustment(baseAssumptions, scenarioAdjustment);

  // Extract current state from data
  const currentState = extractCurrentState(data);

  // Generate yearly projections
  const yearsToProject = assumptions.lifeExpectancy - currentState.currentAge;
  const projections: YearlyProjection[] = [];

  for (let year = 0; year <= yearsToProject; year++) {
    const projection = projectYear(
      year,
      currentState,
      assumptions,
      projections.length > 0 ? projections[projections.length - 1] : null
    );
    projections.push(projection);
  }

  // Calculate summary metrics
  const yearsToRetirement = Math.max(0, assumptions.retirementAge - currentState.currentAge);
  const retirementProjection = projections.find(p => p.age >= assumptions.retirementAge);
  const netWorthAtRetirement = retirementProjection?.netWorth || 0;

  // 4% rule for retirement income
  const projectedRetirementIncome = netWorthAtRetirement * 0.04;
  const replacementRatio = currentState.annualIncome > 0
    ? projectedRetirementIncome / currentState.annualIncome
    : 0;
  const canRetireComfortably = replacementRatio >= 0.7; // 70% replacement ratio

  return {
    userId: data.userId,
    generatedAt: new Date(),
    assumptions,
    scenario,
    projections,
    summary: {
      currentAge: currentState.currentAge,
      retirementAge: assumptions.retirementAge,
      yearsToRetirement,
      netWorthAtRetirement,
      projectedRetirementIncome,
      replacementRatio,
      canRetireComfortably,
    },
  };
}

/**
 * Apply scenario adjustment to assumptions
 */
function applyScenarioAdjustment(
  assumptions: ForecastAssumptions,
  adjustment: number
): ForecastAssumptions {
  return {
    ...assumptions,
    propertyGrowthRate: assumptions.propertyGrowthRate * (1 + adjustment),
    stockMarketReturn: assumptions.stockMarketReturn * (1 + adjustment),
    salaryGrowthRate: assumptions.salaryGrowthRate * (1 + adjustment),
    mortgageRate: assumptions.mortgageRate * (1 - adjustment * 0.5), // Rates move opposite
    savingsRate: assumptions.savingsRate * (1 - adjustment * 0.5),
    scenarioAdjustment: adjustment,
  };
}

/**
 * Extract current financial state from data packet
 */
function extractCurrentState(data: StrategyDataPacket): {
  currentAge: number;
  currentNetWorth: number;
  currentAssets: number;
  currentLiabilities: number;
  propertyValue: number;
  investmentValue: number;
  cashValue: number;
  debtValue: number;
  annualIncome: number;
  annualExpenses: number;
  annualSurplus: number;
} {
  const snapshot = data.snapshot;
  const preferences = data.preferences;

  if (!snapshot) {
    // Return defaults if no snapshot
    return {
      currentAge: 35,
      currentNetWorth: 0,
      currentAssets: 0,
      currentLiabilities: 0,
      propertyValue: 0,
      investmentValue: 0,
      cashValue: 0,
      debtValue: 0,
      annualIncome: 100000,
      annualExpenses: 60000,
      annualSurplus: 40000,
    };
  }

  const propertyValue = snapshot.properties?.reduce((sum, p) => sum + (p.currentValue || 0), 0) || 0;
  const investmentValue = snapshot.investments?.reduce((sum, i) => sum + ((i.totalValue || 0) as number), 0) || 0;
  const cashValue = snapshot.cashflowSummary?.monthlySurplus ? (snapshot.cashflowSummary.monthlySurplus * 12) : 0;
  const debtValue = snapshot.loans?.reduce((sum, l) => sum + (l.principal || 0), 0) || 0;

  const annualIncome = snapshot.cashflowSummary?.monthlyIncome ? (snapshot.cashflowSummary.monthlyIncome * 12) : 100000;
  const annualExpenses = snapshot.cashflowSummary?.monthlyExpenses ? (snapshot.cashflowSummary.monthlyExpenses * 12) : 60000;
  const annualSurplus = annualIncome - annualExpenses;

  const currentAge = preferences?.retirementAge ? (preferences.retirementAge - (preferences.timeHorizon || 30)) : 35;

  return {
    currentAge,
    currentNetWorth: snapshot.netWorth || 0,
    currentAssets: propertyValue + investmentValue + cashValue,
    currentLiabilities: debtValue,
    propertyValue,
    investmentValue,
    cashValue,
    debtValue,
    annualIncome,
    annualExpenses,
    annualSurplus,
  };
}

/**
 * Project a single year forward
 */
function projectYear(
  yearIndex: number,
  currentState: ReturnType<typeof extractCurrentState>,
  assumptions: ForecastAssumptions,
  previousYear: YearlyProjection | null
): YearlyProjection {
  const year = new Date().getFullYear() + yearIndex;
  const age = currentState.currentAge + yearIndex;

  // Start from previous year or current state
  const prevNetWorth = previousYear?.netWorth || currentState.currentNetWorth;
  const prevPropertyValue = previousYear?.breakdown.propertyValue || currentState.propertyValue;
  const prevInvestmentValue = previousYear?.breakdown.investmentValue || currentState.investmentValue;
  const prevCashValue = previousYear?.breakdown.cashValue || currentState.cashValue;
  const prevDebtValue = previousYear?.breakdown.debtValue || currentState.debtValue;
  const prevIncome = previousYear?.cashflow.income || currentState.annualIncome;
  const prevExpenses = previousYear?.cashflow.expenses || currentState.annualExpenses;

  // Apply growth rates
  const propertyValue = prevPropertyValue * (1 + assumptions.propertyGrowthRate);
  const investmentValue = prevInvestmentValue * (1 + assumptions.stockMarketReturn);
  const income = age < assumptions.retirementAge
    ? prevIncome * (1 + assumptions.salaryGrowthRate)
    : prevNetWorth * 0.04; // 4% withdrawal in retirement

  // Adjust expenses for inflation
  const expenses = prevExpenses * (1 + assumptions.inflationRate);

  // Calculate surplus and savings
  const surplus = income - expenses;
  const additionalSavings = age < assumptions.retirementAge ? assumptions.annualSavingsIncrease : 0;

  // Add surplus to investments (simplified)
  const newInvestmentValue = investmentValue + Math.max(0, surplus) + additionalSavings;

  // Pay down debt with surplus if negative cashflow
  const debtPaydown = surplus < 0 ? Math.min(prevCashValue, Math.abs(surplus)) : 0;
  const debtValue = Math.max(0, prevDebtValue - debtPaydown);

  // Update cash (emergency fund)
  const cashValue = Math.max(
    expenses * 0.5, // Minimum 6 months expenses
    prevCashValue + (surplus > 0 ? surplus * 0.2 : -debtPaydown) // 20% of surplus to cash
  );

  // Calculate totals
  const totalAssets = propertyValue + newInvestmentValue + cashValue;
  const totalLiabilities = debtValue;
  const netWorth = totalAssets - totalLiabilities;

  return {
    year,
    age,
    netWorth,
    totalAssets,
    totalLiabilities,
    cashflow: {
      income,
      expenses,
      surplus,
    },
    breakdown: {
      propertyValue,
      investmentValue: newInvestmentValue,
      cashValue,
      debtValue,
    },
  };
}

/**
 * Generate all three scenarios (Conservative, Default, Aggressive)
 */
export function generateAllScenarios(
  data: StrategyDataPacket,
  customAssumptions?: Partial<ForecastAssumptions>
): {
  conservative: ForecastResult;
  default: ForecastResult;
  aggressive: ForecastResult;
} {
  return {
    conservative: generateForecast(data, customAssumptions, 'CONSERVATIVE'),
    default: generateForecast(data, customAssumptions, 'DEFAULT'),
    aggressive: generateForecast(data, customAssumptions, 'AGGRESSIVE'),
  };
}
