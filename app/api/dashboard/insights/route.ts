/**
 * Dashboard Insights API
 * GET /api/dashboard/insights - Get actionable financial insights
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
import { toAnnual, toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// Types for Prisma query results
interface AccountData {
  balance: number;
  type: string;
}

interface ExpenseData {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  frequency: string;
  isEssential: boolean;
}

interface IncomeData {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  netAmount: number | null;
}

interface LoanData {
  id: string;
  name: string;
  minRepayment: number | null;
  repaymentFrequency: string | null;
  principal: number;
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

      // Fetch all user data in parallel
      const [accounts, expenses, income, loans] = await Promise.all([
        prisma.account.findMany({
          where: { userId },
          select: { balance: true, type: true },
        }),
        prisma.expense.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            category: true,
            amount: true,
            frequency: true,
            isEssential: true,
          },
        }),
        prisma.income.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            type: true,
            amount: true,
            frequency: true,
            netAmount: true,
          },
        }),
        prisma.loan.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            minRepayment: true,
            repaymentFrequency: true,
            principal: true,
          },
        }),
      ]);

      // Calculate liquid cash (savings + checking accounts)
      const liquidCash = (accounts as AccountData[])
        .filter((a: AccountData) => ['SAVINGS', 'CHECKING', 'OFFSET'].includes(a.type))
        .reduce((sum: number, a: AccountData) => sum + a.balance, 0);

      // Calculate monthly expenses
      const expensesByCategory: Record<string, CategorySpending> = {};
      let totalMonthlyExpenses = 0;
      let essentialExpenses = 0;
      let discretionaryExpenses = 0;

      (expenses as ExpenseData[]).forEach((expense: ExpenseData) => {
        const monthlyAmount = toMonthly(expense.amount, expense.frequency as Frequency);
        const annualAmount = toAnnual(expense.amount, expense.frequency as Frequency);
        totalMonthlyExpenses += monthlyAmount;

        if (expense.isEssential) {
          essentialExpenses += monthlyAmount;
        } else {
          discretionaryExpenses += monthlyAmount;
        }

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

      // Calculate monthly income
      let totalMonthlyIncome = 0;
      (income as IncomeData[]).forEach((inc: IncomeData) => {
        // Use netAmount for GROSS salary types, otherwise use amount
        const effectiveAmount = inc.type === 'SALARY_GROSS' && inc.netAmount
          ? inc.netAmount
          : inc.amount;
        totalMonthlyIncome += toMonthly(effectiveAmount, inc.frequency as Frequency);
      });

      // Calculate monthly loan payments
      let monthlyLoanPayments = 0;
      (loans as LoanData[]).forEach((loan: LoanData) => {
        if (loan.minRepayment && loan.repaymentFrequency) {
          monthlyLoanPayments += toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency);
        }
      });

      // Total debt
      const totalDebt = (loans as LoanData[]).reduce((sum: number, l: LoanData) => sum + l.principal, 0);

      // Emergency fund calculations
      const monthsCovered = totalMonthlyExpenses > 0
        ? liquidCash / totalMonthlyExpenses
        : 0;
      const targetMonths = 6;
      const emergencyFundGap = Math.max(0, (targetMonths * totalMonthlyExpenses) - liquidCash);

      let emergencyFundStatus: 'danger' | 'warning' | 'good' | 'excellent';
      if (monthsCovered < 1) emergencyFundStatus = 'danger';
      else if (monthsCovered < 3) emergencyFundStatus = 'warning';
      else if (monthsCovered < 6) emergencyFundStatus = 'good';
      else emergencyFundStatus = 'excellent';

      // Calculate Financial Health Score
      const savingsRate = totalMonthlyIncome > 0
        ? ((totalMonthlyIncome - totalMonthlyExpenses - monthlyLoanPayments) / totalMonthlyIncome) * 100
        : 0;

      const debtToIncome = totalMonthlyIncome > 0
        ? (totalDebt / (totalMonthlyIncome * 12)) * 100
        : 0;

      // Asset diversification (count of different asset types)
      const assetTypes = new Set<string>();
      if (accounts.length > 0) assetTypes.add('cash');
      // Would need to check properties, investments etc. for full diversification
      const diversificationScore = Math.min(assetTypes.size * 25, 100);

      // Score calculations (0-100 for each component)
      const savingsRateScore = Math.min(Math.max(savingsRate * 5, 0), 100); // 20% savings = 100
      const emergencyFundScore = Math.min((monthsCovered / 6) * 100, 100); // 6 months = 100
      const debtToIncomeScore = Math.max(100 - debtToIncome, 0); // Lower is better

      const healthScore = Math.round(
        savingsRateScore * 0.30 +
        emergencyFundScore * 0.30 +
        debtToIncomeScore * 0.25 +
        diversificationScore * 0.15
      );

      let healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      if (healthScore >= 80) healthGrade = 'A';
      else if (healthScore >= 65) healthGrade = 'B';
      else if (healthScore >= 50) healthGrade = 'C';
      else if (healthScore >= 35) healthGrade = 'D';
      else healthGrade = 'F';

      // Money bleeding - top expenses as percentage of income
      const moneyBleeding = (expenses as ExpenseData[])
        .map((expense: ExpenseData) => {
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
        .sort((a: { monthlyAmount: number }, b: { monthlyAmount: number }) => b.monthlyAmount - a.monthlyAmount)
        .slice(0, 10);

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
      const monthlyRemaining = totalMonthlyIncome - totalMonthlyExpenses - monthlyLoanPayments;
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
            diversification: { score: diversificationScore, weight: 15, value: assetTypes.size },
          },
        },
        emergencyFund: {
          liquidCash,
          monthlyExpenses: totalMonthlyExpenses,
          monthsCovered,
          target: targetMonths,
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
