/**
 * FINANCIAL HEALTH ENGINE - RISK MODELLING SYSTEM
 * Phase 12 - Section 6
 *
 * Classifies user risk across 6 categories:
 * 1. Spending Risk - overspending, rising discretionary ratio
 * 2. Borrowing Risk - high LVR, high DTI, rising repayments
 * 3. Liquidity Risk - insufficient buffer, negative cashflow
 * 4. Concentration Risk - overweight asset classes, property concentration
 * 5. Market Risk - exposure to volatile assets
 * 6. Longevity Risk - retirement shortfall
 *
 * Each risk receives: tier, explanation, evidence, severity
 */

import {
  FinancialHealthInput,
  AggregatedMetrics,
  HealthCategory,
  RiskSignal,
  RiskSignalCategory,
  RiskSeverity,
  RiskEvidence,
  ImprovementAction,
  ImpactEstimate,
  HealthCategoryName,
} from './types';

// =============================================================================
// RISK THRESHOLDS
// =============================================================================

const RISK_THRESHOLDS = {
  // Spending
  savingsRateCritical: 0,
  savingsRateConcerning: 10,
  fixedCostRatioCritical: 80,
  fixedCostRatioConcerning: 70,

  // Borrowing
  lvrCritical: 90,
  lvrConcerning: 80,
  dtiCritical: 8,
  dtiConcerning: 6,
  repaymentLoadCritical: 40,
  repaymentLoadConcerning: 30,

  // Liquidity
  bufferCritical: 1,      // Less than 1 month
  bufferConcerning: 3,    // Less than 3 months
  surplusCritical: -500,  // Negative $500+
  surplusConcerning: 0,

  // Concentration
  singleAssetCritical: 70,
  singleAssetConcerning: 50,
  propertyConcentrationCritical: 90,
  propertyConcentrationConcerning: 70,

  // Market
  volatilityExposureCritical: 30,
  volatilityExposureConcerning: 15,

  // Longevity
  retirementRunwayCritical: 10,
  retirementRunwayConcerning: 20,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateRiskId(category: RiskSignalCategory, suffix: string): string {
  return `risk_${category.toLowerCase()}_${suffix}_${Date.now()}`;
}

function determineSeverity(value: number, concerningThreshold: number, criticalThreshold: number, lowerIsBetter: boolean): RiskSeverity {
  if (lowerIsBetter) {
    if (value >= criticalThreshold) return 'CRITICAL';
    if (value >= concerningThreshold) return 'HIGH';
    return 'LOW';
  } else {
    if (value <= criticalThreshold) return 'CRITICAL';
    if (value <= concerningThreshold) return 'HIGH';
    return 'LOW';
  }
}

function createRiskSignal(
  category: RiskSignalCategory,
  severity: RiskSeverity,
  title: string,
  description: string,
  metric: string,
  currentValue: number,
  threshold: number,
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING' = 'STABLE'
): RiskSignal {
  return {
    id: generateRiskId(category, metric.replace(/\s+/g, '_').toLowerCase()),
    category,
    severity,
    title,
    description,
    evidence: {
      metric,
      currentValue,
      threshold,
      trend,
    },
    tier: severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 4 : severity === 'MEDIUM' ? 3 : 2,
  };
}

// =============================================================================
// SPENDING RISK ANALYSIS (Section 6.1)
// =============================================================================

export function analyzeSpendingRisk(metrics: AggregatedMetrics): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check savings rate
  const savingsRate = metrics.liquidity.savingsRate.value;
  if (savingsRate < RISK_THRESHOLDS.savingsRateCritical) {
    signals.push(createRiskSignal(
      'SPENDING',
      'CRITICAL',
      'Negative Savings Rate',
      'You are spending more than you earn. This is unsustainable and will lead to increasing debt.',
      'Savings Rate',
      savingsRate,
      RISK_THRESHOLDS.savingsRateConcerning,
      'WORSENING'
    ));
  } else if (savingsRate < RISK_THRESHOLDS.savingsRateConcerning) {
    signals.push(createRiskSignal(
      'SPENDING',
      'HIGH',
      'Low Savings Rate',
      `Your savings rate of ${savingsRate.toFixed(1)}% is below the recommended 20%. Consider reducing discretionary spending.`,
      'Savings Rate',
      savingsRate,
      RISK_THRESHOLDS.savingsRateConcerning
    ));
  }

  // Check fixed cost ratio
  const fixedCostRatio = metrics.cashflow.fixedCostRatio.value;
  if (fixedCostRatio >= RISK_THRESHOLDS.fixedCostRatioCritical) {
    signals.push(createRiskSignal(
      'SPENDING',
      'CRITICAL',
      'Excessive Fixed Costs',
      `${fixedCostRatio.toFixed(0)}% of your income goes to fixed costs, leaving little room for savings or emergencies.`,
      'Fixed Cost Ratio',
      fixedCostRatio,
      RISK_THRESHOLDS.fixedCostRatioConcerning
    ));
  } else if (fixedCostRatio >= RISK_THRESHOLDS.fixedCostRatioConcerning) {
    signals.push(createRiskSignal(
      'SPENDING',
      'MEDIUM',
      'High Fixed Costs',
      `${fixedCostRatio.toFixed(0)}% of income is committed to fixed costs. Look for opportunities to reduce recurring expenses.`,
      'Fixed Cost Ratio',
      fixedCostRatio,
      RISK_THRESHOLDS.fixedCostRatioConcerning
    ));
  }

  return signals;
}

