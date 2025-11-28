/**
 * CASHFLOW STRESS TESTING MODEL
 * Phase 14 - Section 14.3
 *
 * What-if modelling for income variability, expense shocks,
 * interest rate changes, and inflation scenarios.
 */

import {
  StressScenario,
  StressParameters,
  StressTestResult,
  StressTestOutput,
  StressTestSummary,
  StressScenarioType,
  CFEInput,
  CFEOutput,
  ForecastPoint,
  CashflowStrategy,
  StrategyStep,
} from './types';
import { generateForecast } from './forecasting';

// =============================================================================
// PREDEFINED SCENARIOS
// =============================================================================

export const PREDEFINED_SCENARIOS: StressScenario[] = [
  {
    id: 'income-drop-50',
    name: 'Income Drop 50%',
    type: 'INCOME_DROP',
    description: 'Simulates a 50% reduction in income for 3 months',
    parameters: {
      incomeDropPercent: 50,
      incomeDropDuration: 3,
    },
  },
  {
    id: 'income-loss-100',
    name: 'Complete Income Loss',
    type: 'INCOME_DROP',
    description: 'Simulates complete loss of income for 6 months',
    parameters: {
      incomeDropPercent: 100,
      incomeDropDuration: 6,
    },
  },
  {
    id: 'expense-shock-5k',
    name: 'Unexpected $5,000 Expense',
    type: 'EXPENSE_SHOCK',
    description: 'Simulates an unexpected $5,000 expense (e.g., car repair, medical)',
    parameters: {
      expenseShockAmount: 5000,
    },
  },
  {
    id: 'expense-shock-15k',
    name: 'Major Expense $15,000',
    type: 'EXPENSE_SHOCK',
    description: 'Simulates a major expense of $15,000 (e.g., roof replacement)',
    parameters: {
      expenseShockAmount: 15000,
    },
  },
  {
    id: 'rate-rise-100bp',
    name: 'Interest Rate +1%',
    type: 'INTEREST_RATE_RISE',
    description: 'Simulates a 1% (100 basis points) interest rate increase',
    parameters: {
      interestRateIncrease: 100,
    },
  },
  {
    id: 'rate-rise-200bp',
    name: 'Interest Rate +2%',
    type: 'INTEREST_RATE_RISE',
    description: 'Simulates a 2% (200 basis points) interest rate increase',
    parameters: {
      interestRateIncrease: 200,
    },
  },
  {
    id: 'inflation-high',
    name: 'High Inflation (8%)',
    type: 'INFLATION',
    description: 'Simulates 8% annual inflation affecting expenses',
    parameters: {
      expenseInflationPercent: 8,
    },
  },
  {
    id: 'combined-mild',
    name: 'Mild Combined Stress',
    type: 'CUSTOM',
    description: '25% income drop + 3% inflation + 0.5% rate rise',
    parameters: {
      incomeDropPercent: 25,
      incomeDropDuration: 6,
      expenseInflationPercent: 3,
      interestRateIncrease: 50,
    },
  },
  {
    id: 'combined-severe',
    name: 'Severe Combined Stress',
    type: 'CUSTOM',
    description: '50% income drop + 5% inflation + 1.5% rate rise + $10k expense',
    parameters: {
      incomeDropPercent: 50,
      incomeDropDuration: 3,
      expenseInflationPercent: 5,
      interestRateIncrease: 150,
      expenseShockAmount: 10000,
    },
  },
];

// =============================================================================
// MAIN STRESS TESTING ENGINE
// =============================================================================

/**
 * Run stress tests across multiple scenarios
 */
