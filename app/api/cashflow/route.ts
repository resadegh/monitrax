/**
 * CASHFLOW OPTIMISATION ENGINE API
 * Phase 14 - GET/POST /api/cashflow
 *
 * Returns cashflow forecasts and optimisation recommendations.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  generateForecast,
  generateOptimisations,
  generateCashflowInsights,
  COEInput,
  RecurringPaymentData,
  SpendingProfileData,
  LoanData,
  OffsetAccountData,
  CategoryAverage,
  TrendDirection,
} from '@/lib/cashflow';
// MON-027: the CFE input builder is now the ONE shared service (was copy-pasted
// here and in stress-test/route.ts — the copies had drifted on transfers + tax).
import { buildCFEInput } from '@/lib/cashflow/buildCFEInput';
import { toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

// Uses centralized toMonthly from lib/utils/frequencies (Blueprint §5.1)

/**
 * Build COE input from CFE output and database
 */
async function buildCOEInput(
  userId: string,
  cfeOutput: any
): Promise<COEInput> {
  const [
    loans,
    accounts,
    recurringPayments,
    spendingProfile,
  ] = await Promise.all([
    prisma.loan.findMany({
      where: { userId },
      include: { offsetAccount: true },
    }),
    prisma.account.findMany({
      where: { userId },
    }),
    prisma.recurringPayment.findMany({
      where: { userId, isActive: true },
    }),
    prisma.spendingProfile.findUnique({
      where: { userId },
    }),
  ]);

  // Transform spending profile
  let profileData: SpendingProfileData;
  if (spendingProfile) {
    const categoryAverages: Record<string, CategoryAverage> = {};
    const rawAverages = spendingProfile.categoryAverages as Record<string, any>;
    if (rawAverages) {
      Object.entries(rawAverages).forEach(([cat, data]: [string, any]) => {
        categoryAverages[cat] = {
          avgMonthly: data.avgMonthly || 0,
          trend: (data.trend as TrendDirection) || 'STABLE',
          volatility: data.volatility || 0,
        };
      });
    }

    profileData = {
      categoryAverages,
      overallVolatility: spendingProfile.overallVolatility || 0,
      predictedMonthlySpend: spendingProfile.predictedMonthlySpend || undefined,
    };
  } else {
    // Build from transactions if no profile exists
    profileData = {
      categoryAverages: {},
      overallVolatility: 0.5,
    };
  }

  // Transform recurring payments
  const recurringData: RecurringPaymentData[] = recurringPayments.map((rp: any) => ({
    id: rp.id,
    merchantStandardised: rp.merchantStandardised,
    accountId: rp.accountId,
    pattern: rp.pattern,
    expectedAmount: Number(rp.expectedAmount),
    nextExpected: rp.nextExpected,
    lastOccurrence: rp.lastOccurrence,
    isActive: rp.isActive,
    priceIncreaseAlert: rp.priceIncreaseAlert,
    lastPriceChange: rp.lastPriceChange ? Number(rp.lastPriceChange) : undefined,
    lastPriceChangeDate: rp.lastPriceChangeDate,
  }));

  // Transform loans
  const loanData: LoanData[] = loans.map((l: any) => ({
    id: l.id,
    name: l.name,
    principal: Number(l.principal),
    interestRate: Number(l.interestRateAnnual),
    monthlyRepayment: Number(l.minRepayment),
    isInterestOnly: l.isInterestOnly,
    offsetAccountId: l.offsetAccountId,
  }));

  // Transform offset accounts
  const offsetAccounts: OffsetAccountData[] = accounts
    .filter((a: any) => a.type === 'OFFSET')
    .map((a: any) => {
      const linkedLoan = loans.find((l: any) => l.offsetAccountId === a.id);
      return {
        id: a.id,
        name: a.name,
        balance: Number(a.currentBalance),
        linkedLoanId: linkedLoan?.id || '',
        effectiveSavingsRate: linkedLoan
          ? Number(linkedLoan.interestRateAnnual)
          : 0,
      };
    })
    .filter((o: any) => o.linkedLoanId); // Only include linked offsets

  return {
    userId,
    forecast: cfeOutput,
    spendingProfile: profileData,
    recurringPayments: recurringData,
    loans: loanData,
    offsetAccounts,
  };
}

