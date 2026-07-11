/**
 * Phase 17: CFO Intelligence Engine
 * Main orchestrator that combines all CFO components into a unified intelligence layer
 */

import { prisma } from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getNetWorthHistory } from '@/lib/calculations/netWorthHistory';
import { calculateCFOScore, getCFOScoreHistory, saveCFOScore } from './scoreCalculator';
import { scanForRisks } from './riskRadar';
import { generateActions } from './actionEngine';
import { calculateCFOTaxInsights } from './decisionSupport/taxIntegration';
import { calculateCFOLoanInsights } from './decisionSupport/loanDecisionSupport';
import { calculateCFOPropertyInsights } from './decisionSupport/propertyDecisionSupport';
import { calculateCFOInvestmentInsights } from './decisionSupport/investmentDecisionSupport';
import { Decimal, toDecimal } from '@/lib/decimal';
import {
  CFODashboardData,
  CFOScore,
  CFOScoreHistory,
  RiskRadarOutput,
  ActionPrioritisationOutput,
  MonthlyProgress,
  CFOQuickStats,
  CFOAlert,
  CFOPreferences,
  CFOTaxInsights,
  CFOLoanInsights,
  CFOPropertyInsights,
  CFOInvestmentInsights,
} from './types';
import { toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
// MON-021: My Guide's month-end balance projects off the ONE canonical monthly
// net + the ONE shared projection — the same source + formula /cashflow uses —
// instead of a crude expenses-only, declared, income-blind linear burn.
import { getCanonicalMonthlyCashflow, getCanonicalSavingsRate, projectBalanceForward } from '@/lib/calculations/canonicalCashflow';
import { getMoneyStoryTrend } from '@/lib/calculations/moneyStoryTrend';

// Type definitions for Prisma models (to avoid Prisma client generation dependency)
interface AccountRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  currentBalance: number;
}

// MON-018: LoanRecord / PropertyRecord / HoldingRecord / InvestmentAccountRecord
// / IncomeRecord removed — they were only used by the old inline net-worth
// aggregation in calculateMonthlyProgress, now replaced by getNetWorthHistory +
// the canonical master snapshot.

interface ExpenseRecord {
  id: string;
  userId: string;
  amount: number;
  frequency: string;
  isEssential: boolean;
}

// ============================================================================
// Main Dashboard Data Generator
// ============================================================================

export async function getCFODashboardData(userId: string): Promise<CFODashboardData> {
  // Calculate all components in parallel where possible
  const [score, risks, taxInsights, loanInsights, propertyInsights, investmentInsights] = await Promise.all([
    calculateCFOScore(userId),
    scanForRisks(userId),
    calculateCFOTaxInsights(userId).catch((err) => {
      console.error('[CFO] Tax insights calculation failed:', err);
      return undefined;
    }),
    calculateCFOLoanInsights(userId).catch((err) => {
      console.error('[CFO] Loan insights calculation failed:', err);
      return undefined;
    }),
    calculateCFOPropertyInsights(userId).catch((err) => {
      console.error('[CFO] Property insights calculation failed:', err);
      return undefined;
    }),
    calculateCFOInvestmentInsights(userId).catch((err) => {
      console.error('[CFO] Investment insights calculation failed:', err);
      return undefined;
    }),
  ]);

  // Actions depend on risks and score
  const actions = await generateActions(userId, risks.risks, score.components);

  // Get additional data
  const [scoreHistory, monthlyProgress, quickStats, alerts] = await Promise.all([
    getCFOScoreHistory(userId, 30),
    calculateMonthlyProgress(userId),
    calculateQuickStats(userId),
    getActiveAlerts(userId),
  ]);

  // Save the current score for trend tracking
  await saveCFOScore(userId, score);

  return {
    score,
    scoreHistory,
    risks,
    actions,
    monthlyProgress,
    quickStats,
    alerts,
    taxInsights, // Phase 17A: Tax Integration
    loanInsights, // Phase 17B: Loan Decision Support
    propertyInsights, // Phase 17C: Property Decision Support
    investmentInsights, // Phase 17D: Investment Decision Support
  };
}

// ============================================================================
// Monthly Progress Calculation
// ============================================================================