export async function runStressTests(
  baseForecastInput: CFEInput,
  scenarios?: StressScenario[]
): Promise<StressTestOutput> {
  const startTime = Date.now();
  const scenariosToRun = scenarios || PREDEFINED_SCENARIOS;

  // Generate baseline forecast
  const baselineForecast = await generateForecast(baseForecastInput);
  const baselineResult = createBaselineResult(baselineForecast);

  // Run each scenario
  const scenarioResults: StressTestResult[] = [];

  for (const scenario of scenariosToRun) {
    const stressedInput = applyStressToInput(baseForecastInput, scenario.parameters);
    const stressedForecast = await generateForecast(stressedInput);
    const result = analyseStressResult(
      scenario,
      baselineForecast,
      stressedForecast
    );
    scenarioResults.push(result);
  }

  // Calculate resilience score
  const resilienceScore = calculateResilienceScore(scenarioResults);

  // Generate summary
  const summary = generateStressSummary(scenarioResults, baselineForecast);

  return {
    userId: baseForecastInput.userId,
    generatedAt: new Date(),
    baselineResult,
    scenarioResults,
    resilienceScore,
    summary,
  };
}

/**
 * Run a single custom stress scenario
 */
export async function runCustomStressTest(
  baseForecastInput: CFEInput,
  parameters: StressParameters
): Promise<StressTestResult> {
  const baselineForecast = await generateForecast(baseForecastInput);
  const stressedInput = applyStressToInput(baseForecastInput, parameters);
  const stressedForecast = await generateForecast(stressedInput);

  const scenario: StressScenario = {
    id: 'custom',
    name: 'Custom Scenario',
    type: 'CUSTOM',
    description: describeParameters(parameters),
    parameters,
  };

  return analyseStressResult(scenario, baselineForecast, stressedForecast);
}

// =============================================================================
// STRESS APPLICATION
// =============================================================================

function applyStressToInput(
  input: CFEInput,
  params: StressParameters
): CFEInput {
  const stressedInput: CFEInput = JSON.parse(JSON.stringify(input));

  // Apply income drop
  if (params.incomeDropPercent !== undefined) {
    const dropFactor = 1 - params.incomeDropPercent / 100;
    stressedInput.incomeStreams = stressedInput.incomeStreams.map((income) => ({
      ...income,
      monthlyAmount: income.monthlyAmount * dropFactor,
    }));
  }

  // Apply expense inflation
  if (params.expenseInflationPercent !== undefined) {
    const inflationFactor = 1 + params.expenseInflationPercent / 100;
    stressedInput.recurringPayments = stressedInput.recurringPayments.map((rp) => ({
      ...rp,
      expectedAmount: rp.expectedAmount * inflationFactor,
    }));
  }

  // Apply interest rate increase
  if (params.interestRateIncrease !== undefined) {
    const rateIncrease = params.interestRateIncrease / 10000; // Convert basis points
    stressedInput.loanSchedules = stressedInput.loanSchedules.map((loan) => {
      const newRate = loan.interestRate + rateIncrease;
      // Recalculate monthly repayment with higher rate
      const newPayment = calculateNewRepayment(loan, newRate);
      return {
        ...loan,
        interestRate: newRate,
        monthlyRepayment: newPayment,
      };
    });
  }

  // Apply expense shock
  if (params.expenseShockAmount !== undefined && params.expenseShockDate) {
    if (!stressedInput.plannedExpenses) {
      stressedInput.plannedExpenses = [];
    }
    stressedInput.plannedExpenses.push({
      id: 'expense-shock',
      description: 'Unexpected expense (stress test)',
      amount: params.expenseShockAmount,
      date: params.expenseShockDate,
    });
  } else if (params.expenseShockAmount !== undefined) {
    // Add to first week if no date specified
    if (!stressedInput.plannedExpenses) {
      stressedInput.plannedExpenses = [];
    }
    const shockDate = new Date();
    shockDate.setDate(shockDate.getDate() + 7);
    stressedInput.plannedExpenses.push({
      id: 'expense-shock',
      description: 'Unexpected expense (stress test)',
      amount: params.expenseShockAmount,
      date: shockDate,
    });
  }

  return stressedInput;
}

