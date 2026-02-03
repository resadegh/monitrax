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
        // Phase 30: Fetch transactions linked to income for current month
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            incomeId: { not: null },
            date: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First of current month
            },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            incomeId: true,
          },
        }),
      ]);

      // Group transactions by incomeId and calculate monthly actuals
      const actualsByIncomeId = new Map<string, { amount: number; count: number }>();
      for (const tx of linkedTransactions) {
        if (tx.incomeId) {
          const existing = actualsByIncomeId.get(tx.incomeId) || { amount: 0, count: 0 };
          existing.amount += Math.abs(tx.amount);
          existing.count += 1;
          actualsByIncomeId.set(tx.incomeId, existing);
        }
      }

      // Apply GRDCS wrapper to each income and add actuals
      const incomeWithLinks = income.map((inc: typeof income[number]) => {
        const links = extractIncomeLinks(inc);
        const wrapped = wrapWithGRDCS(inc as Record<string, unknown>, 'income', links);

        // Phase 30: Add actual from transactions
        const actuals = actualsByIncomeId.get(inc.id);
        return {
          ...wrapped,
          // Budget = entry.amount (what user entered)
          budgetAmount: inc.amount,
          // Actual = from transactions if available, null otherwise
          actualFromTransactions: actuals ? actuals.amount : null,
          transactionCount: actuals ? actuals.count : 0,
          hasTransactions: actuals !== undefined,
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
