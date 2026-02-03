import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractExpenseLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch expenses and linked transactions in parallel
      const [expenses, linkedTransactions] = await Promise.all([
        prisma.expense.findMany({
          where: { userId },
          include: {
            property: true,
            loan: true,
            investmentAccount: true,
            asset: true,
            // Include custom category if set
            customCategory: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                icon: true,
              },
            },
            // Phase 29: Include linked recurring payments
            linkedRecurringPayments: {
              select: {
                id: true,
                merchantStandardised: true,
                pattern: true,
                expectedAmount: true,
                matchStatus: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Phase 30: Fetch transactions linked to expenses for current month
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            expenseId: { not: null },
            date: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First of current month
            },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            expenseId: true,
          },
        }),
      ]);

      // Group transactions by expenseId and calculate monthly actuals
      const actualsByExpenseId = new Map<string, { amount: number; count: number }>();
      for (const tx of linkedTransactions) {
        if (tx.expenseId) {
          const existing = actualsByExpenseId.get(tx.expenseId) || { amount: 0, count: 0 };
          existing.amount += Math.abs(tx.amount);
          existing.count += 1;
          actualsByExpenseId.set(tx.expenseId, existing);
        }
      }

      // Apply GRDCS wrapper to each expense and add actuals
      const expensesWithLinks = expenses.map((expense: typeof expenses[number]) => {
        const links = extractExpenseLinks(expense);
        const wrapped = wrapWithGRDCS(expense as Record<string, unknown>, 'expense', links);

        // Phase 30: Add actual from transactions
        const actuals = actualsByExpenseId.get(expense.id);
        return {
          ...wrapped,
          // Budget = entry.amount (what user entered)
          budgetAmount: expense.amount,
          // Actual = from transactions if available, null otherwise
          actualFromTransactions: actuals ? actuals.amount : null,
          transactionCount: actuals ? actuals.count : 0,
          hasTransactions: actuals !== undefined,
        };
      });

      return NextResponse.json({
        data: expensesWithLinks,
        _meta: {
          count: expensesWithLinks.length,
          totalLinkedEntities: expensesWithLinks.reduce((sum: number, e: { _meta: { linkedCount: number } }) => sum + e._meta.linkedCount, 0),
          currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
        },
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, category, customCategoryId, amount, frequency, isTaxDeductible, isEssential, isRecurring, propertyId, loanId, investmentAccountId, assetId, vendorName, sourceType } = body;

      // Category is required, but can be 'OTHER' if using a custom category
      if (!name || amount === undefined || !frequency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Must have either category or customCategoryId
      if (!category && !customCategoryId) {
        return NextResponse.json({ error: 'Category or custom category is required' }, { status: 400 });
      }

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        const result = verifyRelatedOwnership(loan, authReq.user!.userId, 'Loan');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, authReq.user!.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      // Validate asset ownership
      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        const result = verifyRelatedOwnership(asset, authReq.user!.userId, 'Asset');
        if (!result.success) return result.response;
      }

      // Validate custom category ownership
      if (customCategoryId) {
        const customCategory = await prisma.category.findFirst({
          where: { id: customCategoryId, userId: authReq.user!.userId, type: 'EXPENSE' },
        });
        if (!customCategory) {
          return NextResponse.json({ error: 'Custom category not found or unauthorized' }, { status: 403 });
        }
      }

      const expense = await prisma.expense.create({
        data: {
          userId: authReq.user!.userId,
          name,
          category: category || 'OTHER',
          customCategoryId: customCategoryId || null,
          amount: parseFloat(amount),
          frequency,
          isTaxDeductible: isTaxDeductible !== undefined ? Boolean(isTaxDeductible) : false,
          isEssential: isEssential !== undefined ? Boolean(isEssential) : true,
          isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : true,
          propertyId: propertyId || null,
          loanId: loanId || null,
          investmentAccountId: investmentAccountId || null,
          assetId: assetId || null,
          vendorName: vendorName || null,
          sourceType: sourceType || 'GENERAL',
        },
        include: {
          property: true,
          loan: true,
          investmentAccount: true,
          asset: true,
          customCategory: {
            select: { id: true, name: true, code: true, color: true, icon: true },
          },
        },
      });

      return NextResponse.json(expense, { status: 201 });
    } catch (error) {
      console.error('Create expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
