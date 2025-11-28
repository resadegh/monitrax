/**
 * TRANSACTION INTELLIGENCE ENGINE (TIE) - ANALYTICS LAYER
 * Phase 13 - Transactional Intelligence
 *
 * Handles:
 * - Rolling spend averages
 * - Trend detection
 * - Category drift analysis
 * - Predicted monthly outgoings
 * - Spending volatility calculation
 * - Spending profile generation
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.2 Component 4
 */

import {
  UnifiedTransaction,
  SpendingProfile,
  CategoryAverage,
  MonthlyPattern,
  SpendingCluster,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface SpendingSummary {
  totalSpend: number;
  totalIncome: number;
  netCashflow: number;
  transactionCount: number;
  averageTransaction: number;
  topCategories: { category: string; amount: number; percentage: number }[];
  topMerchants: { merchant: string; amount: number; count: number }[];
}

export interface TrendAnalysis {
  direction: 'INCREASING' | 'STABLE' | 'DECREASING';
  changePercent: number;
  confidence: number;
}

export interface MonthlyForecast {
  predictedSpend: number;
  confidence: number;
  breakdown: { category: string; predicted: number }[];
  factors: string[];
}

export interface CategoryDrift {
  category: string;
  previousAverage: number;
  currentAverage: number;
  changePercent: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get the start of a month
 */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get month key for grouping (YYYY-MM)
 */
function getMonthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get the number of months between two dates
 */
function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

// =============================================================================
// SPENDING CALCULATIONS
// =============================================================================

/**
 * Calculate spending summary for a period
 */
export function calculateSpendingSummary(
  transactions: UnifiedTransaction[],
  options: { startDate?: Date; endDate?: Date } = {}
): SpendingSummary {
  // Filter by date range
  let filtered = transactions;
  if (options.startDate) {
    filtered = filtered.filter((tx) => new Date(tx.date) >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter((tx) => new Date(tx.date) <= options.endDate!);
  }

  const outgoing = filtered.filter((tx) => tx.direction === 'OUT');
  const incoming = filtered.filter((tx) => tx.direction === 'IN');

  const totalSpend = outgoing.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = incoming.reduce((sum, tx) => sum + tx.amount, 0);

  // Aggregate by category
  const categoryTotals = new Map<string, number>();
  for (const tx of outgoing) {
    const category = tx.categoryLevel1 || 'Uncategorised';
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + tx.amount);
  }

  // Sort categories by amount
  const topCategories = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Aggregate by merchant
  const merchantTotals = new Map<string, { amount: number; count: number }>();
  for (const tx of outgoing) {
    const merchant = tx.merchantStandardised || tx.description;
    const current = merchantTotals.get(merchant) || { amount: 0, count: 0 };
    merchantTotals.set(merchant, {
      amount: current.amount + tx.amount,
      count: current.count + 1,
    });
  }

  const topMerchants = Array.from(merchantTotals.entries())
    .map(([merchant, data]) => ({
      merchant,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    totalSpend,
    totalIncome,
    netCashflow: totalIncome - totalSpend,
    transactionCount: filtered.length,
    averageTransaction: outgoing.length > 0 ? totalSpend / outgoing.length : 0,
    topCategories,
    topMerchants,
  };
}

/**
 * Calculate monthly spending totals
 */
export function calculateMonthlyTotals(
  transactions: UnifiedTransaction[]
): Map<string, { spend: number; income: number; count: number }> {
  const monthlyTotals = new Map<string, { spend: number; income: number; count: number }>();

  for (const tx of transactions) {
    const monthKey = getMonthKey(new Date(tx.date));
    const current = monthlyTotals.get(monthKey) || { spend: 0, income: 0, count: 0 };

    if (tx.direction === 'OUT') {
      current.spend += tx.amount;
    } else {
      current.income += tx.amount;
    }
    current.count++;

    monthlyTotals.set(monthKey, current);
  }

  return monthlyTotals;
}

/**
 * Calculate rolling average spend
 */
export function calculateRollingAverage(
  transactions: UnifiedTransaction[],
  windowMonths: number = 3
): number {
  const monthlyTotals = calculateMonthlyTotals(transactions);

  // Get the last N months
  const sortedMonths = Array.from(monthlyTotals.keys()).sort().slice(-windowMonths);

  if (sortedMonths.length === 0) return 0;

  const totalSpend = sortedMonths.reduce(
    (sum, month) => sum + (monthlyTotals.get(month)?.spend || 0),
    0
  );

  return totalSpend / sortedMonths.length;
}

// =============================================================================
// TREND ANALYSIS
// =============================================================================

/**
 * Analyse spending trend using linear regression
 */
export function analyseTrend(
  transactions: UnifiedTransaction[],
  months: number = 6
): TrendAnalysis {
  const monthlyTotals = calculateMonthlyTotals(transactions);
  const sortedMonths = Array.from(monthlyTotals.keys()).sort().slice(-months);

  if (sortedMonths.length < 2) {
    return { direction: 'STABLE', changePercent: 0, confidence: 0 };
  }

  // Get spend values
  const values = sortedMonths.map((m) => monthlyTotals.get(m)?.spend || 0);

  // Simple linear regression
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate R-squared for confidence
  const predictions = values.map((_, i) => yMean + slope * (i - xMean));
  const ssRes = values.reduce((sum, v, i) => sum + Math.pow(v - predictions[i], 2), 0);
  const ssTot = values.reduce((sum, v) => sum + Math.pow(v - yMean, 2), 0);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Determine direction
  const changePercent = yMean !== 0 ? (slope / yMean) * 100 : 0;

  let direction: 'INCREASING' | 'STABLE' | 'DECREASING';
  if (Math.abs(changePercent) < 5) {
    direction = 'STABLE';
  } else if (changePercent > 0) {
    direction = 'INCREASING';
  } else {
    direction = 'DECREASING';
  }

  return {
    direction,
    changePercent,
    confidence: Math.max(0, Math.min(1, rSquared)),
  };
}

/**
 * Detect category drift (spending pattern changes)
 */
export function detectCategoryDrift(
  transactions: UnifiedTransaction[],
  comparisonMonths: number = 3
): CategoryDrift[] {
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - comparisonMonths, 1);
  const olderCutoff = new Date(
    now.getFullYear(),
    now.getMonth() - comparisonMonths * 2,
    1
  );

  // Split transactions into periods
  const recentTxs = transactions.filter(
    (tx) => new Date(tx.date) >= cutoffDate && tx.direction === 'OUT'
  );
  const olderTxs = transactions.filter(
    (tx) =>
      new Date(tx.date) >= olderCutoff &&
      new Date(tx.date) < cutoffDate &&
      tx.direction === 'OUT'
  );

  // Calculate category averages for each period
  const recentByCategory = new Map<string, number>();
  const olderByCategory = new Map<string, number>();

  for (const tx of recentTxs) {
    const cat = tx.categoryLevel1 || 'Uncategorised';
    recentByCategory.set(cat, (recentByCategory.get(cat) || 0) + tx.amount);
  }

  for (const tx of olderTxs) {
    const cat = tx.categoryLevel1 || 'Uncategorised';
    olderByCategory.set(cat, (olderByCategory.get(cat) || 0) + tx.amount);
  }

  // Calculate monthly averages
  const recentAvgFactor = comparisonMonths;
  const olderAvgFactor = comparisonMonths;

  // Compare categories
  const allCategories = new Set([
    ...Array.from(recentByCategory.keys()),
    ...Array.from(olderByCategory.keys()),
  ]);

  const drifts: CategoryDrift[] = [];

  allCategories.forEach((category) => {
    const recentTotal = recentByCategory.get(category) || 0;
    const olderTotal = olderByCategory.get(category) || 0;

    const currentAverage = recentTotal / recentAvgFactor;
    const previousAverage = olderTotal / olderAvgFactor;

    if (previousAverage === 0 && currentAverage === 0) {
      return;
    }

    const changePercent =
      previousAverage !== 0
        ? ((currentAverage - previousAverage) / previousAverage) * 100
        : currentAverage > 0
        ? 100
        : 0;

    let trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    if (Math.abs(changePercent) < 10) {
      trend = 'STABLE';
    } else if (changePercent > 0) {
      trend = 'INCREASING';
    } else {
      trend = 'DECREASING';
    }

    // Only report significant drifts
    if (Math.abs(changePercent) >= 10) {
      drifts.push({
        category,
        previousAverage,
        currentAverage,
        changePercent,
        trend,
      });
    }
  });

  // Sort by absolute change
  return drifts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

// =============================================================================
// SPENDING FORECAST
// =============================================================================

/**
 * Forecast next month's spending
 */
export function forecastMonthlySpending(
  transactions: UnifiedTransaction[],
  historicalMonths: number = 6
): MonthlyForecast {
  const monthlyTotals = calculateMonthlyTotals(transactions);
  const sortedMonths = Array.from(monthlyTotals.keys()).sort().slice(-historicalMonths);

  if (sortedMonths.length < 2) {
    return {
      predictedSpend: 0,
      confidence: 0,
      breakdown: [],
      factors: ['Insufficient data for prediction'],
    };
  }

  // Calculate weighted average (more recent months weighted higher)
  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < sortedMonths.length; i++) {
    const weight = i + 1; // Linear weight: older = 1, newer = N
    const spend = monthlyTotals.get(sortedMonths[i])?.spend || 0;
    weightedSum += spend * weight;
    weightTotal += weight;
  }

  const baselinePrediction = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Adjust for trend
  const trend = analyseTrend(transactions, historicalMonths);
  const trendAdjustment = baselinePrediction * (trend.changePercent / 100 / 12);
  const predictedSpend = baselinePrediction + trendAdjustment;

  // Category breakdown
  const recentMonths = sortedMonths.slice(-3);
  const recentTxs = transactions.filter((tx) => {
    const monthKey = getMonthKey(new Date(tx.date));
    return recentMonths.includes(monthKey) && tx.direction === 'OUT';
  });

  const categoryTotals = new Map<string, number>();
  for (const tx of recentTxs) {
    const cat = tx.categoryLevel1 || 'Uncategorised';
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + tx.amount);
  }

  const breakdown = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({
      category,
      predicted: total / recentMonths.length,
    }))
    .sort((a, b) => b.predicted - a.predicted)
    .slice(0, 10);

  // Confidence based on data quality
  const dataPoints = sortedMonths.length;
  const variance = calculateVolatility(
    sortedMonths.map((m) => monthlyTotals.get(m)?.spend || 0)
  );
  const confidence = Math.min(1, (dataPoints / 6) * (1 - variance));

  // Explanation factors
  const factors: string[] = [];
  if (trend.direction !== 'STABLE') {
    factors.push(
      `${trend.direction === 'INCREASING' ? 'Upward' : 'Downward'} spending trend detected`
    );
  }
  if (variance > 0.3) {
    factors.push('High spending variability observed');
  }
  if (dataPoints < 4) {
    factors.push('Limited historical data available');
  }

  return {
    predictedSpend: Math.max(0, predictedSpend),
    confidence,
    breakdown,
    factors,
  };
}

// =============================================================================
// VOLATILITY & PROFILE
// =============================================================================

/**
 * Calculate spending volatility (coefficient of variation)
 */
export function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean; // Coefficient of variation
}

