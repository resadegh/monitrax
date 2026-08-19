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
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getCanonicalMonthlyCashflow } from '@/lib/calculations/canonicalCashflow';
import { computeSafetyScore } from '@/lib/calculations/safetyScore';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_SAFETY_NET', auth.userId);
    if (gateBlocked) return gateBlocked;
  try {
    const userId = auth.userId;

    // Phase 1 (cashflow-actuals) — survivability + months-covered now read from
    // the canonical master snapshot (§6.1 — no local financial reduces). Only
    // recurringPayments (bills status) is fetched here because the master
    // snapshot doesn't model the bills calendar.
    const [snapshot, recurringPayments] = await Promise.all([
      getMasterFinancialSnapshot(userId),
      prisma.recurringPayment.findMany({
        where: { userId, isActive: true },
        include: { account: true },
        orderBy: { nextExpected: 'asc' },
      }),
    ]);

    const qm = snapshot.quickMetrics;
    const ef = snapshot.emergencyFund;
    const liquidCash = qm.liquidCash;

    // MON-017 — emergency-fund figures come from the ONE canonical source
    // (snapshot.emergencyFund, §12.2.1). This route previously RE-DERIVED them
    // with a hardcoded 3-month target, contradicting the master's 6-month target
    // for the same monthsCovered. `ef.monthlyExpenses` IS the survival burn rate
    // the master already computed (actual trailing-avg outflow when transactions
    // exist; declared expenses + loans otherwise).
    const totalMonthlyOutgoings = ef.monthlyExpenses;
    const targetMonths = ef.targetMonths;
    const monthsCovered = ef.monthsCovered;
    const targetAmount = targetMonths * totalMonthlyOutgoings;
    const gap = ef.gap;

    // MON-017 residual (VR-001, 2026-07-11) — "money left over each month" MUST
    // be the actuals-first canonical net (getCanonicalMonthlyCashflow: actual
    // when transactions exist, declared fallback). The previous read,
    // qm.monthlyCashflow, is the DECLARED-basis figure — its comment CLAIMED
    // actuals-aware, but on real data it read positive while actual cashflow
    // was −$6,073/mo, so the safety score awarded "Positive Cashflow 15/15" on
    // a deficit. Drives recovery honesty + the cashflow score.
    const monthlySurplus = getCanonicalMonthlyCashflow(snapshot).net;
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

    // Safety score (0-100) — MON-017: one pure, tested engine on CANONICAL inputs.
    // Fixes the fiction: cashflow dimension reads the actuals-aware net cashflow
    // (a real deficit scores 0), zero tracked bills scores 0 (not 30), and the
    // emergency-fund dimension uses the canonical target (6 months, not 3).
    const score = computeSafetyScore({
      monthsCovered,
      targetMonths,
      billsOnTime,
      totalBills,
      monthlyCashflow: monthlySurplus,
    });
    const safetyScore = score.total;
    const safetyGrade = score.grade;

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
      const suggestedTransfer = Math.min(Math.round(monthlySurplus * 0.5), Math.round(gap / targetMonths));
      if (suggestedTransfer > 0) {
        recommendations.push(
          `Set up automatic transfer of $${suggestedTransfer}/month to your emergency savings. You'll reach your ${targetMonths}-month target in ${weeksToTarget ? Math.ceil(weeksToTarget / 4.33) + ' months' : 'time'}.`
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
            emergencyFund: score.emergencyFund,
            billsOnTime: score.billsOnTime,
            noNewDebt: score.noNewDebt,
            positiveCashflow: score.positiveCashflow,
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