function calculateNewRepayment(
  loan: CFEInput['loanSchedules'][0],
  newRate: number
): number {
  if (loan.isInterestOnly) {
    // Interest-only: new monthly interest
    return (loan.principal * newRate) / 12;
  }

  // P&I: recalculate using amortisation formula
  const monthlyRate = newRate / 12;
  const remainingPayments = 30 * 12; // Assume 30-year term for simplicity
  const payment =
    (loan.principal * (monthlyRate * Math.pow(1 + monthlyRate, remainingPayments))) /
    (Math.pow(1 + monthlyRate, remainingPayments) - 1);

  return payment;
}

// =============================================================================
// RESULT ANALYSIS
// =============================================================================

function createBaselineResult(forecast: CFEOutput): StressTestResult {
  return {
    scenarioId: 'baseline',
    scenarioName: 'Baseline (No Stress)',
    originalForecast: forecast.globalForecast,
    stressedForecast: forecast.globalForecast,
    survivalTime: calculateSurvivalTime(forecast),
    maxShortfallAmount: forecast.shortfallAnalysis.maxShortfallAmount,
    balanceImpact: 0,
    shortfallDaysAdded: 0,
    mitigationStrategies: [],
    requiredSavings: 0,
    requiredIncomeIncrease: 0,
  };
}

function analyseStressResult(
  scenario: StressScenario,
  baseline: CFEOutput,
  stressed: CFEOutput
): StressTestResult {
  // Calculate survival time (months until first shortfall)
  const survivalTime = calculateSurvivalTime(stressed);

  // Calculate impact on balance
  const baselineEndBalance =
    baseline.globalForecast[baseline.globalForecast.length - 1]?.predictedBalance || 0;
  const stressedEndBalance =
    stressed.globalForecast[stressed.globalForecast.length - 1]?.predictedBalance || 0;
  const balanceImpact = stressedEndBalance - baselineEndBalance;

  // Calculate shortfall days added
  const baselineShortfallDays = baseline.shortfallAnalysis.totalShortfallDays;
  const stressedShortfallDays = stressed.shortfallAnalysis.totalShortfallDays;
  const shortfallDaysAdded = stressedShortfallDays - baselineShortfallDays;

  // Generate mitigation strategies
  const mitigationStrategies = generateMitigationStrategies(
    scenario,
    stressed,
    balanceImpact
  );

  // Calculate required savings/income to survive
  const { requiredSavings, requiredIncomeIncrease } = calculateRequirements(
    stressed,
    balanceImpact
  );

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    originalForecast: baseline.globalForecast,
    stressedForecast: stressed.globalForecast,
    survivalTime,
    maxShortfallAmount: stressed.shortfallAnalysis.maxShortfallAmount,
    balanceImpact,
    shortfallDaysAdded,
    mitigationStrategies,
    requiredSavings,
    requiredIncomeIncrease,
  };
}

