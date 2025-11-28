/**
 * CASHFLOW INSIGHT GENERATOR
 * Phase 14 - Section 14.5
 *
 * Generates cashflow-specific insights to integrate with Insights Engine v3.
 * Extends existing Insights Engine with new cashflow insight types.
 */

import {
  CashflowInsight,
  CashflowInsightCategory,
  CashflowInsightSeverity,
  CFEOutput,
  COEOutput,
  StressTestOutput,
  RecurringPaymentData,
  LinkedEntities,
  valueToSeverity,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const SHORTFALL_WARNING_DAYS = 14; // Warn if shortfall within 14 days
const LOW_BUFFER_MONTHS = 2; // Warn if buffer below 2 months
const HIGH_BURN_RATE_THRESHOLD = 0.9; // 90% of income

// =============================================================================
// MAIN INSIGHT GENERATOR
// =============================================================================

/**
 * Generate all cashflow insights from CFE, COE, and Stress Test outputs
 */
export function generateCashflowInsights(
  userId: string,
  cfeOutput?: CFEOutput,
  coeOutput?: COEOutput,
  stressOutput?: StressTestOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];

  // Generate CFE-based insights (forecast warnings)
  if (cfeOutput) {
    insights.push(...generateForecastInsights(userId, cfeOutput));
    insights.push(...generateLiquidityInsights(userId, cfeOutput));
  }

  // Generate COE-based insights (optimisation opportunities)
  if (coeOutput) {
    insights.push(...generateOptimisationInsights(userId, coeOutput));
    insights.push(...generateSubscriptionInsights(userId, coeOutput));
  }

  // Generate stress test insights
  if (stressOutput) {
    insights.push(...generateResilienceInsights(userId, stressOutput));
  }

  // Sort by severity (CRITICAL first) then by value
  return insights.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const severityDiff =
      severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return (b.valueEstimate || 0) - (a.valueEstimate || 0);
  });
}

// =============================================================================
// FORECAST INSIGHTS (from CFE)
// =============================================================================

