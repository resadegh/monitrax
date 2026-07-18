/**
 * CASHFLOW INTELLIGENCE API
 * Phase 29 - GET /api/cashflow/intelligence
 *
 * Aggregates data from all existing engines (CFE, COE, Health, Tax, Budget)
 * into a unified intelligence response for the Cashflow Intelligence Center.
 *
 * Uses ONLY real calculated numbers - no hallucination.
 */

import { monthlyRunRate } from '@/lib/utils/frequencies';
import { totalLoanMonthlyCost } from '@/lib/services/loanCosts';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  calculateCashflowHealthScore,
  HealthScoreInput,
  detectMoneyLeaks,
  LeakDetectorInput,
  CashflowIntelligence,
  WaterfallData,
  WaterfallDataPoint,
  ForecastSummary,
  SmartAction,
  BudgetComparison,
  BudgetCategory,
  TaxOptimization,
} from '@/lib/cashflow-intelligence';
import { normalizeIncomeStream } from '@/lib/cashflow/incomeNormalizer';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
// MON-020: the tax estimate now reads the ONE canonical tax position (Medicare
// + full deductions + offsets) shared with My Guide, instead of an ad-hoc
// income-tax-only calc — so both surfaces show the same number (§12.2.1).
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';
import type { TaxPositionResult } from '@/lib/tax-engine/types';
import { getCanonicalMonthlyCashflow, projectBalanceForward } from '@/lib/calculations/canonicalCashflow';
import {
  detectSavingOpportunities,
  type SavingOpportunitiesResult,
} from '@/lib/cashflow/savingOpportunities';

// =============================================================================
// HELPERS
// =============================================================================

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

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchUserFinancialData(userId: string) {
  const [
    accounts,
    income,
    expenses,
    loans,
    transactions,
    recurringPayments,
    budgetAnalysis,
    spendingProfile,
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId }, include: { offsetAccount: true } }),
    prisma.unifiedTransaction.findMany({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.recurringPayment.findMany({ where: { userId, isActive: true } }),
    prisma.budgetAnalysis.findFirst({
      where: { userId, status: 'CONFIRMED' },
      orderBy: { analysisDate: 'desc' },
    }),
    prisma.spendingProfile.findUnique({ where: { userId } }),
  ]);

  return {
    accounts,
    income,
    expenses,
    loans,
    transactions,
    recurringPayments,
    budgetAnalysis,
    spendingProfile,
  };
}

// =============================================================================
// METRIC CALCULATIONS
// =============================================================================

function calculateMonthlyIncome(income: any[]): number {
  return income.reduce((sum, i) => {
    // Use income normalizer for salary types to get NET income
    const baseStream = {
      id: i.id,
      name: i.name,
      type: i.type,
      monthlyAmount: normalizeToMonthly(Number(i.amount), i.frequency),
      frequency: i.frequency,
      volatility: 0.1,
      salaryType: i.salaryType || null,
      grossAmount: i.grossAmount != null ? Number(i.grossAmount) : null,
      netAmount: i.netAmount != null ? Number(i.netAmount) : null,
      paygWithholding: i.paygWithholding != null ? Number(i.paygWithholding) : null,
    };

    const normalized = normalizeIncomeStream(baseStream);
    return sum + normalized.netMonthlyAmount;
  }, 0);
}

function calculateMonthlyExpenses(expenses: any[]): number {
  // Calc-SSOT Wall B2: canonical one-off-aware run-rate (a one-off never ×12).
  return expenses.reduce(
    (sum, e) => sum + monthlyRunRate({ amount: Number(e.amount), frequency: e.frequency, isRecurring: e.isRecurring }),
    0
  );
}

function calculateMonthlyLoanRepayments(userId: string, loans: any[]): Promise<number> {
  // Calc-SSOT Wall B1 + VR-013 F1/F2: the ONE resolved per-loan cost,
  // ACTUALS-FIRST — fed linked repayments over the canonical trailing-12-month
  // window (lib/services/loanCosts.ts). Declared → interest floor only when no
  // repayments are linked; never $0, never a second number vs the property engine.
  return totalLoanMonthlyCost(
    userId,
    loans.map((l) => ({
      id: l.id,
      principal: Number(l.principal ?? 0),
      interestRateAnnual: Number(l.interestRateAnnual ?? 0),
      minRepayment: Number(l.minRepayment ?? 0),
      repaymentFrequency: l.repaymentFrequency ?? 'MONTHLY',
    }))
  );
}

