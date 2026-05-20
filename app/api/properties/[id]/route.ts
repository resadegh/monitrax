import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Phase 41E reform cut-over (CLAUDE.md §12.14): 7:30pm AEST 12 May 2026 =
 * 2026-05-12T09:30:00Z. Pre-cut-over purchases auto-fill
 * `acquisitionContractDate := purchaseDate`; post-cut-over keep the
 * user-confirmed value or null. Reform INPUTS only — no post-reform math.
 */
const REFORM_CUT_OVER_UTC_MS = Date.UTC(2026, 4, 12, 9, 30, 0);

export const GET = withPermission<RouteContext>('property.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      // First fetch the property with related data to get IDs
      const property = await prisma.property.findUnique({
        where: { id },
        include: {
          loans: true,
          income: true,
          expenses: true,
          depreciationSchedules: true,
        },
      });

      const ownershipResult = verifyOwnership(property, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      // Extract IDs for transaction queries
      const incomeIds = property!.income.map((inc) => inc.id);
      const expenseIds = property!.expenses.map((exp) => exp.id);
      const loanIds = property!.loans.map((loan) => loan.id);

      // Fetch transactions linked to property's income/expenses/loans in parallel
      const [incomeTransactions, expenseTransactions, loanTransactions] = await Promise.all([
        // Fetch transactions linked to property's income
        incomeIds.length > 0
          ? prisma.unifiedTransaction.findMany({
              where: {
                userId,
                incomeId: { in: incomeIds },
              },
              select: { id: true, date: true, amount: true, incomeId: true },
              orderBy: { date: 'asc' },
            })
          : Promise.resolve([]),
        // Fetch transactions linked to property's expenses
        expenseIds.length > 0
          ? prisma.unifiedTransaction.findMany({
              where: {
                userId,
                expenseId: { in: expenseIds },
              },
              select: { id: true, date: true, amount: true, expenseId: true },
              orderBy: { date: 'asc' },
            })
          : Promise.resolve([]),
        // Fetch transactions linked to property's loans
        loanIds.length > 0
          ? prisma.unifiedTransaction.findMany({
              where: {
                userId,
                loanId: { in: loanIds },
              },
              select: { id: true, date: true, amount: true, loanId: true },
              orderBy: { date: 'asc' },
            })
          : Promise.resolve([]),
      ]);

      // Helper function to calculate days-based monthly average
      const calculateMonthlyAverage = (transactions: Array<{ date: Date; amount: number }>, isAdvance = false): number | null => {
        if (transactions.length < 2) {
          return transactions.length === 1 ? Math.abs(transactions[0].amount) : null;
        }

        const sortedTx = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (isAdvance) {
          // For ADVANCE payments (rent): exclude last payment
          const completedPayments = sortedTx.slice(0, -1);
          if (completedPayments.length < 1) return null;

          const sum = completedPayments.reduce((s, tx) => s + Math.abs(tx.amount), 0);
          if (completedPayments.length === 1) return sum;

          const firstDate = new Date(completedPayments[0].date);
          const lastDate = new Date(completedPayments[completedPayments.length - 1].date);
          const daysSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          const avgInterval = daysSpan / (completedPayments.length - 1);
          const totalDays = daysSpan + avgInterval;
          return (sum / totalDays) * 30.44;
        } else {
          // For ARREARS payments
          const sum = sortedTx.reduce((s, tx) => s + Math.abs(tx.amount), 0);
          const firstDate = new Date(sortedTx[0].date);
          const lastDate = new Date(sortedTx[sortedTx.length - 1].date);
          const daysSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          const avgInterval = daysSpan / (sortedTx.length - 1);
          const totalDays = daysSpan + avgInterval;
          return (sum / totalDays) * 30.44;
        }
      };

      // Current month tracking
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Group income transactions and calculate actuals
      const incomeActuals = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of incomeTransactions) {
        if (tx.incomeId) {
          const existing = incomeActuals.get(tx.incomeId) || {
            totalAmount: 0, totalCount: 0, currentMonthAmount: 0, transactions: []
          };
          const amt = Math.abs(tx.amount);
          existing.totalAmount += amt;
          existing.totalCount += 1;
          existing.transactions.push({ date: new Date(tx.date), amount: amt });
          if (new Date(tx.date) >= currentMonthStart) existing.currentMonthAmount += amt;
          incomeActuals.set(tx.incomeId, existing);
        }
      }

      // Group expense transactions and calculate actuals
      const expenseActuals = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of expenseTransactions) {
        if (tx.expenseId) {
          const existing = expenseActuals.get(tx.expenseId) || {
            totalAmount: 0, totalCount: 0, currentMonthAmount: 0, transactions: []
          };
          const amt = Math.abs(tx.amount);
          existing.totalAmount += amt;
          existing.totalCount += 1;
          existing.transactions.push({ date: new Date(tx.date), amount: amt });
          if (new Date(tx.date) >= currentMonthStart) existing.currentMonthAmount += amt;
          expenseActuals.set(tx.expenseId, existing);
        }
      }

      // Group loan transactions and calculate actuals
      const loanActuals = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of loanTransactions) {
        if (tx.loanId) {
          const existing = loanActuals.get(tx.loanId) || {
            totalAmount: 0, totalCount: 0, currentMonthAmount: 0, transactions: []
          };
          const amt = Math.abs(tx.amount);
          existing.totalAmount += amt;
          existing.totalCount += 1;
          existing.transactions.push({ date: new Date(tx.date), amount: amt });
          if (new Date(tx.date) >= currentMonthStart) existing.currentMonthAmount += amt;
          loanActuals.set(tx.loanId, existing);
        }
      }

      // Enrich income with actuals
      const incomeWithActuals = property!.income.map((inc) => {
        const actuals = incomeActuals.get(inc.id);
        const isRental = inc.type === 'RENTAL' || inc.type === 'RENT';
        const monthlyAvg = actuals ? calculateMonthlyAverage(actuals.transactions, isRental) : null;
        return {
          ...inc,
          budgetAmount: inc.amount,
          actualFromTransactions: actuals?.totalAmount || null,
          currentMonthActual: actuals?.currentMonthAmount || null,
          monthlyAverageActual: monthlyAvg ? Math.round(monthlyAvg * 100) / 100 : null,
          transactionCount: actuals?.totalCount || 0,
          hasTransactions: (actuals?.totalCount || 0) > 0,
        };
      });

      // Enrich expenses with actuals
      const expensesWithActuals = property!.expenses.map((exp) => {
        const actuals = expenseActuals.get(exp.id);
        const monthlyAvg = actuals ? calculateMonthlyAverage(actuals.transactions, false) : null;
        return {
          ...exp,
          budgetAmount: exp.amount,
          actualFromTransactions: actuals?.totalAmount || null,
          currentMonthActual: actuals?.currentMonthAmount || null,
          monthlyAverageActual: monthlyAvg ? Math.round(monthlyAvg * 100) / 100 : null,
          transactionCount: actuals?.totalCount || 0,
          hasTransactions: (actuals?.totalCount || 0) > 0,
        };
      });

      // Enrich loans with actuals
      const loansWithActuals = property!.loans.map((loan) => {
        const actuals = loanActuals.get(loan.id);
        const monthlyAvg = actuals ? calculateMonthlyAverage(actuals.transactions, false) : null;
        return {
          ...loan,
          budgetAmount: loan.minRepayment,
          actualFromTransactions: actuals?.totalAmount || null,
          currentMonthActual: actuals?.currentMonthAmount || null,
          monthlyAverageActual: monthlyAvg ? Math.round(monthlyAvg * 100) / 100 : null,
          transactionCount: actuals?.totalCount || 0,
          hasTransactions: (actuals?.totalCount || 0) > 0,
        };
      });

      return NextResponse.json({
        ...property,
        income: incomeWithActuals,
        expenses: expensesWithActuals,
        loans: loansWithActuals,
      });
    } catch (error) {
      console.error('Get property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('property.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();
      const {
        name,
        type,
        address,
        purchasePrice,
        purchaseDate,
        currentValue,
        valuationDate,
        // Phase 41E reform inputs (CLAUDE.md §12.14)
        acquisitionContractDate,
        isNewBuild,
        newBuildEvidence,
        // Location fields (Google Maps)
        latitude,
        longitude,
        googlePlaceId,
        suburb,
        state,
        postcode,
      } = body;

      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      // Phase 41E (§12.14): resolve the regime-determining contract date.
      const purchaseDateObj = new Date(purchaseDate);
      const isPostCutOver =
        !Number.isNaN(purchaseDateObj.getTime()) &&
        purchaseDateObj.getTime() > REFORM_CUT_OVER_UTC_MS;
      const resolvedContractDate = acquisitionContractDate
        ? new Date(acquisitionContractDate)
        : isPostCutOver
          ? null
          : purchaseDateObj;

      const property = await prisma.property.update({
        where: { id },
        data: {
          name,
          type,
          address,
          purchasePrice,
          purchaseDate: purchaseDateObj,
          currentValue,
          valuationDate: new Date(valuationDate),
          // Phase 41E reform inputs — stored, never computed here. Only
          // written when the caller sent a reform field, so a dashboard
          // edit that omits them leaves the existing values untouched.
          ...(acquisitionContractDate !== undefined ||
          isNewBuild !== undefined ||
          newBuildEvidence !== undefined
            ? {
                acquisitionContractDate: resolvedContractDate,
                isNewBuild: isPostCutOver ? (isNewBuild ?? null) : null,
                newBuildEvidence: isPostCutOver
                  ? (newBuildEvidence ?? null)
                  : null,
              }
            : {}),
          // Location data
          latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
          longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
          googlePlaceId: googlePlaceId !== undefined ? (googlePlaceId || null) : undefined,
          suburb: suburb !== undefined ? (suburb || null) : undefined,
          state: state !== undefined ? (state || null) : undefined,
          postcode: postcode !== undefined ? (postcode || null) : undefined,
        },
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'PROPERTY_UPDATED',
        status: 'SUCCESS',
        entityType: 'Property',
        entityId: property.id,
        metadata: { type, isPostCutOver },
      });

      return NextResponse.json(property);
    } catch (error) {
      console.error('Update property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const DELETE = withPermission<RouteContext>('property.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      await prisma.property.delete({
        where: { id },
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'PROPERTY_DELETED',
        status: 'SUCCESS',
        entityType: 'Property',
        entityId: id,
      });

      return NextResponse.json({ message: 'Property deleted successfully' });
    } catch (error) {
      console.error('Delete property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
