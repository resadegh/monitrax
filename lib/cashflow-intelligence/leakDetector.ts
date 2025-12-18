/**
 * MONEY LEAK DETECTOR
 * Phase 29 - Cashflow Intelligence Center
 *
 * Analyzes transaction patterns to identify spending leaks.
 * Provides transaction IDs for drill-down navigation.
 *
 * Leak Categories:
 * - Subscriptions (unused or forgotten)
 * - Category overspending (vs benchmarks)
 * - Price increases (creeping costs)
 * - Duplicate services
 * - Impulse spending patterns
 */

import { MoneyLeak, LeakDetectionResult } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  direction: 'IN' | 'OUT';
  categoryLevel1?: string;
  categoryLevel2?: string;
  merchantStandardised?: string;
  isRecurring: boolean;
}

export interface RecurringPayment {
  id: string;
  merchantStandardised: string;
  expectedAmount: number;
  pattern: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  priceIncreaseAlert?: boolean;
  lastPriceChange?: number;
  categoryLevel1?: string;
}

export interface SpendingBenchmarks {
  // Category benchmarks as % of income (Australian averages)
  [category: string]: number;
}

export interface LeakDetectorInput {
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
  monthlyIncome: number;
  spendingProfile?: {
    categoryAverages: Record<string, { avgMonthly: number; trend: string }>;
  };
  analysisMonths?: number; // Default: 3 months
}

// =============================================================================
// AUSTRALIAN SPENDING BENCHMARKS
// =============================================================================

const CATEGORY_BENCHMARKS: SpendingBenchmarks = {
  // As percentage of income (source: ABS Household Expenditure Survey)
  'Food & Groceries': 15,
  'Transport': 12,
  'Entertainment': 6,
  'Dining Out': 5,
  'Shopping': 8,
  'Health & Medical': 5,
  'Personal Care': 3,
  'Subscriptions': 3,
  'Alcohol & Tobacco': 3,
  'Gambling': 1,
  'Takeaway & Delivery': 4,
  'Streaming Services': 2,
};

// Categories that commonly indicate leaks
const LEAK_PRONE_CATEGORIES = [
  'Subscriptions',
  'Streaming Services',
  'Entertainment',
  'Gambling',
  'Dining Out',
  'Takeaway & Delivery',
  'Alcohol & Tobacco',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeAmount(amount: number): number {
  return Math.abs(amount);
}

function groupTransactionsByCategory(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.direction !== 'OUT') continue;

    const category = tx.categoryLevel1 || 'Uncategorized';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(tx);
  }

  return groups;
}

function groupTransactionsByMerchant(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.direction !== 'OUT') continue;

    const merchant = tx.merchantStandardised || 'Unknown';
    if (!groups.has(merchant)) {
      groups.set(merchant, []);
    }
    groups.get(merchant)!.push(tx);
  }

  return groups;
}

function calculateMonthlyAverage(
  transactions: Transaction[],
  months: number
): number {
  const total = transactions.reduce((sum, tx) => sum + normalizeAmount(tx.amount), 0);
  return total / Math.max(1, months);
}

function determineSeverity(
  monthlyAmount: number,
  monthlyIncome: number,
  percentOverBenchmark: number
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const percentOfIncome = (monthlyAmount / monthlyIncome) * 100;

  if (percentOfIncome > 10 || percentOverBenchmark > 50) return 'HIGH';
  if (percentOfIncome > 5 || percentOverBenchmark > 25) return 'MEDIUM';
  return 'LOW';
}

// =============================================================================
// LEAK DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect subscription-based leaks (unused or forgotten services)
 */