async function calculateMonthlyProgress(userId: string): Promise<MonthlyProgress> {
  // MON-018 — real month-over-month progress from CANONICAL sources (§12.2.1 /
  // §19.4). The prior implementation FABRICATED this card: it simulated last
  // month's net worth as `currentNetWorth × 0.98` (algebraically a constant
  // +2.04% every month regardless of the user's data), computed `currentNetWorth`
  // inline (omitting investment-account cash + super, valuing holdings at cost),
  // and hardcoded `savingsRateChange = 0.5` + `debtReduction = totalDebt × 0.005`.
  //
  // Now: net-worth Δ + debt-reduction come from the stored `NetWorthSnapshot`
  // history via the ONE canonical reader (getNetWorthHistory, §12.2) — the same
  // source as the Home Net Worth Trend tile, so the two converge — and the
  // savings rate comes from the canonical master snapshot (actuals-aware), so it
  // matches the dashboard KPI instead of the old declared-records figure.
  const [snapshot, history, moneyStoryTrend] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    getNetWorthHistory(userId, 2), // this month vs last month
    getMoneyStoryTrend(userId, 12), // trailing-12-mo actuals for the ONE savings rate (MON-029)
  ]);

  // Real Δ from stored snapshots — honest 0 when <2 months of history (never a
  // placeholder curve; matches the getNetWorthHistory empty-state contract).
  const netWorthChange = history.deltaAbsolute;
  const netWorthChangePercent = history.deltaPct;

  // Debt paid down this month = last month's liabilities − this month's, read
  // from the same two snapshots. Honest 0 without a prior month to compare.
  const debtReduction =
    history.trend.length >= 2
      ? history.trend[0].totalLiabilities - history.trend[history.trend.length - 1].totalLiabilities
      : 0;

  // MON-029 (VR-001): this card previously read quickMetrics.savingsRate — the
  // DECLARED figure (75.4% while trailing actuals were −30.5%). The savings rate
  // now comes from the ONE canonical selection rule (getCanonicalSavingsRate:
  // trailing-12-mo actuals when history exists, declared plan otherwise) — the
  // SAME accessor the Home KPI tile and the Home insight read.
  const savingsRate = getCanonicalSavingsRate(snapshot, moneyStoryTrend).rate;

  return {
    netWorthChange: Math.round(netWorthChange),
    netWorthChangePercent, // already rounded to 0.1 by getNetWorthHistory
    savingsRate: Math.round(savingsRate * 10) / 10,
    // No stored savings-rate history to compare against → null, not a fabricated
    // "+0.5%". The UI hides the "vs last month" line when this is null.
    savingsRateChange: null,
    debtReduction: Math.round(debtReduction),
    topImprovements: generateTopImprovements(savingsRate, netWorthChangePercent),
    emergingRisks: generateEmergingRisks(savingsRate, netWorthChangePercent),
  };
}

function generateTopImprovements(savingsRate: number, netWorthChange: number): string[] {
  const improvements: string[] = [];

  if (netWorthChange > 0) {
    improvements.push(`Net worth increased this month`);
  }
  if (savingsRate > 15) {
    improvements.push(`Strong savings rate maintained`);
  }
  if (improvements.length === 0) {
    improvements.push('Tracking financial progress');
  }

  return improvements.slice(0, 5);
}

function generateEmergingRisks(savingsRate: number, netWorthChange: number): string[] {
  const risks: string[] = [];

  if (savingsRate < 10) {
    risks.push('Savings rate below target');
  }
  if (netWorthChange < 0) {
    risks.push('Net worth declined this month');
  }

  return risks.slice(0, 3);
}

// ============================================================================
// Quick Stats Calculation
// ============================================================================

async function calculateQuickStats(userId: string): Promise<CFOQuickStats> {
  const [accounts, expenses, snapshot] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    getMasterFinancialSnapshot(userId),
  ]);

  const now = new Date();
  const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  // MON-021 (§12.2.1): project the month-end balance off the ONE canonical
  // monthly net (actuals-aware) via the ONE shared projection — the SAME source
  // + formula /cashflow's forecast uses — so My Guide and /cashflow can only
  // differ by their labelled horizon (month-end vs 30-day), never by method. The
  // balance base is the sum of all bank accounts, matching /cashflow's forecast
  // base (`calculateTotalBalance`). The old crude `totalLiquid − dailyBurn ×
  // daysRemaining` was expenses-only, declared, and ignored income entirely.
  const totalBalance = accounts.reduce(
    (sum: number, a: AccountRecord) => sum + a.currentBalance,
    0,
  );
  const canonicalNet = getCanonicalMonthlyCashflow(snapshot).net;
  const projectedMonthEndBalance = projectBalanceForward(totalBalance, canonicalNet, daysRemaining);

  // Count subscription-like expenses
  const subscriptions = expenses.filter((e: ExpenseRecord) =>
    !e.isEssential &&
    ['MONTHLY', 'ANNUAL'].includes(e.frequency.toUpperCase()) &&
    toMonthly(e.amount, e.frequency as Frequency) < 100
  );

  return {
    daysUntilNextBill: Math.min(daysRemaining, 7), // Simplified
    projectedMonthEndBalance: Math.round(projectedMonthEndBalance),
    unusedSubscriptions: Math.floor(subscriptions.length * 0.2), // Estimate 20% unused
    savingsOpportunities: 3, // Placeholder
    pendingActions: 5, // Placeholder - would come from action engine
  };
}

// ============================================================================
// Alerts Management
// ============================================================================

