/**
 * Phase 29: AI Learning Service
 * Manages the learning database for transaction categorisation
 * Stores patterns, corrections, and improves predictions over time
 */

import { prisma } from '@/lib/prisma';
import { AILearningSource, ImportReviewStatus } from '@prisma/client';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface LearningContext {
  merchantRaw?: string;
  merchantStandardised?: string;
  description: string;
  amount: number;
  direction: 'IN' | 'OUT';
}

export interface CategoryPrediction {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  isEssential: boolean;
  isRecurring: boolean;
  suggestedFrequency: string | null;
  confidence: number;
}

export interface UserConfirmation extends CategoryPrediction {
  wasEdited: boolean;
  applyToSimilar: boolean;
}

export interface MerchantLearningData {
  merchantRaw: string;
  merchantStandardised: string | null;
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  isEssential: boolean;
  isRecurring: boolean;
  confidence: number;
  userCorrectionCount: number;
  lastAIConfidence: number | null;
  usageCount: number;
}

export interface PatternLearningData {
  patternType: string;
  patternValue: string;
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  isEssential: boolean;
  isRecurring: boolean;
  confidence: number;
  matchCount: number;
  confirmCount: number;
}

// =============================================================================
// PATTERN HASHING
// =============================================================================

/**
 * Generate a hash for a pattern to enable quick lookups
 */
