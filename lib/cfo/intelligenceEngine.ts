/**
 * Phase 17: CFO Intelligence Engine
 * Main orchestrator that combines all CFO components into a unified intelligence layer
 */

import { prisma } from '@/lib/db';
import { calculateCFOScore, getCFOScoreHistory, saveCFOScore } from './scoreCalculator';
import { scanForRisks } from './riskRadar';
import { generateActions } from './actionEngine';
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
} from './types';

// ============================================================================
// Main Dashboard Data Generator
// ============================================================================

export async function getCFODashboardData(userId: string): Promise<CFODashboardData> {
  // Calculate all components in parallel where possible
  const [score, risks] = await Promise.all([
    calculateCFOScore(userId),
    scanForRisks(userId),
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
  };
}

// ============================================================================
// Monthly Progress Calculation
// ============================================================================

async function calculateMonthlyProgress(userId: string): Promise<MonthlyProgress> {
  // Fetch current and previous month data
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    accounts,
    loans,
    properties,
    investments,
    incomes,
    expenses,
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.property.findMany({ where: { userId } }),
    prisma.investmentAccount.findMany({ where: { userId }, include: { holdings: true } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
  ]);

  // Calculate current net worth
  const accountBalances = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const propertyValues = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const investmentValues = investments.reduce((sum, inv) => {
    return sum + inv.holdings.reduce((h, hold) => h + hold.units * hold.averagePrice, 0);
  }, 0);
  const totalDebt = loans.reduce((sum, l) => sum + l.principal, 0);

  const currentNetWorth = accountBalances + propertyValues + investmentValues - totalDebt;

  // For demo purposes, simulate last month's net worth (in production, this would be from history)
  const lastMonthNetWorth = currentNetWorth * 0.98; // Assume 2% growth
  const netWorthChange = currentNetWorth - lastMonthNetWorth;
  const netWorthChangePercent = lastMonthNetWorth > 0
    ? (netWorthChange / lastMonthNetWorth) * 100
    : 0;

  // Calculate savings rate
  const monthlyIncome = incomes.reduce((sum, i) => sum + monthlyize(i.amount, i.frequency), 0);
  const monthlyExpenses = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0);
  const savingsRate = monthlyIncome > 0
    ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
    : 0;

  // Calculate debt reduction this month (simulated)
  const debtReduction = totalDebt * 0.005; // Assume 0.5% paydown

  return {
    netWorthChange: Math.round(netWorthChange),
    netWorthChangePercent: Math.round(netWorthChangePercent * 10) / 10,
    savingsRate: Math.round(savingsRate * 10) / 10,
    savingsRateChange: 0.5, // Simulated improvement
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
  const [accounts, expenses] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
  ]);

  // Calculate projected month-end balance
  const totalLiquid = accounts
    .filter(a => ['SAVINGS', 'TRANSACTIONAL', 'OFFSET'].includes(a.type))
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const now = new Date();
  const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const dailyBurn = expenses.reduce((sum, e) => sum + monthlyize(e.amount, e.frequency), 0) / 30;

  const projectedMonthEndBalance = totalLiquid - (dailyBurn * daysRemaining);

  // Count subscription-like expenses
  const subscriptions = expenses.filter(e =>
    !e.isEssential &&
    ['MONTHLY', 'ANNUAL'].includes(e.frequency.toUpperCase()) &&
    monthlyize(e.amount, e.frequency) < 100
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
  const lowBalanceAccounts = accounts.filter(a =>
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
// Helpers
// ============================================================================

function monthlyize(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY': return amount * 52 / 12;
    case 'FORTNIGHTLY': return amount * 26 / 12;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'ANNUAL': return amount / 12;
    default: return amount;
  }
}
