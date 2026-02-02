/**
 * Phase 29: Recurring Expense Detection & Auto-Creation
 * Detects recurring transactions and links/creates expense entries
 */

import prisma from '@/lib/db';
import { Frequency } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface RecurringPattern {
  merchantStandardised: string;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  frequency: Frequency;
  occurrenceCount: number;
  lastOccurrence: Date;
  nextExpected: Date;
  isEssential: boolean;
  categoryLevel1: string;
  categoryLevel2: string | null;
  transactionIds: string[];
}

export interface ExpenseMatch {
  pattern: RecurringPattern;
  existingExpenseId: string | null;
  matchConfidence: number;
  matchReasons: string[];
  suggestedAction: 'LINK' | 'CREATE' | 'REVIEW';
}

interface TransactionData {
  id: string;
  date: Date;
  amount: number;
  merchantStandardised: string | null;
  isRecurring: boolean;
  isEssential: boolean;
  categoryLevel1: string | null;
  categoryLevel2: string | null;
}

// =============================================================================
// FREQUENCY DETECTION
// =============================================================================

/**
 * Detect the frequency pattern from transaction dates
 */
function detectFrequency(dates: Date[]): { frequency: Frequency; confidence: number } {
  if (dates.length < 2) {
    return { frequency: Frequency.MONTHLY, confidence: 0 };
  }

  // Sort dates
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  // Calculate intervals between consecutive transactions
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = Math.round(
      (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    intervals.push(daysDiff);
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

  // Calculate variance
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Determine frequency based on average interval
  let frequency: Frequency;
  let expectedInterval: number;

  if (avgInterval <= 10) {
    frequency = Frequency.WEEKLY;
    expectedInterval = 7;
  } else if (avgInterval <= 18) {
    frequency = Frequency.FORTNIGHTLY;
    expectedInterval = 14;
  } else if (avgInterval <= 45) {
    frequency = Frequency.MONTHLY;
    expectedInterval = 30;
  } else if (avgInterval <= 100) {
    frequency = Frequency.QUARTERLY;
    expectedInterval = 90;
  } else {
    frequency = Frequency.ANNUAL;
    expectedInterval = 365;
  }

  // Calculate confidence based on consistency
  const intervalVariance = stdDev / expectedInterval;
  const confidence = Math.max(0, 1 - intervalVariance);

  return { frequency, confidence };
}

/**
 * Calculate next expected date based on frequency
 */
function calculateNextExpected(lastDate: Date, frequency: Frequency): Date {
  const next = new Date(lastDate);

  switch (frequency) {
    case Frequency.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case Frequency.FORTNIGHTLY:
      next.setDate(next.getDate() + 14);
      break;
    case Frequency.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case Frequency.QUARTERLY:
      next.setMonth(next.getMonth() + 3);
      break;
    case Frequency.ANNUAL:
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

// =============================================================================
// RECURRING PATTERN DETECTION
// =============================================================================

/**
 * Detect recurring patterns from transactions
 */
export async function detectRecurringPatterns(
  userId: string,
  accountId?: string,
  minOccurrences: number = 2
): Promise<RecurringPattern[]> {
  // Get transactions marked as recurring or with repeated merchants
  const transactions = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      direction: 'OUT',
      merchantStandardised: { not: null },
      ...(accountId ? { accountId } : {}),
    },
    select: {
      id: true,
      date: true,
      amount: true,
      merchantStandardised: true,
      isRecurring: true,
      isEssential: true,
      categoryLevel1: true,
      categoryLevel2: true,
    },
    orderBy: { date: 'desc' },
    take: 1000, // Last 1000 transactions
  });

  // Group by merchant
  const merchantGroups = new Map<string, TransactionData[]>();

  for (const tx of transactions) {
    const key = tx.merchantStandardised!.toLowerCase();
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(tx);
  }

  // Analyze each merchant group
  const patterns: RecurringPattern[] = [];

  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < minOccurrences) continue;

    // Calculate amount statistics
    const amounts = txs.map(tx => tx.amount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    // Check amount consistency (within 20% variance)
    const amountVariance = (maxAmount - minAmount) / avgAmount;
    if (amountVariance > 0.3) continue; // Too much variance, likely not recurring

    // Detect frequency
    const dates = txs.map(tx => tx.date);
    const { frequency, confidence } = detectFrequency(dates);

    if (confidence < 0.5) continue; // Not consistent enough

    // Get most recent values
    const latestTx = txs[0];
    const lastOccurrence = latestTx.date;
    const nextExpected = calculateNextExpected(lastOccurrence, frequency);

    // Determine if essential (majority vote)
    const essentialCount = txs.filter(tx => tx.isEssential).length;
    const isEssential = essentialCount > txs.length / 2;

    // Get most common category
    const categoryVotes = new Map<string, number>();
    for (const tx of txs) {
      const cat = tx.categoryLevel1 || 'Other';
      categoryVotes.set(cat, (categoryVotes.get(cat) || 0) + 1);
    }
    const categoryLevel1 = Array.from(categoryVotes.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    patterns.push({
      merchantStandardised: txs[0].merchantStandardised!,
      averageAmount: avgAmount,
      minAmount,
      maxAmount,
      frequency,
      occurrenceCount: txs.length,
      lastOccurrence,
      nextExpected,
      isEssential,
      categoryLevel1,
      categoryLevel2: latestTx.categoryLevel2,
      transactionIds: txs.map(tx => tx.id),
    });
  }

  // Sort by occurrence count (most frequent first)
  patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  return patterns;
}

// =============================================================================
// EXPENSE MATCHING
// =============================================================================

/**
 * Match recurring patterns to existing expenses
 */
export async function matchPatternsToExpenses(
  userId: string,
  patterns: RecurringPattern[]
): Promise<ExpenseMatch[]> {
  // Get user's existing recurring expenses
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      isRecurring: true,
    },
    select: {
      id: true,
      name: true,
      vendorName: true,
      amount: true,
      frequency: true,
      category: true,
      isEssential: true,
    },
  });

  const matches: ExpenseMatch[] = [];

  for (const pattern of patterns) {
    let bestMatch: typeof expenses[0] | null = null;
    let bestConfidence = 0;
    const matchReasons: string[] = [];

    for (const expense of expenses) {
      let confidence = 0;
      const reasons: string[] = [];

      // Match by vendor name
      const vendorSimilarity = calculateSimilarity(
        pattern.merchantStandardised.toLowerCase(),
        (expense.vendorName || expense.name).toLowerCase()
      );
      if (vendorSimilarity > 0.7) {
        confidence += 0.4;
        reasons.push(`Vendor name matches (${Math.round(vendorSimilarity * 100)}%)`);
      }

      // Match by amount (within 15%)
      const amountDiff = Math.abs(pattern.averageAmount - expense.amount) / expense.amount;
      if (amountDiff <= 0.15) {
        confidence += 0.3;
        reasons.push(`Amount matches ($${pattern.averageAmount.toFixed(2)} vs $${expense.amount.toFixed(2)})`);
      }

      // Match by frequency
      if (pattern.frequency === expense.frequency) {
        confidence += 0.2;
        reasons.push(`Frequency matches (${pattern.frequency})`);
      }

      // Bonus for essential match
      if (pattern.isEssential === expense.isEssential) {
        confidence += 0.1;
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = expense;
        matchReasons.length = 0;
        matchReasons.push(...reasons);
      }
    }

    const suggestedAction: 'LINK' | 'CREATE' | 'REVIEW' =
      bestConfidence >= 0.7 ? 'LINK' :
      bestConfidence >= 0.4 ? 'REVIEW' : 'CREATE';

    matches.push({
      pattern,
      existingExpenseId: bestMatch?.id || null,
      matchConfidence: bestConfidence,
      matchReasons,
      suggestedAction,
    });
  }

  return matches;
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

