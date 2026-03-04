/**
 * Transaction Reconciliation Utilities
 *
 * Pure functions for detecting transaction patterns, matching to existing entries,
 * and calculating budget vs actual variances.
 *
 * DESIGN PRINCIPLE: These are pure utility functions with no database calls.
 * All data fetching should be done in the calling code.
 *
 * @see docs/blueprint/02_DESIGN_PRINCIPLES.md - Section 5.1 (Canonical Utility Locations)
 */

import { Frequency } from '@/lib/types/prisma-enums';
import { toMonthly, toAnnual, periodsPerYear } from './frequencies';

// =============================================================================
// TYPES
// =============================================================================

export interface TransactionForReconciliation {
  id: string;
  date: Date;
  amount: number;
  merchantStandardised?: string | null;
  description?: string;
}

export interface EntryForReconciliation {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  propertyId?: string | null;
  investmentAccountId?: string | null;
  category?: string;
  vendorName?: string | null;
  budgetedAmount?: number | null;
}

export interface TransactionPattern {
  transactions: TransactionForReconciliation[];
  count: number;
  detectedFrequency: Frequency;
  frequencyConfidence: number;
  averageAmount: number;
  monthlyEquivalent: number;
  totalAmount: number;
  dateRange: {
    first: Date;
    last: Date;
    spanDays: number;
  };
  amountVariance: number; // Standard deviation as percentage of mean
  isConsistent: boolean;  // Variance < 30%
}

export interface ReconciliationMatch {
  entryId: string;
  entryName: string;
  entryAmount: number;
  entryFrequency: Frequency;
  entryBudgetedAmount: number | null;
  matchScore: number;
  recommendation: 'update_amount' | 'link_only' | 'create_new';
  suggestedAmount: number;
  suggestedFrequency: Frequency;
  amountDifference: number;
  amountDifferencePercent: number;
  matchReasons: string[];
}

export interface BudgetVariance {
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'over' | 'on_track';
}

// =============================================================================
// FREQUENCY DETECTION
// =============================================================================

/**
 * Detect the frequency of transactions based on their dates
 *
 * @param dates - Array of transaction dates (must have at least 2)
 * @returns Detected frequency and confidence score (0-1)
 */
export function detectFrequency(dates: Date[]): { frequency: Frequency; confidence: number } {
  if (dates.length < 2) {
    return { frequency: 'MONTHLY', confidence: 0.3 };
  }

  // Sort dates chronologically
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  // Calculate intervals between consecutive transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0) {
      intervals.push(days);
    }
  }

  if (intervals.length === 0) {
    return { frequency: 'MONTHLY', confidence: 0.3 };
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

  // Calculate standard deviation to measure consistency
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgInterval;

  // Determine frequency based on average interval
  // Use ranges to account for real-world variation
  let frequency: Frequency;
  let baseConfidence: number;

  if (avgInterval <= 10) {
    frequency = 'WEEKLY';
    baseConfidence = avgInterval >= 5 && avgInterval <= 9 ? 0.9 : 0.7;
  } else if (avgInterval <= 20) {
    frequency = 'FORTNIGHTLY';
    baseConfidence = avgInterval >= 12 && avgInterval <= 16 ? 0.9 : 0.7;
  } else if (avgInterval <= 45) {
    frequency = 'MONTHLY';
    baseConfidence = avgInterval >= 25 && avgInterval <= 35 ? 0.9 : 0.7;
  } else if (avgInterval <= 120) {
    frequency = 'QUARTERLY';
    baseConfidence = avgInterval >= 80 && avgInterval <= 100 ? 0.9 : 0.7;
  } else {
    frequency = 'ANNUAL';
    baseConfidence = avgInterval >= 300 && avgInterval <= 400 ? 0.85 : 0.6;
  }

  // Adjust confidence based on consistency (lower variance = higher confidence)
  const consistencyFactor = Math.max(0.5, 1 - coefficientOfVariation);
  const confidence = Math.min(1, baseConfidence * consistencyFactor);

  return { frequency, confidence };
}

/**
 * Get expected interval in days for a frequency
 */
export function getExpectedIntervalDays(frequency: Frequency): number {
  switch (frequency) {
    case 'WEEKLY': return 7;
    case 'FORTNIGHTLY': return 14;
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 91;
    case 'ANNUAL': return 365;
    default: return 30;
  }
}

// =============================================================================
// TRANSACTION PATTERN ANALYSIS
// =============================================================================

/**
 * Analyze a set of transactions to detect patterns
 *
 * @param transactions - Transactions to analyze (should be from same merchant/category)
 * @returns Pattern analysis including frequency, average amount, and consistency
 */