function calculateTotalBalance(accounts: any[]): number {
  return accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
}

function calculateEmergencyBuffer(
  totalBalance: number,
  monthlyExpenses: number,
  monthlyLoanRepayments: number
): number {
  const monthlyOutflow = monthlyExpenses + monthlyLoanRepayments;
  return monthlyOutflow > 0 ? totalBalance / monthlyOutflow : 0;
}

// =============================================================================
// WATERFALL CHART DATA
// =============================================================================

/**
 * Phase 1 (cashflow-actuals) — waterfall now reflects ACTUAL transactions, not
 * declared records. `income` is actual inflow, `outflowByCategory` is the
 * current-month OUT total per category (incl. the 'Uncategorised' line that the
 * old declared path silently dropped). Loan repayments are NOT added separately
 * — they already appear as OUT transactions, so a separate line would
 * double-count. Source: `getMasterFinancialSnapshot()` quickMetrics (§12.3 —
 * no re-reduce here).
 */
function buildWaterfallData(
  income: number,
  outflowByCategory: Record<string, number>
): WaterfallData {
  const items: WaterfallDataPoint[] = [];

  // Start with income
  items.push({
    name: 'Income',
    value: income,
    type: 'income',
  });

  // Actual spend by category (already aggregated by the canonical engine).
  const sortedCategories = Object.entries(outflowByCategory).sort(
    (a, b) => b[1] - a[1]
  );

  let otherTotal = 0;
  sortedCategories.forEach(([category, amount], index) => {
    if (index < 5) {
      items.push({
        name: category,
        value: -amount,
        type: 'expense',
        category,
      });
    } else {
      otherTotal += amount;
    }
  });

  if (otherTotal > 0) {
    items.push({
      name: 'Other Expenses',
      value: -otherTotal,
      type: 'expense',
      category: 'Other',
    });
  }

  const totalExpenses = Object.values(outflowByCategory).reduce(
    (a, b) => a + b,
    0
  );
  const surplus = income - totalExpenses;

  // Add net result
  items.push({
    name: surplus >= 0 ? 'Surplus' : 'Deficit',
    value: surplus,
    type: 'net',
    isSubtotal: true,
  });

  return {
    items,
    netIncome: income,
    totalExpenses,
    surplus,
  };
}

// =============================================================================
// BUDGET COMPARISON
// =============================================================================

/**
 * Phase 1 (cashflow-actuals) — the "Actual" side of budget-vs-actual now comes
 * from ACTUAL transactions (`actualOutflowByCategory` off the master snapshot),
 * not declared `expense.amount × frequency`. The old path made "Actual" equal
 * to the plan, which made every variance read as on-track. Categories are keyed
 * by the transaction `categoryLevel1`; the budget side keeps its own category
 * keys (any mismatch surfaces as a budgeted-but-not-spent or
 * spent-but-not-budgeted row, which is correct).
 */
function buildBudgetComparison(
  budgetAnalysis: any,
  actualOutflowByCategory: Record<string, number>
): BudgetComparison | undefined {
  if (!budgetAnalysis) return undefined;

  const categories: BudgetCategory[] = [];
  const variableBreakdown = budgetAnalysis.variableBreakdown as Record<string, number> | null;
  const recurringBreakdown = budgetAnalysis.recurringBreakdown as Record<string, number> | null;

  // Combine budgeted amounts
  const budgetedByCategory = new Map<string, number>();

  if (variableBreakdown) {
    for (const [category, amount] of Object.entries(variableBreakdown)) {
      budgetedByCategory.set(category, (budgetedByCategory.get(category) || 0) + (amount as number));
    }
  }

  if (recurringBreakdown) {
    for (const [category, amount] of Object.entries(recurringBreakdown)) {
      budgetedByCategory.set(category, (budgetedByCategory.get(category) || 0) + (amount as number));
    }
  }

  // Actual spending by category — straight from the canonical actual engine.
  const actualByCategory = new Map<string, number>(
    Object.entries(actualOutflowByCategory)
  );

  // Build comparison
  const allCategories = new Set([...budgetedByCategory.keys(), ...actualByCategory.keys()]);
  let totalBudgeted = 0;
  let totalActual = 0;

  for (const category of allCategories) {
    const budgeted = budgetedByCategory.get(category) || 0;
    const actual = actualByCategory.get(category) || 0;
    const variance = actual - budgeted;
    const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

    totalBudgeted += budgeted;
    totalActual += actual;

    categories.push({
      name: category,
      budgeted,
      actual,
      variance,
      variancePercent,
      status: variancePercent > 10 ? 'OVER' : variancePercent < -10 ? 'UNDER' : 'ON_TRACK',
    });
  }

  const totalVariance = totalActual - totalBudgeted;
  const overallVariancePercent = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

  return {
    categories: categories.sort((a, b) => b.variance - a.variance),
    totalBudgeted,
    totalActual,
    totalVariance,
    overallStatus: overallVariancePercent > 10 ? 'OVER' : overallVariancePercent < -10 ? 'UNDER' : 'ON_TRACK',
    period: {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(),
    },
  };
}