function detectSubscriptionLeaks(
  recurringPayments: RecurringPayment[],
  monthlyIncome: number
): MoneyLeak[] {
  const leaks: MoneyLeak[] = [];

  // Check for price increases
  const priceIncreases = recurringPayments.filter(
    (rp) => rp.priceIncreaseAlert && rp.lastPriceChange
  );

  for (const rp of priceIncreases) {
    if (rp.lastPriceChange && rp.lastPriceChange > 0) {
      const monthlyImpact =
        rp.pattern === 'ANNUALLY'
          ? rp.lastPriceChange / 12
          : rp.pattern === 'QUARTERLY'
          ? rp.lastPriceChange / 3
          : rp.lastPriceChange;

      if (monthlyImpact > 5) {
        // Only flag increases > $5/mo
        leaks.push({
          id: `leak-price-${rp.id}`,
          category: 'Price Increases',
          description: `${rp.merchantStandardised} increased by $${rp.lastPriceChange.toFixed(2)}`,
          monthlyAmount: monthlyImpact,
          percentOfIncome: (monthlyImpact / monthlyIncome) * 100,
          severity: determineSeverity(monthlyImpact, monthlyIncome, 0),
          trend: 'INCREASING',
          transactionIds: [rp.id],
          recommendation: `Review if ${rp.merchantStandardised} still provides value at the new price`,
        });
      }
    }
  }

  // Check for streaming service stacking (common leak)
  const streamingServices = recurringPayments.filter((rp) =>
    ['Netflix', 'Stan', 'Disney+', 'Amazon Prime', 'Paramount+', 'Binge', 'Apple TV+', 'YouTube Premium', 'Spotify', 'Apple Music']
      .some((s) => rp.merchantStandardised.toLowerCase().includes(s.toLowerCase()))
  );

  if (streamingServices.length >= 3) {
    const totalMonthly = streamingServices.reduce((sum, rp) => {
      if (rp.pattern === 'ANNUALLY') return sum + rp.expectedAmount / 12;
      return sum + rp.expectedAmount;
    }, 0);

    leaks.push({
      id: 'leak-streaming-stack',
      category: 'Streaming Services',
      description: `${streamingServices.length} streaming services totaling $${totalMonthly.toFixed(0)}/mo`,
      monthlyAmount: totalMonthly,
      percentOfIncome: (totalMonthly / monthlyIncome) * 100,
      severity: totalMonthly > 100 ? 'HIGH' : totalMonthly > 50 ? 'MEDIUM' : 'LOW',
      trend: 'STABLE',
      transactionIds: streamingServices.map((rp) => rp.id),
      recommendation: 'Consider rotating services or bundling to reduce costs',
    });
  }

  return leaks;
}

/**
 * Detect category overspending leaks
 */
function detectCategoryOverspending(
  transactions: Transaction[],
  monthlyIncome: number,
  analysisMonths: number
): MoneyLeak[] {
  const leaks: MoneyLeak[] = [];
  const categoryGroups = groupTransactionsByCategory(transactions);

  for (const [category, txs] of categoryGroups) {
    const monthlyAvg = calculateMonthlyAverage(txs, analysisMonths);
    const benchmark = CATEGORY_BENCHMARKS[category];

    if (!benchmark) continue;

    const benchmarkAmount = (benchmark / 100) * monthlyIncome;
    const percentOver = ((monthlyAvg - benchmarkAmount) / benchmarkAmount) * 100;

    // Only flag if significantly over benchmark (>25%)
    if (percentOver > 25 && LEAK_PRONE_CATEGORIES.includes(category)) {
      leaks.push({
        id: `leak-category-${category.toLowerCase().replace(/\s+/g, '-')}`,
        category,
        description: `Spending ${percentOver.toFixed(0)}% above average on ${category}`,
        monthlyAmount: monthlyAvg,
        percentOfIncome: (monthlyAvg / monthlyIncome) * 100,
        severity: determineSeverity(monthlyAvg, monthlyIncome, percentOver),
        trend: 'STABLE', // Would calculate from historical if available
        transactionIds: txs.slice(0, 10).map((tx) => tx.id), // Top 10 transactions
        recommendation: getRecommendation(category, percentOver),
      });
    }
  }

  return leaks;
}

/**
 * Detect high-frequency small purchases (impulse spending)
 */
