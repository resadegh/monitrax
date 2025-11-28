/**
 * TRANSACTION INTELLIGENCE ENGINE (TIE) - BEHAVIOURAL ENGINE
 * Phase 13 - Transactional Intelligence
 *
 * Handles:
 * - Recurring payment detection
 * - Anomaly detection (duplicates, unusual amounts, price increases)
 * - Spending pattern analysis
 * - Merchant behaviour tracking
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.2 Component 3
 */

import {
  UnifiedTransaction,
  RecurringPayment,
  RecurrencePattern,
  AnomalyType,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Thresholds for recurring detection
 */
const RECURRING_THRESHOLDS = {
  MIN_OCCURRENCES: 2, // Minimum occurrences to consider recurring
  AMOUNT_VARIANCE: 0.10, // 10% variance allowed
  DAY_VARIANCE: 5, // Days variance allowed for date matching

  // Pattern detection intervals (in days)
  WEEKLY: { min: 5, max: 9, target: 7 },
  FORTNIGHTLY: { min: 12, max: 16, target: 14 },
  MONTHLY: { min: 27, max: 34, target: 30 },
  QUARTERLY: { min: 85, max: 100, target: 91 },
  ANNUALLY: { min: 355, max: 375, target: 365 },
};

/**
 * Thresholds for anomaly detection
 */
const ANOMALY_THRESHOLDS = {
  // Amount anomaly: outside N standard deviations
  UNUSUAL_AMOUNT_STD_DEVS: 2.5,

  // Minimum transactions needed for statistical analysis
  MIN_TRANSACTIONS_FOR_STATS: 5,

  // Price increase threshold (as percentage)
  PRICE_INCREASE_THRESHOLD: 0.05, // 5% increase

  // Duplicate detection window (hours)
  DUPLICATE_WINDOW_HOURS: 24,

  // Timing anomaly (transactions at unusual hours)
  UNUSUAL_HOUR_START: 1, // 1 AM
  UNUSUAL_HOUR_END: 5, // 5 AM
};

// =============================================================================
// RECURRING PAYMENT DETECTION
// =============================================================================

/**
 * Group transactions by merchant for recurring analysis
 */
export function groupTransactionsByMerchant(
  transactions: UnifiedTransaction[]
): Map<string, UnifiedTransaction[]> {
  const groups = new Map<string, UnifiedTransaction[]>();

  for (const tx of transactions) {
    const key = (tx.merchantStandardised || tx.description).toLowerCase().trim();
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Detect the recurrence pattern from transaction dates
 */
export function detectRecurrencePattern(
  transactions: UnifiedTransaction[]
): RecurrencePattern | null {
  if (transactions.length < RECURRING_THRESHOLDS.MIN_OCCURRENCES) {
    return null;
  }

  // Sort by date
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate intervals between consecutive transactions
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = Math.round(
      (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    intervals.push(daysDiff);
  }

  if (intervals.length === 0) {
    return null;
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Match against known patterns
  const patterns: { pattern: RecurrencePattern; range: { min: number; max: number } }[] = [
    { pattern: 'WEEKLY', range: RECURRING_THRESHOLDS.WEEKLY },
    { pattern: 'FORTNIGHTLY', range: RECURRING_THRESHOLDS.FORTNIGHTLY },
    { pattern: 'MONTHLY', range: RECURRING_THRESHOLDS.MONTHLY },
    { pattern: 'QUARTERLY', range: RECURRING_THRESHOLDS.QUARTERLY },
    { pattern: 'ANNUALLY', range: RECURRING_THRESHOLDS.ANNUALLY },
  ];

  for (const { pattern, range } of patterns) {
    if (avgInterval >= range.min && avgInterval <= range.max) {
      // Verify consistency - most intervals should match the pattern
      const matchingIntervals = intervals.filter(
        (i) => i >= range.min - RECURRING_THRESHOLDS.DAY_VARIANCE &&
               i <= range.max + RECURRING_THRESHOLDS.DAY_VARIANCE
      );

      if (matchingIntervals.length / intervals.length >= 0.7) {
        return pattern;
      }
    }
  }

  // Check for irregular but recurring (same merchant, varying intervals)
  if (transactions.length >= 3) {
    return 'IRREGULAR';
  }

  return null;
}

/**
 * Calculate expected amount for recurring payment
 */
export function calculateExpectedAmount(transactions: UnifiedTransaction[]): {
  expectedAmount: number;
  variance: number;
} {
  const amounts = transactions.map((tx) => tx.amount);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // Calculate variance
  const squaredDiffs = amounts.map((a) => Math.pow(a - avg, 2));
  const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / amounts.length) / avg;

  return {
    expectedAmount: avg,
    variance: Math.min(variance, 1), // Cap at 100%
  };
}

/**
 * Predict next occurrence date
 */
export function predictNextOccurrence(
  transactions: UnifiedTransaction[],
  pattern: RecurrencePattern
): Date | null {
  if (transactions.length === 0) return null;

  // Get most recent transaction
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastDate = new Date(sorted[0].date);

  // Add expected interval based on pattern
  const intervals: Record<RecurrencePattern, number> = {
    WEEKLY: 7,
    FORTNIGHTLY: 14,
    MONTHLY: 30,
    QUARTERLY: 91,
    ANNUALLY: 365,
    IRREGULAR: 30, // Default to monthly for irregular
  };

  const daysToAdd = intervals[pattern];
  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);

  return nextDate;
}

/**
 * Detect recurring payments from transaction history
 */
export function detectRecurringPayments(
  transactions: UnifiedTransaction[],
  existingRecurring: RecurringPayment[] = []
): {
  detected: Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt'>[];
  updated: { id: string; updates: Partial<RecurringPayment> }[];
} {
  const detected: Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const updated: { id: string; updates: Partial<RecurringPayment> }[] = [];

  // Group by merchant and account
  const merchantGroups = groupTransactionsByMerchant(transactions);

  merchantGroups.forEach((txs, merchantKey) => {
    // Group by account within merchant
    const byAccount = new Map<string, UnifiedTransaction[]>();
    for (const tx of txs) {
      const accountTxs = byAccount.get(tx.accountId) || [];
      accountTxs.push(tx);
      byAccount.set(tx.accountId, accountTxs);
    }

    byAccount.forEach((accountTxs, accountId) => {
      // Only consider outgoing transactions for recurring
      const outgoing = accountTxs.filter((tx) => tx.direction === 'OUT');

      if (outgoing.length < RECURRING_THRESHOLDS.MIN_OCCURRENCES) {
        return;
      }

      // Detect pattern
      const pattern = detectRecurrencePattern(outgoing);
      if (!pattern) return;

      // Calculate expected amount
      const { expectedAmount, variance } = calculateExpectedAmount(outgoing);

      // Skip if variance is too high (not consistent amounts)
      if (variance > RECURRING_THRESHOLDS.AMOUNT_VARIANCE * 2) {
        return;
      }

      // Check if this recurring payment already exists
      const existingMatch = existingRecurring.find(
        (r) =>
          r.merchantStandardised.toLowerCase() === merchantKey &&
          r.accountId === accountId
      );

      if (existingMatch) {
        // Update existing
        const sorted = [...outgoing].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        updated.push({
          id: existingMatch.id,
          updates: {
            lastOccurrence: sorted[0].date,
            occurrenceCount: outgoing.length,
            expectedAmount,
            amountVariance: variance,
            nextExpected: predictNextOccurrence(outgoing, pattern),
          },
        });
      } else {
        // Create new
        const sorted = [...outgoing].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        detected.push({
          userId: outgoing[0].userId,
          merchantStandardised: outgoing[0].merchantStandardised || outgoing[0].description,
          accountId,
          pattern,
          expectedAmount,
          amountVariance: variance,
          lastOccurrence: sorted[0].date,
          nextExpected: predictNextOccurrence(outgoing, pattern),
          occurrenceCount: outgoing.length,
          priceIncreaseAlert: false,
          lastPriceChange: null,
          lastPriceChangeDate: null,
          isActive: true,
          isPaused: false,
        });
      }
    });
  });

  return { detected, updated };
}

// =============================================================================
// ANOMALY DETECTION
// =============================================================================

/**
 * Detect duplicate transactions
 */
export function detectDuplicates(
  transaction: UnifiedTransaction,
  recentTransactions: UnifiedTransaction[]
): boolean {
  const windowMs = ANOMALY_THRESHOLDS.DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
  const txTime = new Date(transaction.date).getTime();

  for (const recent of recentTransactions) {
    if (recent.id === transaction.id) continue;

    const recentTime = new Date(recent.date).getTime();
    const timeDiff = Math.abs(txTime - recentTime);

    if (timeDiff <= windowMs) {
      // Check for matching amount and merchant
      const sameAmount = Math.abs(transaction.amount - recent.amount) < 0.01;
      const sameMerchant =
        (transaction.merchantStandardised || transaction.description).toLowerCase() ===
        (recent.merchantStandardised || recent.description).toLowerCase();

      if (sameAmount && sameMerchant) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect unusual amount based on transaction history
 */
export function detectUnusualAmount(
  transaction: UnifiedTransaction,
  merchantHistory: UnifiedTransaction[]
): boolean {
  // Need enough history for statistical analysis
  if (merchantHistory.length < ANOMALY_THRESHOLDS.MIN_TRANSACTIONS_FOR_STATS) {
    return false;
  }

  const amounts = merchantHistory.map((tx) => tx.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const squaredDiffs = amounts.map((a) => Math.pow(a - mean, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / amounts.length);

  // Check if current amount is outside threshold
  const deviation = Math.abs(transaction.amount - mean);
  return deviation > stdDev * ANOMALY_THRESHOLDS.UNUSUAL_AMOUNT_STD_DEVS;
}

/**
 * Detect price increase for recurring payments
 */
export function detectPriceIncrease(
  transaction: UnifiedTransaction,
  recurringPayment: RecurringPayment
): { isIncrease: boolean; percentChange: number } {
  const percentChange =
    (transaction.amount - recurringPayment.expectedAmount) / recurringPayment.expectedAmount;

  return {
    isIncrease: percentChange > ANOMALY_THRESHOLDS.PRICE_INCREASE_THRESHOLD,
    percentChange,
  };
}

/**
 * Detect timing anomaly (unusual hours)
 */
export function detectTimingAnomaly(transaction: UnifiedTransaction): boolean {
  const hour = new Date(transaction.date).getHours();
  return (
    hour >= ANOMALY_THRESHOLDS.UNUSUAL_HOUR_START &&
    hour <= ANOMALY_THRESHOLDS.UNUSUAL_HOUR_END
  );
}

/**
 * Check if merchant is new (first time)
 */
export function isNewMerchant(
  transaction: UnifiedTransaction,
  allUserTransactions: UnifiedTransaction[]
): boolean {
  const merchant = (transaction.merchantStandardised || transaction.description)
    .toLowerCase()
    .trim();

  const previousWithSameMerchant = allUserTransactions.filter((tx) => {
    if (tx.id === transaction.id) return false;
    const txMerchant = (tx.merchantStandardised || tx.description).toLowerCase().trim();
    return txMerchant === merchant && new Date(tx.date) < new Date(transaction.date);
  });

  return previousWithSameMerchant.length === 0;
}

/**
 * Run all anomaly detection on a transaction
 */
export function detectAnomalies(
  transaction: UnifiedTransaction,
  context: {
    recentTransactions: UnifiedTransaction[];
    merchantHistory: UnifiedTransaction[];
    allUserTransactions: UnifiedTransaction[];
    recurringPayment?: RecurringPayment;
  }
): AnomalyType[] {
  const anomalies: AnomalyType[] = [];

  // Check for duplicates
  if (detectDuplicates(transaction, context.recentTransactions)) {
    anomalies.push('DUPLICATE');
  }

  // Check for unusual amount
  if (detectUnusualAmount(transaction, context.merchantHistory)) {
    anomalies.push('UNUSUAL_AMOUNT');
  }

  // Check for new merchant
  if (isNewMerchant(transaction, context.allUserTransactions)) {
    anomalies.push('NEW_MERCHANT');
  }

  // Check for price increase on recurring
  if (context.recurringPayment) {
    const { isIncrease } = detectPriceIncrease(transaction, context.recurringPayment);
    if (isIncrease) {
      anomalies.push('PRICE_INCREASE');
    }
  }

  // Check for timing anomaly
  if (detectTimingAnomaly(transaction)) {
    anomalies.push('TIMING_ANOMALY');
  }

  return anomalies;
}

// =============================================================================
// RECURRENCE GROUP LINKING
// =============================================================================

/**
 * Generate a recurrence group ID for linking related transactions
 */
export function generateRecurrenceGroupId(
  userId: string,
  merchantStandardised: string,
  accountId: string
): string {
  const key = `${userId}_${merchantStandardised.toLowerCase()}_${accountId}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `rg_${Math.abs(hash).toString(36)}`;
}

/**
 * Link transactions to their recurrence group
 */
export function linkToRecurrenceGroup(
  transactions: UnifiedTransaction[],
  recurringPayments: RecurringPayment[]
): Map<string, string> {
  const links = new Map<string, string>();

  for (const tx of transactions) {
    const merchant = (tx.merchantStandardised || tx.description).toLowerCase().trim();

    const matchingRecurring = recurringPayments.find(
      (r) =>
        r.merchantStandardised.toLowerCase() === merchant &&
        r.accountId === tx.accountId &&
        r.userId === tx.userId
    );

    if (matchingRecurring) {
      const groupId = generateRecurrenceGroupId(
        tx.userId,
        matchingRecurring.merchantStandardised,
        tx.accountId
      );
      links.set(tx.id, groupId);
    }
  }

  return links;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  RECURRING_THRESHOLDS,
  ANOMALY_THRESHOLDS,
};
