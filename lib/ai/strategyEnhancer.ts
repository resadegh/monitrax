/**
 * AI STRATEGY ENHANCER
 * Phase 11 Enhancement - AI Integration
 *
 * Enhances rule-based strategy recommendations with AI-generated
 * explanations, insights, and personalized advice.
 */

import {
  generateCompletion,
  generateJSONCompletion,
  AI_MODELS,
  isOpenAIConfigured,
  formatCurrencyForPrompt,
} from './openai';
import type { FinancialContext } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface RecommendationEnhancement {
  enhancedExplanation: string;
  personalizedAdvice: string;
  actionSteps: string[];
  potentialChallenges: string[];
  successMetrics: string[];
}

export interface BatchEnhancementResult {
  enhanced: Map<string, RecommendationEnhancement>;
  usage: {
    totalTokens: number;
    estimatedCost: number;
  };
}

// =============================================================================
// RECOMMENDATION ENHANCER
// =============================================================================

/**
 * Enhance a single strategy recommendation with AI-generated content
 */
export async function enhanceRecommendation(
  recommendation: {
    id: string;
    title: string;
    summary: string;
    detail: string;
    category: string;
    severity: string;
    financialImpact: any;
  },
  context: FinancialContext
): Promise<RecommendationEnhancement | null> {
  if (!isOpenAIConfigured()) {
    return null;
  }

  const systemPrompt = `You are a financial advisor enhancing strategy recommendations for Monitrax users. Provide personalized, actionable advice in Australian context.

Respond in JSON:
{
  "enhancedExplanation": "A clear, jargon-free explanation of why this recommendation matters (2-3 sentences)",
  "personalizedAdvice": "Specific advice based on their financial situation (2-3 sentences)",
  "actionSteps": ["Step 1", "Step 2", "Step 3"],
  "potentialChallenges": ["Challenge 1", "Challenge 2"],
  "successMetrics": ["How to measure success 1", "How to measure success 2"]
}`;

  const userPrompt = `
Recommendation: ${recommendation.title}
Category: ${recommendation.category}
Severity: ${recommendation.severity}
Original Summary: ${recommendation.summary}
Original Detail: ${recommendation.detail}
Financial Impact: ${JSON.stringify(recommendation.financialImpact)}

User's Financial Context:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}
- Risk Appetite: ${context.riskAppetite || 'Moderate'}

Enhance this recommendation with personalized, actionable advice.
`;

  try {
    const { data } = await generateJSONCompletion<RecommendationEnhancement>({
      model: AI_MODELS.QUICK_RESPONSE,
      systemPrompt,
      userPrompt,
      maxTokens: 800,
      temperature: 0.7,
    });

    return data;
  } catch (error) {
    console.error(
      '[AIStrategyEnhancer] Error enhancing recommendation:',
      error
    );
    return null;
  }
}

/**
 * Batch enhance multiple recommendations
 */
export async function enhanceRecommendationsBatch(
  recommendations: Array<{
    id: string;
    title: string;
    summary: string;
    detail: string;
    category: string;
    severity: string;
    financialImpact: any;
  }>,
  context: FinancialContext,
  maxRecommendations: number = 5
): Promise<BatchEnhancementResult> {
  const enhanced = new Map<string, RecommendationEnhancement>();
  let totalTokens = 0;
  let totalCost = 0;

  if (!isOpenAIConfigured()) {
    return { enhanced, usage: { totalTokens: 0, estimatedCost: 0 } };
  }

  // Limit to top N recommendations to control costs
  const toEnhance = recommendations.slice(0, maxRecommendations);

  // Process recommendations sequentially to manage API rate limits
  for (const rec of toEnhance) {
    try {
      const enhancement = await enhanceRecommendation(rec, context);
      if (enhancement) {
        enhanced.set(rec.id, enhancement);
      }
    } catch (error) {
      console.error(
        `[AIStrategyEnhancer] Error enhancing ${rec.id}:`,
        error
      );
    }
  }

  return {
    enhanced,
    usage: { totalTokens, estimatedCost: totalCost },
  };
}

// =============================================================================
// SUMMARY GENERATOR
// =============================================================================

/**
 * Generate an executive summary of all recommendations
 */
