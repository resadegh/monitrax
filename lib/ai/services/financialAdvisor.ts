/**
 * FINANCIAL ADVISOR SERVICE (GEMINI)
 * Phase 27 - Complete AI Migration to Google Gemini
 *
 * AI-powered financial advice using Google Gemini models.
 * Replaces OpenAI-based implementation.
 */

import {
  generateGeminiJSONCompletion,
  generateGeminiTextCompletion,
  isGeminiConfigured,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
  GEMINI_MODELS,
  FINANCIAL_ADVISOR_SYSTEM_PROMPT,
  QUICK_ANALYSIS_SYSTEM_PROMPT,
  QUESTION_ANSWERING_PROMPT,
  PROJECTIONS_SYSTEM_PROMPT,
} from '../google';
import { sumLoanBalances } from '@/lib/calculations/assetValuation';

import type {
  AIAdvisorRequest,
  AIAdvisorResponse,
  AIAdvice,
  FinancialContext,
  AIProjection,
} from '../types';

// =============================================================================
// MAIN ADVISOR FUNCTIONS
// =============================================================================

/**
 * Generate comprehensive AI financial advice using Gemini
 */
export async function generateAIAdvice(
  request: AIAdvisorRequest
): Promise<AIAdvisorResponse> {
  // Check if Gemini is configured
  if (!isGeminiConfigured()) {
    return createFallbackResponse(
      'AI advisor not configured. Please add GEMINI_API_KEY to environment variables.'
    );
  }

  const mode = request.options?.mode || 'detailed';

  try {
    // Build the user prompt with financial context
    const userPrompt = buildFinancialPrompt(request);

    // Choose model based on mode
    const model =
      mode === 'quick'
        ? GEMINI_MODELS.QUICK_RESPONSE
        : GEMINI_MODELS.FINANCIAL_ADVISOR;

    // Choose system prompt based on mode
    const systemPrompt =
      mode === 'quick'
        ? QUICK_ANALYSIS_SYSTEM_PROMPT
        : FINANCIAL_ADVISOR_SYSTEM_PROMPT;

    // Generate AI response
    const { data, usage } = await generateGeminiJSONCompletion<AIAdvice>({
      surface: 'financial-advisor',
      model,
      systemPrompt,
      userPrompt,
      maxTokens: mode === 'quick' ? 1000 : 3000,
      temperature: 0.7,
    });

    // Add projections if requested
    let projections: AIProjection[] | undefined;
    if (request.options?.includeProjections) {
      projections = await generateProjections(request.context);
    }

    return {
      success: true,
      advice: {
        ...data,
        projections,
      },
      usage,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('[AIAdvisor] Error generating advice:', error);
    return createFallbackResponse(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Ask a specific financial question using Gemini
 */
export async function askFinancialQuestion(
  context: FinancialContext,
  question: string
): Promise<{
  answer: string;
  suggestions: string[];
  usage: {
    model: string;
    totalTokens: number;
    estimatedCost: number;
  };
}> {
  if (!isGeminiConfigured()) {
    return {
      answer:
        'AI advisor is not configured. Please add GEMINI_API_KEY to enable this feature.',
      suggestions: [],
      usage: { model: 'none', totalTokens: 0, estimatedCost: 0 },
    };
  }

  const userPrompt = `
My Financial Situation:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Total Assets: ${formatCurrencyForPrompt(context.totalAssets)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}
- Monthly Income: ${formatCurrencyForPrompt(context.monthlyIncome)}
- Monthly Expenses: ${formatCurrencyForPrompt(context.monthlyExpenses)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Properties: ${context.properties.length} (Total Value: ${formatCurrencyForPrompt(context.totalPropertyValue)})
- Investments: ${formatCurrencyForPrompt(context.totalInvestments)}
- Risk Appetite: ${context.riskAppetite || 'Not specified'}

My Question: ${question}
`;

  try {
    const { data, usage } = await generateGeminiJSONCompletion<{
      answer: string;
      suggestions: string[];
    }>({
      model: GEMINI_MODELS.QUICK_RESPONSE,
      systemPrompt: QUESTION_ANSWERING_PROMPT,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.7,
    });

    return {
      answer: data.answer,
      suggestions: data.suggestions,
      usage: {
        model: usage.model,
        totalTokens: usage.totalTokens,
        estimatedCost: usage.estimatedCost,
      },
    };
  } catch (error) {
    console.error('[AIAdvisor] Error answering question:', error);
    return {
      answer: `I encountered an error while processing your question. ${error instanceof Error ? error.message : 'Please try again later.'}`,
      suggestions: ['Try rephrasing your question', 'Ask about your net worth', 'Ask about debt optimization'],
      usage: { model: 'error', totalTokens: 0, estimatedCost: 0 },
    };
  }
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

/**
 * Build comprehensive financial prompt from context
 */
function buildFinancialPrompt(request: AIAdvisorRequest): string {
  const ctx = request.context;
  const focusAreas = request.options?.focusAreas;

  let prompt = `
PORTFOLIO OVERVIEW
==================
Net Worth: ${formatCurrencyForPrompt(ctx.netWorth)}
Total Assets: ${formatCurrencyForPrompt(ctx.totalAssets)}
Total Liabilities: ${formatCurrencyForPrompt(ctx.totalDebt)}

PROPERTY PORTFOLIO
==================
Total Properties: ${ctx.properties.length}
Total Property Value: ${formatCurrencyForPrompt(ctx.totalPropertyValue)}
Total Property Equity: ${formatCurrencyForPrompt(ctx.totalPropertyEquity)}

`;

  // Add property details
  if (ctx.properties.length > 0) {
    prompt += 'Individual Properties:\n';
    ctx.properties.forEach((p, i) => {
      prompt += `${i + 1}. ${p.name} (${p.type})\n`;
      prompt += `   - Value: ${formatCurrencyForPrompt(p.value)}\n`;
      prompt += `   - Equity: ${formatCurrencyForPrompt(p.equity)}\n`;
      if (p.isInvestment && p.rentalIncome) {
        prompt += `   - Rental Income: ${formatCurrencyForPrompt(p.rentalIncome)}/month\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
DEBT STRUCTURE
==============
Total Debt: ${formatCurrencyForPrompt(ctx.totalDebt)}

`;

  // Add loan details
  if (ctx.loans.length > 0) {
    prompt += 'Individual Loans:\n';
    ctx.loans.forEach((l, i) => {
      prompt += `${i + 1}. ${l.name} (${l.type})\n`;
      prompt += `   - Balance: ${formatCurrencyForPrompt(l.balance)}\n`;
      prompt += `   - Interest Rate: ${formatPercentageForPrompt(l.interestRate)}\n`;
      prompt += `   - Monthly Payment: ${formatCurrencyForPrompt(l.monthlyPayment)}\n`;
      if (l.remainingTermYears) {
        prompt += `   - Remaining Term: ${l.remainingTermYears} years\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
INVESTMENTS
===========
Total Investments: ${formatCurrencyForPrompt(ctx.totalInvestments)}

`;

  // Add investment details
  if (ctx.investments.length > 0) {
    prompt += 'Individual Investments:\n';
    ctx.investments.forEach((inv, i) => {
      prompt += `${i + 1}. ${inv.name} (${inv.type})\n`;
      prompt += `   - Value: ${formatCurrencyForPrompt(inv.currentValue)}\n`;
      if (inv.allocation) {
        prompt += `   - Allocation: ${inv.allocation}\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
CASH FLOW
=========
Monthly Income: ${formatCurrencyForPrompt(ctx.monthlyIncome)}
Monthly Expenses: ${formatCurrencyForPrompt(ctx.monthlyExpenses)}
Monthly Surplus: ${formatCurrencyForPrompt(ctx.monthlySurplus)}
Savings Rate: ${ctx.monthlyIncome > 0 ? formatPercentageForPrompt((ctx.monthlySurplus / ctx.monthlyIncome) * 100) : '0%'}

USER PREFERENCES
================
Risk Appetite: ${ctx.riskAppetite || 'Not specified'}
Investment Style: ${ctx.investmentStyle || 'Not specified'}
Time Horizon: ${ctx.timeHorizon ? `${ctx.timeHorizon} years` : 'Not specified'}
Retirement Age Target: ${ctx.retirementAge || 'Not specified'}

`;

  // Add existing issues if any
  if (ctx.criticalInsights.length > 0 || ctx.healthIssues.length > 0) {
    prompt += `
EXISTING CONCERNS
=================
`;
    if (ctx.criticalInsights.length > 0) {
      prompt += 'Critical Insights:\n';
      ctx.criticalInsights.forEach((i) => (prompt += `- ${i}\n`));
    }
    if (ctx.healthIssues.length > 0) {
      prompt += 'Data Health Issues:\n';
      ctx.healthIssues.forEach((i) => (prompt += `- ${i}\n`));
    }
    prompt += '\n';
  }

  // Add focus areas if specified
  if (focusAreas && focusAreas.length > 0) {
    prompt += `
FOCUS AREAS REQUESTED
=====================
Please prioritize advice in these areas: ${focusAreas.join(', ')}

`;
  }

  // Add user query if provided
  if (request.query) {
    prompt += `
SPECIFIC QUESTION
=================
${request.query}

`;
  }

  prompt += `
Please analyze this financial situation and provide comprehensive advice following the required JSON format.
`;

  return prompt;
}

// =============================================================================
// PROJECTIONS GENERATOR
// =============================================================================

/**
 * Generate financial projections using Gemini
 */
async function generateProjections(
  context: FinancialContext
): Promise<AIProjection[]> {
  if (!isGeminiConfigured()) {
    return [];
  }

  const userPrompt = `
Current Financial Position:
- Net Worth: $${context.netWorth}
- Monthly Surplus: $${context.monthlySurplus}
- Total Investments: $${context.totalInvestments}
- Total Property Equity: $${context.totalPropertyEquity}
- Total Debt: $${context.totalDebt}
- Risk Appetite: ${context.riskAppetite || 'MODERATE'}
- Time Horizon: ${context.timeHorizon || 10} years

Generate projections for: Net Worth, Investment Portfolio, Property Equity, Debt Payoff
Use realistic Australian market assumptions (property growth ~5%, investments ~7-8% for moderate risk).
`;

  try {
    const { data } = await generateGeminiJSONCompletion<{ projections: AIProjection[] }>({
      model: GEMINI_MODELS.QUICK_RESPONSE,
      systemPrompt: PROJECTIONS_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1000,
      temperature: 0.5,
    });

    return data.projections;
  } catch (error) {
    console.error('[AIAdvisor] Error generating projections:', error);
    return [];
  }
}

// =============================================================================
// FALLBACK RESPONSE
// =============================================================================

/**
 * Create a fallback response when AI is unavailable
 */
function createFallbackResponse(errorMessage: string): AIAdvisorResponse {
  return {
    success: false,
    advice: {
      summary: `AI analysis unavailable: ${errorMessage}`,
      healthScore: 0,
      observations: [],
      recommendations: [],
      riskAssessment: {
        overallRisk: 'moderate',
        riskFactors: [],
        mitigationStrategies: [],
      },
      prioritizedActions: [],
    },
    usage: {
      model: 'none',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    generatedAt: new Date(),
  };
}

// =============================================================================
// CONTEXT BUILDER UTILITY
// =============================================================================

/**
 * Build FinancialContext from Monitrax data
 * This helper pulls data from the strategy engine's data collector format
 */
export function buildFinancialContextFromSnapshot(
  snapshot: any,
  preferences?: any,
  insights?: any[],
  health?: any
): FinancialContext {
  // Extract property summaries
  const properties =
    snapshot?.properties?.map((p: any) => ({
      id: p.id,
      name: p.name || p.address || 'Unnamed Property',
      value: p.currentValue || p.estimatedValue || 0,
      equity:
        (p.currentValue || p.estimatedValue || 0) - (p.totalDebt || p.loanBalance || 0),
      type: p.propertyType || p.type || 'RESIDENTIAL',
      rentalIncome: p.rentalIncome || p.monthlyRent || 0,
      isInvestment: p.isInvestmentProperty || p.purpose === 'INVESTMENT',
    })) || [];

  // Extract loan summaries
  const loans =
    snapshot?.loans?.map((l: any) => ({
      id: l.id,
      name: l.name || l.lender || 'Unnamed Loan',
      balance: l.currentBalance || l.balance || 0,
      interestRate: l.interestRate || 0,
      monthlyPayment: l.monthlyPayment || l.repayment || 0,
      type: l.loanType || l.type || 'MORTGAGE',
      remainingTermYears: l.remainingTermMonths
        ? l.remainingTermMonths / 12
        : undefined,
    })) || [];

  // Extract investment summaries
  const investments =
    snapshot?.investments?.map((inv: any) => ({
      id: inv.id,
      name: inv.name || inv.symbol || 'Unnamed Investment',
      currentValue: inv.currentValue || inv.value || 0,
      type: inv.type || inv.assetClass || 'OTHER',
      allocation: inv.allocation,
      performance: inv.performance || inv.returnRate,
    })) || [];

  // Calculate totals
  const totalPropertyValue = properties.reduce(
    (sum: number, p: any) => sum + p.value,
    0
  );
  const totalPropertyEquity = properties.reduce(
    (sum: number, p: any) => sum + p.equity,
    0
  );
  // Phase 3 fix PR1 (audit L1-3): loan balances via the shared canonical helper.
  const totalDebt = sumLoanBalances(loans);
  // `inv.currentValue` here is the snapshot's already-aggregated market value
  // (this layer has no raw units/price), so the canonical `holdingMarketValue`
  // basis is applied upstream where the snapshot is built. The net-worth line
  // below prefers the canonical `snapshot.netWorth` and only falls back to this
  // local sum when the snapshot omits it.
  const totalInvestments = investments.reduce(
    (sum: number, inv: any) => sum + inv.currentValue,
    0
  );

  // Cash flow
  const monthlyIncome = snapshot?.cashflowSummary?.totalIncome || 0;
  const monthlyExpenses = snapshot?.cashflowSummary?.totalExpenses || 0;
  const monthlySurplus = monthlyIncome - monthlyExpenses;

  // Net worth
  const totalAssets =
    totalPropertyValue + totalInvestments + (snapshot?.cashBalance || 0);
  const netWorth = snapshot?.netWorth || totalAssets - totalDebt;

  // Extract critical insights
  const criticalInsights =
    insights
      ?.filter((i: any) => i.severity === 'critical' || i.severity === 'high')
      ?.map((i: any) => i.title || i.description) || [];

  // Health issues
  const healthIssues = [
    ...(health?.orphans || []),
    ...(health?.missingLinks || []),
  ];

  return {
    netWorth,
    totalAssets,
    totalLiabilities: totalDebt,
    properties,
    totalPropertyValue,
    totalPropertyEquity,
    loans,
    totalDebt,
    investments,
    totalInvestments,
    monthlyIncome,
    monthlyExpenses,
    monthlySurplus,
    riskAppetite: preferences?.riskAppetite,
    investmentStyle: preferences?.investmentStyle,
    timeHorizon: preferences?.timeHorizon,
    retirementAge: preferences?.retirementAge,
    criticalInsights,
    healthIssues,
  };
}
