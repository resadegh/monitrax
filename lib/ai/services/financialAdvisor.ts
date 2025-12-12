/**
 * FINANCIAL ADVISOR SERVICE (GEMINI)
 * Phase 27 - Unified Google AI Engine
 *
 * AI-powered financial advice using Google Gemini.
 * Migrated from OpenAI implementation.
 */

import {
  generateGeminiJSON,
  isGeminiConfigured,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
  GeminiUsageMetrics,
} from '../google';
import {
  FINANCIAL_ADVISOR_SYSTEM_PROMPT,
  QUICK_ANALYSIS_SYSTEM_PROMPT,
  QUESTION_ANSWERING_SYSTEM_PROMPT,
} from '../google/promptManager';
import type {
  AIAdvisorRequest,
  AIAdvisorResponse,
  AIAdvice,
  FinancialContext,
  AIProjection,
} from '../types';

// =============================================================================
// MAIN ADVISOR FUNCTION
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
    const model = mode === 'quick' ? 'FLASH' : 'PRO';

    // Choose system prompt based on mode
    const systemPrompt =
      mode === 'quick'
        ? QUICK_ANALYSIS_SYSTEM_PROMPT
        : FINANCIAL_ADVISOR_SYSTEM_PROMPT;

    console.log('[FinancialAdvisor] Generating advice with Gemini...');
    console.log('[FinancialAdvisor] Mode:', mode, 'Model:', model);

    // Generate AI response
    const result = await generateGeminiJSON<AIAdvice>({
      model,
      systemPrompt,
      userPrompt,
      temperature: mode === 'quick' ? 0.5 : 0.4,
      maxOutputTokens: mode === 'quick' ? 1500 : 4000,
    });

    console.log('[FinancialAdvisor] Advice generated successfully');
    console.log('[FinancialAdvisor] Health Score:', result.data.healthScore);
    console.log('[FinancialAdvisor] Recommendations:', result.data.recommendations?.length || 0);

    // Add projections if requested
    let projections: AIProjection[] | undefined;
    if (request.options?.includeProjections) {
      projections = await generateProjections(request.context);
    }

    return {
      success: true,
      advice: {
        ...result.data,
        projections,
      },
      usage: result.usage,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('[FinancialAdvisor] Error generating advice:', error);
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
  usage: GeminiUsageMetrics;
}> {
  if (!isGeminiConfigured()) {
    return {
      answer:
        'AI advisor is not configured. Please add GEMINI_API_KEY to enable this feature.',
      suggestions: [],
      usage: {
        model: 'none',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
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
- Property Equity: ${formatCurrencyForPrompt(context.totalPropertyEquity)}
- Investments: ${formatCurrencyForPrompt(context.totalInvestments)}
- Risk Appetite: ${context.riskAppetite || 'Not specified'}
- Investment Style: ${context.investmentStyle || 'Not specified'}

${context.properties.length > 0 ? `
Properties:
${context.properties.map((p, i) => `${i + 1}. ${p.name} - Value: ${formatCurrencyForPrompt(p.value)}, Equity: ${formatCurrencyForPrompt(p.equity)}, Type: ${p.type}${p.isInvestment ? ' (Investment)' : ''}`).join('\n')}
` : ''}

${context.loans.length > 0 ? `
Loans:
${context.loans.map((l, i) => `${i + 1}. ${l.name} - Balance: ${formatCurrencyForPrompt(l.balance)}, Rate: ${formatPercentageForPrompt(l.interestRate)}, Payment: ${formatCurrencyForPrompt(l.monthlyPayment)}/month`).join('\n')}
` : ''}

My Question: ${question}
`;

  console.log('[FinancialAdvisor] Answering question with Gemini...');

  const result = await generateGeminiJSON<{
    answer: string;
    suggestions: string[];
  }>({
    model: 'FLASH',
    systemPrompt: QUESTION_ANSWERING_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.6,
    maxOutputTokens: 2000,
  });

  console.log('[FinancialAdvisor] Question answered');

  return {
    answer: result.data.answer,
    suggestions: result.data.suggestions || [],
    usage: result.usage,
  };
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
Debt-to-Asset Ratio: ${ctx.totalAssets > 0 ? formatPercentageForPrompt((ctx.totalDebt / ctx.totalAssets) * 100) : 'N/A'}

PROPERTY PORTFOLIO
==================
Total Properties: ${ctx.properties.length}
Total Property Value: ${formatCurrencyForPrompt(ctx.totalPropertyValue)}
Total Property Equity: ${formatCurrencyForPrompt(ctx.totalPropertyEquity)}
Equity Percentage: ${ctx.totalPropertyValue > 0 ? formatPercentageForPrompt((ctx.totalPropertyEquity / ctx.totalPropertyValue) * 100) : 'N/A'}

`;

  // Add property details
  if (ctx.properties.length > 0) {
    prompt += 'Individual Properties:\n';
    ctx.properties.forEach((p, i) => {
      prompt += `${i + 1}. ${p.name} (${p.type})\n`;
      prompt += `   - Value: ${formatCurrencyForPrompt(p.value)}\n`;
      prompt += `   - Equity: ${formatCurrencyForPrompt(p.equity)}\n`;
      prompt += `   - LVR: ${p.value > 0 ? formatPercentageForPrompt(((p.value - p.equity) / p.value) * 100) : 'N/A'}\n`;
      if (p.isInvestment && p.rentalIncome) {
        prompt += `   - Rental Income: ${formatCurrencyForPrompt(p.rentalIncome)}/month\n`;
        prompt += `   - Gross Yield: ${p.value > 0 ? formatPercentageForPrompt((p.rentalIncome * 12 / p.value) * 100) : 'N/A'}\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
DEBT STRUCTURE
==============
Total Debt: ${formatCurrencyForPrompt(ctx.totalDebt)}
Debt-to-Income Ratio: ${ctx.monthlyIncome > 0 ? formatPercentageForPrompt((ctx.totalDebt / (ctx.monthlyIncome * 12)) * 100) : 'N/A'}

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
        prompt += `   - Remaining Term: ${l.remainingTermYears.toFixed(1)} years\n`;
      }
      // Calculate total interest if we have remaining term
      if (l.remainingTermYears && l.monthlyPayment) {
        const totalPayments = l.monthlyPayment * l.remainingTermYears * 12;
        const totalInterest = totalPayments - l.balance;
        prompt += `   - Estimated Total Interest: ${formatCurrencyForPrompt(totalInterest)}\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
INVESTMENTS
===========
Total Investments: ${formatCurrencyForPrompt(ctx.totalInvestments)}
Investment-to-Net-Worth Ratio: ${ctx.netWorth > 0 ? formatPercentageForPrompt((ctx.totalInvestments / ctx.netWorth) * 100) : 'N/A'}

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
      if (inv.performance !== undefined) {
        prompt += `   - Performance: ${formatPercentageForPrompt(inv.performance)}\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `
CASH FLOW (MONTHLY)
===================
Monthly Income: ${formatCurrencyForPrompt(ctx.monthlyIncome)}
Monthly Expenses: ${formatCurrencyForPrompt(ctx.monthlyExpenses)}
Monthly Surplus: ${formatCurrencyForPrompt(ctx.monthlySurplus)}
Savings Rate: ${ctx.monthlyIncome > 0 ? formatPercentageForPrompt((ctx.monthlySurplus / ctx.monthlyIncome) * 100) : '0%'}
Annual Surplus: ${formatCurrencyForPrompt(ctx.monthlySurplus * 12)}

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
Focus on:
1. Specific observations based on the actual numbers provided
2. Actionable recommendations with quantified impact
3. Risk factors with severity assessment
4. Prioritized actions with clear next steps
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

  const systemPrompt = `You are a financial projections calculator for Australian investors. Based on the provided data, generate realistic projections.

ASSUMPTIONS:
- Property growth: 5% p.a. (conservative Australian long-term average)
- Investment returns: 7% p.a. for moderate risk (Australian market average)
- Inflation: 3% p.a.
- Super contributions: 11.5% SG (current rate)

Respond in JSON:
{
  "projections": [
    {
      "metric": "string",
      "currentValue": number,
      "projectedValue": number,
      "timeframeYears": number,
      "assumptions": ["assumption 1", "assumption 2"],
      "confidenceLevel": "high|medium|low"
    }
  ]
}`;

  const userPrompt = `
Current Financial Position:
- Net Worth: ${formatCurrencyForPrompt(context.netWorth)}
- Monthly Surplus: ${formatCurrencyForPrompt(context.monthlySurplus)}
- Total Investments: ${formatCurrencyForPrompt(context.totalInvestments)}
- Total Property Equity: ${formatCurrencyForPrompt(context.totalPropertyEquity)}
- Total Debt: ${formatCurrencyForPrompt(context.totalDebt)}
- Risk Appetite: ${context.riskAppetite || 'MODERATE'}
- Time Horizon: ${context.timeHorizon || 10} years

Generate projections for:
1. Net Worth (5 year and 10 year)
2. Investment Portfolio (5 year)
3. Property Equity (5 year)
4. Debt Position (5 year if they continue current repayments)

Use realistic Australian market assumptions.
`;

  try {
    const result = await generateGeminiJSON<{ projections: AIProjection[] }>({
      model: 'FLASH',
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    return result.data.projections || [];
  } catch (error) {
    console.error('[FinancialAdvisor] Error generating projections:', error);
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
  const totalDebt = loans.reduce((sum: number, l: any) => sum + l.balance, 0);
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