/**
 * GET /api/cashflow
 *
 * Query params:
 * - type: 'forecast' | 'optimisation' | 'full' | 'lite' (default: 'full')
 * - days: number (default: 90)
 *
 * Returns cashflow forecast and/or optimisation recommendations
 *
 * Note: 'lite' mode returns minimal data for faster loading on cold starts
 */
export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_HOUSEHOLD');
    if (gateBlocked) return gateBlocked;
    try {
      const userId = auth.userId;
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'full';
      const days = parseInt(searchParams.get('days') || '90', 10);

      // Lite mode - return minimal data quickly (useful for cold starts)
      if (type === 'lite') {
        const [accounts, income, expenses] = await Promise.all([
          prisma.account.findMany({
            where: { userId },
            select: { id: true, name: true, currentBalance: true, type: true },
          }),
          prisma.income.findMany({
            where: { userId },
            select: { amount: true, frequency: true },
          }),
          prisma.expense.findMany({
            where: { userId },
            select: { amount: true, frequency: true },
          }),
        ]);

        const totalBalance = accounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance), 0);
        const monthlyIncome = income.reduce((sum: number, i: any) => sum + toMonthly(Number(i.amount), i.frequency as Frequency), 0);
        const monthlyExpenses = expenses.reduce((sum: number, e: any) => sum + toMonthly(Number(e.amount), e.frequency as Frequency), 0);
        const dailyNet = (monthlyIncome - monthlyExpenses) / 30;

        // Generate simple 90-day forecast
        const globalForecast = [];
        let runningBalance = totalBalance;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 0; day < 90; day++) {
          const forecastDate = new Date(today);
          forecastDate.setDate(forecastDate.getDate() + day);

          globalForecast.push({
            date: forecastDate.toISOString(),
            predictedBalance: runningBalance,
            predictedIncome: day % 30 === 14 ? monthlyIncome : 0, // Assume income on 15th
            predictedExpenses: monthlyExpenses / 30,
            confidenceScore: Math.max(0.5, 0.95 - day * 0.005),
            shortfallRisk: runningBalance < 0,
          });

          runningBalance += dailyNet;
        }

        return NextResponse.json({
          success: true,
          data: {
            forecast: {
              globalForecast,
              summary: {
                avgDailyBalance30: totalBalance + (dailyNet * 15),
                totalIncome30: monthlyIncome,
                totalExpenses30: monthlyExpenses,
                netCashflow30: monthlyIncome - monthlyExpenses,
                avgDailyBalance90: totalBalance + (dailyNet * 45),
                totalIncome90: monthlyIncome * 3,
                totalExpenses90: monthlyExpenses * 3,
                netCashflow90: (monthlyIncome - monthlyExpenses) * 3,
                monthlyBurnRate: monthlyExpenses,
                threeMonthBurnRate: monthlyExpenses * 3,
                withdrawableCash: Math.max(0, totalBalance - monthlyExpenses * 3),
              },
              shortfallAnalysis: {
                hasShortfall: runningBalance < 0,
                shortfallDates: [],
                maxShortfallAmount: 0,
                totalShortfallDays: 0,
                accountsAtRisk: [],
              },
              volatilityIndex: 20, // Low estimate for lite mode
              recurringTimeline: [],
              accountForecasts: accounts.map((a: any) => ({
                accountId: a.id,
                accountName: a.name,
                averageBalance: Number(a.currentBalance),
              })),
            },
            optimisations: {
              fundMovements: [],
              breakEvenDay: monthlyIncome > 0 ? Math.ceil(monthlyExpenses / (monthlyIncome / 30)) : -1,
              summary: { totalPotentialSavings: 0 },
              strategies: [],
            },
            insights: [],
            generatedAt: new Date(),
            metadata: { mode: 'lite', message: 'Lite mode - click Refresh for full analysis' },
          },
        });
      }

      // Build CFE input
      const cfeInput = await buildCFEInput(userId, days);

      // Generate forecast
      const forecast = await generateForecast(cfeInput);

      if (type === 'forecast') {
        return NextResponse.json({
          success: true,
          data: {
            forecast: {
              globalForecast: forecast.globalForecast.map((f) => ({
                date: f.date,
                predictedBalance: f.predictedBalance,
                predictedIncome: f.predictedIncome,
                predictedExpenses: f.predictedExpenses,
                confidenceScore: f.confidenceScore,
                shortfallRisk: f.shortfallRisk,
                upperBound: f.upperBound,
                lowerBound: f.lowerBound,
              })),
              summary: forecast.summary,
              shortfallAnalysis: forecast.shortfallAnalysis,
              volatilityIndex: forecast.volatilityIndex,
              recurringTimeline: forecast.recurringTimeline.slice(0, 30),
            },
            generatedAt: forecast.generatedAt,
            metadata: forecast.metadata,
          },
        });
      }

      // Build COE input and generate optimisations
      const coeInput = await buildCOEInput(userId, forecast);
      const optimisations = await generateOptimisations(coeInput);

      if (type === 'optimisation') {
        return NextResponse.json({
          success: true,
          data: {
            optimisations: {
              inefficiencies: optimisations.inefficiencies,
              subscriptions: optimisations.subscriptions,
              subscriptionsWithPriceIncrease: optimisations.subscriptionsWithPriceIncrease,
              fundMovements: optimisations.fundMovements,
              repaymentOptimisations: optimisations.repaymentOptimisations,
              strategies: optimisations.strategies.slice(0, 10),
              breakEvenDay: optimisations.breakEvenDay,
              summary: optimisations.summary,
            },
            generatedAt: optimisations.generatedAt,
          },
        });
      }

      // Full response
      // Generate insights
      const insights = generateCashflowInsights(userId, forecast, optimisations);

      return NextResponse.json({
        success: true,
        data: {
          forecast: {
            globalForecast: forecast.globalForecast.map((f) => ({
              date: f.date,
              predictedBalance: f.predictedBalance,
              predictedIncome: f.predictedIncome,
              predictedExpenses: f.predictedExpenses,
              confidenceScore: f.confidenceScore,
              shortfallRisk: f.shortfallRisk,
              upperBound: f.upperBound,
              lowerBound: f.lowerBound,
            })),
            accountForecasts: forecast.accountForecasts.map((af) => ({
              accountId: af.accountId,
              accountName: af.accountName,
              averageBalance: af.averageBalance,
              minBalance: af.minBalance,
              maxBalance: af.maxBalance,
              shortfallDays: af.shortfallDays.length,
            })),
            summary: forecast.summary,
            shortfallAnalysis: forecast.shortfallAnalysis,
            volatilityIndex: forecast.volatilityIndex,
            recurringTimeline: forecast.recurringTimeline.slice(0, 30),
          },
          optimisations: {
            inefficiencies: optimisations.inefficiencies.slice(0, 10),
            subscriptions: optimisations.subscriptions,
            subscriptionsWithPriceIncrease: optimisations.subscriptionsWithPriceIncrease,
            fundMovements: optimisations.fundMovements,
            repaymentOptimisations: optimisations.repaymentOptimisations,
            strategies: optimisations.strategies.slice(0, 10),
            breakEvenDay: optimisations.breakEvenDay,
            summary: optimisations.summary,
          },
          insights: insights.slice(0, 20),
          generatedAt: new Date(),
          metadata: forecast.metadata,
        },
      });
    } catch (error) {
      console.error('Cashflow API error:', error);
      const errorMessage = error instanceof Error
        ? `${error.message}\n${error.stack}`
        : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate cashflow data',
          details: errorMessage,
        },
        { status: 500 }
      );
    }
});
