/**
 * Phase 29: AI-Powered Transaction Categorisation
 * Uses Google Gemini to intelligently categorise transactions
 * with confidence scoring and learning capabilities
 */

import {
  generateGeminiJSONCompletion,
  isGeminiConfigured,
  GeminiUsageMetrics,
} from '@/lib/ai/google/geminiClient';
import { GEMINI_MODELS } from '@/lib/ai/google/modelConfig';
import { NormalisedTransaction, CategorisedTransaction, CategoryType } from './types';
import {
  getMerchantLearnings,
  getPatternLearnings,
  getRecurringPatterns,
  updateMerchantLearning,
  updatePatternLearning,
  logAICategorization,
  confirmAICategorization,
  applyToSimilarTransactions,
  MerchantLearningData,
  PatternLearningData,
  LearningContext,
  CategoryPrediction,
  UserConfirmation,
} from './aiLearning';

// =============================================================================
// TYPES
// =============================================================================

export interface AICategorizationPrediction {
  categoryLevel1: string;
  categoryLevel2: string | null;
  subcategory: string | null;
  direction: 'INCOME' | 'EXPENSE';
  isEssential: boolean;
  isRecurring: boolean;
  suggestedFrequency: string | null;
  confidence: number;
  reasoning: string;
}

export interface AICategorizationResult {
  transaction: NormalisedTransaction;
  prediction: AICategorizationPrediction;
  adjustedConfidence: number;
  boostReasons: string[];
  penaltyReasons: string[];
}

export interface AIBatchCategorizationResult {
  results: AICategorizationResult[];
  usage: GeminiUsageMetrics;
  processingTimeMs: number;
}

export interface MerchantLearning {
  merchantRaw: string;
  categoryLevel1: string;
  categoryLevel2: string | null;
  userCorrectionCount: number;
  lastAIConfidence: number | null;
}

export interface CategorizationSettings {
  autoAcceptThreshold: number;      // Default: 0.90
  showForReviewThreshold: number;   // Default: 0.70
  enableAI: boolean;
  batchSize: number;                // Max transactions per AI call
}

const DEFAULT_SETTINGS: CategorizationSettings = {
  autoAcceptThreshold: 0.90,
  showForReviewThreshold: 0.70,
  enableAI: true,
  batchSize: 20,
};

// =============================================================================
// AI PROMPT
// =============================================================================

const TRANSACTION_CATEGORIZATION_SYSTEM_PROMPT = `You are an expert Australian financial transaction analyst. Your job is to analyse bank transaction descriptions and predict accurate categorisation.

IMPORTANT CONTEXT:
- These are Australian bank transactions
- Currency is AUD
- Common Australian merchants, utilities, and services should be recognised
- Direction indicates if money came IN (income/credit) or OUT (expense/debit)

CATEGORIES (use exactly these names):

EXPENSE CATEGORIES (direction=EXPENSE):
- Income (only when direction=IN)
- Transfer (internal bank transfers)
- Property (rates, strata, land tax, property management)
- Utilities (electricity, gas, water, phone, internet)
- Food & Dining (restaurants, cafes, takeaway)
- Groceries (supermarkets, specialty food stores)
- Transport (fuel, public transport, parking, tolls, rideshare)
- Entertainment (streaming, movies, events, hobbies)
- Shopping (retail, online shopping, department stores)
- Insurance (health, car, home, life insurance)
- Health (pharmacy, doctor, dental, fitness)
- Education (school fees, courses, training)
- Finance (loan repayments, bank fees, financial services)
- Cash (ATM withdrawals)
- Fees (bank fees, service charges)
- Subscription (recurring memberships, software, services)
- Other (uncategorised expenses)

INCOME CATEGORIES (direction=INCOME):
- Income/Salary (wages, payroll)
- Income/Interest (bank interest)
- Income/Dividend (investment dividends)
- Income/Rent (rental income received)
- Income/Government (Centrelink, tax refunds)
- Income/Other (miscellaneous income)

ESSENTIAL EXPENSES (set isEssential=true):
- Housing costs (rent, mortgage, rates)
- Utilities (electricity, gas, water, phone, internet)
- Groceries (supermarket, essential food)
- Insurance (health, car, home)
- Transport to work (fuel, public transport)
- Medical/Health expenses
- Education (mandatory)

DISCRETIONARY (set isEssential=false):
- Dining out
- Entertainment
- Shopping (non-essential)
- Subscriptions (streaming, etc.)

RECURRING DETECTION:
Set isRecurring=true for:
- Subscriptions (Netflix, Spotify, gym)
- Regular bills (utilities, insurance)
- Rent/mortgage payments
- Regular salary/wages

Return JSON array with predictions for each transaction.`;

