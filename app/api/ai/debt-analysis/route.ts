/**
 * AI DEBT ANALYSIS API
 * POST /api/ai/debt-analysis
 *
 * Analyzes user's debt portfolio and provides AI-powered recommendations
 * for optimal debt repayment strategies.
 *
 * Phase 27 - Powered by Google Gemini AI
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import {
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  DEBT_ANALYSIS_PROMPT,
  GEMINI_MODELS,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
} from '@/lib/ai/google';

// =============================================================================
// Types
// =============================================================================

interface DebtAnalysisResponse {
  summary: string;
  debtHealthScore: number;
  recommendedStrategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
  strategyReason: string;
  // Note: budgetAnalysis removed - Debt Planner now uses confirmed budget from Budget Analysis page
  optimalSurplus: {
    recommended: number;
    minimum: number;
    aggressive: number;
    reasoning: string;
  };
  keyInsights: Array<{
    type: 'opportunity' | 'warning' | 'tip';
    title: string;
    description: string;
    impact: string;
  }>;
  loanPriority: Array<{
    loanName: string;
    priority: number;
    reason: string;
    estimatedPayoff: string;
  }>;
  projections: {
    debtFreeDate: string;
    totalInterestSaved: number;
    monthsSaved: number;
    comparedToMinimum: string;
  };
  actionPlan: Array<{
    step: number;
    action: string;
    timeline: string;
    expectedResult: string;
  }>;
  warnings: string[];
}

// =============================================================================
// API Handler
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Check if Gemini is configured
      if (!isGeminiConfigured()) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI analysis not available',
            message: 'Please configure GEMINI_API_KEY to enable AI debt analysis.',
          },
          { status: 503 }
        );
      }

      console.log(`[API] AI Debt Analysis request for user: ${userId}`);

      // Fetch user's loans with offset accounts
      const loans = await prisma.loan.findMany({
        where: { userId },
        include: {
          offsetAccount: true,
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              type: true,
            }
          }
        },
        orderBy: { principal: 'desc' },
      });

      if (loans.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No loans found',
            message: 'Please add your loans before running AI debt analysis.',
          },
          { status: 404 }
        );
      }

      // Fetch user's income, expenses, accounts, and budget analysis for cash flow context
      const [incomes, expenses, accounts, budgetAnalysis] = await Promise.all([
        prisma.income.findMany({
          where: { userId },
          select: { amount: true, frequency: true },
        }),
        prisma.expense.findMany({
          where: { userId },
          select: { amount: true, frequency: true, isEssential: true },
        }),
        prisma.account.findMany({
          where: { userId },
          select: { currentBalance: true, type: true },
        }),
        // Phase 28: Check for confirmed budget analysis with realistic expenses
        prisma.budgetAnalysis.findFirst({
          where: {
            userId,
            status: 'CONFIRMED',
          },
          orderBy: { analysisDate: 'desc' },
        }),
      ]);

      // Calculate monthly totals
      const toMonthly = (amount: number, freq: string): number => {
        switch (freq) {
          case 'WEEKLY': return amount * 52 / 12;
          case 'FORTNIGHTLY': return amount * 26 / 12;
          case 'MONTHLY': return amount;
          case 'QUARTERLY': return amount / 3;
          case 'ANNUALLY': return amount / 12;
          default: return amount;
        }
      };

      const monthlyIncome = incomes.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
      const trackedExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);

      // Phase 28: Use realistic budget if available, otherwise use tracked expenses only
      const hasRealisticBudget = budgetAnalysis && budgetAnalysis.userFinalBudget;
      const monthlyExpenses = hasRealisticBudget
        ? budgetAnalysis.userFinalBudget!
        : trackedExpenses;
      const monthlySurplus = monthlyIncome - monthlyExpenses;
      const totalLoanRepayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);
      const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);
      const totalOffsetBalance = loans.reduce((sum, l) => sum + (l.offsetAccount?.currentBalance || 0), 0);
      const cashBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

      // CRITICAL: Calculate the ACTUAL available cashflow for extra debt repayments
      // This is AFTER expenses AND loan repayments
      const availableForExtraRepayments = Math.max(0, monthlySurplus - totalLoanRepayments);

      console.log('[API] Debt Analysis - Cash Flow Breakdown:');
      console.log(`  Monthly Income: $${monthlyIncome.toFixed(0)}`);
      console.log(`  Monthly Expenses: $${monthlyExpenses.toFixed(0)}${hasRealisticBudget ? ' (realistic budget)' : ' (tracked only)'}`);
      if (hasRealisticBudget) {
        console.log(`    └── Tracked: $${trackedExpenses.toFixed(0)}, Variable Est: $${(budgetAnalysis.aiVariableEstimate || 0).toFixed(0)}`);
      }
      console.log(`  Monthly Loan Repayments: $${totalLoanRepayments.toFixed(0)}`);
      console.log(`  Available for Extra: $${availableForExtraRepayments.toFixed(0)}`);

      // Build comprehensive prompt for AI
      const userPrompt = buildDebtAnalysisPrompt({
        loans,
        monthlyIncome,
        monthlyExpenses,
        monthlySurplus,
        totalLoanRepayments,
        totalDebt,
        totalOffsetBalance,
        cashBalance,
      });

      console.log('[API] Generating AI debt analysis...');

      // Generate AI analysis
      const { data, usage } = await generateGeminiJSONCompletion<DebtAnalysisResponse>({
        model: GEMINI_MODELS.FINANCIAL_ADVISOR,
        systemPrompt: DEBT_ANALYSIS_PROMPT,
        userPrompt,
        maxTokens: 3000,
        temperature: 0.7,
      });

      console.log(`[API] AI debt analysis generated. Tokens: ${usage.totalTokens}`);

      // =======================================================================
      // SERVER-SIDE VALIDATION: Cap AI recommendations to actual available cashflow
      // The AI cannot be fully trusted to follow constraints, so we enforce them here
      // =======================================================================

      const validatedAnalysis = validateAndCapRecommendations(data, availableForExtraRepayments, cashBalance);

      console.log('[API] Validated surplus recommendations:');
      console.log(`  AI Original - Min: $${data.optimalSurplus?.minimum}, Rec: $${data.optimalSurplus?.recommended}, Agg: $${data.optimalSurplus?.aggressive}`);
      console.log(`  After Cap - Min: $${validatedAnalysis.optimalSurplus.minimum}, Rec: $${validatedAnalysis.optimalSurplus.recommended}, Agg: $${validatedAnalysis.optimalSurplus.aggressive}`);

      return NextResponse.json({
        success: true,
        data: {
          analysis: validatedAnalysis,
          context: {
            totalDebt,
            totalOffsetBalance,
            monthlyIncome,
            monthlyExpenses,
            monthlySurplus,
            totalLoanRepayments,
            availableForExtraRepayments, // NEW: Include this for UI validation
            cashBalance,
            loanCount: loans.length,

            // Phase 28: Budget analysis integration
            budgetAnalysis: hasRealisticBudget ? {
              available: true,
              totalRealisticBudget: budgetAnalysis.userFinalBudget,
              recurringExpenses: budgetAnalysis.recurringExpensesTotal,
              variableExpenses: budgetAnalysis.aiVariableEstimate,
              usedInCalculation: true,
            } : {
              available: false,
              usedInCalculation: false,
            },

            // Comparison: with vs without realistic budget
            comparison: hasRealisticBudget ? {
              withoutBudgetAnalysis: {
                monthlyExpenses: trackedExpenses,
                availableForExtra: Math.max(0, (monthlyIncome - trackedExpenses) - totalLoanRepayments),
              },
              withBudgetAnalysis: {
                monthlyExpenses: monthlyExpenses,
                availableForExtra: availableForExtraRepayments,
              },
            } : null,
          },
          usage,
        },
      });
    } catch (error) {
      console.error('[API] AI Debt Analysis error:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate debt analysis',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// Server-Side Validation
// =============================================================================

/**
 * Validates and caps AI recommendations to actual available cashflow.
 * The AI cannot be fully trusted to follow constraints, so we enforce them here.
 */
