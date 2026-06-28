/**
 * AI DEBT ANALYSIS API
 * POST /api/ai/debt-analysis
 *
 * Analyzes user's debt portfolio and provides AI-powered recommendations
 * for optimal debt repayment strategies.
 *
 * Phase 27 - Powered by Google Gemini AI
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  DEBT_ANALYSIS_PROMPT,
  GEMINI_MODELS,
  formatCurrencyForPrompt,
  formatPercentageForPrompt,
} from '@/lib/ai/google';
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';
import { toMonthly } from '@/lib/utils/frequencies';
import { buildEngineProjections, toLoanInputs } from '@/lib/neobrain/debtProjections';

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

export const POST = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Parse request body to get pre-calculated availableForExtraRepayments from frontend
    let requestBody: { availableForExtraRepayments?: number } = {};
    try {
      requestBody = await request.json();
    } catch {
      // No body provided - will calculate on server side
    }

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
        select: {
          amount: true,
          frequency: true,
          type: true,
          salaryType: true,  // GROSS or NET
          netAmount: true,   // User-provided NET amount
        },
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

    // Calculate monthly totals - helper function
    const convertToMonthly = (amount: number, freq: string): number => {
      switch (freq) {
        case 'WEEKLY': return amount * 52 / 12;
        case 'FORTNIGHTLY': return amount * 26 / 12;
        case 'MONTHLY': return amount;
        case 'QUARTERLY': return amount / 3;
        case 'HALF_YEARLY': return amount / 6;
        case 'ANNUALLY': return amount / 12;
        default: return amount;
      }
    };

    // Calculate NET income (after PAYG tax) - same as Cashflow API
    let monthlyNetIncome = 0;
    for (const income of incomes) {
      const annualAmount = convertToMonthly(income.amount, income.frequency) * 12;
      let annualNet: number;

      if (income.type === 'SALARY' && income.salaryType === 'GROSS') {
        // GROSS salary: calculate PAYG tax
        const takeHome = calculateTakeHomePay(annualAmount, income.frequency as any);
        annualNet = takeHome.netAmount;
      } else if (income.netAmount) {
        // User provided NET amount directly
        annualNet = convertToMonthly(income.netAmount, income.frequency) * 12;
      } else {
        // Already NET or non-taxable (rental, dividends, etc.)
        annualNet = annualAmount;
      }

      monthlyNetIncome += annualNet / 12;
    }

    const trackedExpenses = expenses.reduce((sum: number, e: typeof expenses[0]) => sum + convertToMonthly(e.amount, e.frequency), 0);

    // Phase 28: Use realistic budget if available, otherwise use tracked expenses only
    const hasRealisticBudget = budgetAnalysis && budgetAnalysis.userFinalBudget;
    const monthlyExpenses = hasRealisticBudget
      ? budgetAnalysis.userFinalBudget!
      : trackedExpenses;
    const monthlySurplus = monthlyNetIncome - monthlyExpenses;
    const totalLoanRepayments = loans.reduce((sum: number, l: typeof loans[0]) => sum + convertToMonthly(l.minRepayment, l.repaymentFrequency), 0);
    const totalDebt = loans.reduce((sum: number, l: typeof loans[0]) => sum + l.principal, 0);
    const totalOffsetBalance = loans.reduce((sum: number, l: typeof loans[0]) => sum + (l.offsetAccount?.currentBalance || 0), 0);
    const cashBalance = accounts.reduce((sum: number, a: typeof accounts[0]) => sum + a.currentBalance, 0);

    // CRITICAL: Use the pre-calculated availableForExtraRepayments from frontend if provided
    // This ensures the AI uses the EXACT same value shown in the UI header ($494)
    // The frontend calculates this using the cashflow API which has the authoritative calculation
    const calculatedAvailable = Math.max(0, monthlySurplus - totalLoanRepayments);
    const availableForExtraRepayments = requestBody.availableForExtraRepayments !== undefined && requestBody.availableForExtraRepayments >= 0
      ? requestBody.availableForExtraRepayments
      : calculatedAvailable;

    console.log('[API] Debt Analysis - Cash Flow Breakdown:');
    console.log(`  Monthly NET Income: $${monthlyNetIncome.toFixed(0)}`);
    console.log(`  Monthly Expenses: $${monthlyExpenses.toFixed(0)}${hasRealisticBudget ? ' (realistic budget)' : ' (tracked only)'}`);
    if (hasRealisticBudget) {
      console.log(`    └── Tracked: $${trackedExpenses.toFixed(0)}, Variable Est: $${(budgetAnalysis.aiVariableEstimate || 0).toFixed(0)}`);
    }
    console.log(`  Monthly Loan Repayments: $${totalLoanRepayments.toFixed(0)}`);
    console.log(`  Server Calculated Available: $${calculatedAvailable.toFixed(0)}`);
    console.log(`  Frontend Provided Available: $${requestBody.availableForExtraRepayments !== undefined ? requestBody.availableForExtraRepayments.toFixed(0) : 'N/A'}`);
    console.log(`  >>> USING Available for Extra: $${availableForExtraRepayments.toFixed(0)} <<<`);

    // Build comprehensive prompt for AI
    const userPrompt = buildDebtAnalysisPrompt({
      loans,
      monthlyIncome: monthlyNetIncome,  // Use NET income, not GROSS
      monthlyExpenses,
      monthlySurplus,
      totalLoanRepayments,
      totalDebt,
      totalOffsetBalance,
      cashBalance,
      availableForExtraRepayments,  // CRITICAL: Pass the pre-calculated available amount
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

    // Neobrain grounding (§15 Phase C) — replace the AI's GUESSED projections
    // with engine-COMPUTED ones (debt-free date / interest saved / months
    // saved) for the recommended strategy + recommended surplus. The AI never
    // invents a payoff date again.
    try {
      validatedAnalysis.projections = buildEngineProjections(
        toLoanInputs(loans),
        validatedAnalysis.recommendedStrategy,
        validatedAnalysis.optimalSurplus?.recommended ?? Math.round(availableForExtraRepayments * 0.6),
      );
    } catch (projErr) {
      // Engine failure must not break the response — keep the (capped) AI data.
      console.error('[API] Debt projection engine failed; falling back to AI projections:', projErr);
    }

    console.log('[API] Validated surplus recommendations:');
    console.log(`  AI Original - Min: $${data.optimalSurplus?.minimum}, Rec: $${data.optimalSurplus?.recommended}, Agg: $${data.optimalSurplus?.aggressive}`);
    console.log(`  After Cap - Min: $${validatedAnalysis.optimalSurplus.minimum}, Rec: $${validatedAnalysis.optimalSurplus.recommended}, Agg: $${validatedAnalysis.optimalSurplus.aggressive}`);

    // =======================================================================
    // PERSIST: Save the analysis to database so it persists across page loads
    // =======================================================================
    try {
      await prisma.debtAnalysis.create({
        data: {
          userId,
          summary: validatedAnalysis.summary || '',
          debtHealthScore: validatedAnalysis.debtHealthScore || 0,
          recommendedStrategy: validatedAnalysis.recommendedStrategy || 'AVALANCHE',
          strategyReason: validatedAnalysis.strategyReason || '',
          surplusMinimum: validatedAnalysis.optimalSurplus?.minimum || 0,
          surplusRecommended: validatedAnalysis.optimalSurplus?.recommended || 0,
          surplusAggressive: validatedAnalysis.optimalSurplus?.aggressive || 0,
          surplusReasoning: validatedAnalysis.optimalSurplus?.reasoning || null,
          keyInsights: validatedAnalysis.keyInsights || [],
          loanPriority: validatedAnalysis.loanPriority || [],
          actionPlan: validatedAnalysis.actionPlan || [],
          projections: validatedAnalysis.projections || null,
          warnings: validatedAnalysis.warnings || [],
          totalDebt,
          monthlyIncome: monthlyNetIncome,
          monthlyExpenses,
          availableForExtra: availableForExtraRepayments,
          loanCount: loans.length,
        },
      });
      console.log('[API] Debt analysis saved to database');
    } catch (saveError) {
      // Don't fail the request if save fails - just log it
      console.error('[API] Failed to save debt analysis to database:', saveError);
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis: validatedAnalysis,
        context: {
          totalDebt,
          totalOffsetBalance,
          monthlyIncome: monthlyNetIncome,  // Use NET income
          monthlyExpenses,
          monthlySurplus,
          totalLoanRepayments,
          availableForExtraRepayments,
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
              availableForExtra: Math.max(0, (monthlyNetIncome - trackedExpenses) - totalLoanRepayments),
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

// =============================================================================
// Server-Side Validation
// =============================================================================

/**
 * Validates and FORCES AI recommendations to actual available cashflow.
 * The AI cannot be trusted to follow constraints, so we ALWAYS enforce correct values here.
 */