async function getActiveAlerts(userId: string): Promise<CFOAlert[]> {
  // In production, this would query an alerts table
  // For now, generate contextual alerts

  const alerts: CFOAlert[] = [];

  // Check for any critical conditions
  const accounts = await prisma.account.findMany({ where: { userId } });
  const lowBalanceAccounts = accounts.filter((a: AccountRecord) =>
    ['TRANSACTIONAL', 'SAVINGS'].includes(a.type) && a.currentBalance < 500
  );

  if (lowBalanceAccounts.length > 0) {
    alerts.push({
      id: 'low-balance-alert',
      type: 'warning',
      title: 'Low Account Balance',
      message: `${lowBalanceAccounts[0].name} has a low balance. Consider topping up.`,
      actionUrl: '/dashboard/accounts',
      createdAt: new Date(),
      read: false,
    });
  }

  // Add a welcome/tip alert if no critical issues
  if (alerts.length === 0) {
    alerts.push({
      id: 'cfo-tip',
      type: 'info',
      title: 'CFO Tip',
      message: 'Review your financial health score weekly to stay on track with your goals.',
      createdAt: new Date(),
      read: false,
    });
  }

  return alerts;
}

// ============================================================================
// Individual Component Accessors
// ============================================================================

export async function getCFOScore(userId: string): Promise<CFOScore> {
  return calculateCFOScore(userId);
}

export async function getRisks(userId: string): Promise<RiskRadarOutput> {
  return scanForRisks(userId);
}

export async function getActions(userId: string): Promise<ActionPrioritisationOutput> {
  const [risks, score] = await Promise.all([
    scanForRisks(userId),
    calculateCFOScore(userId),
  ]);
  return generateActions(userId, risks.risks, score.components);
}

// ============================================================================
// Helpers - Use centralized frequency utilities from lib/utils/frequencies.ts
// ============================================================================

// ============================================================================
// Q-DEC PR 2.E.4 — Decimal sibling helpers
// ============================================================================

/**
 * Decimal sibling of the private projected-month-end-balance computation
 * inside `calculateQuickStats`. Pure: `liquidBalance − dailyBurn × daysRemaining`.
 *
 * Used by the dashboard quick-stats tile to show "where will I land at
 * month end" — composes Decimal `totalLiquid` (from `netWorthCalculator`
 * Decimal sibling, PR 2.A) and Decimal `dailyBurn` (from
 * `expenseAggregator` Decimal sibling, PR 2.B), so once PR 3 cutover
 * lands the Decimal flow runs end-to-end here without Float-bridge.
 */
export function calculateProjectedMonthEndBalanceDecimal(
  liquidBalance: number | string | Decimal,
  dailyBurn: number | string | Decimal,
  daysRemaining: number,
): Decimal {
  const zero = new Decimal(0);
  const lb = toDecimal(liquidBalance) ?? zero;
  const db = toDecimal(dailyBurn) ?? zero;
  return lb.minus(db.times(daysRemaining));
}

/**
 * Decimal sibling of the private net-worth aggregation inside
 * `calculateMonthlyProgress`. Mirrors the inline math bit-for-bit:
 * `accountBalances + propertyValues + investmentValues − totalDebt`.
 *
 * MON-018 (2026-07-08): the live `calculateMonthlyProgress` NO LONGER computes
 * net worth inline — it now reads the stored `NetWorthSnapshot` history via
 * `getNetWorthHistory` (the ×0.98 placeholder is gone). This Decimal helper is
 * retained ONLY as a Float/Decimal parity fixture (lib/calc-audit +
 * tests/cfo/actions-ai-intel.decimal.test.ts); it is not on the live path.
 * The canonical net-worth engine is `netWorthCalculator.calculateNetWorthDecimal`
 * (proper liability classification, cost base, investment-account cash — MON-013).
 */
export function calculateMonthlyProgressNetWorthDecimal(input: {
  accountBalances: ReadonlyArray<{ currentBalance: number | string | Decimal }>;
  propertyValues: ReadonlyArray<{ currentValue: number | string | Decimal }>;
  investmentHoldings: ReadonlyArray<{ units: number | string | Decimal; averagePrice: number | string | Decimal }>;
  totalDebt: number | string | Decimal;
}): Decimal {
  const zero = new Decimal(0);
  const accounts = input.accountBalances.reduce(
    (acc, a) => acc.plus(toDecimal(a.currentBalance) ?? zero),
    zero,
  );
  const properties = input.propertyValues.reduce(
    (acc, p) => acc.plus(toDecimal(p.currentValue) ?? zero),
    zero,
  );
  const investments = input.investmentHoldings.reduce((acc, h) => {
    const units = toDecimal(h.units) ?? zero;
    const price = toDecimal(h.averagePrice) ?? zero;
    return acc.plus(units.times(price));
  }, zero);
  const debt = toDecimal(input.totalDebt) ?? zero;
  return accounts.plus(properties).plus(investments).minus(debt);
}
