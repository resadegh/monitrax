/**
 * Phase 29: Smart Duplicate Detection
 * Enhanced duplicate detection with:
 * - Fuzzy matching for similar transactions
 * - Overlap detection between import batches
 * - Intelligent merging of duplicate data
 */

import prisma from '@/lib/db';
import { NormalisedTransaction, DuplicateCheckResult } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface DuplicateConfig {
  // Time window for considering transactions as potential duplicates (days)
  timeWindowDays: number;
  // Amount tolerance for fuzzy matching (percentage)
  amountTolerancePercent: number;
  // Minimum similarity score to flag as duplicate (0-1)
  similarityThreshold: number;
  // Enable fuzzy matching (beyond exact hash match)
  enableFuzzyMatching: boolean;
}

export interface OverlapDetectionResult {
  hasOverlap: boolean;
  overlapDateRange: { start: Date; end: Date } | null;
  existingBatchIds: string[];
  potentialDuplicateCount: number;
  message: string;
}

export interface DuplicateResult {
  transaction: NormalisedTransaction;
  status: 'NEW' | 'EXACT_DUPLICATE' | 'FUZZY_DUPLICATE' | 'POTENTIAL_MERGE';
  duplicateOf?: string;
  existingTransaction?: {
    id: string;
    date: Date;
    amount: number;
    description: string;
    merchantStandardised: string | null;
  };
  similarityScore: number;
  matchType: string;
  recommendation: 'IMPORT' | 'SKIP' | 'REVIEW';
}

export interface BatchDuplicateResult {
  newTransactions: DuplicateResult[];
  exactDuplicates: DuplicateResult[];
  fuzzyDuplicates: DuplicateResult[];
  potentialMerges: DuplicateResult[];
  statistics: {
    total: number;
    new: number;
    exactDuplicates: number;
    fuzzyDuplicates: number;
    potentialMerges: number;
  };
  skippedInfo: {
    count: number;
    dateRange: { start: Date; end: Date } | null;
    reasons: string[];
  };
}

const DEFAULT_CONFIG: DuplicateConfig = {
  timeWindowDays: 3,
  amountTolerancePercent: 1, // 1% tolerance
  similarityThreshold: 0.85,
  enableFuzzyMatching: true,
};

// =============================================================================
// STRING SIMILARITY
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate string similarity (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLength;
}

/**
 * Normalize merchant name for comparison
 */
function normalizeMerchant(merchant: string | null | undefined): string {
  if (!merchant) return '';
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// =============================================================================
// OVERLAP DETECTION
// =============================================================================

/**
 * Check for date range overlap with existing import batches
 */
export async function detectOverlap(
  userId: string,
  accountId: string,
  newDateRange: { start: Date; end: Date }
): Promise<OverlapDetectionResult> {
  // Find existing batches that overlap with the new date range
  const overlappingBatches = await prisma.importBatch.findMany({
    where: {
      userId,
      accountId,
      status: { in: ['COMPLETED', 'PARTIAL'] },
      OR: [
        // New range starts within existing range
        {
          dateRangeStart: { lte: newDateRange.start },
          dateRangeEnd: { gte: newDateRange.start },
        },
        // New range ends within existing range
        {
          dateRangeStart: { lte: newDateRange.end },
          dateRangeEnd: { gte: newDateRange.end },
        },
        // New range contains existing range
        {
          dateRangeStart: { gte: newDateRange.start },
          dateRangeEnd: { lte: newDateRange.end },
        },
      ],
    },
    select: {
      id: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      importedCount: true,
    },
    orderBy: { dateRangeStart: 'asc' },
  });

  if (overlappingBatches.length === 0) {
    return {
      hasOverlap: false,
      overlapDateRange: null,
      existingBatchIds: [],
      potentialDuplicateCount: 0,
      message: 'No overlapping import batches found',
    };
  }

  // Calculate the overlap date range
  const overlapStart = new Date(
    Math.max(
      newDateRange.start.getTime(),
      Math.min(...overlappingBatches.map(b => b.dateRangeStart.getTime()))
    )
  );
  const overlapEnd = new Date(
    Math.min(
      newDateRange.end.getTime(),
      Math.max(...overlappingBatches.map(b => b.dateRangeEnd.getTime()))
    )
  );

  // Count potential duplicates in overlap range
  const potentialDuplicates = await prisma.unifiedTransaction.count({
    where: {
      userId,
      accountId,
      date: {
        gte: overlapStart,
        lte: overlapEnd,
      },
    },
  });

  return {
    hasOverlap: true,
    overlapDateRange: { start: overlapStart, end: overlapEnd },
    existingBatchIds: overlappingBatches.map(b => b.id),
    potentialDuplicateCount: potentialDuplicates,
    message: `Found ${overlappingBatches.length} overlapping batch(es) with ${potentialDuplicates} potential duplicate transactions`,
  };
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Get existing transactions for duplicate checking
 */
async function getExistingTransactions(
  userId: string,
  accountId: string,
  dateRange: { start: Date; end: Date },
  config: DuplicateConfig
): Promise<{
  id: string;
  date: Date;
  amount: number;
  direction: string;
  description: string;
  merchantStandardised: string | null;
  hash?: string;
}[]> {
  // Expand date range by time window for fuzzy matching
  const expandedStart = new Date(dateRange.start);
  expandedStart.setDate(expandedStart.getDate() - config.timeWindowDays);

  const expandedEnd = new Date(dateRange.end);
  expandedEnd.setDate(expandedEnd.getDate() + config.timeWindowDays);

  const transactions = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      accountId,
      date: {
        gte: expandedStart,
        lte: expandedEnd,
      },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      direction: true,
      description: true,
      merchantStandardised: true,
    },
  });

  return transactions.map(t => ({
    ...t,
    direction: t.direction as string,
  }));
}

