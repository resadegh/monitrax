/**
 * Dashboard Insights API
 * GET /api/dashboard/insights - Get actionable financial insights
 *
 * REFACTORED to use FinancialSnapshotService for consistent calculations.
 *
 * Provides:
 * - Financial Health Score (0-100)
 * - Emergency Fund coverage (months)
 * - Spending by category breakdown
 * - Money bleeding areas (highest expenses)
 * - Actionable recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { getFinancialSnapshot } from '@/lib/services/financialSnapshot';
import { toAnnual, toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

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
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Get centralized financial snapshot for consistent totals
      const snapshot = await getFinancialSnapshot(userId);

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
      const monthlyLoanPayments = snapshot.loans.monthlyRepayments;
      const liquidCash = snapshot.accounts.liquidCash;

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

      // Use snapshot values for emergency fund and health score
      const monthsCovered = snapshot.emergencyFund.monthsCovered;
      const emergencyFundGap = snapshot.emergencyFund.gap;
      const emergencyFundStatus = snapshot.emergencyFund.status;
      const savingsRate = snapshot.healthScore.savingsRate;
      const debtToIncome = snapshot.healthScore.debtToIncome;

      // Score calculations (0-100 for each component)
      const savingsRateScore = Math.min(Math.max(savingsRate * 5, 0), 100);
      const emergencyFundScore = Math.min((monthsCovered / 6) * 100, 100);
      const debtToIncomeScore = Math.max(100 - debtToIncome, 0);
      const diversificationScore = 25; // Simplified for now

      const healthScore = snapshot.healthScore.score;
      const healthGrade = snapshot.healthScore.grade;

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
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Dashboard insights error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
