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

      // Fetch user's income and expenses for cash flow context
      const [incomes, expenses, accounts] = await Promise.all([
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
      const monthlyExpenses = expenses.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
      const monthlySurplus = monthlyIncome - monthlyExpenses;
      const totalLoanRepayments = loans.reduce((sum, l) => sum + toMonthly(l.minRepayment, l.repaymentFrequency), 0);
      const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);
      const totalOffsetBalance = loans.reduce((sum, l) => sum + (l.offsetAccount?.currentBalance || 0), 0);
      const cashBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

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

      return NextResponse.json({
        success: true,
        data: {
          analysis: data,
          context: {
            totalDebt,
            totalOffsetBalance,
            monthlyIncome,
            monthlyExpenses,
            monthlySurplus,
            totalLoanRepayments,
            loanCount: loans.length,
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

  let prompt = `
DEBT PORTFOLIO ANALYSIS REQUEST
===============================

CASH FLOW SUMMARY
-----------------
Monthly Income: ${formatCurrency(ctx.monthlyIncome)}
Monthly Expenses: ${formatCurrency(ctx.monthlyExpenses)}
Monthly Surplus (after expenses): ${formatCurrency(ctx.monthlySurplus)}
Current Loan Repayments: ${formatCurrency(ctx.totalLoanRepayments)}
Available for Extra Repayments: ${formatCurrency(Math.max(0, ctx.monthlySurplus - ctx.totalLoanRepayments))}
Cash/Savings Balance: ${formatCurrency(ctx.cashBalance)}

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
