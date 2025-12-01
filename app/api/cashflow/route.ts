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

// Helper to normalize amount to monthly
function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'FORTNIGHTLY':
      return (amount * 26) / 12;
    case 'MONTHLY':
      return amount;
    case 'ANNUAL':
      return amount / 12;
    default:
      return amount;
  }
}

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
      monthlyAmount: normalizeToMonthly(Number(i.amount), i.frequency),
      frequency: i.frequency,
      volatility: 0.1, // Default low volatility for regular income
    };

    // Apply tax normalization (adjusts salary to net after PAYG)
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
 * - type: 'forecast' | 'optimisation' | 'full' (default: 'full')
 * - days: number (default: 90)
 *
 * Returns cashflow forecast and/or optimisation recommendations
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'full';
      const days = parseInt(searchParams.get('days') || '90', 10);

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
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate cashflow data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
