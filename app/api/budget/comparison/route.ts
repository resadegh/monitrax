/**
 * Phase 18: Budget Comparison API
 * GET /api/budget/comparison - Compare actual spending vs budget targets
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { generateMonthlyReport } from '@/lib/bank';
import type { CategorisedTransaction, BudgetTarget } from '@/lib/bank/types';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const { searchParams } = new URL(request.url);
      const month = searchParams.get('month'); // YYYY-MM format
      const savingsTarget = parseFloat(searchParams.get('savingsTarget') ?? '20');

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          { error: 'Invalid month format. Use YYYY-MM' },
          { status: 400 }
        );
      }

      // Get transactions for the month
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const transactions = await prisma.unifiedTransaction.findMany({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'desc' },
      });

      // Map to CategorisedTransaction format
      type TxType = (typeof transactions)[number];
      const categorisedTransactions: CategorisedTransaction[] = transactions.map((tx: TxType) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        rawDescription: tx.description,
        amount: tx.amount,
        direction: tx.direction as 'IN' | 'OUT',
        sourceFileId: tx.importBatchId ?? '',
        hash: '',
        merchantRaw: tx.merchantRaw ?? undefined,
        merchantStandardised: tx.merchantStandardised ?? undefined,
        categoryType: 'PERSONAL_EXPENSE' as const,
        categoryLevel1: tx.categoryLevel1 ?? 'Uncategorised',
        categoryLevel2: tx.categoryLevel2 ?? undefined,
        subcategory: tx.subcategory ?? undefined,
        confidenceScore: tx.confidenceScore ?? 0,
      }));

      // Get budget targets
      const budgetTargets = await prisma.budgetTarget.findMany({
        where: {
          userId,
          effectiveFrom: { lte: endDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: startDate } },
          ],
        },
      });

      // Map to BudgetTarget format
      type TargetType = (typeof budgetTargets)[number];
      const targets: BudgetTarget[] = budgetTargets.map((t: TargetType) => ({
        id: t.id,
        userId: t.userId,
        categoryLevel1: t.categoryLevel1,
        categoryLevel2: t.categoryLevel2,
        monthlyTarget: t.monthlyTarget,
        warningThreshold: t.warningThreshold,
        isEssential: t.isEssential,
      }));

      // Generate report
      const report = generateMonthlyReport(
        categorisedTransactions,
        targets,
        month,
        savingsTarget
      );

      return NextResponse.json(report);
    } catch (error) {
      console.error('Budget comparison error:', error);
      return NextResponse.json(
        { error: 'Failed to generate budget comparison' },
        { status: 500 }
      );
    }
  });
}

// POST - Create or update budget targets
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const body = await request.json();
      const { targets } = body;

      if (!Array.isArray(targets)) {
        return NextResponse.json(
          { error: 'targets must be an array' },
          { status: 400 }
        );
      }

      // Upsert each target
      const results = [];
      for (const target of targets) {
        const result = await prisma.budgetTarget.upsert({
          where: {
            userId_categoryLevel1_categoryLevel2: {
              userId,
              categoryLevel1: target.categoryLevel1,
              categoryLevel2: target.categoryLevel2 ?? null,
            },
          },
          update: {
            monthlyTarget: target.monthlyTarget,
            warningThreshold: target.warningThreshold ?? 0.8,
            isEssential: target.isEssential ?? false,
            notes: target.notes,
          },
          create: {
            userId,
            categoryLevel1: target.categoryLevel1,
            categoryLevel2: target.categoryLevel2,
            monthlyTarget: target.monthlyTarget,
            warningThreshold: target.warningThreshold ?? 0.8,
            isEssential: target.isEssential ?? false,
            notes: target.notes,
          },
        });
        results.push(result);
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        targets: results,
      });
    } catch (error) {
      console.error('Budget target error:', error);
      return NextResponse.json(
        { error: 'Failed to save budget targets' },
        { status: 500 }
      );
    }
  });
}
