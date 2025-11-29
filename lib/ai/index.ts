/**
 * MONITRAX AI ENGINE
 * Phase 11 Enhancement - AI Integration
 *
 * Main entry point for AI-powered financial advice.
 *
 * Usage:
 * import { generateAIAdvice, askFinancialQuestion, isOpenAIConfigured } from '@/lib/ai';
 */

// Core functionality
export {
  generateAIAdvice,
  askFinancialQuestion,
  buildFinancialContextFromSnapshot,
} from './financialAdvisor';

// Entity Context Builders
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

// Strategy Enhancement
export {
  enhanceRecommendation,
  enhanceRecommendationsBatch,
  generateExecutiveSummary,
  analyzeScenario,
  analyzeGoalProgress,
  type RecommendationEnhancement,
  type BatchEnhancementResult,
} from './strategyEnhancer';

// OpenAI client utilities
export {
  isOpenAIConfigured,
  getOpenAIClient,
  generateCompletion,
  generateJSONCompletion,
  AI_MODELS,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
} from './openai';

// Types
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

export const AI_ENGINE_VERSION = '1.0.0';