// =============================================================================
// BORROWING RISK ANALYSIS (Section 6.2)
// =============================================================================

export function analyzeBorrowingRisk(metrics: AggregatedMetrics): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check LVR
  const lvr = metrics.debt.lvr.value;
  if (lvr >= RISK_THRESHOLDS.lvrCritical) {
    signals.push(createRiskSignal(
      'BORROWING',
      'CRITICAL',
      'Critical LVR Level',
      `Your Loan-to-Value Ratio of ${lvr.toFixed(0)}% is dangerously high. You have very little equity buffer against property value drops.`,
      'LVR',
      lvr,
      RISK_THRESHOLDS.lvrConcerning
    ));
  } else if (lvr >= RISK_THRESHOLDS.lvrConcerning) {
    signals.push(createRiskSignal(
      'BORROWING',
      'HIGH',
      'High LVR',
      `Your LVR of ${lvr.toFixed(0)}% exceeds 80%. Consider making extra repayments to build equity.`,
      'LVR',
      lvr,
      RISK_THRESHOLDS.lvrConcerning
    ));
  }

  // Check DTI
  const dti = metrics.debt.dti.value;
  if (dti >= RISK_THRESHOLDS.dtiCritical) {
    signals.push(createRiskSignal(
      'BORROWING',
      'CRITICAL',
      'Excessive Debt-to-Income',
      `Your debt is ${dti.toFixed(1)}x your annual income. This level of leverage is very risky.`,
      'DTI Ratio',
      dti,
      RISK_THRESHOLDS.dtiConcerning
    ));
  } else if (dti >= RISK_THRESHOLDS.dtiConcerning) {
    signals.push(createRiskSignal(
      'BORROWING',
      'HIGH',
      'High Debt-to-Income',
      `Your DTI of ${dti.toFixed(1)}x is above recommended levels. Focus on debt reduction.`,
      'DTI Ratio',
      dti,
      RISK_THRESHOLDS.dtiConcerning
    ));
  }

  // Check repayment load
  const repaymentLoad = metrics.debt.repaymentLoad.value;
  if (repaymentLoad >= RISK_THRESHOLDS.repaymentLoadCritical) {
    signals.push(createRiskSignal(
      'BORROWING',
      'CRITICAL',
      'Unsustainable Repayment Load',
      `${repaymentLoad.toFixed(0)}% of income goes to loan repayments. This leaves insufficient funds for other expenses.`,
      'Repayment Load',
      repaymentLoad,
      RISK_THRESHOLDS.repaymentLoadConcerning
    ));
  } else if (repaymentLoad >= RISK_THRESHOLDS.repaymentLoadConcerning) {
    signals.push(createRiskSignal(
      'BORROWING',
      'MEDIUM',
      'High Repayment Burden',
      `Loan repayments consume ${repaymentLoad.toFixed(0)}% of income. Consider refinancing for lower rates.`,
      'Repayment Load',
      repaymentLoad,
      RISK_THRESHOLDS.repaymentLoadConcerning
    ));
  }

  return signals;
}

// =============================================================================
// LIQUIDITY RISK ANALYSIS (Section 6.3)
// =============================================================================