export function analyzeTransactionPattern(
  transactions: TransactionForReconciliation[]
): TransactionPattern | null {
  if (transactions.length === 0) {
    return null;
  }

  // Sort by date
  const sorted = [...transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const dates = sorted.map(t => new Date(t.date));
  const amounts = sorted.map(t => Math.abs(t.amount));

  // Detect frequency
  const { frequency: detectedFrequency, confidence: frequencyConfidence } = detectFrequency(dates);

  // Calculate amount statistics
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  const averageAmount = totalAmount / amounts.length;

  // Calculate variance (coefficient of variation)
  const amountVariance = amounts.length > 1
    ? Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - averageAmount, 2), 0) / amounts.length) / averageAmount
    : 0;

  // Convert to monthly equivalent
  const monthlyEquivalent = toMonthly(averageAmount, detectedFrequency);

  // Date range
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const spanDays = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    transactions: sorted,
    count: transactions.length,
    detectedFrequency,
    frequencyConfidence,
    averageAmount,
    monthlyEquivalent,
    totalAmount,
    dateRange: {
      first: firstDate,
      last: lastDate,
      spanDays,
    },
    amountVariance,
    isConsistent: amountVariance < 0.3, // Less than 30% variance
  };
}

// =============================================================================
// MATCHING LOGIC
// =============================================================================

/**
 * Calculate text similarity between two strings (simple word overlap)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

/**
 * Find the best matching entry for a transaction pattern
 *
 * @param pattern - Analyzed transaction pattern
 * @param existingEntries - Existing income/expense entries to match against
 * @param merchantName - Merchant name from transactions
 * @param targetPropertyId - Property ID to filter matches (optional)
 * @param targetInvestmentAccountId - Investment account ID to filter matches (optional)
 * @param targetCategory - Category to match against (optional)
 * @returns Best match or null if no good match found
 */
export function findBestMatch(
  pattern: TransactionPattern,
  existingEntries: EntryForReconciliation[],
  merchantName?: string | null,
  targetPropertyId?: string | null,
  targetInvestmentAccountId?: string | null,
  targetCategory?: string | null
): ReconciliationMatch | null {
  if (existingEntries.length === 0) {
    return null;
  }

  let bestMatch: ReconciliationMatch | null = null;
  let bestScore = 0;

  for (const entry of existingEntries) {
    let score = 0;
    const matchReasons: string[] = [];

    // 1. Entity match (same property or investment account) - REQUIRED for property-specific
    if (targetPropertyId && entry.propertyId) {
      if (entry.propertyId === targetPropertyId) {
        score += 0.4;
        matchReasons.push('Same property');
      } else {
        continue; // Skip entries for different properties
      }
    }

    if (targetInvestmentAccountId && entry.investmentAccountId) {
      if (entry.investmentAccountId === targetInvestmentAccountId) {
        score += 0.4;
        matchReasons.push('Same investment account');
      } else {
        continue; // Skip entries for different accounts
      }
    }

    // 2. Category match
    if (targetCategory && entry.category && entry.category === targetCategory) {
      score += 0.3;
      matchReasons.push('Category match');
    }

    // 3. Merchant/vendor name similarity
    if (merchantName) {
      const nameToCompare = entry.vendorName || entry.name;
      const nameSimilarity = calculateTextSimilarity(merchantName, nameToCompare);
      if (nameSimilarity > 0.3) {
        score += nameSimilarity * 0.3;
        matchReasons.push(`Name similarity: ${Math.round(nameSimilarity * 100)}%`);
      }
    }

    // 4. Amount similarity (compare monthly equivalents)
    const entryMonthly = toMonthly(entry.amount, entry.frequency);
    const patternMonthly = pattern.monthlyEquivalent;
    const amountDiff = Math.abs(entryMonthly - patternMonthly);
    const amountDiffPercent = entryMonthly > 0 ? amountDiff / entryMonthly : 1;

    if (amountDiffPercent <= 0.05) {
      score += 0.2;
      matchReasons.push('Amount within 5%');
    } else if (amountDiffPercent <= 0.15) {
      score += 0.15;
      matchReasons.push('Amount within 15%');
    } else if (amountDiffPercent <= 0.30) {
      score += 0.1;
      matchReasons.push('Amount within 30%');
    } else if (amountDiffPercent <= 0.50) {
      score += 0.05;
      matchReasons.push('Amount within 50%');
    }

    // 5. Frequency alignment bonus
    if (entry.frequency === pattern.detectedFrequency) {
      score += 0.1;
      matchReasons.push('Frequency match');
    }

    // Only consider as match if score meets minimum threshold
    if (score >= 0.4 && score > bestScore) {
      bestScore = score;

      // Determine recommendation
      let recommendation: 'update_amount' | 'link_only' | 'create_new';
      if (amountDiffPercent > 0.05 && amountDiffPercent <= 0.50) {
        recommendation = 'update_amount';
      } else if (amountDiffPercent <= 0.05) {
        recommendation = 'link_only';
      } else {
        recommendation = 'create_new';
      }

      bestMatch = {
        entryId: entry.id,
        entryName: entry.name,
        entryAmount: entry.amount,
        entryFrequency: entry.frequency,
        entryBudgetedAmount: entry.budgetedAmount ?? null,
        matchScore: score,
        recommendation,
        suggestedAmount: pattern.averageAmount,
        suggestedFrequency: pattern.detectedFrequency,
        amountDifference: pattern.averageAmount - entry.amount,
        amountDifferencePercent: amountDiffPercent,
        matchReasons,
      };
    }
  }

  return bestMatch;
}

