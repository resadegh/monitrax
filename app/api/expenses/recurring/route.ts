/**
 * RECURRING EXPENSES API
 * GET /api/expenses/recurring - Get user's recurring expenses grouped by category
 *
 * Phase 28: Realistic Budget Integration
 *
 * This endpoint returns all user's tracked expenses normalized to monthly amounts
 * and grouped by category. Used by the Budget Analysis feature to identify
 * what's already tracked and should be excluded from AI variable estimates.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { toMonthly } from '@/lib/utils/frequencies';
import {
  RecurringExpenseItem,
  RecurringExpenseCategory,
  RecurringExpensesResponse,
} from '@/lib/budget-analysis/types';

// Categories that are typically variable and might not be tracked
const VARIABLE_EXPENSE_CATEGORIES = [
  'FOOD',
  'TRANSPORT',
  'ENTERTAINMENT',
  'PERSONAL',
  'OTHER',
];

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch all user expenses
      const expenses = await prisma.expense.findMany({
        where: { userId },
        orderBy: [
          { category: 'asc' },
          { amount: 'desc' },
        ],
      });

      // Group by category and calculate monthly amounts
      const categories: Record<string, RecurringExpenseCategory> = {};
      let totalMonthly = 0;
      const trackedCategories = new Set<string>();

      for (const expense of expenses) {
        const monthlyAmount = toMonthly(expense.amount, expense.frequency);
        totalMonthly += monthlyAmount;
        trackedCategories.add(expense.category);

        const item: RecurringExpenseItem = {
          id: expense.id,
          name: expense.name,
          vendorName: expense.vendorName,
          amount: expense.amount,
          frequency: expense.frequency,
          monthlyAmount: Math.round(monthlyAmount * 100) / 100,
          category: expense.category,
          isEssential: expense.isEssential,
        };

        if (!categories[expense.category]) {
          categories[expense.category] = {
            total: 0,
            items: [],
          };
        }

        categories[expense.category].items.push(item);
        categories[expense.category].total += monthlyAmount;
      }

      // Round category totals
      Object.values(categories).forEach(cat => {
        cat.total = Math.round(cat.total * 100) / 100;
      });

      // Identify missing variable categories
      const missingCategories = VARIABLE_EXPENSE_CATEGORIES.filter(
        cat => !trackedCategories.has(cat)
      );

      const response: RecurringExpensesResponse = {
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        categories,
        expenseCount: expenses.length,
        missingCategories,
      };

      return NextResponse.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('[API] Get recurring expenses error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve recurring expenses',
        },
        { status: 500 }
      );
    }
  });
}
