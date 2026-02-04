import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractIncomeLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch income entries and linked transactions in parallel
      const [income, linkedTransactions] = await Promise.all([
        prisma.income.findMany({
          where: { userId },
          include: { property: true, investmentAccount: true },
          orderBy: { createdAt: 'desc' },
        }),
        // Phase 30: Fetch ALL linked transactions (not just current month) to show actuals
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            incomeId: { not: null },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            incomeId: true,
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      // Group transactions by incomeId and calculate totals
      // Also track current month vs all-time for display
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const actualsByIncomeId = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        currentMonthCount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of linkedTransactions) {
        if (tx.incomeId) {
          const existing = actualsByIncomeId.get(tx.incomeId) || {
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

          actualsByIncomeId.set(tx.incomeId, existing);
        }
      }

      // Apply GRDCS wrapper to each income and add actuals
      const incomeWithLinks = income.map((inc: typeof income[number]) => {
        const links = extractIncomeLinks(inc);
        const wrapped = wrapWithGRDCS(inc as Record<string, unknown>, 'income', links);

        // Phase 30: Add actual from transactions
        const actuals = actualsByIncomeId.get(inc.id);

        // Calculate monthly average from all transactions
        let monthlyAverage = null;
        if (actuals && actuals.transactions.length >= 2) {
          const sortedTx = actuals.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const firstDate = sortedTx[0].date;
          const lastDate = sortedTx[sortedTx.length - 1].date;
          const daysCovered = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          const monthsCovered = daysCovered / 30.44;
          if (monthsCovered > 0) {
            monthlyAverage = actuals.totalAmount / monthsCovered;
          }
        }

        return {
          ...wrapped,
          // Budget = entry.amount (what user entered)
          budgetAmount: inc.amount,
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
        data: incomeWithLinks,
        _meta: {
          count: incomeWithLinks.length,
          totalLinkedEntities: incomeWithLinks.reduce((sum: number, i: { _meta: { linkedCount: number } }) => sum + i._meta.linkedCount, 0),
          currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
        },
      });
    } catch (error) {
      console.error('Get income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        amount,
        frequency,
        isTaxable,
        propertyId,
        investmentAccountId,
        sourceType,
        // Phase 20: Salary-specific fields
        salaryType,
        payFrequency,
        grossAmount,
        netAmount,
        paygWithholding,
        superGuaranteeRate,
        superGuaranteeAmount,
        salarySacrifice,
        // Phase 20: Investment-specific fields
        frankingPercentage,
        frankingCredits,
      } = body;

      if (!name || !type || amount === undefined || !frequency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, authReq.user!.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      // Helper to safely convert to number
      const toNumber = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      };

      // Helper to convert Frequency enum to PayFrequency enum (ANNUAL -> ANNUALLY)
      // PayFrequency values: WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUALLY
      const toPayFrequency = (freq: string | undefined | null): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | null => {
        if (freq === undefined || freq === null) return null;
        // Map ANNUAL to ANNUALLY (Frequency uses ANNUAL, PayFrequency uses ANNUALLY)
        const mapped = freq === 'ANNUAL' ? 'ANNUALLY' : freq;
        // Validate it's a valid PayFrequency value
        const validPayFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'] as const;
        if (validPayFrequencies.includes(mapped as typeof validPayFrequencies[number])) {
          return mapped as typeof validPayFrequencies[number];
        }
        return null;
      };

      const incomeRecord = await prisma.income.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          amount: toNumber(amount) ?? 0,
          frequency,
          isTaxable: isTaxable !== undefined ? Boolean(isTaxable) : true,
          propertyId: propertyId || null,
          investmentAccountId: investmentAccountId || null,
          sourceType: sourceType || 'GENERAL',
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: type === 'SALARY' ? toPayFrequency(payFrequency) : null,
          grossAmount: toNumber(grossAmount),
          netAmount: toNumber(netAmount),
          paygWithholding: toNumber(paygWithholding),
          superGuaranteeRate: toNumber(superGuaranteeRate),
          superGuaranteeAmount: toNumber(superGuaranteeAmount),
          salarySacrifice: toNumber(salarySacrifice),
          // Phase 20: Investment-specific fields
          frankingPercentage: toNumber(frankingPercentage),
          frankingCredits: toNumber(frankingCredits),
        },
        include: { property: true, investmentAccount: true },
      });

      return NextResponse.json(incomeRecord, { status: 201 });
    } catch (error) {
      console.error('Create income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