function generatePatternHash(patternType: string, patternValue: string): string {
  const normalized = `${patternType}:${patternValue.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
}

/**
 * Determine amount range for pattern matching
 */
function getAmountRange(amount: number): string {
  if (amount < 10) return '0-10';
  if (amount < 25) return '10-25';
  if (amount < 50) return '25-50';
  if (amount < 100) return '50-100';
  if (amount < 250) return '100-250';
  if (amount < 500) return '250-500';
  if (amount < 1000) return '500-1000';
  if (amount < 2500) return '1000-2500';
  if (amount < 5000) return '2500-5000';
  return '5000+';
}

/**
 * Extract keywords from a description for pattern matching
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'pos',
    'eftpos', 'visa', 'debit', 'credit', 'direct', 'card', 'payment'
  ]);

  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5); // Take first 5 significant words
}

// =============================================================================
// MERCHANT LEARNING
// =============================================================================

/**
 * Get merchant learning data for a list of merchants
 */
export async function getMerchantLearnings(
  userId: string,
  merchantKeys: string[]
): Promise<Map<string, MerchantLearningData>> {
  if (merchantKeys.length === 0) {
    return new Map();
  }

  // Fetch user-specific and global mappings
  const mappings = await prisma.merchantMapping.findMany({
    where: {
      OR: [
        { userId, merchantRaw: { in: merchantKeys } },
        { userId: null, merchantRaw: { in: merchantKeys } },
      ],
    },
    orderBy: [
      { userId: 'desc' }, // User mappings first
      { confidence: 'desc' },
    ],
  });

  const result = new Map<string, MerchantLearningData>();

  for (const mapping of mappings) {
    const key = mapping.merchantRaw.toLowerCase();
    // Only use first match (user-specific takes precedence)
    if (!result.has(key)) {
      result.set(key, {
        merchantRaw: mapping.merchantRaw,
        merchantStandardised: mapping.merchantStandardised,
        categoryLevel1: mapping.categoryLevel1,
        categoryLevel2: mapping.categoryLevel2,
        subcategory: mapping.subcategory,
        isEssential: mapping.isEssential,
        isRecurring: mapping.isRecurring,
        confidence: mapping.confidence,
        userCorrectionCount: mapping.userCorrectionCount,
        lastAIConfidence: mapping.aiConfidence,
        usageCount: mapping.usageCount,
      });
    }
  }

  return result;
}

/**
 * Update or create merchant mapping based on user confirmation
 */
export async function updateMerchantLearning(
  userId: string,
  context: LearningContext,
  aiPrediction: CategoryPrediction,
  userConfirmation: UserConfirmation
): Promise<void> {
  const merchantKey = context.merchantStandardised?.toLowerCase() ||
                      context.merchantRaw?.toLowerCase() ||
                      context.description.toLowerCase().substring(0, 50);

  const wasEdited = userConfirmation.wasEdited;
  const source = wasEdited ? 'USER' : 'AI';

  await prisma.merchantMapping.upsert({
    where: {
      userId_merchantRaw: {
        userId,
        merchantRaw: merchantKey,
      },
    },
    create: {
      userId,
      merchantRaw: merchantKey,
      merchantStandardised: context.merchantStandardised || merchantKey,
      categoryLevel1: userConfirmation.categoryLevel1,
      categoryLevel2: userConfirmation.categoryLevel2,
      subcategory: userConfirmation.subcategory,
      isEssential: userConfirmation.isEssential,
      isRecurring: userConfirmation.isRecurring,
      suggestedFrequency: userConfirmation.suggestedFrequency,
      confidence: wasEdited ? 1.0 : aiPrediction.confidence,
      source,
      usageCount: 1,
      aiConfidence: aiPrediction.confidence,
      userCorrectionCount: wasEdited ? 1 : 0,
      lastConfirmedAt: new Date(),
    },
    update: {
      categoryLevel1: userConfirmation.categoryLevel1,
      categoryLevel2: userConfirmation.categoryLevel2,
      subcategory: userConfirmation.subcategory,
      isEssential: userConfirmation.isEssential,
      isRecurring: userConfirmation.isRecurring,
      suggestedFrequency: userConfirmation.suggestedFrequency,
      // Increase confidence if confirmed, keep same if edited
      confidence: wasEdited
        ? 1.0
        : { increment: 0.05 }, // Boost confidence on confirmation
      source: wasEdited ? 'USER' : source,
      usageCount: { increment: 1 },
      aiConfidence: aiPrediction.confidence,
      userCorrectionCount: wasEdited ? { increment: 1 } : undefined,
      lastConfirmedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// =============================================================================
// PATTERN LEARNING
// =============================================================================

/**
 * Get learned patterns for prediction enhancement
 */
export async function getPatternLearnings(
  userId: string,
  context: LearningContext
): Promise<PatternLearningData[]> {
  const patterns: { type: string; value: string }[] = [];

  // Merchant pattern
  if (context.merchantStandardised) {
    patterns.push({
      type: 'MERCHANT',
      value: context.merchantStandardised,
    });
  }

  // Amount range pattern
  patterns.push({
    type: 'AMOUNT_RANGE',
    value: getAmountRange(context.amount),
  });

  // Keyword patterns
  const keywords = extractKeywords(context.description);
  for (const keyword of keywords) {
    patterns.push({
      type: 'DESCRIPTION_KEYWORD',
      value: keyword,
    });
  }

  // Generate hashes for lookup
  const patternHashes = patterns.map(p => generatePatternHash(p.type, p.value));

  // Fetch matching patterns
  const patternData = await prisma.aILearningPattern.findMany({
    where: {
      OR: [
        { userId, patternHash: { in: patternHashes } },
        { userId: null, patternHash: { in: patternHashes } },
      ],
      confidence: { gte: 0.5 }, // Only patterns with reasonable confidence
    },
    orderBy: [
      { userId: 'desc' }, // User patterns first
      { confidence: 'desc' },
    ],
  });

  return patternData.map(p => ({
    patternType: p.patternType,
    patternValue: p.patternValue,
    categoryLevel1: p.categoryLevel1,
    categoryLevel2: p.categoryLevel2,
    subcategory: p.subcategory,
    isEssential: p.isEssential,
    isRecurring: p.isRecurring,
    confidence: p.confidence,
    matchCount: p.matchCount,
    confirmCount: p.confirmCount,
  }));
}

/**
 * Update pattern learning based on user confirmation
 */
export async function updatePatternLearning(
  userId: string,
  context: LearningContext,
  userConfirmation: UserConfirmation
): Promise<void> {
  const patterns: { type: string; value: string }[] = [];

  // Merchant pattern
  if (context.merchantStandardised) {
    patterns.push({
      type: 'MERCHANT',
      value: context.merchantStandardised,
    });
  }

  // Keyword patterns (only if applying to similar)
  if (userConfirmation.applyToSimilar) {
    const keywords = extractKeywords(context.description);
    for (const keyword of keywords.slice(0, 3)) { // Top 3 keywords
      patterns.push({
        type: 'DESCRIPTION_KEYWORD',
        value: keyword,
      });
    }
  }

  // Update each pattern
  for (const pattern of patterns) {
    const patternHash = generatePatternHash(pattern.type, pattern.value);
    const wasEdited = userConfirmation.wasEdited;

    await prisma.aILearningPattern.upsert({
      where: {
        userId_patternType_patternHash: {
          userId,
          patternType: pattern.type,
          patternHash,
        },
      },
      create: {
        userId,
        patternType: pattern.type,
        patternValue: pattern.value,
        patternHash,
        categoryLevel1: userConfirmation.categoryLevel1,
        categoryLevel2: userConfirmation.categoryLevel2,
        subcategory: userConfirmation.subcategory,
        isEssential: userConfirmation.isEssential,
        isRecurring: userConfirmation.isRecurring,
        suggestedFrequency: userConfirmation.suggestedFrequency,
        confidence: 0.6, // Start with moderate confidence
        matchCount: 1,
        confirmCount: wasEdited ? 0 : 1,
        correctionCount: wasEdited ? 1 : 0,
        averageAmount: context.amount,
        minAmount: context.amount,
        maxAmount: context.amount,
        lastMatchAt: new Date(),
        lastConfirmedAt: new Date(),
      },
      update: {
        categoryLevel1: userConfirmation.categoryLevel1,
        categoryLevel2: userConfirmation.categoryLevel2,
        subcategory: userConfirmation.subcategory,
        isEssential: userConfirmation.isEssential,
        isRecurring: userConfirmation.isRecurring,
        suggestedFrequency: userConfirmation.suggestedFrequency,
        // Adjust confidence based on confirmation/correction
        confidence: wasEdited
          ? { decrement: 0.05 } // Decrease on correction
          : { increment: 0.03 }, // Increase on confirmation
        matchCount: { increment: 1 },
        confirmCount: wasEdited ? undefined : { increment: 1 },
        correctionCount: wasEdited ? { increment: 1 } : undefined,
        lastMatchAt: new Date(),
        lastConfirmedAt: wasEdited ? undefined : new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

// =============================================================================
// AI CATEGORIZATION LOGGING
// =============================================================================

/**
 * Log AI categorization for learning
 */
export async function logAICategorization(
  userId: string,
  transactionId: string,
  context: LearningContext,
  aiPrediction: CategoryPrediction
): Promise<string> {
  const learning = await prisma.aICategorizationLearning.create({
    data: {
      userId,
      transactionId,
      aiCategoryLevel1: aiPrediction.categoryLevel1,
      aiCategoryLevel2: aiPrediction.categoryLevel2,
      aiSubcategory: aiPrediction.subcategory,
      aiConfidence: aiPrediction.confidence,
      aiIsEssential: aiPrediction.isEssential,
      aiIsRecurring: aiPrediction.isRecurring,
      merchantRaw: context.merchantRaw,
      merchantStandardised: context.merchantStandardised,
      amountRange: getAmountRange(context.amount),
      source: AILearningSource.AI_PREDICTION,
    },
  });

  return learning.id;
}

/**
 * Update AI categorization log with user confirmation
 */
export async function confirmAICategorization(
  learningId: string,
  userConfirmation: UserConfirmation
): Promise<void> {
  await prisma.aICategorizationLearning.update({
    where: { id: learningId },
    data: {
      finalCategoryLevel1: userConfirmation.categoryLevel1,
      finalCategoryLevel2: userConfirmation.categoryLevel2,
      finalSubcategory: userConfirmation.subcategory,
      finalIsEssential: userConfirmation.isEssential,
      finalIsRecurring: userConfirmation.isRecurring,
      wasEdited: userConfirmation.wasEdited,
      source: userConfirmation.wasEdited
        ? AILearningSource.USER_CORRECTION
        : AILearningSource.USER_CONFIRMED,
      appliedToSimilar: userConfirmation.applyToSimilar,
      confirmedAt: new Date(),
    },
  });
}

// =============================================================================
// APPLY LEARNINGS TO SIMILAR TRANSACTIONS
// =============================================================================

/**
 * Apply user's categorization to similar pending transactions
 */
export async function applyToSimilarTransactions(
  userId: string,
  merchantPattern: string,
  confirmation: UserConfirmation
): Promise<number> {
  // Find similar transactions in review queue
  const similarTransactions = await prisma.transactionReviewQueue.findMany({
    where: {
      userId,
      status: ImportReviewStatus.PENDING,
      tempData: {
        path: ['merchantStandardised'],
        string_contains: merchantPattern,
      },
    },
  });

  if (similarTransactions.length === 0) {
    return 0;
  }

  // Update all similar transactions
  const result = await prisma.transactionReviewQueue.updateMany({
    where: {
      id: { in: similarTransactions.map(t => t.id) },
    },
    data: {
      userCategoryLevel1: confirmation.categoryLevel1,
      userCategoryLevel2: confirmation.categoryLevel2,
      userSubcategory: confirmation.subcategory,
      userIsEssential: confirmation.isEssential,
      userIsRecurring: confirmation.isRecurring,
      status: ImportReviewStatus.USER_CONFIRMED,
      reviewedAt: new Date(),
    },
  });

  // Update the learning log to track how many similar transactions were updated
  await prisma.aICategorizationLearning.updateMany({
    where: {
      userId,
      merchantStandardised: { contains: merchantPattern },
      confirmedAt: null,
    },
    data: {
      appliedToSimilar: true,
      similarTransactionCount: result.count,
    },
  });

  return result.count;
}

// =============================================================================
// LEARNING STATISTICS
// =============================================================================

/**
 * Get learning statistics for a user
 */
export async function getLearningStats(userId: string): Promise<{
  totalLearnings: number;
  merchantMappings: number;
  patterns: number;
  userCorrections: number;
  aiAccuracy: number;
}> {
  const [learnings, merchantMappings, patterns] = await Promise.all([
    prisma.aICategorizationLearning.count({ where: { userId } }),
    prisma.merchantMapping.count({ where: { userId } }),
    prisma.aILearningPattern.count({ where: { userId } }),
  ]);

  // Calculate AI accuracy (confirmed without editing / total confirmed)
  const confirmed = await prisma.aICategorizationLearning.count({
    where: {
      userId,
      confirmedAt: { not: null },
    },
  });

  const correctPredictions = await prisma.aICategorizationLearning.count({
    where: {
      userId,
      confirmedAt: { not: null },
      wasEdited: false,
    },
  });

  const aiAccuracy = confirmed > 0 ? correctPredictions / confirmed : 0;

  const corrections = await prisma.aICategorizationLearning.count({
    where: {
      userId,
      wasEdited: true,
    },
  });

  return {
    totalLearnings: learnings,
    merchantMappings,
    patterns,
    userCorrections: corrections,
    aiAccuracy,
  };
}

/**
 * Get top categories from learnings
 */
export async function getTopCategories(
  userId: string,
  limit: number = 10
): Promise<{ category: string; count: number }[]> {
  const result = await prisma.aICategorizationLearning.groupBy({
    by: ['finalCategoryLevel1'],
    where: {
      userId,
      confirmedAt: { not: null },
      finalCategoryLevel1: { not: null },
    },
    _count: {
      finalCategoryLevel1: true,
    },
    orderBy: {
      _count: {
        finalCategoryLevel1: 'desc',
      },
    },
    take: limit,
  });

  return result.map(r => ({
    category: r.finalCategoryLevel1!,
    count: r._count.finalCategoryLevel1,
  }));
}

// =============================================================================
// RECURRING PATTERNS FROM LEARNINGS
// =============================================================================

/**
 * Get recurring patterns for an account based on learnings
 */
export async function getRecurringPatterns(
  userId: string,
  accountId?: string
): Promise<{ merchant: string; amount: number; frequency: string }[]> {
  const mappings = await prisma.merchantMapping.findMany({
    where: {
      userId,
      isRecurring: true,
      suggestedFrequency: { not: null },
    },
    select: {
      merchantStandardised: true,
      suggestedFrequency: true,
    },
  });

  // Get average amounts from recent transactions
  const patterns: { merchant: string; amount: number; frequency: string }[] = [];

  for (const mapping of mappings) {
    // Get average amount for this merchant
    const avgResult = await prisma.unifiedTransaction.aggregate({
      where: {
        userId,
        merchantStandardised: mapping.merchantStandardised,
        ...(accountId ? { accountId } : {}),
      },
      _avg: {
        amount: true,
      },
    });

    if (avgResult._avg.amount) {
      patterns.push({
        merchant: mapping.merchantStandardised,
        amount: avgResult._avg.amount,
        frequency: mapping.suggestedFrequency!,
      });
    }
  }

  return patterns;
}
