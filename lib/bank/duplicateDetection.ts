/**
 * Phase 18: Duplicate Detection Engine
 * Detects and handles duplicate transactions
 */

import {
  NormalisedTransaction,
  DuplicateCheckResult,
  DuplicateDetectionResult,
  DuplicatePolicy,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface DuplicateConfig {
  // Time window for considering transactions as potential duplicates (hours)
  timeWindowHours: number;
  // Amount tolerance for fuzzy matching (percentage)
  amountTolerancePercent: number;
  // Minimum similarity score to flag as duplicate (0-1)
  similarityThreshold: number;
}

const DEFAULT_CONFIG: DuplicateConfig = {
  timeWindowHours: 24,
  amountTolerancePercent: 1, // 1% tolerance
  similarityThreshold: 0.85,
};

// =============================================================================
// SIMILARITY SCORING
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
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
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

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLength;
}

/**
 * Calculate overall similarity between two transactions
 */
function calculateSimilarity(
  t1: NormalisedTransaction,
  t2: NormalisedTransaction,
  config: DuplicateConfig
): number {
  // Hash match = definite duplicate
  if (t1.hash === t2.hash) return 1;

  // Date match (within time window)
  const timeDiff = Math.abs(t1.date.getTime() - t2.date.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  if (hoursDiff > config.timeWindowHours) return 0;

  // Amount match (within tolerance)
  const amountDiff = Math.abs(t1.amount - t2.amount);
  const amountTolerance = Math.max(t1.amount, t2.amount) * (config.amountTolerancePercent / 100);
  if (amountDiff > amountTolerance) return 0;

  // Direction must match
  if (t1.direction !== t2.direction) return 0;

  // Description similarity
  const descSimilarity = stringSimilarity(t1.description, t2.description);

  // Merchant similarity (if available)
  const merchantSimilarity = t1.merchantStandardised && t2.merchantStandardised
    ? stringSimilarity(t1.merchantStandardised, t2.merchantStandardised)
    : descSimilarity;

  // Weight the factors
  const dateScore = 1 - (hoursDiff / config.timeWindowHours);
  const amountScore = 1 - (amountDiff / Math.max(t1.amount, t2.amount, 1));

  return (
    dateScore * 0.2 +
    amountScore * 0.3 +
    merchantSimilarity * 0.3 +
    descSimilarity * 0.2
  );
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Check a transaction against existing transactions
 */
export function checkForDuplicate(
  newTransaction: NormalisedTransaction,
  existingTransactions: NormalisedTransaction[],
  config: DuplicateConfig = DEFAULT_CONFIG
): DuplicateCheckResult {
  // Quick hash check first
  const hashMatch = existingTransactions.find(t => t.hash === newTransaction.hash);
  if (hashMatch) {
    return {
      transaction: newTransaction,
      isDuplicate: true,
      duplicateOf: hashMatch.id,
      similarityScore: 1,
      reason: 'Exact hash match',
    };
  }

  // Fuzzy matching
  let bestMatch: NormalisedTransaction | null = null;
  let bestScore = 0;

  for (const existing of existingTransactions) {
    const similarity = calculateSimilarity(newTransaction, existing, config);
    if (similarity > bestScore && similarity >= config.similarityThreshold) {
      bestScore = similarity;
      bestMatch = existing;
    }
  }

  if (bestMatch) {
    return {
      transaction: newTransaction,
      isDuplicate: true,
      duplicateOf: bestMatch.id,
      similarityScore: bestScore,
      reason: `Similar transaction (${Math.round(bestScore * 100)}% match)`,
    };
  }

  return {
    transaction: newTransaction,
    isDuplicate: false,
    similarityScore: bestScore,
  };
}

/**
 * Detect duplicates in a batch of new transactions
 */
export function detectDuplicates(
  newTransactions: NormalisedTransaction[],
  existingTransactions: NormalisedTransaction[],
  config: DuplicateConfig = DEFAULT_CONFIG
): DuplicateDetectionResult {
  const unique: NormalisedTransaction[] = [];
  const duplicates: DuplicateCheckResult[] = [];
  const processedHashes = new Set<string>();

  // Also check within the new batch itself
  const allExisting = [...existingTransactions];

  for (const transaction of newTransactions) {
    // Check if this exact hash was already seen in this batch
    if (processedHashes.has(transaction.hash)) {
      duplicates.push({
        transaction,
        isDuplicate: true,
        reason: 'Duplicate within import batch',
        similarityScore: 1,
      });
      continue;
    }

    const result = checkForDuplicate(transaction, allExisting, config);

    if (result.isDuplicate) {
      duplicates.push(result);
    } else {
      unique.push(transaction);
      allExisting.push(transaction); // Add to pool for cross-checking
      processedHashes.add(transaction.hash);
    }
  }

  return {
    unique,
    duplicates,
    statistics: {
      total: newTransactions.length,
      unique: unique.length,
      duplicates: duplicates.length,
    },
  };
}

/**
 * Apply duplicate policy to results
 */
export function applyDuplicatePolicy(
  result: DuplicateDetectionResult,
  policy: DuplicatePolicy
): NormalisedTransaction[] {
  switch (policy) {
    case 'REJECT':
      // Only return unique transactions
      return result.unique;

    case 'SKIP':
      // Same as reject, just silently skip
      return result.unique;

    case 'MARK_DUPLICATE':
      // Return all, but duplicates will be flagged in metadata
      return [
        ...result.unique,
        ...result.duplicates.map(d => ({
          ...d.transaction,
          // Add duplicate metadata (would be stored)
        })),
      ];

    case 'MERGE':
      // For now, treat same as REJECT - merge logic would be more complex
      return result.unique;

    default:
      return result.unique;
  }
}

/**
 * Get count of potential duplicates for preview
 */
export function countPotentialDuplicates(
  newTransactions: NormalisedTransaction[],
  existingTransactions: NormalisedTransaction[],
  config: DuplicateConfig = DEFAULT_CONFIG
): number {
  const result = detectDuplicates(newTransactions, existingTransactions, config);
  return result.statistics.duplicates;
}