function generateForecastInsights(
  userId: string,
  cfe: CFEOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];
  const now = new Date();

  // Shortfall warning
  if (cfe.shortfallAnalysis.hasShortfall) {
    const firstShortfall = cfe.shortfallAnalysis.firstShortfallDate;
    if (firstShortfall) {
      const daysUntil = Math.round(
        (firstShortfall.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil <= SHORTFALL_WARNING_DAYS) {
        insights.push({
          id: `insight-shortfall-imminent-${now.getTime()}`,
          userId,
          severity: 'CRITICAL',
          category: 'LIQUIDITY_RISK',
          title: 'Cash Shortfall Imminent',
          description: `You are predicted to have a cash shortfall of $${Math.round(cfe.shortfallAnalysis.maxShortfallAmount)} in ${daysUntil} days. Immediate action required.`,
          recommendedAction:
            'Transfer funds from savings or reduce upcoming expenses to avoid overdraft.',
          impactedAccountIds: cfe.shortfallAnalysis.accountsAtRisk,
          impactedCategories: [],
          valueEstimate: cfe.shortfallAnalysis.maxShortfallAmount,
          savingsPotential: cfe.shortfallAnalysis.maxShortfallAmount * 0.1, // Overdraft fees
          confidenceScore: 0.9,
          linkedEntities: {
            loans: [],
            accounts: cfe.shortfallAnalysis.accountsAtRisk,
            recurring: [],
          },
          isRead: false,
          isDismissed: false,
          isActioned: false,
          createdAt: now,
        });
      } else if (daysUntil <= 30) {
        insights.push({
          id: `insight-shortfall-warning-${now.getTime()}`,
          userId,
          severity: 'HIGH',
          category: 'LIQUIDITY_RISK',
          title: 'Cash Shortfall Predicted',
          description: `Based on current patterns, you may experience a shortfall of $${Math.round(cfe.shortfallAnalysis.maxShortfallAmount)} in approximately ${daysUntil} days.`,
          recommendedAction:
            'Review upcoming expenses and consider adjusting payment schedules or building buffer.',
          impactedAccountIds: cfe.shortfallAnalysis.accountsAtRisk,
          impactedCategories: [],
          valueEstimate: cfe.shortfallAnalysis.maxShortfallAmount,
          confidenceScore: 0.8,
          isRead: false,
          isDismissed: false,
          isActioned: false,
          createdAt: now,
        });
      }
    }
  }

  // High volatility warning
  if (cfe.volatilityIndex > 50) {
    insights.push({
      id: `insight-volatility-${now.getTime()}`,
      userId,
      severity: cfe.volatilityIndex > 70 ? 'HIGH' : 'MEDIUM',
      category: 'ANOMALY',
      title: 'High Cashflow Volatility',
      description: `Your cashflow volatility index is ${Math.round(cfe.volatilityIndex)}/100. This indicates unpredictable spending patterns.`,
      recommendedAction:
        'Consider creating a budget and tracking expenses more closely to reduce variability.',
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: cfe.summary.monthlyBurnRate * 0.1,
      confidenceScore: 0.85,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  // Negative net cashflow
  if (cfe.summary.netCashflow30 < 0) {
    insights.push({
      id: `insight-negative-cashflow-${now.getTime()}`,
      userId,
      severity: cfe.summary.netCashflow30 < -1000 ? 'HIGH' : 'MEDIUM',
      category: 'LIQUIDITY_RISK',
      title: 'Negative Net Cashflow',
      description: `You are spending $${Math.round(Math.abs(cfe.summary.netCashflow30))} more than you earn over the next 30 days.`,
      recommendedAction:
        'Review expenses and identify areas to cut back, or explore ways to increase income.',
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: Math.abs(cfe.summary.netCashflow30),
      savingsPotential: Math.abs(cfe.summary.netCashflow30) * 0.2,
      confidenceScore: 0.9,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  return insights;
}

// =============================================================================
// LIQUIDITY INSIGHTS (from CFE)
// =============================================================================

function generateLiquidityInsights(
  userId: string,
  cfe: CFEOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];
  const now = new Date();

  // Low buffer warning
  const monthsOfBuffer =
    cfe.summary.withdrawableCash / cfe.summary.monthlyBurnRate;

  if (monthsOfBuffer < LOW_BUFFER_MONTHS && monthsOfBuffer >= 0) {
    insights.push({
      id: `insight-low-buffer-${now.getTime()}`,
      userId,
      severity: monthsOfBuffer < 1 ? 'HIGH' : 'MEDIUM',
      category: 'LIQUIDITY_RISK',
      title: 'Low Emergency Buffer',
      description: `You only have ${monthsOfBuffer.toFixed(1)} months of expenses in reserve. Recommended: 3-6 months.`,
      recommendedAction:
        'Prioritise building an emergency fund of at least 3 months expenses.',
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: cfe.summary.monthlyBurnRate * (3 - monthsOfBuffer),
      confidenceScore: 0.95,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  // High burn rate
  const burnRateRatio = cfe.summary.monthlyBurnRate / (cfe.summary.totalIncome30 || 1);
  if (burnRateRatio > HIGH_BURN_RATE_THRESHOLD) {
    insights.push({
      id: `insight-high-burn-rate-${now.getTime()}`,
      userId,
      severity: burnRateRatio > 1 ? 'HIGH' : 'MEDIUM',
      category: 'INEFFICIENCY',
      title: 'High Burn Rate',
      description: `You're spending ${Math.round(burnRateRatio * 100)}% of your income. This leaves little room for savings.`,
      recommendedAction: 'Aim to reduce spending to 70-80% of income.',
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: cfe.summary.monthlyBurnRate * 0.1,
      savingsPotential: cfe.summary.monthlyBurnRate * 0.1,
      confidenceScore: 0.9,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  return insights;
}

// =============================================================================
// OPTIMISATION INSIGHTS (from COE)
// =============================================================================

function generateOptimisationInsights(
  userId: string,
  coe: COEOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];
  const now = new Date();

  // High-value inefficiencies
  coe.inefficiencies
    .filter((i) => i.potentialSavings > 100)
    .slice(0, 5)
    .forEach((ineff, index) => {
      insights.push({
        id: `insight-ineff-${index}-${now.getTime()}`,
        userId,
        severity: valueToSeverity(ineff.potentialSavings),
        category: ineff.category as CashflowInsightCategory,
        title: `Savings Opportunity: ${ineff.merchantOrCategory}`,
        description: ineff.description,
        recommendedAction: `Review spending in ${ineff.merchantOrCategory}. Potential annual savings: $${Math.round(ineff.potentialSavings)}`,
        impactedAccountIds: [],
        impactedCategories: [ineff.merchantOrCategory],
        valueEstimate: ineff.potentialSavings,
        savingsPotential: ineff.potentialSavings,
        confidenceScore: ineff.confidenceScore,
        isRead: false,
        isDismissed: false,
        isActioned: false,
        createdAt: now,
      });
    });

  // Fund movement opportunities
  coe.fundMovements
    .filter((fm) => fm.projectedBenefit > 100)
    .forEach((fm, index) => {
      insights.push({
        id: `insight-fund-move-${index}-${now.getTime()}`,
        userId,
        severity: fm.urgency === 'HIGH' ? 'HIGH' : 'MEDIUM',
        category: fm.reason.includes('shortfall')
          ? 'LIQUIDITY_RISK'
          : 'SAVINGS_OPPORTUNITY',
        title: `Optimise Fund Allocation`,
        description: fm.reason,
        recommendedAction: `Transfer $${Math.round(fm.amount)} from ${fm.fromAccountName} to ${fm.toAccountName}`,
        impactedAccountIds: [fm.fromAccountId, fm.toAccountId],
        impactedCategories: [],
        valueEstimate: fm.projectedBenefit,
        savingsPotential: fm.projectedBenefit,
        confidenceScore: 0.9,
        linkedEntities: {
          loans: [],
          accounts: [fm.fromAccountId, fm.toAccountId],
          recurring: [],
        },
        isRead: false,
        isDismissed: false,
        isActioned: false,
        createdAt: now,
      });
    });

  // Repayment optimisations
  coe.repaymentOptimisations
    .filter((ro) => ro.interestSavings > 500)
    .forEach((ro, index) => {
      insights.push({
        id: `insight-repayment-${index}-${now.getTime()}`,
        userId,
        severity: ro.interestSavings > 5000 ? 'HIGH' : 'MEDIUM',
        category: 'SAVINGS_OPPORTUNITY',
        title: `Loan Optimisation: ${ro.loanName}`,
        description: ro.rationale,
        recommendedAction: ro.recommendedStrategy,
        impactedAccountIds: [],
        impactedCategories: [],
        valueEstimate: ro.interestSavings,
        savingsPotential: ro.interestSavings,
        confidenceScore: 0.85,
        linkedEntities: {
          loans: [ro.loanId],
          accounts: [],
          recurring: [],
        },
        isRead: false,
        isDismissed: false,
        isActioned: false,
        createdAt: now,
      });
    });

  // Break-even day insight
  if (coe.breakEvenDay > 20 || coe.breakEvenDay === -1) {
    insights.push({
      id: `insight-breakeven-${now.getTime()}`,
      userId,
      severity: coe.breakEvenDay === -1 ? 'HIGH' : 'MEDIUM',
      category: 'LIQUIDITY_RISK',
      title: coe.breakEvenDay === -1
        ? 'Expenses Exceed Income'
        : 'Late Break-Even Day',
      description: coe.breakEvenDay === -1
        ? 'Your monthly expenses exceed your monthly income.'
        : `You don't break even until day ${coe.breakEvenDay} of each month, causing cashflow pressure.`,
      recommendedAction: 'Consider moving payment dates closer to income dates.',
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: coe.summary.totalPotentialSavings * 0.05,
      confidenceScore: 0.8,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  return insights;
}

// =============================================================================
// SUBSCRIPTION INSIGHTS (from COE)
// =============================================================================

function generateSubscriptionInsights(
  userId: string,
  coe: COEOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];
  const now = new Date();

  // Price increase alerts
  coe.subscriptionsWithPriceIncrease.forEach((sub, index) => {
    insights.push({
      id: `insight-price-increase-${index}-${now.getTime()}`,
      userId,
      severity: (sub.priceChangePercent || 0) > 20 ? 'HIGH' : 'MEDIUM',
      category: 'SUBSCRIPTION',
      title: `Price Increase: ${sub.merchantStandardised}`,
      description: `${sub.merchantStandardised} has increased from $${sub.previousAmount?.toFixed(2)} to $${sub.currentAmount.toFixed(2)} (${sub.priceChangePercent?.toFixed(1)}% increase).`,
      recommendedAction:
        'Review if this subscription is still providing value at the new price.',
      impactedAccountIds: [],
      impactedCategories: ['Subscriptions', sub.category],
      valueEstimate: sub.yearlyImpact,
      savingsPotential: sub.yearlyImpact,
      confidenceScore: 0.95,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  });

  // Too many subscriptions warning
  if (coe.subscriptions.length > 10) {
    const totalMonthly = coe.subscriptions.reduce(
      (sum, s) => sum + s.monthlyImpact,
      0
    );
    insights.push({
      id: `insight-subscription-count-${now.getTime()}`,
      userId,
      severity: coe.subscriptions.length > 15 ? 'HIGH' : 'MEDIUM',
      category: 'SUBSCRIPTION',
      title: 'Multiple Active Subscriptions',
      description: `You have ${coe.subscriptions.length} active subscriptions costing $${Math.round(totalMonthly)}/month ($${Math.round(totalMonthly * 12)}/year).`,
      recommendedAction:
        'Review all subscriptions and cancel any that are not regularly used.',
      impactedAccountIds: [],
      impactedCategories: ['Subscriptions'],
      valueEstimate: totalMonthly * 12,
      savingsPotential: totalMonthly * 12 * 0.2, // Assume 20% could be saved
      confidenceScore: 0.9,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  return insights;
}

// =============================================================================
// RESILIENCE INSIGHTS (from Stress Test)
// =============================================================================

function generateResilienceInsights(
  userId: string,
  stress: StressTestOutput
): CashflowInsight[] {
  const insights: CashflowInsight[] = [];
  const now = new Date();

  // Low resilience score
  if (stress.resilienceScore < 50) {
    insights.push({
      id: `insight-resilience-${now.getTime()}`,
      userId,
      severity: stress.resilienceScore < 25 ? 'CRITICAL' : 'HIGH',
      category: 'LIQUIDITY_RISK',
      title: 'Low Financial Resilience',
      description: `Your resilience score is ${stress.resilienceScore}/100. You may struggle to handle unexpected financial stress.`,
      recommendedAction: `Build emergency fund of $${Math.round(stress.summary.recommendedEmergencyFund)} and reduce fixed costs.`,
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: stress.summary.recommendedEmergencyFund,
      confidenceScore: 0.85,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  // Critical risks
  stress.summary.criticalRisks.forEach((risk, index) => {
    insights.push({
      id: `insight-critical-risk-${index}-${now.getTime()}`,
      userId,
      severity: 'HIGH',
      category: 'LIQUIDITY_RISK',
      title: `Risk Alert: ${risk}`,
      description: `Stress testing identified "${risk}" as a critical vulnerability in your financial position.`,
      recommendedAction: 'Review mitigation strategies in the Stress Test results.',
      impactedAccountIds: [],
      impactedCategories: [],
      confidenceScore: 0.8,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  });

  // Most vulnerable scenario
  const worstResult = stress.scenarioResults.find(
    (r) => r.scenarioName === stress.summary.mostVulnerableScenario
  );
  if (worstResult && worstResult.survivalTime < 3) {
    insights.push({
      id: `insight-vulnerable-scenario-${now.getTime()}`,
      userId,
      severity: worstResult.survivalTime < 1 ? 'CRITICAL' : 'HIGH',
      category: 'LIQUIDITY_RISK',
      title: `Vulnerable to: ${stress.summary.mostVulnerableScenario}`,
      description: `Under the "${stress.summary.mostVulnerableScenario}" scenario, you would only survive ${worstResult.survivalTime.toFixed(1)} months before running out of funds.`,
      recommendedAction: `Build buffer of $${Math.round(worstResult.requiredSavings)} or increase income by $${Math.round(worstResult.requiredIncomeIncrease)}/month.`,
      impactedAccountIds: [],
      impactedCategories: [],
      valueEstimate: worstResult.requiredSavings,
      confidenceScore: 0.75,
      isRead: false,
      isDismissed: false,
      isActioned: false,
      createdAt: now,
    });
  }

  return insights;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get high-priority insights (CRITICAL and HIGH severity)
 */
export function getHighPriorityInsights(
  insights: CashflowInsight[]
): CashflowInsight[] {
  return insights.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
  );
}

/**
 * Get unread insights
 */
export function getUnreadInsights(
  insights: CashflowInsight[]
): CashflowInsight[] {
  return insights.filter((i) => !i.isRead && !i.isDismissed);
}

/**
 * Calculate total potential savings from insights
 */
export function getTotalSavingsPotential(insights: CashflowInsight[]): number {
  return insights.reduce((sum, i) => sum + (i.savingsPotential || 0), 0);
}

/**
 * Group insights by category
 */
export function groupInsightsByCategory(
  insights: CashflowInsight[]
): Map<CashflowInsightCategory, CashflowInsight[]> {
  const grouped = new Map<CashflowInsightCategory, CashflowInsight[]>();

  insights.forEach((insight) => {
    const existing = grouped.get(insight.category) || [];
    existing.push(insight);
    grouped.set(insight.category, existing);
  });

  return grouped;
}
