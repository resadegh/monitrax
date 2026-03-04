import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractLoanLinks, wrapWithGRDCS } from '@/lib/grdcs';

export const GET = withPermission('loan.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Fetch loans and linked transactions in parallel
      const [loans, linkedTransactions] = await Promise.all([
        prisma.loan.findMany({
          where: { userId },
          include: {
            property: true,
            offsetAccount: true,
            linkedAsset: true,      // For CAR loans
            linkedAccount: true,    // For LINE_OF_CREDIT
            expenses: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Fetch ALL linked transactions to calculate accurate repayment averages
        prisma.unifiedTransaction.findMany({
          where: {
            userId,
            loanId: { not: null },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            loanId: true,
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      // Group transactions by loanId and calculate totals
      // Track current month vs all-time for display
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const actualsByLoanId = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        currentMonthCount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of linkedTransactions) {
        if (tx.loanId) {
          const existing = actualsByLoanId.get(tx.loanId) || {
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

          actualsByLoanId.set(tx.loanId, existing);
        }
      }

      // Apply GRDCS wrapper to each loan and add actuals
      const loansWithLinks = loans.map((loan: typeof loans[number]) => {
        const links = extractLoanLinks(loan);
        const wrapped = wrapWithGRDCS(loan as Record<string, unknown>, 'loan', links);

        // Add actual repayments from linked transactions
        const actuals = actualsByLoanId.get(loan.id);

        // Calculate monthly average from transactions using DAYS-BASED approach
        // Important for variable rate loans where repayments fluctuate
        let monthlyAverage = null;
        if (actuals && actuals.transactions.length >= 2) {
          const sortedTx = actuals.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const firstDate = sortedTx[0].date;
          const lastDate = sortedTx[sortedTx.length - 1].date;
          const daysCovered = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

          // Add one payment interval to account for period the last payment covers
          const avgPaymentInterval = daysCovered / (sortedTx.length - 1);
          const totalDaysCovered = daysCovered + avgPaymentInterval;

          // Monthly average = (sum / days) * 30.44 (average days per month)
          monthlyAverage = (actuals.totalAmount / totalDaysCovered) * 30.44;
        } else if (actuals && actuals.transactions.length === 1) {
          // Single transaction - use as monthly estimate
          monthlyAverage = actuals.totalAmount;
        }

        return {
          ...wrapped,
          // Budget = minRepayment (what user entered as expected repayment)
          budgetAmount: loan.minRepayment,
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
        data: loansWithLinks,
        _meta: {
          count: loansWithLinks.length,
          totalLinkedEntities: loansWithLinks.reduce((sum: number, l: { _meta: { linkedCount: number } }) => sum + l._meta.linkedCount, 0),
          currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
        },
      });
    } catch (error) {
      console.error('Get loans error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const POST = withPermission('loan.write', async (request, auth) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        propertyId,
        offsetAccountId,
        linkedAssetId,
        linkedAccountId,
        principal,
        interestRateAnnual,
        rateType,
        fixedExpiry,
        isInterestOnly,
        termMonthsRemaining,
        minRepayment,
        repaymentFrequency,
        extraRepaymentCap,
      } = body;

      if (
        !name ||
        !type ||
        principal === undefined ||
        interestRateAnnual === undefined ||
        !rateType ||
        !termMonthsRemaining ||
        !minRepayment ||
        !repaymentFrequency
      ) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, auth.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (offsetAccountId) {
        const account = await prisma.account.findUnique({ where: { id: offsetAccountId } });
        const result = verifyRelatedOwnership(account, auth.userId, 'Offset account');
        if (!result.success) return result.response;
      }

      // Validate linked asset (for CAR loans)
      if (linkedAssetId) {
        const asset = await prisma.asset.findUnique({ where: { id: linkedAssetId } });
        const result = verifyRelatedOwnership(asset, auth.userId, 'Asset');
        if (!result.success) return result.response;
      }

      // Validate linked account (for LINE_OF_CREDIT)
      if (linkedAccountId) {
        const account = await prisma.account.findUnique({ where: { id: linkedAccountId } });
        const result = verifyRelatedOwnership(account, auth.userId, 'Linked account');
        if (!result.success) return result.response;
      }

      const loan = await prisma.loan.create({
        data: {
          userId: auth.userId,
          name,
          type,
          propertyId: propertyId || null,
          offsetAccountId: offsetAccountId || null,
          linkedAssetId: linkedAssetId || null,
          linkedAccountId: linkedAccountId || null,
          principal: parseFloat(principal),
          interestRateAnnual: parseFloat(interestRateAnnual),
          rateType,
          fixedExpiry: fixedExpiry ? new Date(fixedExpiry) : null,
          isInterestOnly: Boolean(isInterestOnly),
          termMonthsRemaining: parseInt(termMonthsRemaining),
          minRepayment: parseFloat(minRepayment),
          repaymentFrequency,
          extraRepaymentCap: extraRepaymentCap ? parseFloat(extraRepaymentCap) : null,
        },
      });

      return NextResponse.json(loan, { status: 201 });
    } catch (error) {
      console.error('Create loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