// =============================================================================
// SMART ACTIONS
// =============================================================================

function buildSmartActions(
  leaks: any,
  healthScore: any,
  budgetComparison?: BudgetComparison
): SmartAction[] {
  const actions: SmartAction[] = [];
  let rank = 1;

  // Add leak-based actions
  for (const leak of leaks.leaks.slice(0, 3)) {
    actions.push({
      id: `action-leak-${leak.id}`,
      rank: rank++,
      title: `Review ${leak.category}`,
      description: leak.recommendation,
      impact: leak.monthlyAmount * 12, // Annual impact
      impactDescription: `Save $${(leak.monthlyAmount * 12).toLocaleString()}/year`,
      category: leak.category.includes('Subscription') ? 'CANCEL' : 'REVIEW',
      priority: leak.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      source: 'COE',
      actionUrl: `/dashboard/transactions?category=${encodeURIComponent(leak.category)}`,
    });
  }

  // Add health-based actions
  for (const breakdown of healthScore.breakdown) {
    if (breakdown.score < 50) {
      let action: SmartAction | null = null;

      if (breakdown.category === 'Liquidity' && breakdown.score < 50) {
        action = {
          id: 'action-liquidity',
          rank: rank++,
          title: 'Build Emergency Buffer',
          description: 'Your emergency fund is below recommended levels',
          impact: 0,
          impactDescription: 'Improve financial security',
          category: 'SAVE',
          priority: breakdown.score < 30 ? 'CRITICAL' : 'HIGH',
          source: 'HEALTH',
          learnMoreUrl: '/dashboard/balances',
        };
      } else if (breakdown.category === 'Budget Adherence' && breakdown.score < 50) {
        action = {
          id: 'action-budget',
          rank: rank++,
          title: 'Review Budget Categories',
          description: 'Some categories are significantly over budget',
          impact: 0,
          impactDescription: 'Stay on track with spending goals',
          category: 'REVIEW',
          priority: 'MEDIUM',
          source: 'BUDGET',
          actionUrl: '/dashboard/budget-analysis',
        };
      }

      if (action) actions.push(action);
    }
  }

  // Add budget variance actions
  if (budgetComparison) {
    const overBudgetCategories = budgetComparison.categories.filter(c => c.status === 'OVER');
    if (overBudgetCategories.length > 0) {
      const topOver = overBudgetCategories[0];
      actions.push({
        id: `action-budget-${topOver.name.toLowerCase().replace(/\s+/g, '-')}`,
        rank: rank++,
        title: `Reduce ${topOver.name} Spending`,
        description: `$${Math.abs(topOver.variance).toFixed(0)} over budget this month`,
        impact: Math.abs(topOver.variance) * 12,
        impactDescription: `Save $${(Math.abs(topOver.variance) * 12).toLocaleString()}/year`,
        category: 'REVIEW',
        priority: topOver.variancePercent > 50 ? 'HIGH' : 'MEDIUM',
        source: 'BUDGET',
        actionUrl: `/dashboard/transactions?category=${encodeURIComponent(topOver.name)}`,
      });
    }
  }

  // Sort by priority and impact
  return actions
    .sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.impact - a.impact;
    })
    .slice(0, 5);
}

// =============================================================================
// TAX OPTIMIZATION
// =============================================================================

