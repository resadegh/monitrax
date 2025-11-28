/**
 * Phase 18: Financial Health Report API
 * GET /api/budget/health - Generate monthly financial health narrative
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { generateMonthlyReport, generateHealthNarrative, getAvailableMonths } from '@/lib/bank';
import type { CategorisedTransaction, BudgetTarget, MonthlyHealthReport, CategoryBreakdown, HealthInsight } from '@/lib/bank/types';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const { searchParams } = new URL(request.url);
      const month = searchParams.get('month'); // YYYY-MM format

      // Get all transactions to determine available months
      const allTransactions = await prisma.unifiedTransaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });

      if (allTransactions.length === 0) {
        return NextResponse.json({
          availableMonths: [],
          report: null,
          narrative: ['No transactions found. Import your bank statements to get started.'],
        });
      }

      // Map to CategorisedTransaction format
      type TxType = (typeof allTransactions)[number];
      const categorisedTransactions: CategorisedTransaction[] = allTransactions.map((tx: TxType) => ({
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

      const availableMonths = getAvailableMonths(categorisedTransactions);

      // Use provided month or most recent
      const targetMonth = month && /^\d{4}-\d{2}$/.test(month)
        ? month
        : availableMonths[0];

      if (!targetMonth) {
        return NextResponse.json({
          availableMonths: [],
          report: null,
          narrative: ['No transaction data available.'],
        });
      }

      // Parse month for date range
      const [year, monthNum] = targetMonth.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

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

      // Generate budget comparison report
      const budgetReport = generateMonthlyReport(
        categorisedTransactions,
        targets,
        targetMonth,
        20 // Default 20% savings target
      );

      // Generate narrative
      const narrative = generateHealthNarrative(budgetReport);

      // Build category breakdown
      const monthTransactions = categorisedTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      });

      const categoryTotals: Record<string, number> = {};
      monthTransactions
        .filter(tx => tx.direction === 'OUT')
        .forEach(tx => {
          const cat = tx.categoryLevel1;
          categoryTotals[cat] = (categoryTotals[cat] ?? 0) + tx.amount;
        });

      const totalExpenses = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

      const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
          trend: 'STABLE' as const, // Would need previous month comparison
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate income
      const totalIncome = monthTransactions
        .filter(tx => tx.direction === 'IN')
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Build health insights
      const insights: HealthInsight[] = budgetReport.insights.map(i => ({
        type: i.type === 'ALERT' ? 'NEGATIVE' : i.type === 'WARNING' ? 'NEGATIVE' : i.type === 'SUCCESS' ? 'POSITIVE' : 'NEUTRAL',
        message: i.message,
        category: i.category,
        value: i.value,
      }));

      // Build full report
      const healthReport: MonthlyHealthReport = {
        month: targetMonth,
        totalIncome,
        totalExpenses,
        netCashflow: totalIncome - totalExpenses,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
        savingsTarget: 20,
        categoryBreakdown,
        insights,
      };

      return NextResponse.json({
        availableMonths,
        month: targetMonth,
        report: healthReport,
        budgetComparison: budgetReport,
        narrative,
      });
    } catch (error) {
      console.error('Health report error:', error);
      return NextResponse.json(
        { error: 'Failed to generate health report' },
        { status: 500 }
      );
    }
  });
}
