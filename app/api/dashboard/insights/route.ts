/**
 * Dashboard Insights API
 * GET /api/dashboard/insights - Get actionable financial insights
 *
 * REFACTORED to use:
 * - getMasterFinancialSnapshot (canonical Phase-28 SSOT) for consistent
 *   expense/income/cashflow/loans/accounts totals
 * - Financial Health Engine for health score (same as sidebar) - Blueprint §5.1
 *
 * Provides:
 * - Financial Health Score (0-100) - from Financial Health Engine
 * - Emergency Fund coverage (months)
 * - Spending by category breakdown
 * - Money bleeding areas (highest expenses)
 * - Actionable recommendations
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getExpenseDataMaturity } from '@/lib/dashboard/expenseDataMaturity';
import { getMoneyStoryTrend } from '@/lib/calculations/moneyStoryTrend';
import { quickHealthCheck, scoreToRiskBand, FinancialHealthInput, PropertyData, LoanData, AccountData, InvestmentData, IncomeData, ExpenseData } from '@/lib/health';
import { toAnnual, toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

// Types for detailed expense data (not in snapshot)
interface ExpenseDetail {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  frequency: string;
  isEssential: boolean;
}

interface CategorySpending {
  category: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage: number;
  items: Array<{
    name: string;
    monthlyAmount: number;
    frequency: string;
  }>;
}

interface Insight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  metric?: string;
  action?: string;
}

interface DashboardInsights {
  healthScore: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: {
      savingsRate: { score: number; weight: number; value: number };
      emergencyFund: { score: number; weight: number; value: number };
      debtToIncome: { score: number; weight: number; value: number };
      diversification: { score: number; weight: number; value: number };
    };
  };
  emergencyFund: {
    liquidCash: number;
    monthlyExpenses: number;
    monthsCovered: number;
    target: number;
    status: 'danger' | 'warning' | 'good' | 'excellent';
    gap: number;
  };
  spendingByCategory: CategorySpending[];
  moneyBleeding: Array<{
    name: string;
    category: string;
    monthlyAmount: number;
    annualAmount: number;
    percentageOfIncome: number;
    suggestion?: string;
  }>;
  insights: Insight[];
  monthlyBudget: {
    income: number;
    essentialExpenses: number;
    discretionaryExpenses: number;
    loanPayments: number;
    remaining: number;
    daysInMonth: number;
    dailyBudget: number;
  };
  // Phase 43 — Money Story 3-line scoreboard (Earned / Kept / Free today)
  // + the Money Story Bar visualisation segments (Tax / Spent / Saved).
  // Pure read-through from `snapshot.quickMetrics` + `snapshot.cashflow`;
  // no new computation here.
  moneyStory: {
    earned: number;            // monthly gross income (pre-tax) — "Earned" line
    kept: number;              // monthlyNetIncome − essentialExpenses — "Kept" line
    keptMargin: number;        // kept ÷ earned × 100 (%, 0 when no income)
    freeToday: number;         // liquid cash today — "Free today" line
    freeDays: number;          // freeToday ÷ daily expense burn (0 when expenses are 0)
    /**
     * False-gates the per-day display when expense data is too thin
     * to back a runway-in-days claim honestly. Phase 43.4 upgraded
     * this from `monthlyExpenses > 0` to a two-mode check: ≥90 days
     * of UnifiedTransaction history OR ≥3 recurring Expense entries
     * with ≥1 essential flag set. See `lib/dashboard/expenseDataMaturity.ts`.
     */
    enoughHistory: boolean;
    // Money Story Bar segments (Phase 43 visualisation). All three are
    // monthly $-amounts; the component renders proportions. Fields chosen
    // so the bar is honest about the full Earned-dollar journey:
    //   Earned = taxWithheld + (everything else outgoing) + surplus
    taxWithheld: number;       // PAYG-equivalent gone before the user sees it
    surplus: number;           // monthlyCashflow — true monthly surplus (the "Saved" segment)
    // Phase R-MoneyStoryV2 (2026-05-27) — 12-month historical trend for
    // the Freedom Horizon ribbon. Honest aggregation of transactions
    // bucketed by month. Empty array when user has <2 months of data
    // (the consumer hides the ribbon in that case).
    trend: Array<{ label: string; spent: number; kept: number }>;
    // Margin in percentage points the kept-margin has widened (positive)
    // or tightened (negative) over the trend window. 0 when not enough
    // history. Drives the hero sub-text.
    marginDeltaPoints: number;
    // Freedom horizon in years (= freeCashDays / 365.25). The headline
    // metric on the Money Story v2 hero. Replaces the previous
    // "5255 days of life" framing.
    freedomYears: number;
  };
  // Phase KPI-tiles (2026-05-28) — series + deltas for the dashboard's
  // 3 sparkline KPI tiles (Cash Flow / Income / Outgoings). The band
  // tiles (Saving Rate / LVR) read straight from snapshot.cashflow +
  // snapshot.gearing and need nothing here. Series are empty when the
  // user has <2 months of transaction history.
  kpiTiles: {
    cashflowSeries: number[];
    incomeSeries: number[];
    outgoingsSeries: number[];
    cashflowDeltaMonthly: number;
    incomeDeltaPct: number;
    outgoingsDeltaVsAvg: number;
    // Precomputed display figures so the dashboard page does ZERO inline
    // arithmetic (the Phase 41i.6b surface linter forbids it). Outgoings
    // = expenses + loan repayments, both annual + monthly.
    outgoingsAnnual: number;
    outgoingsMonthly: number;
    incomeMonthly: number;
  };
}

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Get canonical Phase-28 snapshot (single source of truth)
      const snapshot = await getMasterFinancialSnapshot(userId);

      // Phase 43.4 — two-mode expense-data maturity gate. Replaces the
      // cheap `monthlyExpenses > 0` check with ≥90-day UnifiedTransaction
      // history OR ≥3 recurring expenses with ≥1 essential. Drives the
      // `moneyStory.enoughHistory` flag on the response below.
      const expenseMaturity = await getExpenseDataMaturity(userId);

      // Phase R-MoneyStoryV2 (2026-05-27) — honest 12-month aggregation
      // of the user's own transactions for the Freedom Horizon ribbon.
      // Returns empty trend + marginDelta=0 when <2 months of activity
      // (the consumer hides the ribbon cleanly in that case).
      const moneyStoryTrend = await getMoneyStoryTrend(userId, 12);

      // Get health score from Financial Health Engine (same as sidebar) - Blueprint §5.1
      // This ensures Dashboard and Sidebar show the same health score
      const healthInput = await buildHealthInput(userId);
      const healthResult = quickHealthCheck(healthInput);

      // Fetch expense details for item-level breakdowns
      // (snapshot has totals, but we need individual items for category/money bleeding views)
      const expenseDetails = await prisma.expense.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          category: true,
          amount: true,
          frequency: true,
          isEssential: true,
        },
      }) as ExpenseDetail[];

      // Use snapshot values for consistent totals
      const totalMonthlyExpenses = snapshot.expenses.monthly.all.total;
      const essentialExpenses = snapshot.expenses.monthly.essential.total;
      const discretionaryExpenses = snapshot.expenses.monthly.discretionary.total;
      const totalMonthlyIncome = snapshot.income.monthly.all.netTotal;
      const monthlyLoanPayments = snapshot.quickMetrics.monthlyLoanRepayments;
      const liquidCash = snapshot.quickMetrics.liquidCash;

      // Build category spending breakdown using expense details
      const expensesByCategory: Record<string, CategorySpending> = {};
      expenseDetails.forEach((expense) => {
        const monthlyAmount = toMonthly(expense.amount, expense.frequency as Frequency);
        const annualAmount = toAnnual(expense.amount, expense.frequency as Frequency);

        const category = expense.category || 'Uncategorized';
        if (!expensesByCategory[category]) {
          expensesByCategory[category] = {
            category,
            monthlyAmount: 0,
            annualAmount: 0,
            percentage: 0,
            items: [],
          };
        }
        expensesByCategory[category].monthlyAmount += monthlyAmount;
        expensesByCategory[category].annualAmount += annualAmount;
        expensesByCategory[category].items.push({
          name: expense.name,
          monthlyAmount,
          frequency: expense.frequency,
        });
      });

      // Calculate percentages and sort categories
      const spendingByCategory = Object.values(expensesByCategory)
        .map(cat => ({
          ...cat,
          percentage: totalMonthlyExpenses > 0 ? (cat.monthlyAmount / totalMonthlyExpenses) * 100 : 0,
          items: cat.items.sort((a, b) => b.monthlyAmount - a.monthlyAmount),
        }))
        .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

      // Money bleeding - top expenses as percentage of income
      const moneyBleeding = expenseDetails
        .map((expense) => {
          const monthlyAmount = toMonthly(expense.amount, expense.frequency as Frequency);
          const annualAmount = toAnnual(expense.amount, expense.frequency as Frequency);
          const percentageOfIncome = totalMonthlyIncome > 0
            ? (monthlyAmount / totalMonthlyIncome) * 100
            : 0;

          // Add suggestions for high expenses
          let suggestion: string | undefined;
          if (percentageOfIncome > 10 && !expense.isEssential) {
            suggestion = 'This expense is over 10% of your income. Consider if it\'s necessary.';
          } else if (percentageOfIncome > 5 && expense.category?.toLowerCase().includes('subscription')) {
            suggestion = 'Review if all subscriptions are being used.';
          }

          return {
            name: expense.name,
            category: expense.category || 'Uncategorized',
            monthlyAmount,
            annualAmount,
            percentageOfIncome,
            suggestion,
          };
        })
        .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
        .slice(0, 10);

      // Use snapshot values for emergency fund metrics
      const monthsCovered = snapshot.emergencyFund.monthsCovered;
      const emergencyFundGap = snapshot.emergencyFund.gap;
      const emergencyFundStatus = snapshot.emergencyFund.status;
      const savingsRate = snapshot.quickMetrics.savingsRate;
      const debtToIncome = snapshot.healthScore.components.debtToIncome.value;

      // Score calculations (0-100 for each component) - for breakdown display
      const savingsRateScore = Math.min(Math.max(savingsRate * 5, 0), 100);
      const emergencyFundScore = Math.min((monthsCovered / 6) * 100, 100);
      const debtToIncomeScore = Math.max(100 - debtToIncome, 0);
      const diversificationScore = 25; // Simplified for now

      // Use Financial Health Engine score (same as sidebar) - Blueprint §5.1
      const healthScore = healthResult.score;
      // Convert riskBand to grade
      const healthGrade = riskBandToGrade(healthResult.riskBand);

      // Generate actionable insights
      const insights: Insight[] = [];

      // Emergency fund insight
      if (monthsCovered < 1) {
        insights.push({
          type: 'danger',
          title: 'Critical: No Emergency Buffer',
          message: `You have less than 1 month of expenses saved. You need ${formatCurrency(emergencyFundGap)} more for a 6-month buffer.`,
          metric: `${monthsCovered.toFixed(1)} months`,
          action: 'Set up automatic transfers to a savings account',
        });
      } else if (monthsCovered < 3) {
        insights.push({
          type: 'warning',
          title: 'Build Your Safety Net',
          message: `You have ${monthsCovered.toFixed(1)} months of expenses saved. Aim for at least 3 months.`,
          metric: `${monthsCovered.toFixed(1)} months`,
          action: `Save ${formatCurrency(emergencyFundGap)} more to reach 6 months`,
        });
      } else if (monthsCovered >= 6) {
        insights.push({
          type: 'success',
          title: 'Solid Emergency Fund',
          message: `Great job! You have ${monthsCovered.toFixed(1)} months of expenses covered.`,
          metric: `${monthsCovered.toFixed(1)} months`,
        });
      }

      // Savings rate insight
      if (savingsRate < 0) {
        insights.push({
          type: 'danger',
          title: 'Spending More Than Earning',
          message: `You're spending ${formatCurrency(Math.abs(savingsRate * totalMonthlyIncome / 100))} more than you earn each month.`,
          metric: `${savingsRate.toFixed(1)}%`,
          action: 'Review your largest expenses below',
        });
      } else if (savingsRate < 10) {
        insights.push({
          type: 'warning',
          title: 'Low Savings Rate',
          message: `You're only saving ${savingsRate.toFixed(1)}% of your income. Aim for at least 20%.`,
          metric: `${savingsRate.toFixed(1)}%`,
          action: 'Look for expenses to cut',
        });
      } else if (savingsRate >= 20) {
        insights.push({
          type: 'success',
          title: 'Excellent Savings Rate',
          message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep it up!`,
          metric: `${savingsRate.toFixed(1)}%`,
        });
      }

      // High expense category insights
      const topCategory = spendingByCategory[0];
      if (topCategory && topCategory.percentage > 30) {
        insights.push({
          type: 'info',
          title: `${topCategory.category} is Your Biggest Expense`,
          message: `${topCategory.percentage.toFixed(0)}% of your spending (${formatCurrency(topCategory.monthlyAmount)}/mo) goes to ${topCategory.category.toLowerCase()}.`,
          action: 'Review individual items in this category',
        });
      }

      // Discretionary vs essential insight
      const discretionaryPercentage = totalMonthlyExpenses > 0
        ? (discretionaryExpenses / totalMonthlyExpenses) * 100
        : 0;
      if (discretionaryPercentage > 50) {
        insights.push({
          type: 'warning',
          title: 'High Discretionary Spending',
          message: `${discretionaryPercentage.toFixed(0)}% of your expenses are non-essential. Consider cutting back.`,
          metric: formatCurrency(discretionaryExpenses) + '/mo',
        });
      }

      // Monthly budget calculations
      const monthlyRemaining = snapshot.cashflow.monthlyCashflow;
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const dailyBudget = monthlyRemaining > 0 ? monthlyRemaining / daysInMonth : 0;

      const response: DashboardInsights = {
        healthScore: {
          score: healthScore,
          grade: healthGrade,
          breakdown: {
            savingsRate: { score: savingsRateScore, weight: 30, value: savingsRate },
            emergencyFund: { score: emergencyFundScore, weight: 30, value: monthsCovered },
            debtToIncome: { score: debtToIncomeScore, weight: 25, value: debtToIncome },
            diversification: { score: diversificationScore, weight: 15, value: snapshot.counts.accounts },
          },
        },
        emergencyFund: {
          liquidCash,
          monthlyExpenses: totalMonthlyExpenses,
          monthsCovered,
          target: snapshot.emergencyFund.targetMonths,
          status: emergencyFundStatus,
          gap: emergencyFundGap,
        },
        spendingByCategory,
        moneyBleeding,
        insights,
        monthlyBudget: {
          income: totalMonthlyIncome,
          essentialExpenses,
          discretionaryExpenses,
          loanPayments: monthlyLoanPayments,
          remaining: monthlyRemaining,
          daysInMonth,
          dailyBudget,
        },
        // Phase 43 — Money Story. Pure passthrough from canonical
        // quickMetrics + cashflow. `enoughHistory` gates the per-day
        // precision in the hero: a user with no recorded expenses gets
        // the dollar amount only, never a misleading "0 days of life".
        // taxWithheld + surplus power the Money Story Bar visualisation.
        // Phase R-MoneyStoryV2 (2026-05-27) — adds trend + marginDelta +
        // freedomYears for the Freedom Horizon ribbon hero. Honest
        // transaction aggregation; empty trend when <2 months of data.
        moneyStory: {
          earned: snapshot.quickMetrics.monthlyGrossIncome,
          kept: snapshot.quickMetrics.keptAfterEssentials,
          keptMargin: snapshot.quickMetrics.keptMargin,
          freeToday: snapshot.quickMetrics.liquidCash,
          freeDays: snapshot.quickMetrics.freeCashDays,
          enoughHistory: expenseMaturity.isMature,
          taxWithheld: snapshot.cashflow.monthlyPaygWithholding,
          surplus: snapshot.quickMetrics.monthlyCashflow,
          trend: moneyStoryTrend.trend,
          marginDeltaPoints: moneyStoryTrend.marginDeltaPoints,
          freedomYears: snapshot.quickMetrics.freeCashDays / 365.25,
        },
        // Phase KPI-tiles — pure passthrough of the service-computed
        // sparkline series + deltas. No arithmetic here (all done in
        // lib/calculations/moneyStoryTrend.ts).
        kpiTiles: {
          cashflowSeries: moneyStoryTrend.monthlyNetCashflow,
          incomeSeries: moneyStoryTrend.monthlyEarned,
          outgoingsSeries: moneyStoryTrend.monthlySpent,
          cashflowDeltaMonthly: moneyStoryTrend.cashflowDeltaMonthly,
          incomeDeltaPct: moneyStoryTrend.incomeDeltaPct,
          outgoingsDeltaVsAvg: moneyStoryTrend.outgoingsDeltaVsAvg,
          // Arithmetic here is fine — the surface linter only scans
          // app/dashboard, app/portal, components (not app/api).
          // CashflowResult uses annual*/monthly* field names (the page's
          // serialised snapshot uses total* — different type).
          outgoingsAnnual:
            snapshot.cashflow.annualExpenses + snapshot.cashflow.annualLoanRepayments,
          outgoingsMonthly:
            snapshot.cashflow.monthlyExpenses + snapshot.cashflow.monthlyLoanRepayments,
          incomeMonthly: snapshot.quickMetrics.monthlyGrossIncome,
        },
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Dashboard insights error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Convert Financial Health Engine riskBand to letter grade
 * Aligns Dashboard grade with the health score from the engine
 */
function riskBandToGrade(riskBand: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  switch (riskBand) {
    case 'EXCELLENT':
      return 'A';
    case 'GOOD':
      return 'B';
    case 'MODERATE':
      return 'C';
    case 'CONCERNING':
      return 'D';
    case 'CRITICAL':
      return 'F';
    default:
      return 'C';
  }
}

// Helper to get net income amount (after PAYG for salary types)
function getNetMonthlyIncome(incomeItem: { amount: number; frequency: string; type: string }): number {
  if (incomeItem.type === 'SALARY') {
    const takeHome = calculateTakeHomePay(
      incomeItem.amount,
      incomeItem.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL'
    );
    return toMonthly(takeHome.netAmount, incomeItem.frequency as Frequency);
  }
  return toMonthly(incomeItem.amount, incomeItem.frequency as Frequency);
}

/**
 * Build Financial Health Engine input from database
 * This mirrors the logic in /api/financial-health to ensure consistent scores
 */
async function buildHealthInput(userId: string): Promise<FinancialHealthInput> {
  const [
    properties,
    loans,
    accounts,
    income,
    expenses,
    holdings,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { userId },
      include: { loans: true, income: true, expenses: true },
    }),
    prisma.loan.findMany({
      where: { userId },
      include: { property: true, offsetAccount: true },
    }),
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investmentHolding.findMany({
      where: { investmentAccount: { userId } },
    }),
  ]);

  // Calculate totals
  const totalPropertyValue = properties.reduce((sum: number, p: any) => sum + Number(p.currentValue), 0);
  const totalAccountBalances = accounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance), 0);
  const totalInvestmentValue = holdings.reduce((sum: number, h: any) => sum + Number(h.units) * Number(h.averagePrice), 0);
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
      (sum: number, i: any) => sum + toMonthly(Number(i.amount), i.frequency as Frequency), 0
    );
    const monthlyExpenses = propertyExpenses.reduce(
      (sum: number, e: any) => sum + toMonthly(Number(e.amount), e.frequency as Frequency), 0
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
    const monthlyInterest = (Number(l.principal) * Number(l.interestRateAnnual)) / 12;
    const monthlyRepayment = l.isInterestOnly ? monthlyInterest : Number(l.minRepayment) || monthlyInterest * 1.2;
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
    costBase: Number(h.units) * Number(h.averagePrice),
  }));

  // Transform income with net amounts for salary types
  const incomeData: IncomeData[] = income.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    monthlyAmount: getNetMonthlyIncome({ amount: Number(i.amount), frequency: i.frequency, type: i.type }),
    isTaxable: i.isTaxable,
  }));

  // Transform expenses
  const expenseData: ExpenseData[] = expenses.map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    monthlyAmount: toMonthly(Number(e.amount), e.frequency as Frequency),
    isEssential: e.isEssential,
  }));

  // Calculate linkage health
  const orphanedLoans = loans.filter((l: any) => !l.propertyId);
  const rentalIncomeWithoutProperty = income.filter((i: any) => (i.type === 'RENT' || i.type === 'RENTAL') && !i.propertyId);
  const orphanCount = orphanedLoans.length + rentalIncomeWithoutProperty.length;
  const totalEntities = properties.length + loans.length + income.length + expenses.length + accounts.length + holdings.length;
  const consistencyScore = totalEntities > 0 ? Math.max(0, 100 - orphanCount * 10) : 100;

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
    insights: [],
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