export async function generateExecutiveSummary(
  recommendations: Array<{
    title: string;
    summary: string;
    category: string;
    severity: string;
    sbsScore: number;
  }>,
  context: FinancialContext
): Promise<string | null> {
  if (!isOpenAIConfigured() || recommendations.length === 0) {
    return null;
  }

  const systemPrompt = `You are a senior financial advisor creating an executive summary. Be concise, professional, and actionable. Focus on the key takeaways.`;

  const recList = recommendations
    .slice(0, 10)
    .map(
      (r, i) =>
        `${i + 1}. [${r.severity.toUpperCase()}] ${r.title} (Score: ${r.sbsScore})`
    )
    .join('\n');

  const userPrompt = `
Financial Snapshot:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}
- Properties: ${context.properties.length}
- Investment Portfolio: ${formatCurrencyForPrompt(context.totalInvestments)}

Top Recommendations:
${recList}

Write a brief executive summary (3-4 sentences) highlighting:
1. Overall financial health assessment
2. The most critical action item
3. The biggest opportunity for improvement
`;

  try {
    const result = await generateCompletion({
      model: AI_MODELS.QUICK_RESPONSE,
      systemPrompt,
      userPrompt,
      maxTokens: 400,
      temperature: 0.7,
    });

    return result.content;
  } catch (error) {
    console.error('[AIStrategyEnhancer] Error generating summary:', error);
    return null;
  }
}

// =============================================================================
// SCENARIO ANALYZER
// =============================================================================

/**
 * Analyze "what-if" scenarios
 */
export async function analyzeScenario(
  scenario: {
    type: 'extra_payment' | 'investment' | 'property_purchase' | 'refinance';
    amount?: number;
    description: string;
  },
  context: FinancialContext
): Promise<{
  analysis: string;
  pros: string[];
  cons: string[];
  recommendation: string;
} | null> {
  if (!isOpenAIConfigured()) {
    return null;
  }

  const systemPrompt = `You are a financial scenario analyst. Analyze the proposed scenario and provide balanced, realistic advice for Australian investors.

Respond in JSON:
{
  "analysis": "2-3 sentence analysis of the scenario",
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2", "Con 3"],
  "recommendation": "Your recommendation (1-2 sentences)"
}`;

  const userPrompt = `
Scenario: ${scenario.description}
${scenario.amount ? `Amount: ${formatCurrencyForPrompt(scenario.amount)}` : ''}
Type: ${scenario.type}

Current Financial Position:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}
- Monthly Income: ${formatCurrencyForPrompt(context.monthlyIncome)}
- Risk Appetite: ${context.riskAppetite || 'Moderate'}

Analyze this scenario and provide a balanced assessment.
`;

  try {
    const { data } = await generateJSONCompletion<{
      analysis: string;
      pros: string[];
      cons: string[];
      recommendation: string;
    }>({
      model: AI_MODELS.QUICK_RESPONSE,
      systemPrompt,
      userPrompt,
      maxTokens: 800,
      temperature: 0.7,
    });

    return data;
  } catch (error) {
    console.error('[AIStrategyEnhancer] Error analyzing scenario:', error);
    return null;
  }
}

// =============================================================================
// GOAL ANALYZER
// =============================================================================

/**
 * Analyze progress toward financial goals
 */
export async function analyzeGoalProgress(
  goal: {
    type: 'retirement' | 'debt_free' | 'investment_target' | 'property_purchase';
    targetAmount?: number;
    targetDate?: string;
    description: string;
  },
  context: FinancialContext
): Promise<{
  feasibility: 'on_track' | 'achievable' | 'challenging' | 'unrealistic';
  analysis: string;
  adjustments: string[];
  milestones: string[];
} | null> {
  if (!isOpenAIConfigured()) {
    return null;
  }

  const systemPrompt = `You are a financial goal analyst. Assess goal feasibility realistically based on Australian financial conditions.

Respond in JSON:
{
  "feasibility": "on_track|achievable|challenging|unrealistic",
  "analysis": "2-3 sentence assessment of the goal",
  "adjustments": ["Suggested adjustment 1", "Suggested adjustment 2"],
  "milestones": ["Milestone 1", "Milestone 2", "Milestone 3"]
}`;

  const userPrompt = `
Goal: ${goal.description}
Type: ${goal.type}
${goal.targetAmount ? `Target Amount: ${formatCurrencyForPrompt(goal.targetAmount)}` : ''}
${goal.targetDate ? `Target Date: ${goal.targetDate}` : ''}

Current Position:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Total Savings Rate: ${context.monthlyIncome > 0 ? ((context.monthlySurplus / context.monthlyIncome) * 100).toFixed(1) : 0}%
- Total Investments: ${formatCurrencyForPrompt(context.totalInvestments)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}

Assess the feasibility of this goal and suggest concrete milestones.
`;

  try {
    const { data } = await generateJSONCompletion<{
      feasibility: 'on_track' | 'achievable' | 'challenging' | 'unrealistic';
      analysis: string;
      adjustments: string[];
      milestones: string[];
    }>({
      model: AI_MODELS.QUICK_RESPONSE,
      systemPrompt,
      userPrompt,
      maxTokens: 800,
      temperature: 0.7,
    });

    return data;
  } catch (error) {
    console.error('[AIStrategyEnhancer] Error analyzing goal:', error);
    return null;
  }
}
