/**
 * FINANCIAL HEALTH ENGINE API
 * Phase 12 - GET /api/financial-health
 *
 * Returns the complete Financial Health Report including:
 * - Health Score (0-100)
 * - Category breakdowns
 * - Risk signals
 * - Improvement actions
 * - Evidence pack for explainability
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  generateHealthReport,
  quickHealthCheck,
  scoreToRiskBand,
  FinancialHealthInput,
  PropertyData,
  LoanData,
  AccountData,
  InvestmentData,
  IncomeData,
  ExpenseData,
  InsightData,
} from '@/lib/health';
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

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

// Helper to get net income amount (after PAYG for salary types)
function getNetMonthlyIncome(incomeItem: { amount: number; frequency: string; type: string }): number {
  if (incomeItem.type === 'SALARY') {
    const takeHome = calculateTakeHomePay(
      incomeItem.amount,
      incomeItem.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL'
    );
    return normalizeToMonthly(takeHome.netAmount, incomeItem.frequency);
  }
  // For non-salary income, use gross amount (tax calculated at year end)
  return normalizeToMonthly(incomeItem.amount, incomeItem.frequency);
}

/**
 * Transform database data into FinancialHealthInput format
 */
async function buildHealthInput(userId: string): Promise<FinancialHealthInput> {
  // Fetch all user data in parallel
  const [
    properties,
    loans,
    accounts,
    income,
    expenses,
    investmentAccounts,
    holdings,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { userId },
      include: {
        loans: true,
        income: true,
        expenses: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId },
      include: {
        property: true,
        offsetAccount: true,
      },
    }),
    prisma.account.findMany({
      where: { userId },
    }),
    prisma.income.findMany({
      where: { userId },
    }),
    prisma.expense.findMany({
      where: { userId },
    }),
    prisma.investmentAccount.findMany({
      where: { userId },
      include: {
        holdings: true,
      },
    }),
    prisma.investmentHolding.findMany({
      where: {
        investmentAccount: { userId },
      },
    }),
  ]);

  // Calculate totals
  const totalPropertyValue = properties.reduce(
    (sum: number, p: any) => sum + Number(p.currentValue),
    0
  );
  const totalAccountBalances = accounts.reduce(
    (sum: number, a: any) => sum + Number(a.currentBalance),
    0
  );
  const totalInvestmentValue = holdings.reduce(
    (sum: number, h: any) => sum + Number(h.units) * Number(h.averagePrice),
    0
  );
  const totalAssets = totalPropertyValue + totalAccountBalances + totalInvestmentValue;
  const totalLiabilities = loans.reduce((sum: number, l: any) => sum + Number(l.principal), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Transform properties
  const propertyData: PropertyData[] = properties.map((p: any) => {
    const propertyLoans = loans.filter((l: any) => l.propertyId === p.id);
    const debt = propertyLoans.reduce((sum: number, l: any) => sum + Number(l.principal), 0);
    const propertyIncome = income.filter((i: any) => i.propertyId === p.id);
    const propertyExpenses = expenses.filter((e: any) => e.propertyId === p.id);
    const monthlyIncome = propertyIncome.reduce(
      (sum: number, i: any) => sum + normalizeToMonthly(Number(i.amount), i.frequency),
      0
    );
    const monthlyExpenses = propertyExpenses.reduce(
      (sum: number, e: any) => sum + normalizeToMonthly(Number(e.amount), e.frequency),
      0
    );

    return {
      id: p.id,
      name: p.name,
      type: p.type as 'HOME' | 'INVESTMENT',
      currentValue: Number(p.currentValue),
      purchasePrice: Number(p.purchasePrice),
      debt,
      monthlyIncome,
      monthlyExpenses,
    };
  });

  // Transform loans
  const loanData: LoanData[] = loans.map((l: any) => {
    // Calculate monthly repayment (simplified)
    const monthlyInterest = (Number(l.principal) * Number(l.interestRateAnnual)) / 12;
    const monthlyRepayment = l.isInterestOnly
      ? monthlyInterest
      : Number(l.minRepayment) || monthlyInterest * 1.2;

    return {
      id: l.id,
      name: l.name,
      type: l.type as 'HOME' | 'INVESTMENT',
      principal: Number(l.principal),
      interestRate: Number(l.interestRateAnnual),
      isInterestOnly: l.isInterestOnly,
      monthlyRepayment,
      propertyId: l.propertyId || undefined,
    };
  });

  // Transform accounts
  const accountData: AccountData[] = accounts.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type as 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD',
    balance: Number(a.currentBalance),
  }));

  // Transform investments
  const investmentData: InvestmentData[] = holdings.map((h: any) => ({
    id: h.id,
    ticker: h.ticker,
    type: h.type as 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO',
    value: Number(h.units) * Number(h.averagePrice),
    costBase: Number(h.units) * Number(h.averagePrice), // Simplified
  }));

  // Transform income with net amounts for salary types
  const incomeData: IncomeData[] = income.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    // Use net income (after PAYG) for salary types - reflects actual available cash
    monthlyAmount: getNetMonthlyIncome({ amount: Number(i.amount), frequency: i.frequency, type: i.type }),
    isTaxable: i.isTaxable,
  }));

  // Transform expenses
  const expenseData: ExpenseData[] = expenses.map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    monthlyAmount: normalizeToMonthly(Number(e.amount), e.frequency),
    isEssential: e.isEssential,
  }));

  // Fetch insights if available (from insights engine)
  // For now, return empty array as insights engine integration is separate
  const insights: InsightData[] = [];

  // Calculate linkage health metrics
  const orphanedLoans = loans.filter((l: any) => !l.propertyId);
  const rentalIncomeWithoutProperty = income.filter(
    (i: any) => (i.type === 'RENT' || i.type === 'RENTAL') && !i.propertyId
  );
  const orphanCount = orphanedLoans.length + rentalIncomeWithoutProperty.length;
  const totalEntities =
    properties.length +
    loans.length +
    income.length +
    expenses.length +
    accounts.length +
    investmentAccounts.length +
    holdings.length;
  const consistencyScore =
    totalEntities > 0 ? Math.max(0, 100 - orphanCount * 10) : 100;

  return {
    userId,
    portfolioSnapshot: {
      netWorth,
      totalAssets,
      totalLiabilities,
      properties: propertyData,
      loans: loanData,
      accounts: accountData,
      investments: investmentData,
      income: incomeData,
      expenses: expenseData,
    },
    insights,
    linkageHealth: {
      orphans: [
        ...orphanedLoans.map((l: any) => `loan:${l.id}`),
        ...rentalIncomeWithoutProperty.map((i: any) => `income:${i.id}`),
      ],
      missingLinks: [],
      consistencyScore,
    },
  };
}

