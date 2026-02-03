/**
 * CASHFLOW OPTIMISATION ENGINE API
 * Phase 14 - GET/POST /api/cashflow
 *
 * Returns cashflow forecasts and optimisation recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  generateForecast,
  generateOptimisations,
  generateCashflowInsights,
  CFEInput,
  COEInput,
  AccountBalance,
  TransactionRecord,
  RecurringPaymentData,
  IncomeStream,
  LoanSchedule,
  SpendingProfileData,
  LoanData,
  OffsetAccountData,
  CategoryAverage,
  TrendDirection,
} from '@/lib/cashflow';
import { normalizeIncomeStream } from '@/lib/cashflow/incomeNormalizer';
import { toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// Uses centralized toMonthly from lib/utils/frequencies (Blueprint §5.1)

/**
 * Build CFE input from database
 */
async function buildCFEInput(
  userId: string,
  forecastDays: number = 90
): Promise<CFEInput> {
  const [
    accounts,
    transactions,
    recurringPayments,
    income,
    loans,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      include: { linkedLoan: true },
    }),
    prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
        isTransfer: { not: true }, // Exclude transfers from cashflow calculations
      },
      orderBy: { date: 'desc' },
    }),
    prisma.recurringPayment.findMany({
      where: { userId, isActive: true },
    }),
    prisma.income.findMany({
      where: { userId },
    }),
    prisma.loan.findMany({
      where: { userId },
      include: { offsetAccount: true },
    }),
  ]);

  // Transform accounts
  const accountBalances: AccountBalance[] = accounts.map((a: any) => ({
    accountId: a.id,
    accountName: a.name,
    accountType: a.type,
    currentBalance: Number(a.currentBalance),
    lastUpdated: a.updatedAt,
    linkedLoanId: a.linkedLoan?.id,
  }));

  // Transform transactions
  const transactionRecords: TransactionRecord[] = transactions.map((t: any) => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    amount: Math.abs(Number(t.amount)),
    direction: t.direction,
    categoryLevel1: t.categoryLevel1,
    categoryLevel2: t.categoryLevel2,
    merchantStandardised: t.merchantStandardised,
    isRecurring: t.isRecurring,
  }));

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
  }));

  // Transform income streams with tax-adjusted amounts for salaries
  const incomeStreams: IncomeStream[] = income.map((i: any) => {
    const baseStream: IncomeStream = {
      id: i.id,
      name: i.name,
      type: i.type,
      monthlyAmount: toMonthly(Number(i.amount), i.frequency as Frequency),
      frequency: i.frequency,
      volatility: 0.1, // Default low volatility for regular income
      // Pass salary-specific fields for proper tax handling
      salaryType: i.salaryType || null,
      grossAmount: i.grossAmount != null ? Number(i.grossAmount) : null,
      netAmount: i.netAmount != null ? Number(i.netAmount) : null,
      paygWithholding: i.paygWithholding != null ? Number(i.paygWithholding) : null,
    };

    // Apply tax normalization (handles NET vs GROSS properly)
    const normalized = normalizeIncomeStream(baseStream);
    return {
      ...baseStream,
      monthlyAmount: normalized.netMonthlyAmount, // Use after-tax amount for cashflow
    };
  });

  // Transform loan schedules
  const loanSchedules: LoanSchedule[] = loans.map((l: any) => ({
    loanId: l.id,
    loanName: l.name,
    principal: Number(l.principal),
    interestRate: Number(l.interestRateAnnual),
    monthlyRepayment: Number(l.minRepayment),
    repaymentDate: 15, // Default to 15th of month
    isInterestOnly: l.isInterestOnly,
    offsetAccountId: l.offsetAccountId,
    offsetBalance: l.offsetAccount
      ? Number(l.offsetAccount.currentBalance)
      : undefined,
  }));

  return {
    userId,
    accounts: accountBalances,
    transactions: transactionRecords,
    recurringPayments: recurringData,
    incomeStreams,
    loanSchedules,
    config: {
      forecastDays,
      granularity: 'DAILY',
      includeConfidenceBands: true,
    },
  };
}

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
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
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
}