function buildTaxOptimization(
  taxPosition: TaxPositionResult
): TaxOptimization | undefined {
  // MON-020: every figure reads the ONE canonical tax position (Medicare +
  // full deductions + offsets), the SAME source My Guide uses — so the two
  // surfaces show the same estimated tax. No ad-hoc income-tax-only calc here.
  const estimatedTax = Math.round(taxPosition.tax.netTax); // income tax + Medicare − offsets
  const medicareLevy = Math.round(taxPosition.tax.medicareLevy); // MON-039a: itemise the Medicare component
  const deductibleExpenses = Math.round(taxPosition.deductions.total);
  const annualGrossIncome = taxPosition.income.total; // canonical assessable income
  const effectiveTaxRate = taxPosition.tax.effectiveRate;
  const paygWithheld = taxPosition.paygWithheld;

  // Generate recommendations
  const recommendations: TaxOptimization['recommendations'] = [];

  // Check for deduction opportunities
  if (deductibleExpenses === 0 && annualGrossIncome > 80000) {
    recommendations.push({
      id: 'tax-deductions',
      title: 'Review Work-Related Deductions',
      description: 'You may have unclaimed deductions for work expenses',
      potentialSaving: annualGrossIncome * 0.01, // Estimate 1% potential
      priority: 'MEDIUM',
    });
  }

  // Check for super contributions
  if (annualGrossIncome > 100000) {
    recommendations.push({
      id: 'tax-super',
      title: 'Consider Salary Sacrifice',
      description: 'Additional super contributions can reduce taxable income',
      potentialSaving: Math.min(27500, annualGrossIncome * 0.05) * 0.34, // Approx tax saving
      priority: 'HIGH',
    });
  }

  return {
    estimatedAnnualTax: estimatedTax,
    deductibleExpenses,
    potentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSaving, 0),
    recommendations,
    effectiveTaxRate,
    paygWithheld,
    medicareLevy,
  };
}

// =============================================================================
// FORECAST SUMMARY
// =============================================================================

/**
 * Build the cashflow forecast HERO from CANONICAL monthly figures.
 *
 * Phase 2 (cashflow-SSOT-convergence, 2026-06-23): this previously took
 * DECLARED income/expenses/loans and computed its own surplus — the source
 * of the falsely-optimistic hero (+$10,505 surplus / 51.9% saving rate)
 * while the same page's money-flow waterfall already showed actuals. It now
 * takes the single canonical in/out/net (actual when transactions exist,
 * declared fallback otherwise) via getCanonicalMonthlyCashflow(). `outflow`
 * already includes loan repayments + uncategorised spend. See CLAUDE.md §19.1.
 */