/**
 * Check if two transactions are duplicates
 */
function checkDuplicate(
  newTx: NormalisedTransaction,
  existingTx: {
    id: string;
    date: Date;
    amount: number;
    direction: string;
    description: string;
    merchantStandardised: string | null;
  },
  config: DuplicateConfig
): { isDuplicate: boolean; score: number; matchType: string } {
  // Quick checks first

  // Direction must match
  if (newTx.direction !== existingTx.direction) {
    return { isDuplicate: false, score: 0, matchType: 'NONE' };
  }

  // Amount check (with tolerance)
  const amountDiff = Math.abs(newTx.amount - existingTx.amount);
  const amountTolerance = Math.max(newTx.amount, existingTx.amount) *
    (config.amountTolerancePercent / 100);

  if (amountDiff > amountTolerance) {
    return { isDuplicate: false, score: 0, matchType: 'NONE' };
  }

  // Date check (within time window)
  const timeDiff = Math.abs(newTx.date.getTime() - existingTx.date.getTime());
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

  if (daysDiff > config.timeWindowDays) {
    return { isDuplicate: false, score: 0, matchType: 'NONE' };
  }

  // Exact match check (same day, same amount, same description)
  if (
    daysDiff < 1 &&
    amountDiff < 0.01 &&
    stringSimilarity(newTx.description, existingTx.description) > 0.95
  ) {
    return { isDuplicate: true, score: 1.0, matchType: 'EXACT' };
  }

  // Fuzzy matching
  if (!config.enableFuzzyMatching) {
    return { isDuplicate: false, score: 0, matchType: 'NONE' };
  }

  // Calculate similarity score
  const dateScore = 1 - (daysDiff / config.timeWindowDays);
  const amountScore = 1 - (amountDiff / Math.max(newTx.amount, existingTx.amount, 1));

  // Merchant similarity
  const newMerchant = normalizeMerchant(newTx.merchantStandardised);
  const existingMerchant = normalizeMerchant(existingTx.merchantStandardised);
  const merchantScore = stringSimilarity(newMerchant, existingMerchant);

  // Description similarity
  const descScore = stringSimilarity(newTx.description, existingTx.description);

  // Weighted score
  const score = (
    dateScore * 0.2 +
    amountScore * 0.3 +
    merchantScore * 0.3 +
    descScore * 0.2
  );

  if (score >= config.similarityThreshold) {
    return { isDuplicate: true, score, matchType: 'FUZZY' };
  }

  // Potential merge: same merchant, similar amount, different day
  if (
    merchantScore > 0.8 &&
    amountScore > 0.95 &&
    daysDiff <= 3
  ) {
    return { isDuplicate: false, score, matchType: 'POTENTIAL_MERGE' };
  }

  return { isDuplicate: false, score, matchType: 'NONE' };
}

/**
 * Detect duplicates in a batch of transactions
 */