/**
 * Generate complete spending profile
 */
export function generateSpendingProfile(
  transactions: UnifiedTransaction[],
  userId: string
): Omit<SpendingProfile, 'id' | 'createdAt' | 'updatedAt'> {
  const outgoing = transactions.filter((tx) => tx.direction === 'OUT');
  const monthlyTotals = calculateMonthlyTotals(transactions);

  // Category averages
  const categoryTransactions = new Map<string, UnifiedTransaction[]>();
  for (const tx of outgoing) {
    const cat = tx.categoryLevel1 || 'Uncategorised';
    const txs = categoryTransactions.get(cat) || [];
    txs.push(tx);
    categoryTransactions.set(cat, txs);
  }

  const categoryAverages: Record<string, CategoryAverage> = {};
  categoryTransactions.forEach((txs, category) => {
    const amounts = txs.map((tx) => tx.amount);
    const total = amounts.reduce((a, b) => a + b, 0);
    const months = new Set(txs.map((tx) => getMonthKey(new Date(tx.date)))).size;

    const trend = analyseTrend(txs, 6);

    categoryAverages[category] = {
      avgMonthly: months > 0 ? total / months : 0,
      trend: trend.direction,
      volatility: calculateVolatility(amounts),
      transactionCount: txs.length,
    };
  });

  // Monthly patterns
  const monthlyPatterns: Record<string, MonthlyPattern> = {};
  monthlyTotals.forEach((data, monthKey) => {
    const monthTxs = outgoing.filter(
      (tx) => getMonthKey(new Date(tx.date)) === monthKey
    );

    const categories: Record<string, number> = {};
    for (const tx of monthTxs) {
      const cat = tx.categoryLevel1 || 'Uncategorised';
      categories[cat] = (categories[cat] || 0) + tx.amount;
    }

    monthlyPatterns[monthKey] = {
      totalSpend: data.spend,
      categories,
    };
  });

  // Overall volatility
  const monthlySpends = Array.from(monthlyTotals.values()).map((d) => d.spend);
  const overallVolatility = calculateVolatility(monthlySpends);

  // Category volatility
  const categoryVolatility: Record<string, number> = {};
  Object.entries(categoryAverages).forEach(([cat, avg]) => {
    categoryVolatility[cat] = avg.volatility;
  });

  // Prediction
  const forecast = forecastMonthlySpending(transactions, 6);

  return {
    userId,
    categoryAverages,
    monthlyPatterns,
    seasonalityFactors: null, // TODO: Implement seasonality detection
    spendingClusters: null, // TODO: Implement clustering
    overallVolatility,
    categoryVolatility,
    predictedMonthlySpend: forecast.predictedSpend,
    predictionConfidence: forecast.confidence,
    dataPointCount: transactions.length,
    lastCalculated: new Date(),
  };
}

// =============================================================================
// SPENDING CLUSTERS (Simple implementation)
// =============================================================================

/**
 * Identify spending clusters based on merchant patterns
 */
export function identifySpendingClusters(
  transactions: UnifiedTransaction[]
): SpendingCluster[] {
  const merchantTotals = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions.filter((t) => t.direction === 'OUT')) {
    const merchant = tx.merchantStandardised || tx.description;
    const current = merchantTotals.get(merchant) || { amount: 0, count: 0 };
    merchantTotals.set(merchant, {
      amount: current.amount + tx.amount,
      count: current.count + 1,
    });
  }

  // Get unique months for averaging
  const months = new Set(
    transactions.map((tx) => getMonthKey(new Date(tx.date)))
  ).size || 1;

  // Create clusters from top merchants
  const clusters: SpendingCluster[] = [];
  const sortedMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 20);

  for (const [merchant, data] of sortedMerchants) {
    if (data.count >= 2) {
      // Only include merchants with multiple transactions
      clusters.push({
        name: merchant,
        merchants: [merchant],
        avgMonthly: data.amount / months,
      });
    }
  }

  return clusters.slice(0, 10);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  getMonthKey,
  getMonthStart,
  monthsBetween,
};
