import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { calculateTaxPosition } from '@/lib/tax/auTax';
import { toAnnual } from '@/lib/utils/frequencies';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      // Fetch user's income and expenses
      const income = await prisma.income.findMany({
        where: { userId: authReq.user!.userId },
      });

      const expenses = await prisma.expense.findMany({
        where: { userId: authReq.user!.userId },
      });

      // Convert to annual amounts and prepare for tax calculation
      const incomeSources = income.map((i: typeof income[number]) => ({
        name: i.name,
        amount: toAnnual(i.amount, i.frequency),
        isTaxable: i.isTaxable,
      }));

      const expenseSources = expenses.map((e: typeof expenses[number]) => ({
        name: e.name,
        amount: toAnnual(e.amount, e.frequency),
        isTaxDeductible: e.isTaxDeductible,
      }));

      // Calculate tax position
      const taxResult = calculateTaxPosition(incomeSources, expenseSources);

      // Transform to frontend-expected shape
      type IncomeSource = typeof incomeSources[number];
      type ExpenseSource = typeof expenseSources[number];
      const response = {
        totalIncome: taxResult.totalIncome,
        totalDeductions: taxResult.taxDeductibleExpenses,
        taxableIncome: taxResult.assessableIncome,
        taxPayable: taxResult.totalTax,
        effectiveRate: taxResult.effectiveTaxRate / 100, // Convert percentage to decimal
        breakdown: {
          income: incomeSources.map((i: IncomeSource) => ({
            name: i.name,
            amount: i.amount,
            taxable: i.isTaxable,
          })),
          deductions: expenseSources
            .filter((e: ExpenseSource) => e.isTaxDeductible)
            .map((e: ExpenseSource) => ({
              name: e.name,
              amount: e.amount,
            })),
        },
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Tax calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
