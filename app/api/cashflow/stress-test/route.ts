/**
 * CASHFLOW STRESS TEST API
 * Phase 14 - GET/POST /api/cashflow/stress-test
 *
 * Run stress tests and what-if scenarios on cashflow projections.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  runStressTests,
  runCustomStressTest,
  getAvailableScenarios,
  createCustomScenario,
  CFEInput,
  StressParameters,
  StressScenario,
  AccountBalance,
  TransactionRecord,
  RecurringPaymentData,
  IncomeStream,
  LoanSchedule,
} from '@/lib/cashflow';

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
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
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

  // Transform income streams
  const incomeStreams: IncomeStream[] = income.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    monthlyAmount: normalizeToMonthly(Number(i.amount), i.frequency),
    frequency: i.frequency,
    volatility: 0.1,
  }));

  // Transform loan schedules
  const loanSchedules: LoanSchedule[] = loans.map((l: any) => ({
    loanId: l.id,
    loanName: l.name,
    principal: Number(l.principal),
    interestRate: Number(l.interestRateAnnual),
    monthlyRepayment: Number(l.minRepayment),
    repaymentDate: 15,
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
 * GET /api/cashflow/stress-test
 *
 * Query params:
 * - scenarios: comma-separated scenario IDs (optional, runs all if not specified)
 *
 * Returns stress test results across predefined scenarios
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);
      const scenarioIds = searchParams.get('scenarios');

      // Build CFE input
      const cfeInput = await buildCFEInput(userId, 90);

      // Get available scenarios
      const allScenarios = getAvailableScenarios();

      // Filter scenarios if specified
      let scenariosToRun: StressScenario[] = allScenarios;
      if (scenarioIds) {
        const ids = scenarioIds.split(',').map((s) => s.trim());
        scenariosToRun = allScenarios.filter((s) => ids.includes(s.id));
      }

      // Run stress tests
      const results = await runStressTests(cfeInput, scenariosToRun);

      return NextResponse.json({
        success: true,
        data: {
          resilienceScore: results.resilienceScore,
          summary: results.summary,
          baselineResult: {
            scenarioId: results.baselineResult.scenarioId,
            scenarioName: results.baselineResult.scenarioName,
            survivalTime: results.baselineResult.survivalTime,
            maxShortfallAmount: results.baselineResult.maxShortfallAmount,
          },
          scenarioResults: results.scenarioResults.map((r) => ({
            scenarioId: r.scenarioId,
            scenarioName: r.scenarioName,
            survivalTime: r.survivalTime,
            maxShortfallAmount: r.maxShortfallAmount,
            balanceImpact: r.balanceImpact,
            shortfallDaysAdded: r.shortfallDaysAdded,
            requiredSavings: r.requiredSavings,
            requiredIncomeIncrease: r.requiredIncomeIncrease,
            mitigationStrategies: r.mitigationStrategies.slice(0, 5),
          })),
          availableScenarios: allScenarios.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description,
          })),
          generatedAt: results.generatedAt,
        },
      });
    } catch (error) {
      console.error('Stress test API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to run stress tests',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/cashflow/stress-test
 *
 * Body:
 * {
 *   name?: string,
 *   description?: string,
 *   parameters: {
 *     incomeDropPercent?: number,
 *     incomeDropDuration?: number,
 *     expenseShockAmount?: number,
 *     interestRateIncrease?: number,
 *     expenseInflationPercent?: number
 *   }
 * }
 *
 * Run a custom stress test scenario
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();

      // Validate parameters
      const parameters: StressParameters = {
        incomeDropPercent: body.parameters?.incomeDropPercent,
        incomeDropDuration: body.parameters?.incomeDropDuration,
        expenseShockAmount: body.parameters?.expenseShockAmount,
        expenseShockDate: body.parameters?.expenseShockDate
          ? new Date(body.parameters.expenseShockDate)
          : undefined,
        expenseInflationPercent: body.parameters?.expenseInflationPercent,
        interestRateIncrease: body.parameters?.interestRateIncrease,
      };

      // Validate at least one parameter is set
      const hasParameter = Object.values(parameters).some(
        (v) => v !== undefined && v !== null
      );

      if (!hasParameter) {
        return NextResponse.json(
          {
            success: false,
            error: 'At least one stress parameter must be provided',
          },
          { status: 400 }
        );
      }

      // Build CFE input
      const cfeInput = await buildCFEInput(userId, 90);

      // Run custom stress test
      const result = await runCustomStressTest(cfeInput, parameters);

      return NextResponse.json({
        success: true,
        data: {
          scenarioId: result.scenarioId,
          scenarioName: body.name || result.scenarioName,
          description: body.description || `Custom scenario with parameters`,
          parameters,
          survivalTime: result.survivalTime,
          maxShortfallAmount: result.maxShortfallAmount,
          balanceImpact: result.balanceImpact,
          shortfallDaysAdded: result.shortfallDaysAdded,
          requiredSavings: result.requiredSavings,
          requiredIncomeIncrease: result.requiredIncomeIncrease,
          mitigationStrategies: result.mitigationStrategies,
          stressedForecast: result.stressedForecast.slice(0, 30).map((f) => ({
            date: f.date,
            predictedBalance: f.predictedBalance,
            shortfallRisk: f.shortfallRisk,
          })),
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Custom stress test API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to run custom stress test',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
