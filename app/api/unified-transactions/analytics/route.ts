/**
 * UNIFIED TRANSACTIONS ANALYTICS API
 * Phase 13 - Transactional Intelligence
 *
 * GET - Get spending analytics, trends, and forecasts
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.2 Component 4
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  calculateSpendingSummary,
  analyseTrend,
  detectCategoryDrift,
  forecastMonthlySpending,
  generateSpendingProfile,
  UnifiedTransaction,
} from '@/lib/tie';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const { searchParams } = new URL(request.url);
      const userId = authReq.user!.userId;

      // Date range (default: last 6 months)
      const months = parseInt(searchParams.get('months') || '6');
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Fetch transactions
      const transactions = await prisma.unifiedTransaction.findMany({
        where: {
          userId,
          date: { gte: startDate },
        },
        orderBy: { date: 'desc' },
      });

      // Convert Prisma results to TIE types
      const tieTransactions: UnifiedTransaction[] = transactions.map((tx: typeof transactions[number]) => ({
        id: tx.id,
        userId: tx.userId,
        accountId: tx.accountId,
        date: tx.date,
        postDate: tx.postDate,
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction as 'IN' | 'OUT',
        merchantRaw: tx.merchantRaw,
        merchantStandardised: tx.merchantStandardised,
        merchantCategoryCode: tx.merchantCategoryCode,
        description: tx.description,
        categoryLevel1: tx.categoryLevel1,
        categoryLevel2: tx.categoryLevel2,
        subcategory: tx.subcategory,
        tags: tx.tags,
        userCorrectedCategory: tx.userCorrectedCategory,
        confidenceScore: tx.confidenceScore,
        isRecurring: tx.isRecurring,
        recurrencePattern: tx.recurrencePattern as UnifiedTransaction['recurrencePattern'],
        recurrenceGroupId: tx.recurrenceGroupId,
        anomalyFlags: tx.anomalyFlags as UnifiedTransaction['anomalyFlags'],
        source: tx.source as UnifiedTransaction['source'],
        externalId: tx.externalId,
        importBatchId: tx.importBatchId,
        propertyId: tx.propertyId,
        loanId: tx.loanId,
        incomeId: tx.incomeId,
        expenseId: tx.expenseId,
        investmentAccountId: tx.investmentAccountId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        processedAt: tx.processedAt,
      }));

      // Calculate analytics
      const summary = calculateSpendingSummary(tieTransactions);
      const trend = analyseTrend(tieTransactions, months);
      const categoryDrift = detectCategoryDrift(tieTransactions, 3);
      const forecast = forecastMonthlySpending(tieTransactions, months);

      // Get or create spending profile
      let profile = await prisma.spendingProfile.findUnique({
        where: { userId },
      });

      if (!profile && tieTransactions.length > 0) {
        const profileData = generateSpendingProfile(tieTransactions, userId);
        profile = await prisma.spendingProfile.create({
          data: {
            userId,
            categoryAverages: profileData.categoryAverages,
            monthlyPatterns: profileData.monthlyPatterns,
            seasonalityFactors: profileData.seasonalityFactors,
            spendingClusters: profileData.spendingClusters,
            overallVolatility: profileData.overallVolatility,
            categoryVolatility: profileData.categoryVolatility,
            predictedMonthlySpend: profileData.predictedMonthlySpend,
            predictionConfidence: profileData.predictionConfidence,
            dataPointCount: profileData.dataPointCount,
            lastCalculated: profileData.lastCalculated,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalSpend: summary.totalSpend,
            totalIncome: summary.totalIncome,
            netCashflow: summary.netCashflow,
            transactionCount: summary.transactionCount,
            averageTransaction: summary.averageTransaction,
            topCategories: summary.topCategories.slice(0, 5),
            topMerchants: summary.topMerchants.slice(0, 5),
          },
          trend: {
            direction: trend.direction,
            changePercent: trend.changePercent,
            confidence: trend.confidence,
          },
          categoryDrift: categoryDrift.slice(0, 5),
          forecast: {
            predictedSpend: forecast.predictedSpend,
            confidence: forecast.confidence,
            topCategories: forecast.breakdown.slice(0, 5),
            factors: forecast.factors,
          },
          profile: profile
            ? {
                overallVolatility: profile.overallVolatility,
                predictedMonthlySpend: profile.predictedMonthlySpend,
                predictionConfidence: profile.predictionConfidence,
                dataPointCount: profile.dataPointCount,
                lastCalculated: profile.lastCalculated,
              }
            : null,
          meta: {
            periodMonths: months,
            transactionsAnalysed: tieTransactions.length,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Analytics error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate analytics' },
        { status: 500 }
      );
    }
  });
}
