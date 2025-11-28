/**
 * Cashflow Calculation API
 * POST /api/calculate/cashflow
 *
 * Calculate cashflow analysis from income and expense data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import prisma from '@/lib/db';
import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

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
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'ANNUAL']),
        isTaxable: z.boolean().default(true),
        type: z.string().optional(),
      })
    )
    .optional(),
  expenses: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number(),
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'ANNUAL']),
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
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'ANNUAL']),
        offsetBalance: z.number().default(0),
      })
    )
    .optional(),
  // If not provided, fetch from user's data
  fetchFromDatabase: z.boolean().default(true),
});

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

interface CashflowResult {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlySurplus: number;
  annualIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualSurplus: number;
  savingsRate: number;
  incomeByType: Record<string, number>;
  expensesByCategory: Record<string, number>;
  essentialExpenses: number;
  discretionaryExpenses: number;
  taxableIncome: number;
  taxDeductibleExpenses: number;
}

function calculateCashflow(
  income: Array<{ name: string; amount: number; frequency: string; isTaxable: boolean; type?: string }>,
  expenses: Array<{
    name: string;
    amount: number;
    frequency: string;
    isEssential: boolean;
    isTaxDeductible: boolean;
    category?: string;
  }>,
  loans: Array<{
    name: string;
    principal: number;
    interestRate: number;
    minRepayment: number;
    frequency: string;
    offsetBalance: number;
  }>
): CashflowResult {
  // Calculate monthly income
  let monthlyIncome = 0;
  let taxableIncome = 0;
  const incomeByType: Record<string, number> = {};

  for (const inc of income) {
    const monthly = toMonthly(inc.amount, inc.frequency as Frequency);
    monthlyIncome += monthly;

    if (inc.isTaxable) {
      taxableIncome += monthly * 12;
    }

    const type = inc.type || 'OTHER';
    incomeByType[type] = (incomeByType[type] || 0) + monthly;
  }

  // Calculate monthly expenses
  let monthlyExpenses = 0;
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;
  let taxDeductibleExpenses = 0;
  const expensesByCategory: Record<string, number> = {};

  for (const exp of expenses) {
    const monthly = toMonthly(exp.amount, exp.frequency as Frequency);
    monthlyExpenses += monthly;

    if (exp.isEssential) {
      essentialExpenses += monthly;
    } else {
      discretionaryExpenses += monthly;
    }

    if (exp.isTaxDeductible) {
      taxDeductibleExpenses += monthly * 12;
    }

    const category = exp.category || 'OTHER';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + monthly;
  }

  // Calculate monthly loan repayments
  let monthlyLoanRepayments = 0;
  for (const loan of loans) {
    const monthly = toMonthly(loan.minRepayment, loan.frequency as Frequency);
    monthlyLoanRepayments += monthly;
  }

  // Calculate totals
  const totalMonthlyOutflows = monthlyExpenses + monthlyLoanRepayments;
  const monthlySurplus = monthlyIncome - totalMonthlyOutflows;
  const savingsRate = monthlyIncome > 0 ? (monthlySurplus / monthlyIncome) * 100 : 0;

  return {
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    monthlyLoanRepayments: Math.round(monthlyLoanRepayments * 100) / 100,
    monthlySurplus: Math.round(monthlySurplus * 100) / 100,
    annualIncome: Math.round(monthlyIncome * 12 * 100) / 100,
    annualExpenses: Math.round(monthlyExpenses * 12 * 100) / 100,
    annualLoanRepayments: Math.round(monthlyLoanRepayments * 12 * 100) / 100,
    annualSurplus: Math.round(monthlySurplus * 12 * 100) / 100,
    savingsRate: Math.round(savingsRate * 100) / 100,
    incomeByType,
    expensesByCategory,
    essentialExpenses: Math.round(essentialExpenses * 100) / 100,
    discretionaryExpenses: Math.round(discretionaryExpenses * 100) / 100,
    taxableIncome: Math.round(taxableIncome * 100) / 100,
    taxDeductibleExpenses: Math.round(taxDeductibleExpenses * 100) / 100,
  };
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
        incomeData = dbIncome.map((i: any) => ({
          name: i.name,
          amount: i.amount,
          frequency: i.frequency,
          isTaxable: i.isTaxable,
          type: i.type,
        }));
      }

      if (input.fetchFromDatabase && !expenseData) {
        const dbExpenses = await prisma.expense.findMany({
          where: { userId: authReq.user!.userId },
        });
        expenseData = dbExpenses.map((e: any) => ({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          isEssential: e.isEssential,
          isTaxDeductible: e.isTaxDeductible,
          category: e.category,
        }));
      }

      if (input.fetchFromDatabase && !loanData) {
        const dbLoans = await prisma.loan.findMany({
          where: { userId: authReq.user!.userId },
          include: { offsetAccount: true },
        });
        loanData = dbLoans.map((l: any) => ({
          name: l.name,
          principal: l.principal,
          interestRate: l.interestRateAnnual,
          minRepayment: l.minRepayment,
          frequency: l.repaymentFrequency,
          offsetBalance: l.offsetAccount?.currentBalance || 0,
        }));
      }

      // Calculate cashflow
      const result = calculateCashflow(
        incomeData || [],
        expenseData || [],
        loanData || []
      );

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
      diagnostics.assumptions.push('Loan interest calculated separately');

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

      const incomeData = income.map((i: any) => ({
        name: i.name,
        amount: i.amount,
        frequency: i.frequency,
        isTaxable: i.isTaxable,
        type: i.type,
      }));

      const expenseData = expenses.map((e: any) => ({
        name: e.name,
        amount: e.amount,
        frequency: e.frequency,
        isEssential: e.isEssential,
        isTaxDeductible: e.isTaxDeductible,
        category: e.category,
      }));

      const loanData = loans.map((l: any) => ({
        name: l.name,
        principal: l.principal,
        interestRate: l.interestRateAnnual,
        minRepayment: l.minRepayment,
        frequency: l.repaymentFrequency,
        offsetBalance: l.offsetAccount?.currentBalance || 0,
      }));

      const result = calculateCashflow(incomeData, expenseData, loanData);

      return NextResponse.json({
        output: result,
        diagnostics: {
          warnings: result.savingsRate < 10 ? ['Low savings rate'] : [],
          assumptions: ['All amounts normalized to monthly'],
        },
      });
    } catch (error) {
      console.error('Cashflow calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
