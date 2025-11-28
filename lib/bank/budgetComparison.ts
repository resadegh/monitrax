/**
 * Phase 18: Budget Comparison Engine
 * Compares actual spending against budgeted targets
 */

import {
  CategorisedTransaction,
  BudgetTarget,
  BudgetComparisonResult,
  MonthlyBudgetReport,
  BudgetStatus,
  BudgetInsight,
} from './types';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get month key from date (YYYY-MM)
 */
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Parse month key to date range
 */
function parseMonthKey(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Determine budget status based on percentage used
 */
function determineBudgetStatus(
  percentUsed: number,
  warningThreshold: number
): BudgetStatus {
  if (percentUsed >= 100) return 'OVER';
  if (percentUsed >= warningThreshold * 100) return 'WARNING';
  if (percentUsed >= 50) return 'ON_TRACK';
  return 'UNDER';
}

// =============================================================================
// BUDGET COMPARISON
// =============================================================================

/**
 * Group transactions by category for a given month
 */
function groupTransactionsByCategory(
  transactions: CategorisedTransaction[],
  monthKey: string
): Map<string, CategorisedTransaction[]> {
  const { start, end } = parseMonthKey(monthKey);
  const grouped = new Map<string, CategorisedTransaction[]>();

  for (const tx of transactions) {
    // Only include expense transactions within the month
    if (
      tx.date >= start &&
      tx.date <= end &&
      tx.direction === 'OUT' &&
      tx.categoryType !== 'TRANSFER'
    ) {
      const key = tx.categoryLevel2
        ? `${tx.categoryLevel1}|${tx.categoryLevel2}`
        : tx.categoryLevel1;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(tx);
    }
  }

  return grouped;
}

/**
 * Calculate total for a category from transactions
 */
function calculateCategoryTotal(transactions: CategorisedTransaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Compare actual spending to budget targets
 */
export function compareAgainstBudget(
  transactions: CategorisedTransaction[],
  targets: BudgetTarget[],
  monthKey: string
): BudgetComparisonResult[] {
  const grouped = groupTransactionsByCategory(transactions, monthKey);
  const results: BudgetComparisonResult[] = [];

  // Process each budget target
  for (const target of targets) {
    const key = target.categoryLevel2
      ? `${target.categoryLevel1}|${target.categoryLevel2}`
      : target.categoryLevel1;

    const categoryTransactions = grouped.get(key) ?? [];
    const actual = calculateCategoryTotal(categoryTransactions);
    const variance = target.monthlyTarget - actual;
    const percentUsed = target.monthlyTarget > 0
      ? (actual / target.monthlyTarget) * 100
      : actual > 0 ? 100 : 0;

    results.push({
      category: target.categoryLevel1,
      subcategory: target.categoryLevel2 ?? undefined,
      budgeted: target.monthlyTarget,
      actual,
      variance,
      percentUsed,
      status: determineBudgetStatus(percentUsed, target.warningThreshold),
      isEssential: target.isEssential,
      transactions: categoryTransactions.length,
    });

    // Remove from grouped so we can track unbudgeted categories
    grouped.delete(key);
  }

  // Add unbudgeted categories (spending without a target)
  for (const [key, txs] of grouped) {
    const [categoryLevel1, categoryLevel2] = key.split('|');
    const actual = calculateCategoryTotal(txs);

    results.push({
      category: categoryLevel1,
      subcategory: categoryLevel2,
      budgeted: 0,
      actual,
      variance: -actual, // All overspend since no budget
      percentUsed: 100,
      status: 'OVER',
      isEssential: false,
      transactions: txs.length,
    });
  }

  // Sort by variance (most over budget first)
  return results.sort((a, b) => a.variance - b.variance);
}

// =============================================================================
// MONTHLY REPORT GENERATION
// =============================================================================

/**
 * Generate insights based on budget comparison
 */
function generateInsights(
  results: BudgetComparisonResult[],
  totalIncome: number,
  totalExpenses: number,
  savingsTarget: number
): BudgetInsight[] {
  const insights: BudgetInsight[] = [];

  // Overall spending insight
  const savingsAchieved = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (savingsAchieved / totalIncome) * 100 : 0;

  if (savingsRate >= savingsTarget) {
    insights.push({
      type: 'SUCCESS',
      category: 'Overall',
      message: `You saved ${savingsRate.toFixed(1)}% of your income this month, exceeding your ${savingsTarget}% target!`,
      value: savingsAchieved,
    });
  } else if (savingsRate > 0) {
    insights.push({
      type: 'INFO',
      category: 'Overall',
      message: `You saved ${savingsRate.toFixed(1)}% of your income. Your target is ${savingsTarget}%.`,
      value: savingsAchieved,
    });
  } else {
    insights.push({
      type: 'WARNING',
      category: 'Overall',
      message: `You spent more than you earned this month. Consider reviewing your expenses.`,
      value: savingsAchieved,
    });
  }

  // Category-specific insights
  const overBudget = results.filter(r => r.status === 'OVER' && r.budgeted > 0);
  const warnings = results.filter(r => r.status === 'WARNING');
  const underBudget = results.filter(r => r.status === 'UNDER' && r.budgeted > 0);

  // Over budget warnings
  for (const result of overBudget.slice(0, 3)) {
    const overAmount = Math.abs(result.variance);
    insights.push({
      type: 'ALERT',
      category: result.subcategory ?? result.category,
      message: `${result.subcategory ?? result.category} exceeded budget by $${overAmount.toFixed(2)}`,
      value: overAmount,
    });
  }

  // Warning level alerts
  for (const result of warnings.slice(0, 2)) {
    insights.push({
      type: 'WARNING',
      category: result.subcategory ?? result.category,
      message: `${result.subcategory ?? result.category} is at ${result.percentUsed.toFixed(0)}% of budget`,
      value: result.actual,
    });
  }

  // Positive feedback for under-budget categories
  if (underBudget.length > 0) {
    const totalSaved = underBudget.reduce((sum, r) => sum + r.variance, 0);
    insights.push({
      type: 'SUCCESS',
      category: 'Budget',
      message: `You're under budget in ${underBudget.length} categories, saving $${totalSaved.toFixed(2)} in total`,
      value: totalSaved,
    });
  }

  // Unbudgeted spending warning
  const unbudgeted = results.filter(r => r.budgeted === 0 && r.actual > 0);
  if (unbudgeted.length > 0) {
    const totalUnbudgeted = unbudgeted.reduce((sum, r) => sum + r.actual, 0);
    insights.push({
      type: 'INFO',
      category: 'Unbudgeted',
      message: `$${totalUnbudgeted.toFixed(2)} spent in ${unbudgeted.length} categories without budgets set`,
      value: totalUnbudgeted,
    });
  }

  return insights;
}

/**
 * Generate a full monthly budget report
 */
export function generateMonthlyReport(
  transactions: CategorisedTransaction[],
  targets: BudgetTarget[],
  monthKey: string,
  savingsTargetPercent: number = 20
): MonthlyBudgetReport {
  const { start, end } = parseMonthKey(monthKey);

  // Calculate totals
  const monthTransactions = transactions.filter(tx =>
    tx.date >= start && tx.date <= end
  );

  const totalIncome = monthTransactions
    .filter(tx => tx.direction === 'IN' && tx.categoryType !== 'TRANSFER')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = monthTransactions
    .filter(tx => tx.direction === 'OUT' && tx.categoryType !== 'TRANSFER')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const results = compareAgainstBudget(transactions, targets, monthKey);

  // Summary calculations
  const totalBudgeted = targets.reduce((sum, t) => sum + t.monthlyTarget, 0);
  const totalActual = results.reduce((sum, r) => sum + r.actual, 0);
  const totalVariance = totalBudgeted - totalActual;
  const savingsAchieved = totalIncome - totalExpenses;
  const savingsTarget = totalIncome * (savingsTargetPercent / 100);
  const savingsRate = totalIncome > 0 ? (savingsAchieved / totalIncome) * 100 : 0;

  const categoriesOverBudget = results.filter(r =>
    r.status === 'OVER' && r.budgeted > 0
  ).length;
  const categoriesUnderBudget = results.filter(r =>
    r.status === 'UNDER' && r.budgeted > 0
  ).length;

  const insights = generateInsights(results, totalIncome, totalExpenses, savingsTargetPercent);

  return {
    month: monthKey,
    results,
    summary: {
      totalBudgeted,
      totalActual,
      totalVariance,
      savingsAchieved,
      savingsTarget,
      savingsRate,
      categoriesOverBudget,
      categoriesUnderBudget,
    },
    insights,
  };
}

/**
 * Generate a financial health narrative for the month
 */
export function generateHealthNarrative(report: MonthlyBudgetReport): string[] {
  const narratives: string[] = [];
  const { summary, results } = report;

  // Overall performance
  if (summary.savingsAchieved > 0) {
    narratives.push(
      `You saved $${summary.savingsAchieved.toFixed(2)} this month (${summary.savingsRate.toFixed(1)}% of income).`
    );
  } else {
    narratives.push(
      `You spent $${Math.abs(summary.savingsAchieved).toFixed(2)} more than you earned this month.`
    );
  }

  // Budget adherence
  if (summary.totalVariance >= 0) {
    narratives.push(
      `Overall, you spent $${summary.totalVariance.toFixed(2)} less than your total budget.`
    );
  } else {
    narratives.push(
      `Overall, you exceeded your budget by $${Math.abs(summary.totalVariance).toFixed(2)}.`
    );
  }

  // Top over-budget categories
  const overBudget = results
    .filter(r => r.status === 'OVER' && r.budgeted > 0)
    .slice(0, 2);

  for (const category of overBudget) {
    const overAmount = Math.abs(category.variance);
    narratives.push(
      `${category.subcategory ?? category.category} exceeded budget by $${overAmount.toFixed(2)}.`
    );
  }

  // Top under-budget categories
  const underBudget = results
    .filter(r => r.status === 'UNDER' && r.variance > 50)
    .slice(0, 2);

  for (const category of underBudget) {
    narratives.push(
      `Great job on ${category.subcategory ?? category.category} - $${category.variance.toFixed(2)} under budget!`
    );
  }

  return narratives;
}

/**
 * Get available months from transactions
 */
export function getAvailableMonths(transactions: CategorisedTransaction[]): string[] {
  const months = new Set<string>();

  for (const tx of transactions) {
    months.add(getMonthKey(tx.date));
  }

  return Array.from(months).sort().reverse();
}