function validateAndCapRecommendations(
  aiResponse: DebtAnalysisResponse,
  availableForExtra: number,
  cashBalance: number
): DebtAnalysisResponse {
  // Create a copy to avoid mutating original
  const validated = { ...aiResponse };

  // Calculate realistic surplus limits based on actual available cashflow
  // Leave 10% buffer for unexpected expenses
  const maxAggressiveSurplus = Math.round(availableForExtra * 0.9);
  const maxRecommendedSurplus = Math.round(availableForExtra * 0.6);
  const maxMinimumSurplus = Math.round(availableForExtra * 0.3);

  // Cap the surplus recommendations
  if (validated.optimalSurplus) {
    const original = { ...validated.optimalSurplus };

    // Aggressive: Max 90% of available
    validated.optimalSurplus.aggressive = Math.min(
      original.aggressive || maxAggressiveSurplus,
      maxAggressiveSurplus
    );

    // Recommended: Max 60% of available
    validated.optimalSurplus.recommended = Math.min(
      original.recommended || maxRecommendedSurplus,
      maxRecommendedSurplus
    );

    // Minimum: Max 30% of available
    validated.optimalSurplus.minimum = Math.min(
      original.minimum || maxMinimumSurplus,
      maxMinimumSurplus
    );

    // Ensure hierarchy: minimum < recommended < aggressive
    if (validated.optimalSurplus.minimum > validated.optimalSurplus.recommended) {
      validated.optimalSurplus.minimum = Math.round(validated.optimalSurplus.recommended * 0.5);
    }
    if (validated.optimalSurplus.recommended > validated.optimalSurplus.aggressive) {
      validated.optimalSurplus.recommended = Math.round(validated.optimalSurplus.aggressive * 0.7);
    }

    // Update reasoning if we had to cap
    const wasCapped = original.aggressive > maxAggressiveSurplus ||
                      original.recommended > maxRecommendedSurplus ||
                      original.minimum > maxMinimumSurplus;

    if (wasCapped) {
      validated.optimalSurplus.reasoning = `Based on your actual available cashflow of $${availableForExtra.toLocaleString()}/month after expenses and loan repayments. ` +
        `Minimum ($${validated.optimalSurplus.minimum.toLocaleString()}) is 30%, ` +
        `Recommended ($${validated.optimalSurplus.recommended.toLocaleString()}) is 60%, ` +
        `and Aggressive ($${validated.optimalSurplus.aggressive.toLocaleString()}) is 90% of available funds, leaving buffer for unexpected expenses.`;
    }
  }

  // IMPORTANT: Remove any AI-generated budgetAnalysis - we use confirmed budget from Budget Analysis page
  // The AI might still generate this field even though we don't ask for it
  if ((validated as any).budgetAnalysis) {
    delete (validated as any).budgetAnalysis;
  }

  // Add warning if AI recommendations were significantly off
  if (aiResponse.optimalSurplus?.aggressive &&
      aiResponse.optimalSurplus.aggressive > availableForExtra * 1.5) {
    validated.warnings = validated.warnings || [];
    validated.warnings.unshift(
      `Recommendations adjusted to fit your actual available cashflow of $${availableForExtra.toLocaleString()}/month.`
    );
  }

  return validated;
}