function calculateSurvivalTime(forecast: CFEOutput): number {
  if (!forecast.shortfallAnalysis.hasShortfall) {
    return forecast.metadata.forecastDays / 30; // Full survival in months
  }

  const firstShortfall = forecast.shortfallAnalysis.firstShortfallDate;
  if (!firstShortfall) {
    return forecast.metadata.forecastDays / 30;
  }

  const today = new Date();
  const daysToShortfall = Math.round(
    (firstShortfall.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, daysToShortfall / 30);
}

// =============================================================================
// MITIGATION STRATEGIES
// =============================================================================

function generateMitigationStrategies(
  scenario: StressScenario,
  stressed: CFEOutput,
  balanceImpact: number
): CashflowStrategy[] {
  const strategies: CashflowStrategy[] = [];

  // If there's a shortfall, suggest mitigation
  if (stressed.shortfallAnalysis.hasShortfall) {
    const shortfallAmount = stressed.shortfallAnalysis.maxShortfallAmount;

    strategies.push({
      id: `mitigate-${scenario.id}-emergency`,
      type: 'PREVENT_SHORTFALL',
      priority: 95,
      title: 'Build Emergency Fund',
      summary: `Build an emergency fund of $${Math.round(shortfallAmount * 1.5)} to survive this scenario`,
      confidence: 0.9,
      projectedBenefit: shortfallAmount,
      recommendedSteps: generateEmergencyFundSteps(shortfallAmount * 1.5),
      affectedAccountIds: [],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });

    // Expense reduction strategy
    if (Math.abs(balanceImpact) > 1000) {
      strategies.push({
        id: `mitigate-${scenario.id}-reduce`,
        type: 'REDUCE_WASTE',
        priority: 85,
        title: 'Reduce Discretionary Spending',
        summary: 'Cut non-essential expenses to improve cashflow resilience',
        confidence: 0.8,
        projectedBenefit: Math.abs(balanceImpact) * 0.3,
        recommendedSteps: [
          {
            order: 1,
            action: 'REVIEW',
            description: 'Review all subscription services',
            optional: false,
          },
          {
            order: 2,
            action: 'CANCEL',
            description: 'Cancel or pause non-essential subscriptions',
            optional: false,
          },
          {
            order: 3,
            action: 'BUDGET',
            description: 'Set strict budgets for entertainment and dining',
            optional: false,
          },
        ],
        affectedAccountIds: [],
        affectedLoanIds: [],
        affectedRecurringIds: [],
        status: 'PENDING',
      });
    }
  }

  // Scenario-specific mitigations
  if (scenario.type === 'INCOME_DROP') {
    strategies.push({
      id: `mitigate-${scenario.id}-income`,
      type: 'OPTIMISE',
      priority: 80,
      title: 'Diversify Income Sources',
      summary: 'Consider additional income streams to reduce single-source dependency',
      confidence: 0.7,
      projectedBenefit: 0,
      recommendedSteps: [
        {
          order: 1,
          action: 'ASSESS',
          description: 'Identify skills that could generate additional income',
          optional: false,
        },
        {
          order: 2,
          action: 'EXPLORE',
          description: 'Research side income opportunities',
          optional: false,
        },
      ],
      affectedAccountIds: [],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  }

  if (scenario.type === 'INTEREST_RATE_RISE') {
    strategies.push({
      id: `mitigate-${scenario.id}-lock`,
      type: 'REPAYMENT_OPTIMISE',
      priority: 75,
      title: 'Consider Fixed Rate Option',
      summary: 'Lock in current rates with a fixed-rate period to protect against future rises',
      confidence: 0.75,
      projectedBenefit: Math.abs(balanceImpact) * 0.5,
      recommendedSteps: [
        {
          order: 1,
          action: 'RESEARCH',
          description: 'Compare fixed-rate options from your lender',
          optional: false,
        },
        {
          order: 2,
          action: 'CALCULATE',
          description: 'Calculate break-even point for fixing',
          optional: false,
        },
        {
          order: 3,
          action: 'DECIDE',
          description: 'Consider splitting loan between fixed and variable',
          optional: true,
        },
      ],
      affectedAccountIds: [],
      affectedLoanIds: [],
      affectedRecurringIds: [],
      status: 'PENDING',
    });
  }

  return strategies;
}

function generateEmergencyFundSteps(targetAmount: number): StrategyStep[] {
  const monthlyTarget = targetAmount / 12;
  return [
    {
      order: 1,
      action: 'OPEN_ACCOUNT',
      description: 'Open a dedicated high-interest savings account',
      optional: false,
    },
    {
      order: 2,
      action: 'AUTOMATE',
      description: `Set up automatic transfer of $${Math.round(monthlyTarget)}/month`,
      optional: false,
    },
    {
      order: 3,
      action: 'REVIEW',
      description: 'Review progress quarterly and adjust as needed',
      optional: true,
    },
  ];
}

function calculateRequirements(
  stressed: CFEOutput,
  balanceImpact: number
): { requiredSavings: number; requiredIncomeIncrease: number } {
  if (!stressed.shortfallAnalysis.hasShortfall) {
    return { requiredSavings: 0, requiredIncomeIncrease: 0 };
  }

  const shortfallAmount = stressed.shortfallAnalysis.maxShortfallAmount;
  const survivalMonths = calculateSurvivalTime(stressed);

  // Required savings = shortfall amount + 50% buffer
  const requiredSavings = shortfallAmount * 1.5;

  // Required income increase = monthly shortfall to avoid
  const monthlyShortfall = shortfallAmount / Math.max(1, survivalMonths);
  const requiredIncomeIncrease = monthlyShortfall;

  return { requiredSavings, requiredIncomeIncrease };
}

// =============================================================================
// RESILIENCE SCORE
// =============================================================================

function calculateResilienceScore(results: StressTestResult[]): number {
  // Score based on survival time across scenarios
  // 100 = survives all scenarios fully
  // 0 = immediate shortfall in all scenarios

  let totalScore = 0;
  const maxScore = results.length * 100;

  results.forEach((result) => {
    // Score based on survival months (max 3 months = 100 points)
    const survivalScore = Math.min(100, (result.survivalTime / 3) * 100);
    totalScore += survivalScore;
  });

  return Math.round((totalScore / maxScore) * 100);
}

// =============================================================================
// SUMMARY GENERATION
// =============================================================================

function generateStressSummary(
  results: StressTestResult[],
  baseline: CFEOutput
): StressTestSummary {
  // Find most vulnerable scenario
  const sortedBySurvival = [...results].sort(
    (a, b) => a.survivalTime - b.survivalTime
  );
  const mostVulnerable = sortedBySurvival[0];

  // Calculate statistics
  const survivalTimes = results.map((r) => r.survivalTime);
  const shortestSurvival = Math.min(...survivalTimes);
  const avgSurvival =
    survivalTimes.reduce((a, b) => a + b, 0) / survivalTimes.length;

  // Recommended emergency fund (cover worst case)
  const maxShortfall = Math.max(...results.map((r) => r.maxShortfallAmount));
  const recommendedEmergencyFund = Math.max(
    maxShortfall * 1.5,
    baseline.summary.monthlyBurnRate * 3
  );

  // Identify critical risks
  const criticalRisks: string[] = [];
  if (shortestSurvival < 1) {
    criticalRisks.push('Insufficient emergency buffer');
  }
  if (avgSurvival < 2) {
    criticalRisks.push('Low cashflow resilience');
  }
  results.forEach((r) => {
    if (r.survivalTime < 1 && r.scenarioName.includes('Interest')) {
      criticalRisks.push('High interest rate sensitivity');
    }
    if (r.survivalTime < 1 && r.scenarioName.includes('Income')) {
      criticalRisks.push('High income dependency');
    }
  });

  return {
    mostVulnerableScenario: mostVulnerable?.scenarioName || 'None',
    shortestSurvivalTime: shortestSurvival,
    averageSurvivalTime: avgSurvival,
    recommendedEmergencyFund,
    criticalRisks: Array.from(new Set(criticalRisks)), // Deduplicate
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function describeParameters(params: StressParameters): string {
  const parts: string[] = [];

  if (params.incomeDropPercent !== undefined) {
    parts.push(
      `${params.incomeDropPercent}% income drop for ${params.incomeDropDuration || 'indefinite'} months`
    );
  }
  if (params.expenseShockAmount !== undefined) {
    parts.push(`$${params.expenseShockAmount} unexpected expense`);
  }
  if (params.interestRateIncrease !== undefined) {
    parts.push(`+${params.interestRateIncrease / 100}% interest rate`);
  }
  if (params.expenseInflationPercent !== undefined) {
    parts.push(`${params.expenseInflationPercent}% expense inflation`);
  }

  return parts.join(', ') || 'Custom scenario';
}

/**
 * Get available predefined scenarios
 */
export function getAvailableScenarios(): StressScenario[] {
  return PREDEFINED_SCENARIOS;
}

/**
 * Create a custom scenario
 */
export function createCustomScenario(
  name: string,
  description: string,
  parameters: StressParameters
): StressScenario {
  return {
    id: `custom-${Date.now()}`,
    name,
    type: 'CUSTOM',
    description,
    parameters,
  };
}
