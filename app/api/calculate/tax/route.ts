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
      const incomeSources = income.map((i) => ({
        name: i.name,
        amount: toAnnual(i.amount, i.frequency),
        isTaxable: i.isTaxable,
      }));

      const expenseSources = expenses.map((e) => ({
        name: e.name,
        amount: toAnnual(e.amount, e.frequency),
        isTaxDeductible: e.isTaxDeductible,
      }));

      // Calculate tax position
      const taxResult = calculateTaxPosition(incomeSources, expenseSources);

      return NextResponse.json({ tax: taxResult });
    } catch (error) {
      console.error('Tax calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