// =============================================================================
// BUDGET VARIANCE CALCULATIONS
// =============================================================================

/**
 * Calculate budget variance for a single entry
 */
export function calculateBudgetVariance(
  actual: number,
  budgeted: number | null | undefined
): BudgetVariance | null {
  if (budgeted === null || budgeted === undefined || budgeted === 0) {
    return null;
  }

  const variance = budgeted - actual;
  const variancePercent = (variance / budgeted) * 100;

  let status: 'under' | 'over' | 'on_track';
  if (variancePercent > 5) {
    status = 'under';
  } else if (variancePercent < -5) {
    status = 'over';
  } else {
    status = 'on_track';
  }

  return {
    budgeted,
    actual,
    variance,
    variancePercent,
    status,
  };
}

/**
 * Calculate aggregated budget variance for multiple entries
 *
 * @param entries - Array of entries with amount, budgetedAmount, and frequency
 * @returns Total monthly budget variance
 */
export function calculateAggregatedBudgetVariance(
  entries: Array<{
    amount: number;
    budgetedAmount: number | null | undefined;
    frequency: Frequency;
  }>
): BudgetVariance {
  let totalActualMonthly = 0;
  let totalBudgetedMonthly = 0;

  for (const entry of entries) {
    const actualMonthly = toMonthly(entry.amount, entry.frequency);
    totalActualMonthly += actualMonthly;

    if (entry.budgetedAmount !== null && entry.budgetedAmount !== undefined) {
      totalBudgetedMonthly += toMonthly(entry.budgetedAmount, entry.frequency);
    } else {
      // If no budget set, use actual as budget
      totalBudgetedMonthly += actualMonthly;
    }
  }

  const variance = totalBudgetedMonthly - totalActualMonthly;
  const variancePercent = totalBudgetedMonthly > 0
    ? (variance / totalBudgetedMonthly) * 100
    : 0;

  let status: 'under' | 'over' | 'on_track';
  if (variancePercent > 5) {
    status = 'under';
  } else if (variancePercent < -5) {
    status = 'over';
  } else {
    status = 'on_track';
  }

  return {
    budgeted: totalBudgetedMonthly,
    actual: totalActualMonthly,
    variance,
    variancePercent,
    status,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Filter transactions by date range (last N months)
 */
export function filterByDateRange(
  transactions: TransactionForReconciliation[],
  months: number = 12
): TransactionForReconciliation[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  return transactions.filter(t => new Date(t.date) >= cutoff);
}

/**
 * Group transactions by merchant (standardised)
 */
export function groupByMerchant(
  transactions: TransactionForReconciliation[]
): Map<string, TransactionForReconciliation[]> {
  const groups = new Map<string, TransactionForReconciliation[]>();

  for (const tx of transactions) {
    const key = tx.merchantStandardised?.toLowerCase() || tx.description?.toLowerCase() || 'unknown';
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Check if a date range spans at least N days
 */
export function spansAtLeastDays(
  transactions: TransactionForReconciliation[],
  minDays: number
): boolean {
  if (transactions.length < 2) return false;

  const dates = transactions.map(t => new Date(t.date).getTime());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const spanDays = (max - min) / (1000 * 60 * 60 * 24);

  return spanDays >= minDays;
}

/**
 * Convert amount from one frequency to another
 */
export function convertFrequency(
  amount: number,
  fromFrequency: Frequency,
  toFrequency: Frequency
): number {
  const annual = toAnnual(amount, fromFrequency);
  return annual / periodsPerYear(toFrequency);
}
