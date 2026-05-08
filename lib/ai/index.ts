/**
 * MONITRAX AI ENGINE
 * Phase 27 - Complete AI Migration to Google Gemini
 *
 * Main entry point for AI-powered financial advice.
 * All AI features now powered by Google Gemini.
 *
 * Usage:
 * import { generateAIAdvice, askFinancialQuestion, isGeminiConfigured } from '@/lib/ai';
 */

// =============================================================================
// GEMINI-POWERED SERVICES (Primary)
// =============================================================================

// Core functionality from Gemini services
export {
  generateAIAdvice,
  askFinancialQuestion,
  buildFinancialContextFromSnapshot,
} from './services/financialAdvisor';

// Gemini client and utilities
export {
  isGeminiConfigured,
  getGeminiClient,
  generateGeminiJSONCompletion,
  generateGeminiTextCompletion,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
  truncateToTokenLimit,
  GEMINI_MODELS,
  type GeminiCompletionOptions,
  type GeminiUsageMetrics,
  type GeminiCompletionResult,
} from './google';

// =============================================================================
// LEGACY EXPORTS (For backward compatibility)
// =============================================================================

// Phase 11 contextBuilder + openai re-exports REMOVED 2026-05-09 alongside
// the OpenAI dep cleanup — those exports had zero callers across the
// codebase. See `docs/operational/cost-control/00_VENDOR_INVENTORY.md`
// "Removed 2026-05-09" + Tech Debt #17.

// Strategy Enhancement (Gemini-backed, alive — used by /api/ai/scenario,
// /api/ai/goal, /api/ai/advisor, /api/ai/ask)
export {
  enhanceRecommendation,
  enhanceRecommendationsBatch,
  generateExecutiveSummary,
  analyzeScenario,
  analyzeGoalProgress,
  type RecommendationEnhancement,
  type BatchEnhancementResult,
} from './strategyEnhancer';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Request types
  AIAdvisorRequest,
  AIAdvisorOptions,
  FinancialContext,
  PropertySummary,
  LoanSummary,
  InvestmentSummary,
  // Response types
  AIAdvisorResponse,
  AIAdvice,
  AIObservation,
  AIRecommendation,
  AIProjection,
  AIRiskAssessment,
  AIRiskFactor,
  AIPrioritizedAction,
  AIUsageMetrics,
  // Conversation types
  AIConversationMessage,
  AIConversationSession,
  // Query types
  SpecificQuery,
  DebtOptimizationQuery,
  InvestmentAdviceQuery,
  RetirementPlanningQuery,
  PropertyAnalysisQuery,
  TaxOptimizationQuery,
} from './types';

// =============================================================================
// VERSION
// =============================================================================

export const AI_ENGINE_VERSION = '2.0.0'; // Phase 27 - Gemini Migration