function buildForecastSummary(
  totalBalance: number,
  monthlyIncome: number,
  monthlyOutflow: number,
  monthlyNet: number
): ForecastSummary {
  const monthlySurplus = monthlyNet;

  // Calculate 30 and 90 day predictions via the ONE shared projection (MON-021) —
  // the same helper My Guide's Month-End Balance uses, off the same canonical net.
  const balance30 = projectBalanceForward(totalBalance, monthlyNet, 30);
  const balance90 = projectBalanceForward(totalBalance, monthlyNet, 90);

  // Calculate break-even day
  let breakEvenDay = -1;
  if (monthlyIncome > 0) {
    const dailyIncome = monthlyIncome / 30;
    const dailyExpense = monthlyOutflow / 30;
    let runningTotal = 0;

    for (let day = 1; day <= 30; day++) {
      runningTotal += dailyIncome;
      if (runningTotal >= dailyExpense * day) {
        breakEvenDay = day;
        break;
      }
    }
  }

  // Determine risk levels
  const risk30: 'LOW' | 'MEDIUM' | 'HIGH' =
    balance30 > monthlyOutflow ? 'LOW' :
    balance30 > 0 ? 'MEDIUM' : 'HIGH';

  const risk90: 'LOW' | 'MEDIUM' | 'HIGH' =
    balance90 > monthlyOutflow * 3 ? 'LOW' :
    balance90 > 0 ? 'MEDIUM' : 'HIGH';

  const hasShortfall = balance30 < 0 || balance90 < 0;

  return {
    current: {
      balance: totalBalance,
      income: monthlyIncome,
      expenses: monthlyOutflow,
      net: monthlySurplus,
    },
    forecast30Day: {
      predictedBalance: balance30,
      confidence: 85,
      risk: risk30,
    },
    forecast90Day: {
      predictedBalance: balance90,
      confidence: 70,
      risk: risk90,
    },
    breakEvenDay,
    shortfallRisk: hasShortfall,
    shortfallDate: hasShortfall && balance30 < 0 ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined,
    shortfallAmount: hasShortfall ? Math.abs(Math.min(balance30, balance90)) : undefined,
  };
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Fetch all financial data
      const data = await fetchUserFinancialData(userId);

      // Phase 1 (cashflow-actuals) — canonical snapshot. Drives the ACTUAL
      // waterfall + budget-vs-actual + saving opportunities below. Single fetch,
      // reused (§12.3/§12.10). Master failure must not blank the whole page, so
      // we degrade gracefully: actual fields fall back to empty (= declared
      // income with no spend lines) and savingOpportunities stays empty.
      let masterSnapshot: Awaited<
        ReturnType<typeof getMasterFinancialSnapshot>
      > | null = null;
      try {
        masterSnapshot = await getMasterFinancialSnapshot(userId);
      } catch (snapErr) {
        console.error('[CashflowIntelligence] Master snapshot failed:', snapErr);
      }

      // Calculate core metrics
      const monthlyIncome = calculateMonthlyIncome(data.income);
      const monthlyExpenses = calculateMonthlyExpenses(data.expenses);
      const monthlyLoanRepayments = await calculateMonthlyLoanRepayments(userId, data.loans);
      const totalBalance = calculateTotalBalance(data.accounts);

      // Phase 2 (cashflow-SSOT-convergence, 2026-06-23) — the ONE canonical
      // monthly in/out/net for the health score + forecast hero. Actual when
      // the user has transactions; declared fallback otherwise. `outflow`
      // folds in loan repayments + uncategorised spend, so loanRepayments is
      // 0 in the health-score input below (no double counting). When master is
      // unavailable we degrade to the declared record figures. CLAUDE.md §19.1.
      const canonical = masterSnapshot
        ? getCanonicalMonthlyCashflow(masterSnapshot)
        : {
            inflow: monthlyIncome,
            outflow: monthlyExpenses + monthlyLoanRepayments,
            net: monthlyIncome - monthlyExpenses - monthlyLoanRepayments,
            avgMonthlyOutflow: monthlyExpenses + monthlyLoanRepayments,
            basis: 'declared' as const,
            savingsRate:
              monthlyIncome > 0
                ? ((monthlyIncome - monthlyExpenses - monthlyLoanRepayments) / monthlyIncome) * 100
                : 0,
          };

      const emergencyBuffer = calculateEmergencyBuffer(totalBalance, canonical.outflow, 0);

      // Prepare health score input — canonical outflow (loans folded in).
      const healthScoreInput: HealthScoreInput = {
        monthlyIncome: canonical.inflow,
        monthlyExpenses: canonical.outflow,
        monthlyLoanRepayments: 0,
        availableCash: totalBalance,
        withdrawableCash: Math.max(0, totalBalance - canonical.outflow * 3),
        burnRate: canonical.outflow,
        volatilityIndex: data.spendingProfile?.overallVolatility || 30,
        breakEvenDay: 15, // Will be calculated properly
        hasShortfall: totalBalance < canonical.outflow,
        shortfallDays: 0,
        emergencyBuffer,
        hasBudget: !!data.budgetAnalysis,
        budgetedTotal: data.budgetAnalysis?.totalRealisticBudget || undefined,
        actualTotal: canonical.outflow,
      };

      // Calculate health score
      const healthScore = calculateCashflowHealthScore(healthScoreInput);

      // Prepare leak detector input
      const leakDetectorInput: LeakDetectorInput = {
        transactions: data.transactions.map((t: any) => ({
          id: t.id,
          date: new Date(t.date),
          amount: Number(t.amount),
          direction: t.direction,
          categoryLevel1: t.categoryLevel1,
          categoryLevel2: t.categoryLevel2,
          merchantStandardised: t.merchantStandardised,
          isRecurring: t.isRecurring,
        })),
        recurringPayments: data.recurringPayments.map((rp: any) => ({
          id: rp.id,
          merchantStandardised: rp.merchantStandardised,
          expectedAmount: Number(rp.expectedAmount),
          pattern: rp.pattern,
          priceIncreaseAlert: rp.priceIncreaseAlert,
          lastPriceChange: rp.lastPriceChange ? Number(rp.lastPriceChange) : undefined,
          categoryLevel1: rp.categoryLevel1,
        })),
        monthlyIncome,
        spendingProfile: data.spendingProfile
          ? {
              categoryAverages: data.spendingProfile.categoryAverages as any,
            }
          : undefined,
        analysisMonths: 3,
      };

      // Detect money leaks
      const leaks = detectMoneyLeaks(leakDetectorInput);

      // MON-021 (§12.2.1 / §19.1): the waterfall income is the SAME canonical
      // inflow the hero shows (`canonical.inflow`), so the two "Money In" figures
      // can never contradict. The prior `actualMonthlyInflow ? … : monthlyIncome`
      // used a TRUTHINESS fallback, so a legitimate $0 actual inflow (user has
      // transactions but none this month) fell through to DECLARED income — the
      // "In $0" hero vs "In +$43,736" waterfall discrepancy. `canonical.inflow`
      // gates on `hasActualData`, so $0 actual stays $0. Declared fallback only
      // when master is unavailable (canonical's own fallback branch above).
      const actualIncome = canonical.inflow;
      const actualOutflowByCategory =
        masterSnapshot?.quickMetrics.actualOutflowByCategory ?? {};

      // Build waterfall data — ACTUAL income vs ACTUAL spend-by-category.
      const waterfall = buildWaterfallData(actualIncome, actualOutflowByCategory);

      // Build budget comparison — "Actual" column from ACTUAL transactions.
      const budgetComparison = buildBudgetComparison(
        data.budgetAnalysis,
        actualOutflowByCategory
      );

      // Build forecast summary — CANONICAL in/out/net (actual when present).
      const forecast = buildForecastSummary(
        totalBalance,
        canonical.inflow,
        canonical.outflow,
        canonical.net
      );

      // Build tax optimization from the ONE canonical tax position (MON-020) —
      // the same source My Guide reads, so both surfaces show the same tax.
      const taxBundle = await getUserTaxPosition(userId);
      const taxOptimization = buildTaxOptimization(taxBundle.taxPosition);

      // Build smart actions
      const smartActions = buildSmartActions(leaks, healthScore, budgetComparison);

      // Phase 45.8 — detect cross-account / cross-property saving opportunities.
      // Reuses the canonical master snapshot fetched above (§12.10 — one fetch
      // per request). Empty when master was unavailable.
      let savingOpportunities: SavingOpportunitiesResult = {
        opportunities: [],
        totalEstimatedAnnualBenefit: 0,
      };
      if (masterSnapshot) {
        try {
          savingOpportunities = detectSavingOpportunities(masterSnapshot);
        } catch (oppError) {
          console.error('[CashflowIntelligence] Saving opportunities detection failed:', oppError);
        }
      }

      // Calculate data quality
      const transactionCount = data.transactions.length;
      const categorizedCount = data.transactions.filter((t: any) => t.categoryLevel1).length;
      const transactionCoverage = transactionCount > 0 ? (categorizedCount / transactionCount) * 100 : 0;

      // Build complete response
      const intelligence: CashflowIntelligence = {
        healthScore,
        forecast,
        leaks,
        waterfall,
        budgetComparison,
        taxOptimization,
        smartActions,
        generatedAt: new Date(),
        dataQuality: {
          transactionCoverage,
          incomeCoverage: data.income.length > 0 ? 100 : 0,
          expenseCoverage: data.expenses.length > 0 ? 100 : 0,
          confidence: Math.min(100, (transactionCoverage + (data.income.length > 0 ? 50 : 0)) / 1.5),
        },
      };

      return NextResponse.json({
        success: true,
        data: {
          ...intelligence,
          savingOpportunities,
        },
      });
    } catch (error) {
      console.error('[CashflowIntelligence] API error:', error);
      const errorMessage = error instanceof Error
        ? `${error.message}\n${error.stack}`
        : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate cashflow intelligence',
          details: errorMessage,
        },
        { status: 500 }
      );
    }
});