// =============================================================================
// Prompt Builder
// =============================================================================

interface PromptContext {
  loans: any[];
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySurplus: number;
  totalLoanRepayments: number;
  totalDebt: number;
  totalOffsetBalance: number;
  cashBalance: number;
}

function buildDebtAnalysisPrompt(ctx: PromptContext): string {
  const formatCurrency = (v: number) => formatCurrencyForPrompt(v);
  const formatPercent = (v: number) => formatPercentageForPrompt(v);

  const availableForExtra = Math.max(0, ctx.monthlySurplus - ctx.totalLoanRepayments);

  let prompt = `
DEBT PORTFOLIO ANALYSIS REQUEST
===============================

CASH FLOW SUMMARY
-----------------
Monthly Income: ${formatCurrency(ctx.monthlyIncome)}
Monthly Expenses (recorded): ${formatCurrency(ctx.monthlyExpenses)}
Monthly Surplus (after recorded expenses): ${formatCurrency(ctx.monthlySurplus)}
Current Loan Repayments (minimum required): ${formatCurrency(ctx.totalLoanRepayments)}

⚠️ IMPORTANT - AVAILABLE FOR EXTRA REPAYMENTS: ${formatCurrency(availableForExtra)}/month
This is the MAXIMUM amount that can be allocated to extra debt payments.
Your surplus recommendations MUST NOT exceed this amount!

Cash/Savings Balance (Emergency Fund): ${formatCurrency(ctx.cashBalance)}

DEBT SUMMARY
------------
Total Debt: ${formatCurrency(ctx.totalDebt)}
Total Offset Balance: ${formatCurrency(ctx.totalOffsetBalance)}
Net Effective Debt: ${formatCurrency(ctx.totalDebt - ctx.totalOffsetBalance)}
Number of Loans: ${ctx.loans.length}

INDIVIDUAL LOANS
----------------
`;

  ctx.loans.forEach((loan, index) => {
    const isInvestment = loan.property?.type === 'INVESTMENT' || loan.type === 'INVESTMENT';
    const effectiveBalance = loan.principal - (loan.offsetAccount?.currentBalance || 0);
    const monthlyInterest = (effectiveBalance * loan.interestRateAnnual) / 12;

    prompt += `
${index + 1}. ${loan.name}
   Type: ${loan.type} ${isInvestment ? '(TAX DEDUCTIBLE - Investment)' : '(NON-DEDUCTIBLE - Home)'}
   Principal: ${formatCurrency(loan.principal)}
   Interest Rate: ${formatPercent(loan.interestRateAnnual * 100)}
   Rate Type: ${loan.rateType}${loan.rateType === 'FIXED' && loan.fixedExpiry ? ` (expires ${new Date(loan.fixedExpiry).toLocaleDateString('en-AU')})` : ''}
   Interest Only: ${loan.isInterestOnly ? 'Yes' : 'No'}
   Term Remaining: ${loan.termMonthsRemaining} months (${(loan.termMonthsRemaining / 12).toFixed(1)} years)
   Minimum Repayment: ${formatCurrency(loan.minRepayment)} ${loan.repaymentFrequency.toLowerCase()}
   Offset Balance: ${formatCurrency(loan.offsetAccount?.currentBalance || 0)}
   Effective Balance: ${formatCurrency(effectiveBalance)}
   Monthly Interest Cost: ${formatCurrency(monthlyInterest)}
   ${loan.extraRepaymentCap ? `Extra Repayment Cap: ${formatCurrency(loan.extraRepaymentCap)}/year` : 'No Extra Repayment Cap'}
   ${loan.property ? `Linked Property: ${loan.property.name || loan.property.address}` : 'No linked property'}
`;
  });

  prompt += `

ANALYSIS REQUEST
----------------
Based on the above debt portfolio and cash flow situation:

REMEMBER: Available for Extra Repayments = ${formatCurrency(availableForExtra)}/month
ALL your surplus recommendations must be LESS than or equal to this amount!

1. Recommend the BEST strategy (Tax-Aware, Avalanche, or Snowball) with specific reasoning
2. Calculate optimal monthly surplus amounts they should allocate to extra repayments
3. Prioritize which loans to attack first and why
4. Project debt-free timeline with your recommendations
5. Identify any opportunities to save interest or warnings about their situation
6. Provide a clear action plan with specific steps

Consider their actual cash flow constraints and provide realistic recommendations.
`;

  return prompt;
}