function validateAndCapRecommendations(
  aiResponse: DebtAnalysisResponse,
  availableForExtra: number,
  cashBalance: number
): DebtAnalysisResponse {
  // Create a copy to avoid mutating original
  const validated = { ...aiResponse };

  // Calculate CORRECT surplus values based on actual available cashflow
  // These are the ONLY valid values - we ALWAYS use these regardless of AI output
  const correctAggressiveSurplus = Math.round(availableForExtra * 0.9);
  const correctRecommendedSurplus = Math.round(availableForExtra * 0.6);
  const correctMinimumSurplus = Math.round(availableForExtra * 0.3);

  console.log('[API] Forcing correct surplus values:');
  console.log(`  Available for Extra: $${availableForExtra}`);
  console.log(`  Correct Min (30%): $${correctMinimumSurplus}`);
  console.log(`  Correct Rec (60%): $${correctRecommendedSurplus}`);
  console.log(`  Correct Agg (90%): $${correctAggressiveSurplus}`);

  // ALWAYS force correct surplus values - DO NOT trust AI output
  if (validated.optimalSurplus) {
    const aiOriginal = { ...validated.optimalSurplus };

    console.log(`  AI suggested Min: $${aiOriginal.minimum}, Rec: $${aiOriginal.recommended}, Agg: $${aiOriginal.aggressive}`);

    // FORCE correct values - ignore what AI returned
    validated.optimalSurplus.aggressive = correctAggressiveSurplus;
    validated.optimalSurplus.recommended = correctRecommendedSurplus;
    validated.optimalSurplus.minimum = correctMinimumSurplus;

    // ALWAYS update reasoning to show correct values
    validated.optimalSurplus.reasoning = `Based on your confirmed budget, you have $${availableForExtra.toLocaleString()}/month available for extra debt payments. ` +
      `Minimum ($${validated.optimalSurplus.minimum.toLocaleString()}) is 30%, ` +
      `Recommended ($${validated.optimalSurplus.recommended.toLocaleString()}) is 60%, ` +
      `and Aggressive ($${validated.optimalSurplus.aggressive.toLocaleString()}) is 90% of your available funds.`;
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
  availableForExtraRepayments: number;  // CRITICAL: Pre-calculated available amount
}

function buildDebtAnalysisPrompt(ctx: PromptContext): string {
  const formatCurrency = (v: number) => formatCurrencyForPrompt(v);
  const formatPercent = (v: number) => formatPercentageForPrompt(v);

  // Use the pre-calculated available amount - DO NOT recalculate
  const availableForExtra = ctx.availableForExtraRepayments;

  let prompt = `
DEBT PORTFOLIO ANALYSIS REQUEST
===============================

╔══════════════════════════════════════════════════════════════════════════════╗
║  🚨 CRITICAL CONSTRAINT - READ THIS FIRST 🚨                                  ║
║                                                                               ║
║  AVAILABLE FOR EXTRA DEBT REPAYMENTS: ${formatCurrency(availableForExtra)}/month                      ║
║                                                                               ║
║  This is the MAXIMUM amount the user can allocate to extra debt payments.    ║
║  This has been calculated from their CONFIRMED budget:                        ║
║    NET Income - Confirmed Budget - Loan Repayments = Available               ║
║                                                                               ║
║  YOUR SURPLUS RECOMMENDATIONS MUST BE:                                        ║
║    • Minimum: ~30% of ${formatCurrency(availableForExtra)} = ${formatCurrency(Math.round(availableForExtra * 0.3))}                              ║
║    • Recommended: ~60% of ${formatCurrency(availableForExtra)} = ${formatCurrency(Math.round(availableForExtra * 0.6))}                          ║
║    • Aggressive: ~90% of ${formatCurrency(availableForExtra)} = ${formatCurrency(Math.round(availableForExtra * 0.9))}                           ║
║                                                                               ║
║  DO NOT recommend amounts higher than ${formatCurrency(availableForExtra)}/month!                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

CASH FLOW SUMMARY (for context only - use Available amount above)
-----------------------------------------------------------------
Monthly NET Income: ${formatCurrency(ctx.monthlyIncome)}
Monthly Budget (confirmed): ${formatCurrency(ctx.monthlyExpenses)}
Monthly Surplus (after budget): ${formatCurrency(ctx.monthlySurplus)}
Loan Repayments (minimum required): ${formatCurrency(ctx.totalLoanRepayments)}
>>> AVAILABLE FOR EXTRA REPAYMENTS: ${formatCurrency(availableForExtra)}/month <<<

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

╔══════════════════════════════════════════════════════════════════════════════╗
║  🚨 FINAL REMINDER - SURPLUS RECOMMENDATIONS 🚨                               ║
║                                                                               ║
║  Available for Extra Repayments: ${formatCurrency(availableForExtra)}/month                           ║
║                                                                               ║
║  Your optimalSurplus values MUST be:                                          ║
║    • minimum: ${formatCurrency(Math.round(availableForExtra * 0.3))} (about 30% of available)                          ║
║    • recommended: ${formatCurrency(Math.round(availableForExtra * 0.6))} (about 60% of available)                      ║
║    • aggressive: ${formatCurrency(Math.round(availableForExtra * 0.9))} (about 90% of available)                       ║
║                                                                               ║
║  NEVER exceed ${formatCurrency(availableForExtra)}/month in any recommendation!                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

GROUNDING (non-negotiable): Do NOT compute or state projection figures — the
debt-free date, total interest saved, and months saved are calculated by the
system's debt-payoff engine and will OVERWRITE whatever you put in the
"projections" field. In all prose (summary, reasoning, insights, action plan)
keep any timeline or savings reference QUALITATIVE ("significantly sooner",
"meaningful interest savings") — never invent a specific date or dollar figure
that isn't one of the loan/cashflow numbers given above.

1. Recommend the BEST strategy (Tax-Aware, Avalanche, or Snowball) with specific reasoning
2. Set optimalSurplus amounts based on the ${formatCurrency(availableForExtra)}/month available
3. Prioritize which loans to attack first and why
4. Project debt-free timeline with your recommendations
5. Identify any opportunities to save interest or warnings about their situation
6. Provide a clear action plan with specific steps

The user has a CONFIRMED budget. Do NOT suggest they have more money available than ${formatCurrency(availableForExtra)}/month.
`;

  return prompt;
}