const buildUserPrompt = (transactions: { id: string; description: string; amount: number; direction: string }[]): string => {
  const txList = transactions.map((tx, i) =>
    `${i + 1}. ID: ${tx.id} | Amount: $${tx.amount.toFixed(2)} | Direction: ${tx.direction} | Description: "${tx.description}"`
  ).join('\n');

  return `Analyse these Australian bank transactions and return a JSON array of predictions.

TRANSACTIONS:
${txList}

Return JSON in this exact format:
{
  "predictions": [
    {
      "id": "<transaction id>",
      "categoryLevel1": "<category>",
      "categoryLevel2": "<subcategory or null>",
      "subcategory": "<detailed subcategory or null>",
      "direction": "INCOME" or "EXPENSE",
      "isEssential": true/false,
      "isRecurring": true/false,
      "suggestedFrequency": "WEEKLY|FORTNIGHTLY|MONTHLY|QUARTERLY|ANNUAL" or null,
      "confidence": 0.0-1.0,
      "reasoning": "<brief explanation>"
    }
  ]
}`;
};

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

/**
 * Calculate adjusted confidence based on merchant learning and patterns
 */
export function calculateAdjustedConfidence(
  baseConfidence: number,
  transaction: NormalisedTransaction,
  merchantLearning: MerchantLearning | null,
  existingPatterns: { merchant: string; amount: number; frequency: string }[]
): { adjustedConfidence: number; boostReasons: string[]; penaltyReasons: string[] } {
  let confidence = baseConfidence;
  const boostReasons: string[] = [];
  const penaltyReasons: string[] = [];

  // Boost: User previously categorised same merchant
  if (merchantLearning && merchantLearning.userCorrectionCount > 0) {
    if (merchantLearning.userCorrectionCount >= 3) {
      confidence += 0.15;
      boostReasons.push('User has categorised this merchant multiple times');
    } else {
      confidence += 0.10;
      boostReasons.push('User has categorised this merchant before');
    }
  }

  // Boost: MerchantMapping exists with high usage
  if (merchantLearning && merchantLearning.lastAIConfidence !== null && merchantLearning.lastAIConfidence > 0.8) {
    confidence += 0.05;
    boostReasons.push('Previous AI prediction was confident');
  }

  // Boost: Transaction matches existing recurring pattern
  const matchingPattern = existingPatterns.find(p =>
    p.merchant.toLowerCase() === transaction.merchantStandardised?.toLowerCase() &&
    Math.abs(p.amount - transaction.amount) < transaction.amount * 0.1
  );
  if (matchingPattern) {
    confidence += 0.10;
    boostReasons.push('Matches existing recurring pattern');
  }

  // Boost: Clear merchant name
  if (transaction.merchantStandardised && transaction.merchantStandardised.length > 3) {
    const knownMerchants = [
      'woolworths', 'coles', 'aldi', 'bunnings', 'netflix', 'spotify',
      'amazon', 'uber', 'telstra', 'optus', 'agl', 'origin'
    ];
    if (knownMerchants.some(m => transaction.merchantStandardised!.toLowerCase().includes(m))) {
      confidence += 0.05;
      boostReasons.push('Well-known merchant');
    }
  }

  // Penalty: User previously corrected AI for this merchant
  if (merchantLearning && merchantLearning.userCorrectionCount > 0 &&
      merchantLearning.lastAIConfidence !== null && merchantLearning.lastAIConfidence < 0.5) {
    confidence -= 0.20;
    penaltyReasons.push('User has previously corrected AI for this merchant');
  }

  // Penalty: Very short/cryptic description
  if (transaction.description.length < 10) {
    confidence -= 0.10;
    penaltyReasons.push('Description is very short');
  }

  // Penalty: Description contains only numbers/codes
  if (/^[0-9\s\-\.]+$/.test(transaction.description)) {
    confidence -= 0.15;
    penaltyReasons.push('Description contains only numbers');
  }

  // Clamp to 0-1 range
  const adjustedConfidence = Math.max(0, Math.min(1, confidence));

  return { adjustedConfidence, boostReasons, penaltyReasons };
}

