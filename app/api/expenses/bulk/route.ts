import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { Frequency } from '@/lib/validation/common';
import { ExpenseCategory, ExpenseSourceType } from '@/lib/validation/expenses';

interface BulkExpenseItem {
  name: string;
  category: string;
  amount: number;
  frequency: string;
  sourceType?: string;
  propertyId?: string | null;
  isTaxDeductible?: boolean;
  isEssential?: boolean;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { expenses } = body as { expenses: BulkExpenseItem[] };

      if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
        return NextResponse.json({ error: 'No expenses provided' }, { status: 400 });
      }

      // Validate all expenses have required fields
      for (const expense of expenses) {
        if (!expense.name || !expense.category || expense.amount === undefined || !expense.frequency) {
          return NextResponse.json({
            error: `Invalid expense: ${expense.name || 'unnamed'} - missing required fields`
          }, { status: 400 });
        }
      }

      // Validate property ownership for any property-linked expenses
      const propertyIds = [...new Set(expenses.filter(e => e.propertyId).map(e => e.propertyId))];
      if (propertyIds.length > 0) {
        const properties = await prisma.property.findMany({
          where: {
            id: { in: propertyIds as string[] },
            userId: authReq.user!.userId
          },
          select: { id: true }
        });
        const validPropertyIds = new Set(properties.map((p: { id: string }) => p.id));

        for (const expense of expenses) {
          if (expense.propertyId && !validPropertyIds.has(expense.propertyId)) {
            return NextResponse.json({
              error: `Invalid property ID for expense: ${expense.name}`
            }, { status: 403 });
          }
        }
      }

      // Create all expenses in a transaction
      const createdExpenses = await prisma.$transaction(
        expenses.map(expense =>
          prisma.expense.create({
            data: {
              userId: authReq.user!.userId,
              name: expense.name,
              category: expense.category as ExpenseCategory,
              amount: parseFloat(String(expense.amount)),
              frequency: expense.frequency as Frequency,
              sourceType: (expense.sourceType || (expense.propertyId ? 'PROPERTY' : 'GENERAL')) as ExpenseSourceType,
              propertyId: expense.propertyId || null,
              isTaxDeductible: expense.isTaxDeductible ?? false,
              isEssential: expense.isEssential ?? true,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        count: createdExpenses.length,
        expenses: createdExpenses
      }, { status: 201 });
    } catch (error) {
      console.error('Bulk create expenses error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
