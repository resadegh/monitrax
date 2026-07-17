/**
 * Phase 45 PR 2.B — GET /api/cfo/scenarios/context
 *
 * Returns the snapshot-derived defaults the lever-detail UI needs to
 * render its sliders + selectors without having to fetch the full
 * `MasterFinancialSnapshot` (which is large + most fields irrelevant
 * to the lever picker).
 *
 * Auth: requires `report.read` permission.
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       grossSalaryAnnual: number,
 *       monthlyCashflow: number,
 *       totalSuperBalance: number,       // un-deduplicated TSB (APRA + SMSF)
 *       superAccounts: SuperAccountView[],
 *       loans: LoanView[],
 *       properties: { id, name, currentValue, equity }[],
 *       computedAt: ISO string,
 *     }
 *   }
 *
 * The `totalSuperBalance` is the un-deduplicated TSB (sums every super
 * account regardless of fundType) — matches the ATO Div 296 definition.
 * The snapshot's `netWorth.assets.superannuation` excludes SMSF per
 * Phase 39.5; that's correct for net-worth, wrong for TSB. See
 * `lib/cfo/scenarios/salarySacrificeToSuper.ts:sumSuperBalance` for
 * the resolution.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { LoanView, SuperAccountView } from '@/lib/cfo';

async function fetchSuperAccounts(userId: string): Promise<SuperAccountView[]> {
  const accounts = await prisma.superannuationAccount.findMany({
    where: { userId },
    select: {
      id: true,
      fundName: true,
      name: true,
      currentBalance: true,
      fundType: true,
    },
  });
  return accounts.map((a) => ({
    id: a.id,
    name: a.fundName ?? a.name ?? undefined,
    currentBalance: Number(a.currentBalance ?? 0),
    fundType: (a.fundType as 'INDUSTRY' | 'RETAIL' | 'SMSF' | null) ?? null,
  }));
}

async function fetchLoanViews(userId: string): Promise<LoanView[]> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      principal: true,
      interestRateAnnual: true,
      termMonthsRemaining: true,
      minRepayment: true,
      type: true,
      repaymentFrequency: true,
      offsetAccount: { select: { currentBalance: true } },
    },
  });
  // Calc-SSOT Wall B1 + VR-013 F1/F2: the ONE resolved per-loan cost,
  // ACTUALS-FIRST — fed linked repayments over the canonical trailing-12-month
  // window (lib/services/loanCosts.ts); declared → interest floor only when no
  // repayments are linked. Same number as the property engine, every surface.
  const resolvedCosts = await resolveLoanCostsForUser(
    userId,
    loans.map((l) => ({
      id: l.id,
      principal: Number(l.principal ?? 0),
      interestRateAnnual: Number(l.interestRateAnnual ?? 0),
      minRepayment: Number(l.minRepayment ?? 0),
      repaymentFrequency: l.repaymentFrequency ?? 'MONTHLY',
    })),
  );
  return loans.map((l) => {
    const remaining = Number(l.termMonthsRemaining ?? 360);
    const minMonthlyRepayment = resolvedCosts.get(l.id)?.monthly ?? 0;
    return {
      id: l.id,
      name: l.name,
      principal: Number(l.principal),
      interestRate: Number(l.interestRateAnnual ?? 0),
      termMonths: remaining,
      remainingMonths: remaining,
      monthlyRepayment: minMonthlyRepayment,
      loanType: String(l.type ?? ''),
      offsetBalance: Number(l.offsetAccount?.currentBalance ?? 0),
    };
  });
}

export const GET = withPermission('report.read', async (_request: NextRequest, auth) => {
  try {
    const [snapshot, superAccounts, loans] = await Promise.all([
      getMasterFinancialSnapshot(auth.userId),
      fetchSuperAccounts(auth.userId),
      fetchLoanViews(auth.userId),
    ]);

    // Un-deduplicated TSB — every super account regardless of fundType.
    const totalSuperBalance = superAccounts.reduce(
      (sum, a) => sum + a.currentBalance,
      0,
    );

    const properties = (snapshot.properties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      currentValue: p.currentValue,
      equity: p.equity,
    }));

    return NextResponse.json({
      success: true,
      data: {
        grossSalaryAnnual: snapshot.income.annual.primary.grossTotal,
        monthlyCashflow: snapshot.quickMetrics.monthlyCashflow,
        totalSuperBalance,
        superAccounts,
        loans,
        properties,
        computedAt: snapshot.calculatedAt instanceof Date
          ? snapshot.calculatedAt.toISOString()
          : new Date(snapshot.calculatedAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('[/api/cfo/scenarios/context] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONTEXT_FETCH_FAILED', message: 'Could not load lever context.' },
      },
      { status: 500 },
    );
  }
});