/**
 * GET /api/financial-health
 *
 * Query params:
 * - quick: boolean - If true, returns only the score without full report
 *
 * Returns:
 * - Full FinancialHealthReport or quick score summary
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);
      const quickMode = searchParams.get('quick') === 'true';

      // Build input from database
      const input = await buildHealthInput(userId);

      if (quickMode) {
        // Return quick score only
        const result = quickHealthCheck(input);
        return NextResponse.json({
          success: true,
          data: {
            score: result.score,
            riskBand: result.riskBand,
            confidence: result.confidence,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // Generate full report
      const report = generateHealthReport(input);

      return NextResponse.json({
        success: true,
        data: {
          // Core health score
          healthScore: {
            score: report.healthScore.score,
            confidence: report.healthScore.confidence,
            riskBand: scoreToRiskBand(report.healthScore.score),
            trend: report.healthScore.trend,
          },

          // Category breakdown
          categories: report.categories.map((c) => ({
            name: c.name,
            score: c.score,
            weight: c.weight,
            riskBand: c.riskBand,
            contributingMetrics: c.contributingMetrics,
          })),

          // Risk signals (sorted by severity)
          riskSignals: report.riskSignals.map((r) => ({
            id: r.id,
            category: r.category,
            severity: r.severity,
            title: r.title,
            description: r.description,
            tier: r.tier,
            evidence: r.evidence,
          })),

          // Improvement actions (top 10)
          improvementActions: report.improvementActions.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            category: a.category,
            difficulty: a.difficulty,
            impact: a.impact,
            priority: a.priority,
          })),

          // Score modifiers (for transparency)
          modifiers: report.modifiers,

          // Evidence pack (for explainability)
          evidence: {
            inputsUsed: report.evidence.inputsUsed.length,
            confidenceLevel: report.evidence.confidenceLevel,
            insightsLinked: report.evidence.insightsLinked.length,
            riskMap: report.evidence.riskMap,
            lastUpdated: report.evidence.lastUpdated,
          },

          // Metadata
          generatedAt: report.generatedAt.toISOString(),
          userId: report.userId,
        },
      });
    } catch (error) {
      console.error('Financial health API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate financial health report',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
