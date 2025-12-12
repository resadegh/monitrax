/**
 * MONITRAX AI ENGINE
 * Phase 27 - Unified Google AI Engine
 *
 * Main entry point for AI-powered financial advice.
 * Now powered by Google Gemini.
 *
 * Usage:
 * import { generateAIAdvice, askFinancialQuestion, isGeminiConfigured } from '@/lib/ai';
 */

// =============================================================================
// CORE AI SERVICES (GEMINI-POWERED)
// =============================================================================

// Financial Advisor Service (Primary)
export {
  generateAIAdvice,
  askFinancialQuestion,
  buildFinancialContextFromSnapshot,
} from './services/financialAdvisor';

// Google AI Client & Configuration
export {
  isGeminiConfigured,
  getGeminiClient,
  generateGeminiText,
  generateGeminiJSON,
  GEMINI_MODELS,
  MODEL_FOR_USE_CASE,
  getModelForUseCase,
  getTemperatureForUseCase,
} from './google';

// System Prompts
export {
  getSystemPrompt,
  FINANCIAL_ADVISOR_SYSTEM_PROMPT,
  QUESTION_ANSWERING_SYSTEM_PROMPT,
  TRANSACTION_CATEGORIZER_SYSTEM_PROMPT,
} from './google/promptManager';

// =============================================================================
// LEGACY EXPORTS (FOR BACKWARD COMPATIBILITY)
// =============================================================================

// These exports maintain backward compatibility with existing code
// that imports from '@/lib/ai' with old function names

// Context Builder (still used)
export {
  buildPropertyContext,
  buildLoanContext,
  buildInvestmentContext,
  buildEntityPrompt,
  logAIRequest,
  createRequestLog,
  type EntityContext,
  type AIRequestLog,
} from './contextBuilder';

// Strategy Enhancement (updated to use Gemini internally)
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
// DEPRECATED EXPORTS - Use Gemini equivalents instead
// =============================================================================

// Re-export isGeminiConfigured as isOpenAIConfigured for backward compatibility
export { isGeminiConfigured as isOpenAIConfigured } from './google';

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
// ENGINE METADATA
// =============================================================================

export const AI_ENGINE_VERSION = '2.0.0';
export const AI_ENGINE_PROVIDER = 'Google Gemini';
