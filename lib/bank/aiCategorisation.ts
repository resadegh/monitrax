/**
 * Phase 29: AI-Powered Transaction Categorisation
 * Uses Google Gemini to intelligently categorise transactions
 * with confidence scoring and learning capabilities
 */

import { GeminiUsageMetrics } from '@/lib/ai/google/geminiClient';
import { NormalisedTransaction, CategorisedTransaction, CategoryType } from './types';
import { isTransferDescription } from '@/lib/bookkeeping/transferCategorisation';
import { categoriseTransactionBatch, type CategorisationResult } from '@/lib/tie/categorisation';
import type { UnifiedTransaction } from '@/lib/tie/types';
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
  /**
   * Phase 54.2 — the cascade layer that produced this result. Drives the
   * "AI-sourced results never auto-file" rule in `classifyByConfidence`
   * (source==='AI' is demoted out of auto-accept → always user-confirmed).
   * Optional for back-compat with results built by the legacy path.
   */
  source?: CategorisationResult['source'];
  boostReasons: string[];
  penaltyReasons: string[];
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

/**
 * Confidence-0 fallback used whenever AI categorisation is unavailable or
 * fails — the transactions still flow through the import, they just need
 * manual categorisation.
 */
function buildUncategorisedResults(
  txs: NormalisedTransaction[],
  reason: string
): AICategorizationResult[] {
  return txs.map((tx) => ({
    transaction: tx,
    prediction: {
      categoryLevel1: 'Other',
      categoryLevel2: null,
      subcategory: null,
      direction: tx.direction === 'IN' ? ('INCOME' as const) : ('EXPENSE' as const),
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
  // Phase 54.2 — AI-sourced results NEVER auto-file. An `source==='AI'` proposal
  // above the auto-accept threshold is demoted to needsReview so the user always
  // confirms it (matches "AI proposes, user confirms" + KB echo-chamber safety —
  // only human confirmations feed the shared KB, lib/categorisation/kb/recordFromConfirmation.ts).
  // Deterministic sources (RULE / USER / KB / transfer) auto-file as before.
  const isAiProposal = (r: AICategorizationResult) => r.source === 'AI';
  return {
    autoAccept: results.filter(
      r => !isAiProposal(r) && r.adjustedConfidence >= settings.autoAcceptThreshold
    ),
    needsReview: results.filter(
      r =>
        r.adjustedConfidence < settings.autoAcceptThreshold
          ? r.adjustedConfidence >= settings.showForReviewThreshold
          : isAiProposal(r) // AI at/above auto-accept lands here, not in autoAccept
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
// CASCADE ADAPTER (Phase 54.2 — reconcile onto the ONE AI categoriser)
// =============================================================================

/**
 * Map an import-side `NormalisedTransaction` (lib/bank) to the TIE
 * `UnifiedTransaction` the KB cascade consumes. Only the fields the cascade
 * reads are meaningful (id, merchantStandardised, merchantRaw, description,
 * direction); the rest are type-satisfying defaults the cascade never inspects
 * (`source` is a placeholder — the cascade does not branch on it). Pure.
 */
export function mapNormalisedToUnified(
  tx: NormalisedTransaction,
  userId: string
): UnifiedTransaction {
  return {
    id: tx.id,
    userId,
    accountId: tx.bankAccountId ?? '',
    date: tx.date,
    amount: tx.amount,
    currency: 'AUD',
    direction: tx.direction,
    description: tx.description,
    merchantRaw: tx.merchantRaw ?? null,
    merchantStandardised: tx.merchantStandardised ?? null,
    merchantCategoryCode: tx.merchantCategoryCode ?? null,
    tags: [],
    userCorrectedCategory: false,
    isRecurring: false,
    anomalyFlags: [],
    source: 'CSV', // not consumed by the cascade; placeholder for the type
    createdAt: tx.date,
    updatedAt: tx.date,
  };
}

const CASCADE_REASONING: Record<CategorisationResult['source'], string> = {
  RULE: 'Matched a categorisation rule',
  KB: 'Matched the community knowledge base',
  AI: 'AI suggestion — please confirm',
  USER: 'Matched your learned merchant',
  FALLBACK: 'No confident match — needs manual categorisation',
};

/**
 * Map one cascade `CategorisationResult` back to the `AICategorizationResult`
 * shape the import + Basiq consumers already expect — so the downstream DB-write
 * code does not change. Carries `source` (drives never-auto-file). `isEssential`
 * / `isRecurring` are not inferred by the cascade → default false (the user sets
 * them on confirm); `direction` derives from the tx as the legacy path did. Pure.
 */
export function cascadeResultToAIResult(
  tx: NormalisedTransaction,
  result: CategorisationResult | undefined
): AICategorizationResult {
  const r: CategorisationResult = result ?? {
    categoryLevel1: 'Other',
    categoryLevel2: 'Uncategorised',
    subcategory: null,
    confidence: 0.1,
    source: 'FALLBACK',
  };
  const reasoning =
    r.source === 'RULE' && r.ruleMatched
      ? `Matched rule: ${r.ruleMatched}`
      : CASCADE_REASONING[r.source] ?? 'Categorised';
  return {
    transaction: tx,
    prediction: {
      categoryLevel1: r.categoryLevel1,
      categoryLevel2: r.categoryLevel2 ?? null,
      subcategory: r.subcategory ?? null,
      direction: tx.direction === 'IN' ? 'INCOME' : 'EXPENSE',
      isEssential: false,
      isRecurring: false,
      suggestedFrequency: null,
      confidence: r.confidence,
      reasoning,
    },
    adjustedConfidence: r.confidence,
    source: r.source,
    boostReasons: [],
    penaltyReasons: [],
  };
}

/**
 * Categorise import unknowns through the KB cascade (the SSOT AI categoriser).
 * Passes NO merchantMappings so the cascade skips its layer-1 merchant lookup —
 * `categoriseWithLearning` already ran the merchant-learning pass, so this runs
 * only rules → shared-KB prior → Gemini-on-miss → fallback. Never throws:
 * degrades to uncategorised so the import can never fail (matches the legacy
 * enrichment contract).
 */
export async function categoriseUnknownsViaCascade(
  userId: string,
  txs: NormalisedTransaction[]
): Promise<{ results: AICategorizationResult[]; degraded: boolean; degradedReason?: string }> {
  if (txs.length === 0) return { results: [], degraded: false };
  try {
    const unified = txs.map(tx => mapNormalisedToUnified(tx, userId));
    // DETERMINISTIC-ONLY at import (`skipAiOnMiss`). Running the Gemini-on-miss
    // layer inline — N serial ungrounded + grounded (web-search) LLM calls —
    // made a small QIF exceed the function timeout and 504 (2026-07-02). The
    // deterministic cascade (rules + user mappings + shared-KB prior) is fast +
    // free and categorises known merchants; genuine unknowns land in review and
    // the user runs the OPT-IN, deduped, cost-bounded "Ask AI for the rest"
    // re-scan (`recategoriseUncategorised({ useAI })`). AI never auto-files
    // anyway (§54.2), so those guesses always went to review — no UX loss.
    const resultMap = await categoriseTransactionBatch(unified, { skipAiOnMiss: true });
    const results = txs.map((tx, i) =>
      cascadeResultToAIResult(tx, resultMap.get(unified[i].id))
    );
    return { results, degraded: false };
  } catch (err) {
    // Enrichment, not a gate — a cascade/LLM hiccup must never fail the upload.
    console.error('Cascade categorisation failed during import — importing uncategorised:', err);
    return {
      results: buildUncategorisedResults(txs, 'Categorisation unavailable, requires manual categorisation'),
      degraded: true,
      degradedReason: 'Categorisation failed for all transactions',
    };
  }
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
  /** True when any transactions fell back to uncategorised because AI was unavailable/failed. */
  degraded?: boolean;
  degradedReason?: string;
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
    // SSOT transfer detection (lib/bookkeeping/transferCategorisation.ts) —
    // word-order-agnostic, runs BEFORE merchant-learning/AI. This engine had no
    // transfer pass at all, so internal transfers like "To Reza Sadegh … Transfer"
    // fell through to AI/uncategorised. Suggestion only (confidence 0.9,
    // categoryLevel1='Transfer') — never sets the isTransfer exclusion flag
    // (stays user-confirmed; §19.1 + §12.2.1 one detector for every categoriser).
    const transferText = tx.merchantStandardised || tx.description;
    if (isTransferDescription(transferText)) {
      fromLearningResults.push({
        transaction: tx,
        prediction: {
          categoryLevel1: 'Transfer',
          categoryLevel2: 'Internal',
          subcategory: null,
          direction: tx.direction === 'IN' ? 'INCOME' : 'EXPENSE',
          isEssential: false,
          isRecurring: false,
          suggestedFrequency: null,
          confidence: 0.9,
          reasoning: 'Recognised as an internal transfer from the description',
        },
        adjustedConfidence: 0.9,
        boostReasons: ['Transfer description (SSOT detector)'],
        penaltyReasons: [],
      });
      continue;
    }

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

  // Step 4: Categorise the remaining unknowns via the ONE canonical AI
  // categoriser — the KB lookup-first cascade (Phase 54.2 reconciliation,
  // §12.2.1). The old bulk-Gemini path (categoriseInBatches) was a SECOND AI
  // categoriser that could auto-file an AI guess silently — it was retired in
  // 54.2 and deleted in 54.2c. The cascade runs rules → shared-KB prior → Gemini-on-miss (gated
  // KB_GEMINI_ENABLED) → Uncategorised fallback, and every AI-sourced result is
  // demoted out of auto-accept by classifyByConfidence (AI proposes, the user
  // always confirms — echo-chamber safety). Categorisation remains an
  // ENRICHMENT: any failure degrades to uncategorised, the import never fails.
  let aiResults: AICategorizationResult[] = [];
  // Gemini-on-miss records its own AI-usage telemetry inside the cascade
  // (lib/categorisation/kb/geminiOnMiss.ts → recordAiUsage); this legacy
  // aggregate metric is null on the cascade path.
  const usage: GeminiUsageMetrics | null = null;
  let degraded = false;
  let degradedReason: string | undefined;

  if (needsAI.length > 0) {
    const cascade = await categoriseUnknownsViaCascade(userId, needsAI);
    aiResults = cascade.results;
    degraded = cascade.degraded;
    degradedReason = cascade.degradedReason;
  }

  // Step 5: Combine results
  const allResults = [...fromLearningResults, ...aiResults];

  return {
    results: allResults,
    fromLearning: fromLearningResults.length,
    fromAI: aiResults.length,
    usage,
    degraded,
    degradedReason,
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
