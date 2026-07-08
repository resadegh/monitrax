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
import { getCanonicalMonthlyCashflow } from '@/lib/calculations/canonicalCashflow';
import { getExpenseDataMaturity } from '@/lib/dashboard/expenseDataMaturity';
import { getMoneyStoryTrend } from '@/lib/calculations/moneyStoryTrend';
import { computeFinancialIndependence } from '@/lib/calculations/financialIndependence';
import { quickHealthCheck, scoreToRiskBand, FinancialHealthInput, PropertyData, LoanData, AccountData, InvestmentData, IncomeData, ExpenseData } from '@/lib/health';
import { toMonthly } from '@/lib/utils/frequencies';
import { resolveMonthly } from '@/lib/calculations/monthlyResolver';
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
  isRecurring: boolean;
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
    // Freedom horizon in years (= freeCashDays / 365.25). LEGACY liquid-cash
    // runway — retained for back-compat; the hero now leads with the FI
    // coverage below (Phase 58).
    freedomYears: number;
    // Phase 58 (Freedom hero) — Financial Independence: what fraction of the
    // user's real lifestyle spend is already funded by NET, ACCESSIBLE passive
    // income (rent net of costs+interest + dividends + distributions + interest).
    // The single number that only exists because the WHOLE portfolio is on one
    // page. `...At60` adds preserved super at a labelled 4% drawdown assumption.
    freedomCoverageNow: number;
    freedomCoverageAt60: number;
    passiveMonthly: number;
    superIncomeAt60Monthly: number;
    superDrawdownRate: number;
    incomeProducingCount: number;
    growthBuildingCount: number;
    freedomHasData: boolean;
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
    // SSOT canonical cashflow (CLAUDE.md §12.2 / §19.1) — actuals when the
    // user has transactions, declared fallback otherwise. The dashboard money
    // tiles + cashflow detail read THESE (precomputed; zero inline arithmetic
    // per the surface linter) so they match the /cashflow page exactly.
    canonical: {
      monthlyNet: number;
      annualNet: number;
      monthlyInflow: number;
      annualInflow: number;
      monthlyOutflow: number;
      annualOutflow: number;
      savingsRate: number;
      // Phase 57 — 'actual-ttm' = trailing 12-month actuals (the tile headline basis).
      basis: 'actual' | 'actual-ttm' | 'declared';
    };
  };
}

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Get canonical Phase-28 snapshot (single source of truth)
      const snapshot = await getMasterFinancialSnapshot(userId);

      // SSOT for headline cashflow (CLAUDE.md §12.2 / §19.1): the canonical
      // monthly cashflow — ACTUAL transaction-based when `hasActualData`,
      // declared fallback otherwise — the SAME resolver the /cashflow page
      // uses. Dashboard money tiles read this (precomputed, below) so they can
      // never diverge from the cashflow page or Money Story again. (Before:
      // the dashboard read declared `snapshot.cashflow.*` off the portfolio
      // snapshot, which silently drops uncategorised spend → false-optimistic.)
      const canonicalCashflow = getCanonicalMonthlyCashflow(snapshot);

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
      const allExpenseDetails = await prisma.expense.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          category: true,
          amount: true,
          frequency: true,
          isEssential: true,
          isRecurring: true,
        },
      }) as ExpenseDetail[];

      // MON-011: "Where your money goes" + "Spending by category" show ONGOING
      // recurring spend. One-off purchases (a battery, an ATO tax payment) are
      // not a monthly cost — they're excluded here and appear as actual spend in
      // the month they happened (the actuals/activity view).
      const expenseDetails = allExpenseDetails.filter((e) => e.isRecurring !== false);

      // MON-025: read each expense's TRUE monthly from its transaction DATES
      // (the MON-009 resolver) — so an annual payment seen ≥2× reads at its real
      // monthly (~$18/mo), not the stored/defaulted MONTHLY frequency ($216/mo).
      // The declared frequency is the fallback only when there aren't enough
      // transactions to detect the cadence.
      const recurringIds = expenseDetails.map((e) => e.id);
      const expenseTx = recurringIds.length
        ? await prisma.unifiedTransaction.findMany({
            where: { userId, expenseId: { in: recurringIds } },
            select: { expenseId: true, date: true, amount: true },
            orderBy: { date: 'asc' },
          })
        : [];
      const txByExpense = new Map<string, Array<{ date: Date; amount: number }>>();
      for (const t of expenseTx) {
        if (!t.expenseId) continue;
        const arr = txByExpense.get(t.expenseId) ?? [];
        arr.push({ date: t.date, amount: t.amount });
        txByExpense.set(t.expenseId, arr);
      }
      const resolvedMonthlyById = new Map<string, number>();
      for (const e of expenseDetails) {
        resolvedMonthlyById.set(
          e.id,
          resolveMonthly({
            declaredMonthly: toMonthly(e.amount, e.frequency as Frequency),
            cadenceHintFrequency: e.frequency,
            transactions: txByExpense.get(e.id) ?? [],
          }).monthly,
        );
      }

      // MON-023: essential + discretionary + total are all derived from the SAME
      // recurring set, so their shares are coherent. (Regression guard: mixing a
      // recurring total with all-inclusive discretionary/essential slices made a
      // one-off discretionary purchase read as ">100% of expenses" — e.g. 906%.)
      const monthlyOf = (e: ExpenseDetail) =>
        resolvedMonthlyById.get(e.id) ?? toMonthly(e.amount, e.frequency as Frequency);
      const totalMonthlyExpenses = expenseDetails.reduce((s, e) => s + monthlyOf(e), 0);
      const essentialExpenses = expenseDetails.filter((e) => e.isEssential).reduce((s, e) => s + monthlyOf(e), 0);
      const discretionaryExpenses = expenseDetails.filter((e) => !e.isEssential).reduce((s, e) => s + monthlyOf(e), 0);
      const totalMonthlyIncome = snapshot.income.monthly.all.netTotal;
      const monthlyLoanPayments = snapshot.quickMetrics.monthlyLoanRepayments;
      const liquidCash = snapshot.quickMetrics.liquidCash;

      // Build category spending breakdown using expense details
      const expensesByCategory: Record<string, CategorySpending> = {};
      expenseDetails.forEach((expense) => {
        const monthlyAmount = monthlyOf(expense); // MON-025: cadence from dates
        const annualAmount = monthlyAmount * 12;

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
          const monthlyAmount = monthlyOf(expense); // MON-025: cadence from dates
          const annualAmount = monthlyAmount * 12;
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
      // Canonical (actuals-aware) savings rate — §19.1. Was the declared
      // `quickMetrics.savingsRate`, which made the "you're saving X%" insight
      // messages falsely optimistic when actual spend exceeds declared.
      const savingsRate = canonicalCashflow.savingsRate;
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

      // Phase 1 (cashflow-actuals) — Money-Story "Kept" + margin now reflect
      // ACTUAL spend, not declared. The declared `keptAfterEssentials` excludes
      // discretionary spend AND drops uncategorised OUT transactions, so it
      // overstates what was kept. With real transaction data we compute
      // kept = net income − actual total spend (this calendar month). We only
      // switch when `hasActualData` is true; otherwise fall back to the declared
      // value so a brand-new user with no transactions still sees the plan.
      const qm = snapshot.quickMetrics;
      const keptActual = qm.hasActualData
        ? totalMonthlyIncome - qm.actualMonthlyOutflow
        : qm.keptAfterEssentials;
      const keptMarginActual = qm.hasActualData
        ? snapshot.cashflow.monthlyGrossIncome > 0
          ? (keptActual / snapshot.cashflow.monthlyGrossIncome) * 100
          : 0
        : qm.keptMargin;
      // Surplus follows the same rule — actual net when we have real data.
      const surplusActual = qm.hasActualData
        ? qm.actualNetCashflow
        : qm.monthlyCashflow;

      // Phase 58 (Freedom hero) — Financial Independence coverage. Assemble the
      // pure engine's inputs from canonical snapshot fields. NET passive income
      // = per-property net cashflow (the ONLY figure net of expenses + loan
      // repayments — snapshot.income.passive is GROSS and must not be used for
      // rent) + non-property passive (dividends/interest/royalties, no modelled
      // costs). Gross rent is never used — it would overstate freedom on geared
      // property (§0 financial-adviser honesty; §19.1). Lifestyle = the trailing
      // real spend (Phase 57), declared-plan fallback when no trailing actuals.
      const fiPropertyNetMonthly = snapshot.properties.map((p) => p.monthlyCashflow);
      const fiPropertyNetAnnual =
        fiPropertyNetMonthly.reduce((s, v) => s + v, 0) * 12; /* @financial-math-allowed: Σ canonical per-property net cashflow, annualised, for the FI engine (§19.1) */
      const fiPassiveByType = snapshot.income.annual.passive.byType;
      const fiNonPropertyPassiveAnnual =
        (fiPassiveByType['DIVIDEND']?.net ?? 0) +
        (fiPassiveByType['INTEREST']?.net ?? 0) +
        (fiPassiveByType['ROYALTY']?.net ?? 0); /* @financial-math-allowed: non-property passive income (no modelled costs) for the FI engine */
      const fiLifestyleAnnual =
        moneyStoryTrend.trailingMonthsWithData > 0 && moneyStoryTrend.annualOutgoings > 0
          ? moneyStoryTrend.annualOutgoings
          : (snapshot.quickMetrics.monthlyExpenses + snapshot.quickMetrics.monthlyLoanRepayments) * 12; /* @financial-math-allowed: declared-plan lifestyle fallback when no trailing actuals (§19.1) */
      const financialIndependence = computeFinancialIndependence({
        netAccessiblePassiveAnnual: fiPropertyNetAnnual + fiNonPropertyPassiveAnnual, /* @financial-math-allowed: net accessible passive = property net cashflow + non-property passive */
        preservedSuperBalance: snapshot.netWorth.assets.superannuation,
        lifestyleAnnual: fiLifestyleAnnual,
        propertyNetMonthly: fiPropertyNetMonthly,
      });

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
          // Phase 2 (cashflow-SSOT-convergence, 2026-06-23) — display the EXACT
          // denominator the engine used for monthsCovered (actual trailing-avg
          // outflow when transactions exist; declared fallback otherwise), not
          // the declared `totalMonthlyExpenses`. Previously the numerator
          // (liquidCash) + monthsCovered were actual-based while the displayed
          // "/month" figure was declared — an internal contradiction on one
          // tile. CLAUDE.md §19.1.
          monthlyExpenses: snapshot.emergencyFund.monthlyExpenses,
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
          // Phase 58 — earned/kept on the trailing basis (avg money-in and avg
          // net over COMPLETE months) so MARGIN is a real savings margin, not
          // "100%" (the old bug: declared income − near-empty current-month
          // actual spend). Declared fallback when there are no trailing actuals.
          earned:
            moneyStoryTrend.annualIncome > 0
              ? Math.round(moneyStoryTrend.annualIncome / 12)
              : snapshot.quickMetrics.monthlyGrossIncome,
          kept:
            moneyStoryTrend.annualIncome > 0 ? moneyStoryTrend.avgMonthlyNet : keptActual,
          keptMargin: keptMarginActual,
          freeToday: snapshot.quickMetrics.liquidCash,
          freeDays: snapshot.quickMetrics.freeCashDays,
          enoughHistory: expenseMaturity.isMature,
          taxWithheld: snapshot.cashflow.monthlyPaygWithholding,
          surplus: surplusActual,
          trend: moneyStoryTrend.trend,
          marginDeltaPoints: moneyStoryTrend.marginDeltaPoints,
          freedomYears: snapshot.quickMetrics.freeCashDays / 365.25,
          // Phase 58 — Financial Independence coverage (the Freedom hero number).
          freedomCoverageNow: financialIndependence.coverageNowPct,
          freedomCoverageAt60: financialIndependence.coverageAt60Pct,
          passiveMonthly: financialIndependence.netAccessiblePassiveMonthly,
          superIncomeAt60Monthly: financialIndependence.superIncomeAt60Monthly,
          superDrawdownRate: financialIndependence.superDrawdownRate,
          incomeProducingCount: financialIndependence.incomeProducingCount,
          growthBuildingCount: financialIndependence.growthBuildingCount,
          freedomHasData: financialIndependence.hasData,
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
            snapshot.cashflow.annualExpenses + snapshot.cashflow.annualLoanRepayments, /* @financial-math-allowed: declared outgoings context for the tile delta subtext (app/api; §19.1 plan side) */
          outgoingsMonthly:
            snapshot.cashflow.monthlyExpenses + snapshot.cashflow.monthlyLoanRepayments, /* @financial-math-allowed: declared outgoings context for the tile delta subtext (app/api; §19.1 plan side) */
          incomeMonthly: snapshot.quickMetrics.monthlyGrossIncome,
          // SSOT canonical cashflow (§12.2 / §19.1) — precomputed actuals-aware
          // figures the dashboard headline tiles read verbatim.
          //
          // Phase 57 (2026-07-02) — the "Annual income / outgoings / saving rate"
          // + "Monthly cash flow" tiles headline the TRAILING basis (average of
          // COMPLETE populated months × 12, from moneyStoryTrend), NOT the
          // in-progress current month × 12 (which read $0 in the first days of
          // each month). Falls back to the declared PLAN when there are no
          // complete actual months yet (a brand-new user), so a tile is never a
          // misleading bare $0 (§19.1 actuals-win-when-present; declared = plan).
          canonical: (() => {
            const hasTrailing =
              moneyStoryTrend.trailingMonthsWithData > 0 &&
              (moneyStoryTrend.annualIncome > 0 || moneyStoryTrend.annualOutgoings > 0);
            if (hasTrailing) {
              return {
                monthlyNet: moneyStoryTrend.avgMonthlyNet,
                annualNet: moneyStoryTrend.annualNet,
                monthlyInflow: Math.round(moneyStoryTrend.annualIncome / 12),
                annualInflow: moneyStoryTrend.annualIncome,
                monthlyOutflow: Math.round(moneyStoryTrend.annualOutgoings / 12),
                annualOutflow: moneyStoryTrend.annualOutgoings,
                savingsRate: moneyStoryTrend.savingsRateTrailing,
                basis: 'actual-ttm' as const,
              };
            }
            // Declared plan fallback (net income basis, matching "money in").
            const inM = snapshot.quickMetrics.monthlyIncome;
            const outM =
              snapshot.quickMetrics.monthlyExpenses +
              snapshot.quickMetrics.monthlyLoanRepayments;
            const netM = inM - outM;
            return {
              monthlyNet: netM,
              annualNet: netM * 12,
              monthlyInflow: inM,
              annualInflow: inM * 12,
              monthlyOutflow: outM,
              annualOutflow: outM * 12,
              savingsRate: inM > 0 ? (netM / inM) * 100 : 0,
              basis: 'declared' as const,
            };
          })(),
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
