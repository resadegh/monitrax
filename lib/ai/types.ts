/**
 * AI ENGINE TYPE DEFINITIONS
 * Phase 11 Enhancement - AI Integration
 *
 * Core TypeScript interfaces for AI-powered financial advice.
 */

// =============================================================================
// AI REQUEST TYPES
// =============================================================================

export interface AIAdvisorRequest {
  userId: string;
  query?: string;
  context: FinancialContext;
  options?: AIAdvisorOptions;
}

export interface FinancialContext {
  // Portfolio snapshot
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;

  // Properties
  properties: PropertySummary[];
  totalPropertyValue: number;
  totalPropertyEquity: number;

  // Loans
  loans: LoanSummary[];
  totalDebt: number;

  // Investments
  investments: InvestmentSummary[];
  totalInvestments: number;

  // Cash flow
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;

  // User preferences
  riskAppetite?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  investmentStyle?: 'PASSIVE' | 'BALANCED' | 'ACTIVE';
  timeHorizon?: number; // years
  retirementAge?: number;

  // Existing insights and issues
  criticalInsights: string[];
  healthIssues: string[];
}

export interface PropertySummary {
  id: string;
  name: string;
  value: number;
  equity: number;
  type: string;
  rentalIncome?: number;
  isInvestment: boolean;
}

export interface LoanSummary {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  type: string;
  remainingTermYears?: number;
}

export interface InvestmentSummary {
  id: string;
  name: string;
  currentValue: number;
  type: string;
  allocation?: string;
  performance?: number;
}

export interface AIAdvisorOptions {
  mode?: 'quick' | 'detailed' | 'comprehensive';
  focusAreas?: ('debt' | 'investment' | 'property' | 'cashflow' | 'retirement' | 'tax')[];
  includeProjections?: boolean;
  maxRecommendations?: number;
}

// =============================================================================
// AI RESPONSE TYPES
// =============================================================================

export interface AIAdvisorResponse {
  success: boolean;
  advice: AIAdvice;
  usage: AIUsageMetrics;
  generatedAt: Date;
}

export interface AIAdvice {
  // Overall assessment
  summary: string;
  healthScore: number; // 0-100

  // Key observations
  observations: AIObservation[];

  // Recommendations
  recommendations: AIRecommendation[];

  // Projections (optional)
  projections?: AIProjection[];

  // Risk assessment
  riskAssessment: AIRiskAssessment;

  // Action items
  prioritizedActions: AIPrioritizedAction[];
}

export interface AIObservation {
  category: string;
  finding: string;
  impact: 'positive' | 'neutral' | 'concern' | 'critical';
  details?: string;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'debt' | 'investment' | 'property' | 'cashflow' | 'retirement' | 'tax' | 'general';
  priority: 'high' | 'medium' | 'low';
  potentialImpact: string;
  timeframe: string;
  steps?: string[];
}

export interface AIProjection {
  metric: string;
  currentValue: number;
  projectedValue: number;
  timeframeYears: number;
  assumptions: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface AIRiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high';
  riskFactors: AIRiskFactor[];
  mitigationStrategies: string[];
}

export interface AIRiskFactor {
  factor: string;
  severity: 'low' | 'moderate' | 'high';
  description: string;
}

export interface AIPrioritizedAction {
  rank: number;
  action: string;
  reason: string;
  urgency: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  estimatedImpact: string;
}

export interface AIUsageMetrics {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// =============================================================================
// CONVERSATION TYPES
// =============================================================================

export interface AIConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AIConversationSession {
  sessionId: string;
  userId: string;
  messages: AIConversationMessage[];
  context: FinancialContext;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// QUERY-SPECIFIC TYPES
// =============================================================================

export interface DebtOptimizationQuery {
  type: 'debt_optimization';
  strategy?: 'avalanche' | 'snowball' | 'hybrid';
  extraPayment?: number;
}

export interface InvestmentAdviceQuery {
  type: 'investment_advice';
  amount?: number;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

export interface RetirementPlanningQuery {
  type: 'retirement_planning';
  targetAge?: number;
  desiredIncome?: number;
}

export interface PropertyAnalysisQuery {
  type: 'property_analysis';
  propertyId?: string;
  scenario?: 'buy' | 'sell' | 'refinance';
}

export interface TaxOptimizationQuery {
  type: 'tax_optimization';
  financialYear?: string;
}

export type SpecificQuery =
  | DebtOptimizationQuery
  | InvestmentAdviceQuery
  | RetirementPlanningQuery
  | PropertyAnalysisQuery
  | TaxOptimizationQuery;
