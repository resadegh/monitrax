/**
 * CASHFLOW SUMMARY API
 * Phase 29 - GET/POST /api/cashflow/summary
 *
 * GET: Retrieve the latest cached summary (or generate if none exists)
 * POST: Force regeneration of the summary
 *
 * Summaries are persisted and only regenerated when:
 * 1. User explicitly requests (POST)
 * 2. Significant data change detected
 * 3. No existing summary
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  generateGeminiSummary,
  generateDataHash,
  isSummaryStale,
  GeminiSummary,
} from '@/lib/cashflow-intelligence';
import { normalizeIncomeStream } from '@/lib/cashflow/incomeNormalizer';
import { toMonthly, monthlyRunRate } from '@/lib/utils/frequencies';
import { totalLoanMonthlyCost } from '@/lib/services/loanCosts';
import { Frequency } from '@/lib/types/prisma-enums';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

// Uses centralized toMonthly from lib/utils/frequencies (Blueprint §5.1)

// =============================================================================
// DATA GATHERING
// =============================================================================

async function buildSummaryInput(userId: string) {
  const [accounts, income, expenses, loans, budgetAnalysis, leaks, snapshot] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.budgetAnalysis.findFirst({
      where: { userId, status: 'CONFIRMED' },
      orderBy: { analysisDate: 'desc' },
    }),
    // Get recurring payments with price alerts for leak detection
    prisma.recurringPayment.findMany({
      where: { userId, isActive: true },
    }),
    // Phase 1 (cashflow-actuals) — canonical snapshot for ACTUAL spend/surplus.
    getMasterFinancialSnapshot(userId),
  ]);

  // Calculate monthly income (NET after PAYG)
  const monthlyIncome = income.reduce((sum: number, i: any) => {
    const baseStream = {
      id: i.id,
      name: i.name,
      type: i.type,
      monthlyAmount: toMonthly(Number(i.amount), i.frequency as Frequency),
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

  // Calc-SSOT Wall B2: canonical one-off-aware run-rate (a one-off never ×12).
  const monthlyExpenses = expenses.reduce(
    (sum: number, e: any) => sum + monthlyRunRate({ amount: Number(e.amount), frequency: e.frequency, isRecurring: e.isRecurring }),
    0
  );

  // Calc-SSOT Wall B1 + VR-013 F1/F2: the ONE resolved per-loan cost,
  // ACTUALS-FIRST — fed each loan's linked repayments over the canonical
  // trailing-12-month window (lib/services/loanCosts.ts), so this reads the
  // SAME number as the property engine. Declared → interest floor only when
  // no repayments are linked.
  const monthlyLoanRepayments = await totalLoanMonthlyCost(
    userId,
    loans.map((l: any) => ({
      id: l.id,
      principal: Number(l.principal ?? 0),
      interestRateAnnual: Number(l.interestRateAnnual ?? 0),
      minRepayment: Number(l.minRepayment ?? 0),
      repaymentFrequency: l.repaymentFrequency ?? 'MONTHLY',
    }))
  );

  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum: number, a: any) => sum + Number(a.currentBalance),
    0
  );

  // Phase 1 (cashflow-actuals) — total monthly outflow now reflects ACTUAL
  // transactions when available (trailing-3-month average, which already
  // includes loan repayments + the uncategorised spend the declared path
  // dropped). Falls back to declared expenses + loan repayments otherwise.
  // This stops the Gemini narrative from asserting a surplus that doesn't
  // exist once uncategorised spend is counted.
  const qm = snapshot.quickMetrics;
  const declaredOutflow = monthlyExpenses + monthlyLoanRepayments;
  const monthlyOutflow = qm.hasActualData
    ? qm.actualAvgMonthlyOutflow
    : declaredOutflow;

  // Calculate emergency buffer
  const emergencyBuffer = monthlyOutflow > 0 ? totalBalance / monthlyOutflow : 0;

  // Calculate net surplus — income minus ACTUAL total outflow.
  const netSurplus = monthlyIncome - monthlyOutflow;

  // Calculate leakage (simplified - from price increases)
  const leakageTotal = leaks
    .filter((l: any) => l.priceIncreaseAlert && l.lastPriceChange)
    .reduce((sum: number, l: any) => sum + Number(l.lastPriceChange || 0), 0);

  const topLeaks = leaks
    .filter((l: any) => l.priceIncreaseAlert)
    .map((l: any) => ({
      category: l.categoryLevel1 || 'Subscriptions',
      amount: Number(l.expectedAmount),
    }))
    .slice(0, 3);

  // Determine forecast risk
  const forecastRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
    netSurplus < 0 ? 'HIGH' :
    emergencyBuffer < 1 ? 'HIGH' :
    emergencyBuffer < 3 ? 'MEDIUM' : 'LOW';

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

  // Calculate health score (simplified)
  let healthScore = 50;
  if (emergencyBuffer >= 6) healthScore += 20;
  else if (emergencyBuffer >= 3) healthScore += 10;
  else if (emergencyBuffer < 1) healthScore -= 10;

  if (netSurplus >= monthlyIncome * 0.2) healthScore += 20;
  else if (netSurplus >= monthlyIncome * 0.1) healthScore += 10;
  else if (netSurplus < 0) healthScore -= 15;

  healthScore = Math.max(0, Math.min(100, healthScore));

  const tier =
    healthScore >= 80 ? 'EXCELLENT' :
    healthScore >= 60 ? 'GOOD' :
    healthScore >= 40 ? 'MODERATE' :
    healthScore >= 20 ? 'CONCERNING' : 'CRITICAL';

  return {
    healthScore: { overallScore: healthScore, tier },
    monthlyIncome,
    monthlyExpenses,
    monthlyLoanRepayments,
    netSurplus,
    emergencyBuffer,
    leakageTotal,
    topLeaks,
    forecastRisk,
    breakEvenDay,
    hasBudget: !!budgetAnalysis,
    budgetVariance: budgetAnalysis
      ? monthlyExpenses - Number(budgetAnalysis.totalRealisticBudget || 0)
      : undefined,
    smartActionCount: topLeaks.length + (netSurplus < 0 ? 1 : 0),
    topAction: netSurplus < 0
      ? 'Reduce expenses to balance your budget'
      : topLeaks.length > 0
      ? `Review ${topLeaks[0].category} for potential savings`
      : 'Continue building your emergency buffer',
  };
}

// =============================================================================
// GET - Retrieve cached summary
// =============================================================================

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Check for cached summary
      const cached = await prisma.cashflowSummary.findFirst({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
      });

      // Build current input to check for staleness
      const currentInput = await buildSummaryInput(userId);
      const currentHash = generateDataHash(currentInput);

      // If cached exists and hash matches, return it
      if (cached && cached.dataHash === currentHash) {
        return NextResponse.json({
          success: true,
          data: {
            id: cached.id,
            userId: cached.userId,
            content: cached.content,
            generatedAt: cached.generatedAt,
            dataHash: cached.dataHash,
            isStale: false,
            keyInsights: cached.keyInsights as string[],
          },
        });
      }

      // If cached exists but stale, mark it and return with stale flag
      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            id: cached.id,
            userId: cached.userId,
            content: cached.content,
            generatedAt: cached.generatedAt,
            dataHash: cached.dataHash,
            isStale: true,
            keyInsights: cached.keyInsights as string[],
          },
          message: 'Summary is stale - significant data changes detected. Click regenerate for updated analysis.',
        });
      }

      // No cached summary - generate new one
      const summary = await generateGeminiSummary(currentInput, userId);

      // Store in database
      await prisma.cashflowSummary.create({
        data: {
          userId,
          content: summary.content,
          dataHash: summary.dataHash,
          keyInsights: summary.keyInsights,
          generatedAt: summary.generatedAt,
        },
      });

      return NextResponse.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('[CashflowSummary] GET error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve cashflow summary',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// POST - Force regeneration
// =============================================================================

export const POST = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Build current input
      const currentInput = await buildSummaryInput(userId);

      // Generate new summary
      const summary = await generateGeminiSummary(currentInput, userId);

      // Delete old summaries
      await prisma.cashflowSummary.deleteMany({
        where: { userId },
      });

      // Store new summary
      await prisma.cashflowSummary.create({
        data: {
          userId,
          content: summary.content,
          dataHash: summary.dataHash,
          keyInsights: summary.keyInsights,
          generatedAt: summary.generatedAt,
        },
      });

      return NextResponse.json({
        success: true,
        data: summary,
        message: 'Summary regenerated successfully',
      });
    } catch (error) {
      console.error('[CashflowSummary] POST error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to regenerate cashflow summary',
        },
        { status: 500 }
      );
    }
});