// =============================================================================
// AI CATEGORISATION
// =============================================================================

/**
 * Categorise transactions using Gemini AI
 */
export async function categoriseWithAI(
  transactions: NormalisedTransaction[],
  merchantLearnings: Map<string, MerchantLearning>,
  existingPatterns: { merchant: string; amount: number; frequency: string }[] = [],
  settings: CategorizationSettings = DEFAULT_SETTINGS
): Promise<AIBatchCategorizationResult> {
  const startTime = Date.now();

  if (!isGeminiConfigured()) {
    throw new Error('Gemini AI is not configured. Please set GEMINI_API_KEY.');
  }

  if (transactions.length === 0) {
    return {
      results: [],
      usage: {
        model: GEMINI_MODELS.FLASH,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      processingTimeMs: 0,
    };
  }

  // Prepare transaction data for AI
  const txData = transactions.map(tx => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    direction: tx.direction,
  }));

  // Call Gemini AI
  const response = await generateGeminiJSONCompletion<{
    predictions: Array<{
      id: string;
      categoryLevel1: string;
      categoryLevel2: string | null;
      subcategory: string | null;
      direction: 'INCOME' | 'EXPENSE';
      isEssential: boolean;
      isRecurring: boolean;
      suggestedFrequency: string | null;
      confidence: number;
      reasoning: string;
    }>;
  }>({
    model: GEMINI_MODELS.FLASH,
    systemPrompt: TRANSACTION_CATEGORIZATION_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(txData),
    temperature: 0.1, // Low temperature for consistent categorisation
  });

  // Map predictions back to transactions
  const predictionMap = new Map(
    response.data.predictions.map(p => [p.id, p])
  );

  const results: AICategorizationResult[] = transactions.map(tx => {
    const prediction = predictionMap.get(tx.id);

    if (!prediction) {
      // Fallback if AI didn't return prediction for this transaction
      return {
        transaction: tx,
        prediction: {
          categoryLevel1: 'Other',
          categoryLevel2: null,
          subcategory: null,
          direction: tx.direction === 'IN' ? 'INCOME' : 'EXPENSE',
          isEssential: false,
          isRecurring: false,
          suggestedFrequency: null,
          confidence: 0,
          reasoning: 'AI did not return prediction',
        },
        adjustedConfidence: 0,
        boostReasons: [],
        penaltyReasons: ['No AI prediction returned'],
      };
    }

    // Get merchant learning data
    const merchantKey = tx.merchantStandardised?.toLowerCase() || tx.description.toLowerCase();
    const merchantLearning = merchantLearnings.get(merchantKey) || null;

    // Calculate adjusted confidence
    const { adjustedConfidence, boostReasons, penaltyReasons } = calculateAdjustedConfidence(
      prediction.confidence,
      tx,
      merchantLearning,
      existingPatterns
    );

    return {
      transaction: tx,
      prediction,
      adjustedConfidence,
      boostReasons,
      penaltyReasons,
    };
  });

  return {
    results,
    usage: response.usage,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Categorise transactions in batches for large imports
 */
export async function categoriseInBatches(
  transactions: NormalisedTransaction[],
  merchantLearnings: Map<string, MerchantLearning>,
  existingPatterns: { merchant: string; amount: number; frequency: string }[] = [],
  settings: CategorizationSettings = DEFAULT_SETTINGS
): Promise<AIBatchCategorizationResult> {
  const allResults: AICategorizationResult[] = [];
  let totalUsage: GeminiUsageMetrics = {
    model: GEMINI_MODELS.FLASH,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < transactions.length; i += settings.batchSize) {
    const batch = transactions.slice(i, i + settings.batchSize);
    const batchResult = await categoriseWithAI(
      batch,
      merchantLearnings,
      existingPatterns,
      settings
    );

    allResults.push(...batchResult.results);
    totalUsage.promptTokens += batchResult.usage.promptTokens;
    totalUsage.completionTokens += batchResult.usage.completionTokens;
    totalUsage.totalTokens += batchResult.usage.totalTokens;
    totalUsage.estimatedCost += batchResult.usage.estimatedCost;
  }

  return {
    results: allResults,
    usage: totalUsage,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Convert AI prediction to CategorisedTransaction format
 */
export function aiPredictionToCategorised(
  result: AICategorizationResult
): CategorisedTransaction {
  const { transaction, prediction, adjustedConfidence } = result;

  // Determine category type
  let categoryType: CategoryType;
  if (prediction.direction === 'INCOME') {
    categoryType = 'INCOME';
  } else if (prediction.categoryLevel1 === 'Transfer') {
    categoryType = 'TRANSFER';
  } else if (prediction.categoryLevel1 === 'Property') {
    categoryType = 'PROPERTY_EXPENSE';
  } else {
    categoryType = 'PERSONAL_EXPENSE';
  }

  return {
    ...transaction,
    categoryType,
    categoryLevel1: prediction.categoryLevel1,
    categoryLevel2: prediction.categoryLevel2 || undefined,
    subcategory: prediction.subcategory || undefined,
    confidenceScore: adjustedConfidence,
  };
}

/**
 * Classify transactions by confidence level for UI display
 */
export function classifyByConfidence(
  results: AICategorizationResult[],
  settings: CategorizationSettings = DEFAULT_SETTINGS
): {
  autoAccept: AICategorizationResult[];
  needsReview: AICategorizationResult[];
  requiresManual: AICategorizationResult[];
} {
  return {
    autoAccept: results.filter(r => r.adjustedConfidence >= settings.autoAcceptThreshold),
    needsReview: results.filter(r =>
      r.adjustedConfidence >= settings.showForReviewThreshold &&
      r.adjustedConfidence < settings.autoAcceptThreshold
    ),
    requiresManual: results.filter(r => r.adjustedConfidence < settings.showForReviewThreshold),
  };
}

/**
 * Get categorisation settings with user overrides
 */
export function getCategorizationSettings(
  userSettings?: Partial<CategorizationSettings>
): CategorizationSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...userSettings,
  };
}

// =============================================================================
// ENHANCED CATEGORISATION WITH LEARNING DATABASE
// =============================================================================

/**
 * Full categorisation pipeline with learning integration
 * 1. Check existing learnings (merchant mappings, patterns)
 * 2. Use AI for uncategorised transactions
 * 3. Combine learnings with AI predictions
 * 4. Return categorised transactions with confidence levels
 */
export async function categoriseWithLearning(
  userId: string,
  transactions: NormalisedTransaction[],
  settings: CategorizationSettings = DEFAULT_SETTINGS
): Promise<{
  results: AICategorizationResult[];
  fromLearning: number;
  fromAI: number;
  usage: GeminiUsageMetrics | null;
}> {
  if (transactions.length === 0) {
    return {
      results: [],
      fromLearning: 0,
      fromAI: 0,
      usage: null,
    };
  }

  // Step 1: Get all merchant keys for lookup
  const merchantKeys = transactions
    .map(tx => tx.merchantStandardised?.toLowerCase() || tx.description.toLowerCase())
    .filter(Boolean);

  // Step 2: Fetch existing learnings
  const [merchantLearnings, recurringPatterns] = await Promise.all([
    getMerchantLearnings(userId, merchantKeys),
    getRecurringPatterns(userId),
  ]);

  // Step 3: Separate transactions by learning availability
  const fromLearningResults: AICategorizationResult[] = [];
  const needsAI: NormalisedTransaction[] = [];

  for (const tx of transactions) {
    const merchantKey = tx.merchantStandardised?.toLowerCase() || tx.description.toLowerCase();
    const learning = merchantLearnings.get(merchantKey);

    // Check if we have high-confidence learning for this merchant
    if (learning && learning.confidence >= settings.autoAcceptThreshold) {
      fromLearningResults.push({
        transaction: tx,
        prediction: {
          categoryLevel1: learning.categoryLevel1,
          categoryLevel2: learning.categoryLevel2,
          subcategory: learning.subcategory,
          direction: tx.direction === 'IN' ? 'INCOME' : 'EXPENSE',
          isEssential: learning.isEssential,
          isRecurring: learning.isRecurring,
          suggestedFrequency: null,
          confidence: learning.confidence,
          reasoning: `Matched from learned merchant pattern (${learning.usageCount} previous matches)`,
        },
        adjustedConfidence: Math.min(learning.confidence + 0.05, 1.0), // Boost for learned
        boostReasons: ['Matched existing merchant learning'],
        penaltyReasons: [],
      });
    } else {
      needsAI.push(tx);
    }
  }

  // Step 4: Use AI for remaining transactions.
  //
  // AI categorisation is an ENRICHMENT, not a prerequisite for importing
  // transactions. A Gemini failure (rate limit, timeout, quota, model change,
  // outage, malformed response) must NEVER fail the whole import — otherwise a
  // transient upstream blip throws a generic 500 and the user loses their
  // upload. On any AI error (or when Gemini is unconfigured) we fall back to
  // uncategorised + confidence 0, so every transaction still imports and lands
  // in the review queue for manual categorisation.
  let aiResults: AICategorizationResult[] = [];
  let usage: GeminiUsageMetrics | null = null;

  const uncategorisedFallback = (
    txs: NormalisedTransaction[],
    reason: string
  ): AICategorizationResult[] =>
    txs.map((tx) => ({
      transaction: tx,
      prediction: {
        categoryLevel1: 'Other',
        categoryLevel2: null,
        subcategory: null,
        direction: tx.direction === 'IN' ? 'INCOME' : 'EXPENSE',
        isEssential: false,
        isRecurring: false,
        suggestedFrequency: null,
        confidence: 0,
        reasoning: reason,
      },
      adjustedConfidence: 0,
      boostReasons: [],
      penaltyReasons: ['AI categorisation not available'],
    }));

  if (needsAI.length > 0 && settings.enableAI && isGeminiConfigured()) {
    try {
      const aiResponse = await categoriseInBatches(
        needsAI,
        merchantLearnings,
        recurringPatterns,
        settings
      );
      aiResults = aiResponse.results;
      usage = aiResponse.usage;
    } catch (err) {
      // Degrade gracefully — import proceeds, categorisation is deferred to
      // manual review rather than failing the upload.
      console.error('AI categorisation failed during import — importing uncategorised:', err);
      aiResults = uncategorisedFallback(
        needsAI,
        'AI categorisation unavailable, requires manual categorisation'
      );
    }
  } else if (needsAI.length > 0) {
    // Gemini unconfigured / AI disabled.
    aiResults = uncategorisedFallback(needsAI, 'AI not available, requires manual categorisation');
  }

  // Step 5: Combine results
  const allResults = [...fromLearningResults, ...aiResults];

  return {
    results: allResults,
    fromLearning: fromLearningResults.length,
    fromAI: aiResults.length,
    usage,
  };
}

/**
 * Process user confirmation and update learnings
 */
export async function processUserConfirmation(
  userId: string,
  transactionId: string,
  context: LearningContext,
  aiPrediction: CategoryPrediction,
  userConfirmation: UserConfirmation
): Promise<{
  learningId: string;
  similarUpdated: number;
}> {
  // Log the categorization
  const learningId = await logAICategorization(
    userId,
    transactionId,
    context,
    aiPrediction
  );

  // Confirm the categorization
  await confirmAICategorization(learningId, userConfirmation);

  // Update merchant learning
  await updateMerchantLearning(userId, context, aiPrediction, userConfirmation);

  // Update pattern learning
  await updatePatternLearning(userId, context, userConfirmation);

  // Apply to similar transactions if requested
  let similarUpdated = 0;
  if (userConfirmation.applyToSimilar && context.merchantStandardised) {
    similarUpdated = await applyToSimilarTransactions(
      userId,
      context.merchantStandardised,
      userConfirmation
    );
  }

  return {
    learningId,
    similarUpdated,
  };
}

/**
 * Bulk confirm auto-accepted transactions
 */
export async function bulkConfirmAutoAccepted(
  userId: string,
  results: AICategorizationResult[]
): Promise<number> {
  let confirmed = 0;

  for (const result of results) {
    if (result.adjustedConfidence >= DEFAULT_SETTINGS.autoAcceptThreshold) {
      const context: LearningContext = {
        merchantRaw: result.transaction.merchantRaw,
        merchantStandardised: result.transaction.merchantStandardised,
        description: result.transaction.description,
        amount: result.transaction.amount,
        direction: result.transaction.direction,
      };

      const confirmation: UserConfirmation = {
        ...result.prediction,
        wasEdited: false,
        applyToSimilar: false,
      };

      await processUserConfirmation(
        userId,
        result.transaction.id,
        context,
        result.prediction,
        confirmation
      );

      confirmed++;
    }
  }

  return confirmed;
}

// Re-export learning functions for convenience
export {
  getMerchantLearnings,
  getPatternLearnings,
  getRecurringPatterns,
  updateMerchantLearning,
  updatePatternLearning,
  type MerchantLearningData,
  type PatternLearningData,
  type LearningContext,
  type CategoryPrediction,
  type UserConfirmation,
};