function detectImpulseSpending(
  transactions: Transaction[],
  monthlyIncome: number,
  analysisMonths: number
): MoneyLeak[] {
  const leaks: MoneyLeak[] = [];
  const merchantGroups = groupTransactionsByMerchant(transactions);

  // Look for frequent small purchases at same merchant
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 10) continue; // Need enough transactions

    const avgAmount = txs.reduce((sum, tx) => sum + normalizeAmount(tx.amount), 0) / txs.length;

    // Flag if small purchases (<$30) with high frequency
    if (avgAmount < 30 && txs.length > 15 * analysisMonths) {
      const monthlyTotal = calculateMonthlyAverage(txs, analysisMonths);

      if (monthlyTotal > 50) {
        leaks.push({
          id: `leak-impulse-${merchant.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
          category: 'Impulse Spending',
          description: `${(txs.length / analysisMonths).toFixed(0)} purchases/month at ${merchant} averaging $${avgAmount.toFixed(0)}`,
          monthlyAmount: monthlyTotal,
          percentOfIncome: (monthlyTotal / monthlyIncome) * 100,
          severity: monthlyTotal > 200 ? 'HIGH' : monthlyTotal > 100 ? 'MEDIUM' : 'LOW',
          trend: 'STABLE',
          transactionIds: txs.slice(0, 10).map((tx) => tx.id),
          recommendation: `Consider reducing frequency of ${merchant} purchases`,
        });
      }
    }
  }

  return leaks;
}

/**
 * Detect takeaway/food delivery over-reliance
 */
function detectTakeawayLeaks(
  transactions: Transaction[],
  monthlyIncome: number,
  analysisMonths: number
): MoneyLeak[] {
  const leaks: MoneyLeak[] = [];

  // Filter takeaway/delivery transactions
  const takeawayTxs = transactions.filter(
    (tx) =>
      tx.direction === 'OUT' &&
      (tx.categoryLevel1?.toLowerCase().includes('takeaway') ||
        tx.categoryLevel1?.toLowerCase().includes('delivery') ||
        tx.categoryLevel2?.toLowerCase().includes('takeaway') ||
        tx.categoryLevel2?.toLowerCase().includes('delivery') ||
        ['Uber Eats', 'DoorDash', 'Menulog', 'Deliveroo']
          .some((s) => tx.merchantStandardised?.includes(s)))
  );

  if (takeawayTxs.length > 0) {
    const monthlyTotal = calculateMonthlyAverage(takeawayTxs, analysisMonths);
    const percentOfIncome = (monthlyTotal / monthlyIncome) * 100;

    // Flag if takeaway exceeds 5% of income
    if (percentOfIncome > 5) {
      leaks.push({
        id: 'leak-takeaway-delivery',
        category: 'Takeaway & Delivery',
        description: `$${monthlyTotal.toFixed(0)}/month on food delivery (${percentOfIncome.toFixed(1)}% of income)`,
        monthlyAmount: monthlyTotal,
        percentOfIncome,
        severity: percentOfIncome > 10 ? 'HIGH' : percentOfIncome > 7 ? 'MEDIUM' : 'LOW',
        trend: 'STABLE',
        transactionIds: takeawayTxs.slice(0, 10).map((tx) => tx.id),
        recommendation: 'Consider meal planning to reduce delivery frequency',
      });
    }
  }

  return leaks;
}

function getRecommendation(category: string, percentOver: number): string {
  const recommendations: Record<string, string> = {
    'Entertainment': 'Review entertainment subscriptions and look for free alternatives',
    'Dining Out': 'Try cooking more meals at home to reduce dining costs',
    'Shopping': 'Implement a waiting period before non-essential purchases',
    'Gambling': 'Consider setting strict spending limits or seeking support',
    'Alcohol & Tobacco': 'Track consumption and consider reducing frequency',
    'Subscriptions': 'Audit active subscriptions and cancel unused services',
    'Streaming Services': 'Rotate between services instead of subscribing to all',
  };

  return (
    recommendations[category] ||
    `Review ${category} spending and identify areas to cut back`
  );
}

// =============================================================================
// MAIN DETECTOR FUNCTION
// =============================================================================

/**
 * Analyze transactions and detect money leaks
 */
export function detectMoneyLeaks(input: LeakDetectorInput): LeakDetectionResult {
  const analysisMonths = input.analysisMonths || 3;
  const now = new Date();
  const analysisStart = new Date(now);
  analysisStart.setMonth(analysisStart.getMonth() - analysisMonths);

  // Filter transactions within analysis period
  const filteredTransactions = input.transactions.filter(
    (tx) => new Date(tx.date) >= analysisStart && tx.direction === 'OUT'
  );

  // Run all detection algorithms
  const allLeaks: MoneyLeak[] = [
    ...detectSubscriptionLeaks(input.recurringPayments, input.monthlyIncome),
    ...detectCategoryOverspending(filteredTransactions, input.monthlyIncome, analysisMonths),
    ...detectImpulseSpending(filteredTransactions, input.monthlyIncome, analysisMonths),
    ...detectTakeawayLeaks(filteredTransactions, input.monthlyIncome, analysisMonths),
  ];

  // Sort by severity and amount
  allLeaks.sort((a, b) => {
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.monthlyAmount - a.monthlyAmount;
  });

  // Calculate total leakage
  const totalLeakage = allLeaks.reduce((sum, leak) => sum + leak.monthlyAmount, 0);

  // Calculate top categories
  const categoryTotals = new Map<string, number>();
  for (const leak of allLeaks) {
    const current = categoryTotals.get(leak.category) || 0;
    categoryTotals.set(leak.category, current + leak.monthlyAmount);
  }

  const topCategories = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / totalLeakage) * 100 || 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    totalLeakage,
    leaks: allLeaks.slice(0, 10), // Top 10 leaks
    topCategories,
    analyzedFrom: analysisStart,
    analyzedTo: now,
    transactionCount: filteredTransactions.length,
  };
}
