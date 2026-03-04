import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractExpenseLinks, wrapWithGRDCS } from '@/lib/grdcs';

export const GET = withPermission('expense.read', async (request, auth) => {
    try {
      const userId = auth.userId;

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
        // Phase 30: Fetch ALL linked transactions (not just current month) to calculate accurate averages
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            expenseId: { not: null },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            expenseId: true,
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      // Group transactions by expenseId and calculate totals
      // Track current month vs all-time for display
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const actualsByExpenseId = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        currentMonthCount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of linkedTransactions) {
        if (tx.expenseId) {
          const existing = actualsByExpenseId.get(tx.expenseId) || {
            totalAmount: 0,
            totalCount: 0,
            currentMonthAmount: 0,
            currentMonthCount: 0,
            transactions: [],
          };
          const txAmount = Math.abs(tx.amount);
          const txDate = new Date(tx.date);

          existing.totalAmount += txAmount;
          existing.totalCount += 1;
          existing.transactions.push({ date: txDate, amount: txAmount });

          // Track current month separately
          if (txDate >= currentMonthStart) {
            existing.currentMonthAmount += txAmount;
            existing.currentMonthCount += 1;
          }

          actualsByExpenseId.set(tx.expenseId, existing);
        }
      }

      // Apply GRDCS wrapper to each expense and add actuals
      const expensesWithLinks = expenses.map((expense: typeof expenses[number]) => {
        const links = extractExpenseLinks(expense);
        const wrapped = wrapWithGRDCS(expense as Record<string, unknown>, 'expense', links);

        // Phase 30: Add actual from transactions with days-based monthly average
        const actuals = actualsByExpenseId.get(expense.id);

        // Calculate monthly average from transactions using DAYS-BASED approach
        // This provides accurate averages regardless of how payments fall across calendar months
        // Formula: (sum / totalDaysCovered) * 30.44 = monthly average
        // Expenses are typically paid in ARREARS (covering a completed period)
        let monthlyAverage = null;
        if (actuals && actuals.transactions.length >= 2) {
          const sortedTx = actuals.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const firstDate = sortedTx[0].date;
          const lastDate = sortedTx[sortedTx.length - 1].date;
          const daysCovered = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

          // For accurate monthly average, add one payment interval to days covered
          // This accounts for the period the last payment covers
          const avgPaymentInterval = daysCovered / (sortedTx.length - 1);
          const totalDaysCovered = daysCovered + avgPaymentInterval;

          // Monthly average = (sum / days) * 30.44 (average days per month)
          monthlyAverage = (actuals.totalAmount / totalDaysCovered) * 30.44;
        } else if (actuals && actuals.transactions.length === 1) {
          // Single transaction - assume it represents one period based on expense frequency
          monthlyAverage = actuals.totalAmount; // Will be normalized by frequency in UI
        }

        return {
          ...wrapped,
          // Budget = entry.amount (what user entered)
          budgetAmount: expense.amount,
          // Actual = total from ALL linked transactions
          actualFromTransactions: actuals ? actuals.totalAmount : null,
          // Current month actual
          currentMonthActual: actuals ? actuals.currentMonthAmount : null,
          // Monthly average calculated from transaction history
          monthlyAverageActual: monthlyAverage ? Math.round(monthlyAverage * 100) / 100 : null,
          transactionCount: actuals ? actuals.totalCount : 0,
          currentMonthTransactionCount: actuals ? actuals.currentMonthCount : 0,
          hasTransactions: actuals !== undefined && actuals.totalCount > 0,
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

export const POST = withPermission('expense.write', async (request, auth) => {
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
        const result = verifyRelatedOwnership(property, auth.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        const result = verifyRelatedOwnership(loan, auth.userId, 'Loan');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, auth.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      // Validate asset ownership
      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        const result = verifyRelatedOwnership(asset, auth.userId, 'Asset');
        if (!result.success) return result.response;
      }

      // Validate custom category ownership
      if (customCategoryId) {
        const customCategory = await prisma.category.findFirst({
          where: { id: customCategoryId, userId: auth.userId, type: 'EXPENSE' },
        });
        if (!customCategory) {
          return NextResponse.json({ error: 'Custom category not found or unauthorized' }, { status: 403 });
        }
      }

      const expense = await prisma.expense.create({
        data: {
          userId: auth.userId,
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