export function analyzeLiquidityRisk(metrics: AggregatedMetrics): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check emergency buffer
  const buffer = metrics.liquidity.emergencyBuffer.value;
  if (buffer < RISK_THRESHOLDS.bufferCritical) {
    signals.push(createRiskSignal(
      'LIQUIDITY',
      'CRITICAL',
      'No Emergency Buffer',
      `You have less than 1 month of expenses in liquid savings. This is an emergency that needs immediate attention.`,
      'Emergency Buffer',
      buffer,
      RISK_THRESHOLDS.bufferConcerning,
      'WORSENING'
    ));
  } else if (buffer < RISK_THRESHOLDS.bufferConcerning) {
    signals.push(createRiskSignal(
      'LIQUIDITY',
      'HIGH',
      'Insufficient Emergency Buffer',
      `Your ${buffer.toFixed(1)} month buffer is below the recommended 3-6 months. Prioritize building this up.`,
      'Emergency Buffer',
      buffer,
      RISK_THRESHOLDS.bufferConcerning
    ));
  }

  // Check cashflow surplus
  const surplus = metrics.cashflow.surplus.value;
  if (surplus < RISK_THRESHOLDS.surplusCritical) {
    signals.push(createRiskSignal(
      'LIQUIDITY',
      'CRITICAL',
      'Severe Negative Cashflow',
      `You're losing $${Math.abs(surplus).toFixed(0)} per month. This will quickly deplete any savings.`,
      'Monthly Surplus',
      surplus,
      RISK_THRESHOLDS.surplusConcerning,
      'WORSENING'
    ));
  } else if (surplus < RISK_THRESHOLDS.surplusConcerning) {
    signals.push(createRiskSignal(
      'LIQUIDITY',
      'HIGH',
      'Negative Cashflow',
      'You are spending more than you earn each month. Review and cut expenses urgently.',
      'Monthly Surplus',
      surplus,
      RISK_THRESHOLDS.surplusConcerning
    ));
  }

  return signals;
}

// =============================================================================
// CONCENTRATION RISK ANALYSIS (Section 6.4)
// =============================================================================

export function analyzeConcentrationRisk(
  metrics: AggregatedMetrics,
  input: FinancialHealthInput
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check asset class concentration
  const concentration = metrics.investments.assetClassConcentration.value;
  if (concentration >= RISK_THRESHOLDS.singleAssetCritical) {
    signals.push(createRiskSignal(
      'CONCENTRATION',
      'CRITICAL',
      'Extreme Concentration Risk',
      `${concentration.toFixed(0)}% of your investments are in a single asset class. This is highly risky.`,
      'Asset Concentration',
      concentration,
      RISK_THRESHOLDS.singleAssetConcerning
    ));
  } else if (concentration >= RISK_THRESHOLDS.singleAssetConcerning) {
    signals.push(createRiskSignal(
      'CONCENTRATION',
      'MEDIUM',
      'Portfolio Concentration',
      `${concentration.toFixed(0)}% in one asset class. Consider diversifying for better risk management.`,
      'Asset Concentration',
      concentration,
      RISK_THRESHOLDS.singleAssetConcerning
    ));
  }

  // Check property concentration (property as % of total assets)
  const totalAssets = input.portfolioSnapshot.totalAssets;
  const propertyValue = input.portfolioSnapshot.properties.reduce((sum, p) => sum + p.currentValue, 0);
  const propertyConcentration = totalAssets > 0 ? (propertyValue / totalAssets) * 100 : 0;

  if (propertyConcentration >= RISK_THRESHOLDS.propertyConcentrationCritical) {
    signals.push(createRiskSignal(
      'CONCENTRATION',
      'HIGH',
      'Property Over-Concentration',
      `${propertyConcentration.toFixed(0)}% of your wealth is in property. Consider building other asset classes.`,
      'Property Concentration',
      propertyConcentration,
      RISK_THRESHOLDS.propertyConcentrationConcerning
    ));
  } else if (propertyConcentration >= RISK_THRESHOLDS.propertyConcentrationConcerning) {
    signals.push(createRiskSignal(
      'CONCENTRATION',
      'MEDIUM',
      'High Property Exposure',
      'Property makes up a large portion of your portfolio. Diversification could reduce risk.',
      'Property Concentration',
      propertyConcentration,
      RISK_THRESHOLDS.propertyConcentrationConcerning
    ));
  }

  return signals;
}

// =============================================================================
// MARKET RISK ANALYSIS (Section 6.5)
// =============================================================================

