/**
 * Cashflow Calculation API
 * POST /api/calculate/cashflow
 *
 * Calculate cashflow analysis from income and expense data.
 * Uses centralized cashflowOrchestrator for all calculations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import prisma from '@/lib/db';
import { calculateCashflow, CashflowInput } from '@/lib/calculations/cashflowOrchestrator';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const cashflowRequestSchema = z.object({
  // Optional: provide data directly instead of fetching from DB
  income: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
        isTaxable: z.boolean().default(true),
        type: z.string().optional(),
        salaryType: z.string().optional().nullable(),
        netAmount: z.number().optional().nullable(),
        grossAmount: z.number().optional().nullable(),
      })
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
        isEssential: z.boolean().default(false),
        isTaxDeductible: z.boolean().default(false),
        category: z.string().optional(),
      })
    )
    .optional(),
  loans: z
    .array(
      z.object({
        name: z.string(),
        principal: z.number(),
        interestRate: z.number(),
        minRepayment: z.number(),
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
        offsetBalance: z.number().default(0),
      })
    )
    .optional(),
  // If not provided, fetch from user's data
  fetchFromDatabase: z.boolean().default(true),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Transform income from database or input format to orchestrator format
 */
function transformIncomeData(income: any[]): CashflowInput['income'] {
  return income.map((i) => ({
    name: i.name,
    amount: i.amount,
    frequency: i.frequency,
    type: i.type,
    salaryType: i.salaryType,
    netAmount: i.netAmount,
    grossAmount: i.grossAmount,
    isTaxable: i.isTaxable ?? true,
  }));
}

/**
 * Transform expenses from database or input format to orchestrator format
 */
function transformExpenseData(expenses: any[]): CashflowInput['expenses'] {
  return expenses.map((e) => ({
    name: e.name,
    amount: e.amount,
    frequency: e.frequency,
    isEssential: e.isEssential ?? false,
    isTaxDeductible: e.isTaxDeductible ?? false,
    category: e.category,
  }));
}

/**
 * Transform loans from database or input format to orchestrator format
 */
function transformLoanData(loans: any[]): CashflowInput['loans'] {
  return loans.map((l) => ({
    name: l.name,
    minRepayment: l.minRepayment ?? l.minRepayment ?? 0,
    repaymentFrequency: l.frequency ?? l.repaymentFrequency ?? 'MONTHLY',
    principal: l.principal,
    interestRate: l.interestRate ?? l.interestRateAnnual,
    offsetBalance: l.offsetBalance ?? l.offsetAccount?.currentBalance ?? 0,
  }));
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();

      // Validate input
      const parseResult = cashflowRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const input = parseResult.data;
      let incomeData = input.income;
      let expenseData = input.expenses;
      let loanData = input.loans;

      // Fetch from database if not provided
      if (input.fetchFromDatabase && !incomeData) {
        const dbIncome = await prisma.income.findMany({
          where: { userId: authReq.user!.userId },
        });
        incomeData = dbIncome;
      }

      if (input.fetchFromDatabase && !expenseData) {
        const dbExpenses = await prisma.expense.findMany({
          where: { userId: authReq.user!.userId },
        });
        expenseData = dbExpenses;
      }

      if (input.fetchFromDatabase && !loanData) {
        const dbLoans = await prisma.loan.findMany({
          where: { userId: authReq.user!.userId },
          include: { offsetAccount: true },
        });
        loanData = dbLoans;
      }

      // Transform data to orchestrator format and calculate
      const cashflowInput: CashflowInput = {
        income: transformIncomeData(incomeData || []),
        expenses: transformExpenseData(expenseData || []),
        loans: transformLoanData(loanData || []),
      };

      // Use centralized orchestrator for calculation
      const result = calculateCashflow(cashflowInput);

      // Diagnostics
      const diagnostics: { warnings: string[]; assumptions: string[] } = {
        warnings: [],
        assumptions: [],
      };

      if (result.savingsRate < 0) {
        diagnostics.warnings.push('Negative savings rate - expenses exceed income');
      } else if (result.savingsRate < 10) {
        diagnostics.warnings.push('Low savings rate - consider reducing discretionary expenses');
      }

      if (result.essentialExpenses > result.monthlyIncome * 0.7) {
        diagnostics.warnings.push('Essential expenses exceed 70% of income');
      }

      if (result.monthlyLoanRepayments > result.monthlyIncome * 0.5) {
        diagnostics.warnings.push('Loan repayments exceed 50% of income');
      }

      diagnostics.assumptions.push('All amounts normalized to monthly');
      diagnostics.assumptions.push('Uses centralized cashflowOrchestrator');

      const response = {
        input: {
          incomeCount: (incomeData || []).length,
          expenseCount: (expenseData || []).length,
          loanCount: (loanData || []).length,
          fetchedFromDatabase: input.fetchFromDatabase,
        },
        output: result,
        diagnostics,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Cashflow calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

// GET endpoint - fetch user's cashflow from database
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      // Fetch all user data
      const [income, expenses, loans] = await Promise.all([
        prisma.income.findMany({ where: { userId: authReq.user!.userId } }),
        prisma.expense.findMany({ where: { userId: authReq.user!.userId } }),
        prisma.loan.findMany({
          where: { userId: authReq.user!.userId },
          include: { offsetAccount: true },
        }),
      ]);

      // Transform data to orchestrator format and calculate
      const cashflowInput: CashflowInput = {
        income: transformIncomeData(income),
        expenses: transformExpenseData(expenses),
        loans: transformLoanData(loans),
      };

      // Use centralized orchestrator for calculation
      const result = calculateCashflow(cashflowInput);

      return NextResponse.json({
        output: result,
        diagnostics: {
          warnings: result.savingsRate < 10 ? ['Low savings rate'] : [],
          assumptions: ['All amounts normalized to monthly', 'Uses centralized cashflowOrchestrator'],
        },
      });
    } catch (error) {
      console.error('Cashflow calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