export async function detectDuplicates(
  userId: string,
  accountId: string,
  transactions: NormalisedTransaction[],
  config: DuplicateConfig = DEFAULT_CONFIG
): Promise<BatchDuplicateResult> {
  if (transactions.length === 0) {
    return {
      newTransactions: [],
      exactDuplicates: [],
      fuzzyDuplicates: [],
      potentialMerges: [],
      statistics: {
        total: 0,
        new: 0,
        exactDuplicates: 0,
        fuzzyDuplicates: 0,
        potentialMerges: 0,
      },
      skippedInfo: {
        count: 0,
        dateRange: null,
        reasons: [],
      },
    };
  }

  // Calculate date range of new transactions
  const dates = transactions.map(t => t.date.getTime());
  const dateRange = {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates)),
  };

  // Get existing transactions for comparison
  const existingTransactions = await getExistingTransactions(
    userId,
    accountId,
    dateRange,
    config
  );

  // Track processed hashes to detect duplicates within the batch
  const processedHashes = new Set<string>();

  const results: {
    new: DuplicateResult[];
    exact: DuplicateResult[];
    fuzzy: DuplicateResult[];
    merge: DuplicateResult[];
  } = {
    new: [],
    exact: [],
    fuzzy: [],
    merge: [],
  };

  const skippedReasons: string[] = [];

  for (const tx of transactions) {
    // Check for duplicates within the batch
    if (processedHashes.has(tx.hash)) {
      results.exact.push({
        transaction: tx,
        status: 'EXACT_DUPLICATE',
        similarityScore: 1.0,
        matchType: 'BATCH_DUPLICATE',
        recommendation: 'SKIP',
      });
      skippedReasons.push(`Duplicate within import batch: ${tx.description}`);
      continue;
    }

    // Check against existing transactions
    let bestMatch: {
      existing: typeof existingTransactions[0];
      score: number;
      matchType: string;
    } | null = null;

    for (const existing of existingTransactions) {
      const result = checkDuplicate(tx, existing, config);

      if (result.isDuplicate || result.matchType === 'POTENTIAL_MERGE') {
        if (!bestMatch || result.score > bestMatch.score) {
          bestMatch = {
            existing,
            score: result.score,
            matchType: result.matchType,
          };
        }
      }
    }

    if (bestMatch) {
      const duplicateResult: DuplicateResult = {
        transaction: tx,
        status: bestMatch.matchType === 'EXACT' ? 'EXACT_DUPLICATE' :
                bestMatch.matchType === 'FUZZY' ? 'FUZZY_DUPLICATE' : 'POTENTIAL_MERGE',
        duplicateOf: bestMatch.existing.id,
        existingTransaction: bestMatch.existing,
        similarityScore: bestMatch.score,
        matchType: bestMatch.matchType,
        recommendation: bestMatch.matchType === 'EXACT' ? 'SKIP' :
                        bestMatch.matchType === 'FUZZY' ? 'SKIP' : 'REVIEW',
      };

      if (bestMatch.matchType === 'EXACT') {
        results.exact.push(duplicateResult);
        skippedReasons.push(`Exact duplicate: ${tx.description} (${tx.date.toLocaleDateString()})`);
      } else if (bestMatch.matchType === 'FUZZY') {
        results.fuzzy.push(duplicateResult);
        skippedReasons.push(`Similar duplicate (${Math.round(bestMatch.score * 100)}%): ${tx.description}`);
      } else {
        results.merge.push(duplicateResult);
      }
    } else {
      results.new.push({
        transaction: tx,
        status: 'NEW',
        similarityScore: 0,
        matchType: 'NONE',
        recommendation: 'IMPORT',
      });
      processedHashes.add(tx.hash);
    }
  }

  // Calculate skipped date range
  const skippedDates = [
    ...results.exact.map(r => r.transaction.date.getTime()),
    ...results.fuzzy.map(r => r.transaction.date.getTime()),
  ];

  const skippedDateRange = skippedDates.length > 0 ? {
    start: new Date(Math.min(...skippedDates)),
    end: new Date(Math.max(...skippedDates)),
  } : null;

  return {
    newTransactions: results.new,
    exactDuplicates: results.exact,
    fuzzyDuplicates: results.fuzzy,
    potentialMerges: results.merge,
    statistics: {
      total: transactions.length,
      new: results.new.length,
      exactDuplicates: results.exact.length,
      fuzzyDuplicates: results.fuzzy.length,
      potentialMerges: results.merge.length,
    },
    skippedInfo: {
      count: results.exact.length + results.fuzzy.length,
      dateRange: skippedDateRange,
      reasons: skippedReasons.slice(0, 10), // First 10 reasons
    },
  };
}

/**
 * Get duplicate summary message for user
 */
export function getDuplicateSummaryMessage(result: BatchDuplicateResult): string {
  const parts: string[] = [];

  if (result.statistics.new > 0) {
    parts.push(`${result.statistics.new} new transaction(s) will be imported`);
  }

  if (result.statistics.exactDuplicates > 0) {
    parts.push(`${result.statistics.exactDuplicates} exact duplicate(s) will be skipped`);
  }

  if (result.statistics.fuzzyDuplicates > 0) {
    parts.push(`${result.statistics.fuzzyDuplicates} similar duplicate(s) will be skipped`);
  }

  if (result.statistics.potentialMerges > 0) {
    parts.push(`${result.statistics.potentialMerges} transaction(s) need review`);
  }

  if (result.skippedInfo.dateRange) {
    const start = result.skippedInfo.dateRange.start.toLocaleDateString();
    const end = result.skippedInfo.dateRange.end.toLocaleDateString();
    parts.push(`Skipped transactions are from ${start} to ${end}`);
  }

  return parts.join('. ');
}

/**
 * Get duplicate config with user overrides
 */
export function getDuplicateConfig(
  userConfig?: Partial<DuplicateConfig>
): DuplicateConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };
}