export function analyzeMarketRisk(metrics: AggregatedMetrics): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check volatility exposure (mainly crypto/speculative)
  const volatilityExposure = metrics.risk.volatilityExposure.value;
  if (volatilityExposure >= RISK_THRESHOLDS.volatilityExposureCritical) {
    signals.push(createRiskSignal(
      'MARKET',
      'HIGH',
      'High Volatility Exposure',
      `${volatilityExposure.toFixed(0)}% of your portfolio is in highly volatile assets. This could lead to significant losses.`,
      'Volatility Exposure',
      volatilityExposure,
      RISK_THRESHOLDS.volatilityExposureConcerning
    ));
  } else if (volatilityExposure >= RISK_THRESHOLDS.volatilityExposureConcerning) {
    signals.push(createRiskSignal(
      'MARKET',
      'MEDIUM',
      'Moderate Volatility Risk',
      'You have notable exposure to volatile assets. Ensure this aligns with your risk tolerance.',
      'Volatility Exposure',
      volatilityExposure,
      RISK_THRESHOLDS.volatilityExposureConcerning
    ));
  }

  // Interest rate risk (from debt metrics)
  const interestRisk = metrics.debt.interestRiskExposure.value;
  if (interestRisk >= 80) {
    signals.push(createRiskSignal(
      'MARKET',
      'HIGH',
      'Interest Rate Vulnerability',
      'Most of your debt is on variable rates. Rate increases would significantly impact your cashflow.',
      'Interest Rate Exposure',
      interestRisk,
      50
    ));
  }

  return signals;
}

// =============================================================================
// LONGEVITY RISK ANALYSIS (Section 6.6)
// =============================================================================

export function analyzeLongevityRisk(metrics: AggregatedMetrics): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Check retirement runway
  const runway = metrics.forecast.retirementRunway.value;
  if (runway < RISK_THRESHOLDS.retirementRunwayCritical) {
    signals.push(createRiskSignal(
      'LONGEVITY',
      'CRITICAL',
      'Retirement Shortfall Crisis',
      `Your projected retirement runway is only ${runway.toFixed(0)} years. You need to significantly increase savings or adjust retirement plans.`,
      'Retirement Runway',
      runway,
      RISK_THRESHOLDS.retirementRunwayConcerning
    ));
  } else if (runway < RISK_THRESHOLDS.retirementRunwayConcerning) {
    signals.push(createRiskSignal(
      'LONGEVITY',
      'HIGH',
      'Retirement Funding Gap',
      `${runway.toFixed(0)} years of retirement funding projected. Consider increasing super contributions.`,
      'Retirement Runway',
      runway,
      RISK_THRESHOLDS.retirementRunwayConcerning
    ));
  }

  // Check sustainable withdrawal rate coverage
  const withdrawalCoverage = metrics.forecast.sustainableWithdrawalRate.value;
  if (withdrawalCoverage < 50) {
    signals.push(createRiskSignal(
      'LONGEVITY',
      'HIGH',
      'Insufficient Passive Income',
      `Your sustainable withdrawal only covers ${withdrawalCoverage.toFixed(0)}% of expenses. Build more income-generating assets.`,
      'Withdrawal Coverage',
      withdrawalCoverage,
      100
    ));
  }

  return signals;
}

// =============================================================================
// MAIN RISK ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze all risk categories and return consolidated risk signals
 */
export function analyzeAllRisks(
  metrics: AggregatedMetrics,
  input: FinancialHealthInput
): RiskSignal[] {
  const allSignals = [
    ...analyzeSpendingRisk(metrics),
    ...analyzeBorrowingRisk(metrics),
    ...analyzeLiquidityRisk(metrics),
    ...analyzeConcentrationRisk(metrics, input),
    ...analyzeMarketRisk(metrics),
    ...analyzeLongevityRisk(metrics),
  ];

  // Sort by severity (CRITICAL first, then HIGH, MEDIUM, LOW)
  const severityOrder: Record<RiskSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  return allSignals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// =============================================================================
// IMPROVEMENT ACTION GENERATION
// =============================================================================

/**
 * Generate improvement actions based on risk signals and category scores
 */
export function generateImprovementActions(
  riskSignals: RiskSignal[],
  categories: HealthCategory[]
): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  let priority = 1;

  // Group risks by category
  const criticalRisks = riskSignals.filter(r => r.severity === 'CRITICAL');
  const highRisks = riskSignals.filter(r => r.severity === 'HIGH');

  // Generate actions for critical risks first (quick wins)
  for (const risk of criticalRisks) {
    const action = generateActionForRisk(risk, priority++);
    if (action) actions.push(action);
  }

  // Then high risks
  for (const risk of highRisks) {
    const action = generateActionForRisk(risk, priority++);
    if (action) actions.push(action);
  }

  // Add strategic improvements from weak categories
  const weakCategories = categories.filter(c => c.score < 50);
  for (const category of weakCategories) {
    const action = generateActionForCategory(category, priority++);
    if (action) actions.push(action);
  }

  return actions.slice(0, 10); // Limit to top 10 actions
}