// =============================================================================
// EXPENSE CREATION/LINKING
// =============================================================================

/**
 * Create or link expenses based on matches
 */
export async function processExpenseMatches(
  userId: string,
  matches: ExpenseMatch[],
  autoLinkThreshold: number = 0.7
): Promise<{
  linked: number;
  created: number;
  needsReview: number;
  results: Array<{
    merchantStandardised: string;
    action: 'LINKED' | 'CREATED' | 'NEEDS_REVIEW';
    expenseId: string | null;
  }>;
}> {
  const results: Array<{
    merchantStandardised: string;
    action: 'LINKED' | 'CREATED' | 'NEEDS_REVIEW';
    expenseId: string | null;
  }> = [];

  let linked = 0;
  let created = 0;
  let needsReview = 0;

  for (const match of matches) {
    if (match.suggestedAction === 'LINK' && match.existingExpenseId) {
      // Link to existing expense
      await prisma.recurringPayment.upsert({
        where: {
          userId_merchantStandardised_accountId: {
            userId,
            merchantStandardised: match.pattern.merchantStandardised,
            accountId: match.pattern.transactionIds[0] ?
              (await prisma.unifiedTransaction.findUnique({
                where: { id: match.pattern.transactionIds[0] },
                select: { accountId: true },
              }))?.accountId || '' : '',
          },
        },
        create: {
          userId,
          merchantStandardised: match.pattern.merchantStandardised,
          accountId: match.pattern.transactionIds[0] ?
            (await prisma.unifiedTransaction.findUnique({
              where: { id: match.pattern.transactionIds[0] },
              select: { accountId: true },
            }))?.accountId || '' : '',
          pattern: match.pattern.frequency as any,
          expectedAmount: match.pattern.averageAmount,
          lastOccurrence: match.pattern.lastOccurrence,
          nextExpected: match.pattern.nextExpected,
          occurrenceCount: match.pattern.occurrenceCount,
          linkedExpenseId: match.existingExpenseId,
          matchConfidence: match.matchConfidence,
          matchStatus: 'LINKED',
        },
        update: {
          pattern: match.pattern.frequency as any,
          expectedAmount: match.pattern.averageAmount,
          lastOccurrence: match.pattern.lastOccurrence,
          nextExpected: match.pattern.nextExpected,
          occurrenceCount: match.pattern.occurrenceCount,
          linkedExpenseId: match.existingExpenseId,
          matchConfidence: match.matchConfidence,
          matchStatus: 'LINKED',
        },
      });

      results.push({
        merchantStandardised: match.pattern.merchantStandardised,
        action: 'LINKED',
        expenseId: match.existingExpenseId,
      });
      linked++;

    } else if (match.suggestedAction === 'CREATE') {
      // Create new expense
      const expense = await prisma.expense.create({
        data: {
          userId,
          name: match.pattern.merchantStandardised,
          vendorName: match.pattern.merchantStandardised,
          category: match.pattern.categoryLevel1 as any || 'OTHER',
          amount: match.pattern.averageAmount,
          frequency: match.pattern.frequency,
          isRecurring: true,
          isEssential: match.pattern.isEssential,
          isTaxDeductible: false,
        },
      });

      // Link the recurring payment
      const firstTx = await prisma.unifiedTransaction.findFirst({
        where: { id: { in: match.pattern.transactionIds } },
        select: { accountId: true },
      });

      if (firstTx) {
        await prisma.recurringPayment.create({
          data: {
            userId,
            merchantStandardised: match.pattern.merchantStandardised,
            accountId: firstTx.accountId,
            pattern: match.pattern.frequency as any,
            expectedAmount: match.pattern.averageAmount,
            lastOccurrence: match.pattern.lastOccurrence,
            nextExpected: match.pattern.nextExpected,
            occurrenceCount: match.pattern.occurrenceCount,
            linkedExpenseId: expense.id,
            matchConfidence: 1.0,
            matchStatus: 'CREATED',
          },
        });
      }

      results.push({
        merchantStandardised: match.pattern.merchantStandardised,
        action: 'CREATED',
        expenseId: expense.id,
      });
      created++;

    } else {
      // Needs review
      const firstTx = await prisma.unifiedTransaction.findFirst({
        where: { id: { in: match.pattern.transactionIds } },
        select: { accountId: true },
      });

      if (firstTx) {
        await prisma.recurringPayment.upsert({
          where: {
            userId_merchantStandardised_accountId: {
              userId,
              merchantStandardised: match.pattern.merchantStandardised,
              accountId: firstTx.accountId,
            },
          },
          create: {
            userId,
            merchantStandardised: match.pattern.merchantStandardised,
            accountId: firstTx.accountId,
            pattern: match.pattern.frequency as any,
            expectedAmount: match.pattern.averageAmount,
            lastOccurrence: match.pattern.lastOccurrence,
            nextExpected: match.pattern.nextExpected,
            occurrenceCount: match.pattern.occurrenceCount,
            matchConfidence: match.matchConfidence,
            matchStatus: 'SUGGESTED',
          },
          update: {
            pattern: match.pattern.frequency as any,
            expectedAmount: match.pattern.averageAmount,
            lastOccurrence: match.pattern.lastOccurrence,
            nextExpected: match.pattern.nextExpected,
            occurrenceCount: match.pattern.occurrenceCount,
            matchConfidence: match.matchConfidence,
            matchStatus: 'SUGGESTED',
          },
        });
      }

      results.push({
        merchantStandardised: match.pattern.merchantStandardised,
        action: 'NEEDS_REVIEW',
        expenseId: match.existingExpenseId,
      });
      needsReview++;
    }
  }

  return { linked, created, needsReview, results };
}

// =============================================================================
// API HELPERS
// =============================================================================

/**
 * Run full recurring expense detection and matching
 */
export async function runRecurringExpenseDetection(
  userId: string,
  accountId?: string,
  options: {
    minOccurrences?: number;
    autoLinkThreshold?: number;
    autoCreate?: boolean;
  } = {}
): Promise<{
  patterns: RecurringPattern[];
  matches: ExpenseMatch[];
  processed?: Awaited<ReturnType<typeof processExpenseMatches>>;
}> {
  const {
    minOccurrences = 2,
    autoLinkThreshold = 0.7,
    autoCreate = false,
  } = options;

  // Detect patterns
  const patterns = await detectRecurringPatterns(userId, accountId, minOccurrences);

  // Match to expenses
  const matches = await matchPatternsToExpenses(userId, patterns);

  // Process if auto mode
  let processed;
  if (autoCreate) {
    processed = await processExpenseMatches(userId, matches, autoLinkThreshold);
  }

  return { patterns, matches, processed };
}
