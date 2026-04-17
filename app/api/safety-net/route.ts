/**
 * SAFETY NET API
 * TRAIL Framework — Stage A (Anchor)
 *
 * GET /api/safety-net — Get safety net status
 *
 * Returns emergency fund progress, bills status, safety score,
 * and recommendations for building the user's financial anchor.
 *
 * Data sources: master snapshot (accounts, expenses, emergency fund),
 * recurring payments (bills status), and Guide recommendations.
 *
 * Blueprint reference: docs/blueprint/TRAIL_FRAMEWORK.md §5
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import prisma from '@/lib/db';
import { toMonthly } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    const [accounts, expenses, loans, recurringPayments] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.loan.findMany({ where: { userId } }),
      prisma.recurringPayment.findMany({
        where: { userId, isActive: true },
        include: { account: true },
        orderBy: { nextExpected: 'asc' },
      }),
    ]);

    const liquidAccounts = accounts.filter(
      (a) => a.type === 'SAVINGS' || a.type === 'OFFSET' || a.type === 'TRANSACTIONAL'
    );
    const liquidCash = liquidAccounts.reduce(
      (sum, a) => sum + Number(a.currentBalance || 0),
      0
    );

    const monthlyExpenses = expenses.reduce(
      (sum, e) => sum + toMonthly(Number(e.amount || 0), (e.frequency || 'MONTHLY') as Frequency),
      0
    );

    const monthlyLoanRepayments = loans.reduce(
      (sum, l) => sum + Number(l.minRepayment || 0),
      0
    );

    const totalMonthlyOutgoings = monthlyExpenses + monthlyLoanRepayments;
    const targetMonths = 3;
    const monthsCovered = totalMonthlyOutgoings > 0 ? liquidCash / totalMonthlyOutgoings : 0;
    const targetAmount = targetMonths * totalMonthlyOutgoings;
    const gap = Math.max(0, targetAmount - liquidCash);

    const monthlyIncome = await prisma.income.findMany({ where: { userId } });
    const totalMonthlyIncome = monthlyIncome.reduce(
      (sum, i) => sum + toMonthly(Number(i.amount || 0), (i.frequency || 'MONTHLY') as Frequency),
      0
    );
    const monthlySurplus = totalMonthlyIncome - totalMonthlyOutgoings;
    const weeksToTarget = monthlySurplus > 0 && gap > 0
      ? Math.ceil((gap / monthlySurplus) * 4.33)
      : gap <= 0 ? 0 : null;

    // Bills status
    const billsOnTime = recurringPayments.filter((p) => !p.isPaused).length;
    const billsOverdue = 0; // TODO: detect overdue from transaction matching
    const totalBills = recurringPayments.length;
    const monthlyBillsTotal = recurringPayments.reduce((sum, p) => {
      const amount = Number(p.expectedAmount || 0);
      switch (p.pattern) {
        case 'WEEKLY': return sum + amount * 4.33;
        case 'FORTNIGHTLY': return sum + amount * 2.17;
        case 'MONTHLY': return sum + amount;
        case 'QUARTERLY': return sum + amount / 3;
        case 'ANNUALLY': return sum + amount / 12;
        default: return sum + amount;
      }
    }, 0);

    // Safety score (0-100)
    const emergencyFundScore = Math.min((monthsCovered / targetMonths) * 40, 40);
    const billsScore = totalBills > 0
      ? ((billsOnTime / totalBills) * 30)
      : 30;
    const noNewDebtScore = 15; // TODO: detect new consumer debt from recent transactions
    const cashflowScore = monthlySurplus > 0 ? 15 : monthlySurplus > -200 ? 8 : 0;
    const safetyScore = Math.round(emergencyFundScore + billsScore + noNewDebtScore + cashflowScore);

    let safetyGrade: string;
    if (safetyScore >= 80) safetyGrade = 'STRONG';
    else if (safetyScore >= 60) safetyGrade = 'BUILDING';
    else if (safetyScore >= 40) safetyGrade = 'FRAGILE';
    else safetyGrade = 'AT RISK';

    // What-if scenarios
    const scenarios = [
      {
        name: 'Car breakdown',
        cost: 3000,
        monthsRemaining: totalMonthlyOutgoings > 0 ? (liquidCash - 3000) / totalMonthlyOutgoings : 0,
        recoveryWeeks: monthlySurplus > 0 ? Math.ceil((3000 / monthlySurplus) * 4.33) : null,
      },
      {
        name: 'Medical emergency',
        cost: 5000,
        monthsRemaining: totalMonthlyOutgoings > 0 ? (liquidCash - 5000) / totalMonthlyOutgoings : 0,
        recoveryWeeks: monthlySurplus > 0 ? Math.ceil((5000 / monthlySurplus) * 4.33) : null,
      },
      {
        name: 'Job loss (1 month)',
        cost: totalMonthlyOutgoings,
        monthsRemaining: totalMonthlyOutgoings > 0 ? (liquidCash - totalMonthlyOutgoings) / totalMonthlyOutgoings : 0,
        recoveryWeeks: monthlySurplus > 0 ? Math.ceil((totalMonthlyOutgoings / monthlySurplus) * 4.33) : null,
      },
    ];

    // Guide recommendations for Anchor stage
    const recommendations: string[] = [];
    if (monthsCovered < 3) {
      const suggestedTransfer = Math.min(Math.round(monthlySurplus * 0.5), Math.round(gap / 6));
      if (suggestedTransfer > 0) {
        recommendations.push(
          `Set up automatic transfer of $${suggestedTransfer}/month to your emergency savings. You'll reach 3 months in ${weeksToTarget ? Math.ceil(weeksToTarget / 4.33) + ' months' : 'time'}.`
        );
      }
    }
    if (monthsCovered < 1) {
      recommendations.push(
        'Your emergency fund covers less than 1 month. Focus here before investing — one unexpected bill could set you back.'
      );
    }
    if (monthlySurplus <= 0) {
      recommendations.push(
        'Your expenses exceed your income. Visit My Budget to find areas to reduce before building your safety net.'
      );
    }
    if (monthsCovered >= 3) {
      recommendations.push(
        'Your safety net is solid! You\'re ready to move to the Invest stage of your TRAIL journey.'
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        emergencyFund: {
          liquidCash: Math.round(liquidCash),
          monthlyOutgoings: Math.round(totalMonthlyOutgoings),
          monthsCovered: Math.round(monthsCovered * 10) / 10,
          targetMonths,
          targetAmount: Math.round(targetAmount),
          gap: Math.round(gap),
          monthlySurplus: Math.round(monthlySurplus),
          weeksToTarget,
        },
        bills: {
          total: totalBills,
          onTime: billsOnTime,
          overdue: billsOverdue,
          monthlyTotal: Math.round(monthlyBillsTotal),
          items: recurringPayments.slice(0, 10).map((p) => ({
            id: p.id,
            name: p.merchantStandardised,
            amount: Number(p.expectedAmount),
            pattern: p.pattern,
            status: p.isPaused ? 'paused' : 'active',
            nextExpected: p.nextExpected,
          })),
        },
        safetyScore: {
          total: safetyScore,
          grade: safetyGrade,
          breakdown: {
            emergencyFund: { score: Math.round(emergencyFundScore), max: 40 },
            billsOnTime: { score: Math.round(billsScore), max: 30 },
            noNewDebt: { score: noNewDebtScore, max: 15 },
            positiveCashflow: { score: cashflowScore, max: 15 },
          },
        },
        scenarios,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Safety net API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate safety net status' },
      { status: 500 }
    );
  }
});