function generateActionForRisk(risk: RiskSignal, priority: number): ImprovementAction | null {
  const actionMap: Record<RiskSignalCategory, { title: string; description: string; difficulty: 'EASY' | 'MODERATE' | 'HARD'; impact: ImpactEstimate }> = {
    SPENDING: {
      title: 'Reduce Discretionary Spending',
      description: 'Review and cut non-essential expenses. Consider subscription audits and lifestyle adjustments.',
      difficulty: 'EASY',
      impact: { scoreImprovement: 5, financialImpact: 200, timeframe: '1 month' },
    },
    BORROWING: {
      title: 'Accelerate Debt Repayment',
      description: 'Make extra loan repayments to reduce LVR and DTI. Consider refinancing for better rates.',
      difficulty: 'MODERATE',
      impact: { scoreImprovement: 8, financialImpact: 500, timeframe: '6 months' },
    },
    LIQUIDITY: {
      title: 'Build Emergency Fund',
      description: 'Set up automatic transfers to a high-interest savings account. Target 3-6 months of expenses.',
      difficulty: 'MODERATE',
      impact: { scoreImprovement: 10, financialImpact: 0, timeframe: '3 months' },
    },
    CONCENTRATION: {
      title: 'Diversify Portfolio',
      description: 'Add exposure to other asset classes. Consider low-cost ETFs for broad market exposure.',
      difficulty: 'MODERATE',
      impact: { scoreImprovement: 6, financialImpact: 0, timeframe: '6 months' },
    },
    MARKET: {
      title: 'Reduce Volatility Exposure',
      description: 'Rebalance away from speculative assets. Lock in fixed-rate loans to hedge interest rate risk.',
      difficulty: 'MODERATE',
      impact: { scoreImprovement: 5, financialImpact: 0, timeframe: '3 months' },
    },
    LONGEVITY: {
      title: 'Increase Retirement Contributions',
      description: 'Maximize super contributions including salary sacrifice. Review investment options for growth.',
      difficulty: 'HARD',
      impact: { scoreImprovement: 8, financialImpact: 1000, timeframe: '12 months' },
    },
  };

  const template = actionMap[risk.category];
  if (!template) return null;

  return {
    id: `action_${risk.category.toLowerCase()}_${priority}`,
    title: template.title,
    description: template.description,
    impact: template.impact,
    category: mapRiskToHealthCategory(risk.category),
    difficulty: template.difficulty,
    priority,
  };
}

function generateActionForCategory(category: HealthCategory, priority: number): ImprovementAction | null {
  // Find the weakest contributing metric
  const weakestMetric = category.contributingMetrics.reduce((weakest, current) =>
    current.score < weakest.score ? current : weakest
  );

  return {
    id: `action_${category.name.toLowerCase()}_improve_${priority}`,
    title: `Improve ${weakestMetric.name}`,
    description: `Your ${weakestMetric.name} score is ${weakestMetric.score}. Focus on improving this metric to boost your ${category.name} category score.`,
    impact: {
      scoreImprovement: Math.ceil((100 - weakestMetric.score) * 0.1),
      financialImpact: 0,
      timeframe: '3-6 months',
    },
    category: category.name,
    difficulty: 'MODERATE',
    priority,
  };
}

function mapRiskToHealthCategory(riskCategory: RiskSignalCategory): HealthCategoryName {
  const map: Record<RiskSignalCategory, HealthCategoryName> = {
    SPENDING: 'CASHFLOW',
    BORROWING: 'DEBT',
    LIQUIDITY: 'LIQUIDITY',
    CONCENTRATION: 'INVESTMENTS',
    MARKET: 'RISK_EXPOSURE',
    LONGEVITY: 'LONG_TERM_OUTLOOK',
  };
  return map[riskCategory];
}
