/**
 * MON-131 Tranche 2 — T2 LOAN-COST COMPARE relay (the expectedMoves computer).
 *
 * GET /api/admin/matrix/golden-baseline/t2-loan-cost[?userId=<id>]
 *
 * Runs the OLD loan-cost producers (the live legacy path — exactly what
 * production renders today) and the NEW canonical producer
 * (`resolveLoanCostsForUser`, actuals-first) against the SAME live data, and
 * returns per-path before/after values. This is how T2's `expectedMoves` gets
 * COMPUTED rather than predicted (T2 brief §5; the T1 precedent, where a
 * declared-not-measured value produced a two-cent contract defect —
 * VR-045 §2.1).
 *
 * WHY A RELAY AT ALL. Previews bind to the dev database; real numbers exist
 * only in production. So the before/after table cannot be produced from a
 * test — it has to be measured on live data behind admin auth (HR-3).
 *
 * THE OLD PRODUCERS IT MEASURES (T2 brief §3.1 enumeration, verified in
 * source 2026-07-31):
 *   · masterFinancialService.ts:1872 — builds loanInputs from RAW
 *     `minRepayment` and feeds aggregateLoanRepayments + calculateDebtMetrics.
 *     This is the $8,816.65 against the canonical $12,779.
 *   · loanAggregator.ts:90/234 — converts raw minRepayment by frequency.
 *   · moneyFlowService.ts:382 — `if (!minRepayment) continue`, which skips
 *     BOTH interest-only loans entirely, so they contribute $0 to the entity
 *     money-flow while /dashboard/expenses shows them at $1,191 and $2,518.
 *     The relay measures that skip explicitly rather than leaving it inferred.
 *
 * ALSO RETURNED, because T2 needs them and they are cheap here:
 *   · per-loan basis (actuals / declared / interest-floor) — so a number can
 *     be read together with WHY it has that value;
 *   · the MON-142 effective-rate divergence per loan — the stored-vs-charged
 *     signal, surfaced not applied (nothing consumes that engine yet).
 *
 * SCAFFOLD-ONLY GUARANTEE: this route READS both paths. It changes no
 * producer, no consumer and no rendered number; the golden baseline must hash
 * IDENTICAL across its merge.
 *
 * Per HR-3: admin-side surface only. No user-facing variant exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { resolveSoleUserId, deployedSha } from '@/lib/matrix/goldenBaseline';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import { resolveEffectiveLoanRate } from '@/lib/calculations/effectiveLoanRate';
import { toMonthly } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

interface ComparedPath {
  path: string;
  before: number;
  after: number | null;
  arithmetic: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 },
    );
  }

  let userId = request.nextUrl.searchParams.get('userId') || undefined;
  if (!userId) {
    const r = await resolveSoleUserId();
    if ('candidates' in r) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MULTIPLE_USERS', message: 'More than one user exists — pass ?userId=<id>', details: r.candidates },
        },
        { status: 400 },
      );
    }
    userId = r.userId;
  }

  // ---- the loan rows both paths read -------------------------------------
  const loanRows = await prisma.loan.findMany({
    where: { userId },
    select: {
      id: true, name: true, principal: true, interestRateAnnual: true,
      minRepayment: true, repaymentFrequency: true, isInterestOnly: true,
      ownerEntityId: true, offsetAccountId: true,
      offsetAccount: { select: { currentBalance: true } },
    },
    orderBy: { name: 'asc' },
  });

  const cashflowLoans = loanRows.map((l) => ({
    id: l.id,
    principal: Number(l.principal ?? 0),
    interestRateAnnual: Number(l.interestRateAnnual ?? 0),
    minRepayment: Number(l.minRepayment ?? 0), // @source-lock-allowed: admin compare relay — it MUST read the raw minRepayment path, because measuring the OLD producer is its entire purpose (T2 brief §5). Not a user-facing producer (HR-3); the NEW value beside it comes from resolveLoanCostsForUser.
    repaymentFrequency: l.repaymentFrequency ?? 'MONTHLY',
  }));

  // ---- OLD: the live legacy producers, exactly as production renders ------
  const [snapshot, moneyFlow] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    getMoneyFlow(userId),
  ]);

  // ---- NEW: the ONE canonical producer, actuals-first ---------------------
  const resolved = await resolveLoanCostsForUser(userId, cashflowLoans);
  const newMonthlyLoanCost = cashflowLoans.reduce(
    (s, l) => s + (resolved.get(l.id ?? '')?.monthly ?? 0),
    0,
  );

  // ---- per-loan: old vs new, with the basis that explains the difference --
  const perLoan = loanRows.map((l) => {
    const declaredMonthly =
      Number(l.minRepayment ?? 0) > 0 // @source-lock-allowed: admin compare relay — it MUST read the raw minRepayment path, because measuring the OLD producer is its entire purpose (T2 brief §5). Not a user-facing producer (HR-3); the NEW value beside it comes from resolveLoanCostsForUser.
        ? toMonthly(Number(l.minRepayment), (l.repaymentFrequency ?? 'MONTHLY') as Frequency) // @source-lock-allowed: admin compare relay — it MUST read the raw minRepayment path, because measuring the OLD producer is its entire purpose (T2 brief §5). Not a user-facing producer (HR-3); the NEW value beside it comes from resolveLoanCostsForUser.
        : 0;
    const rc = resolved.get(l.id);
    const offsetBalance = Number((l as { offsetAccount?: { currentBalance?: number } }).offsetAccount?.currentBalance ?? 0);
    const rate = resolveEffectiveLoanRate({
      principal: Number(l.principal ?? 0),
      storedRateAnnual: Number(l.interestRateAnnual ?? 0),
      offsetBalance,
      isInterestOnly: l.isInterestOnly,
      resolvedMonthlyRepayment: rc?.monthly ?? null,
    });
    return {
      id: l.id,
      name: l.name,
      isInterestOnly: l.isInterestOnly,
      principal: Number(l.principal ?? 0),
      offsetBalance,
      // OLD — the raw declared conversion every legacy producer performs.
      oldMonthly: r2(declaredMonthly),
      // NEW — the canonical resolution, with WHY.
      newMonthly: r2(rc?.monthly ?? 0),
      newBasis: rc
        ? rc.flooredToInterest
          ? 'INTEREST_FLOOR'
          : rc.usedActuals
            ? 'ACTUALS'
            : 'DECLARED'
        : 'UNRESOLVED',
      monthlyInterestFloor: r2(rc?.monthlyInterest ?? 0),
      deltaMonthly: r2((rc?.monthly ?? 0) - declaredMonthly),
      // MON-142 — surfaced, not applied.
      effectiveRate: {
        basis: rate.basis,
        storedRateAnnual: rate.storedRateAnnual,
        impliedRateAnnual: rate.impliedRateAnnual,
        divergencePp: rate.divergencePp === null ? null : r2(rate.divergencePp * 1000) / 1000,
        flags: rate.flags,
      },
      // moneyFlowService:382 skips any loan with no minRepayment — the
      // interest-only shape. Measured, not assumed.
      skippedByMoneyFlow: !(Number(l.minRepayment ?? 0) > 0), // @source-lock-allowed: admin compare relay — it MUST read the raw minRepayment path, because measuring the OLD producer is its entire purpose (T2 brief §5). Not a user-facing producer (HR-3); the NEW value beside it comes from resolveLoanCostsForUser.
    };
  });

  // ---- the declared paths T2 will move -----------------------------------
  const cf = snapshot.cashflow;
  const qm = snapshot.quickMetrics;
  const oldMonthlyLoan = cf.monthlyLoanRepayments;
  const delta = newMonthlyLoanCost - oldMonthlyLoan;

  // The income leg is FROZEN at its T1 value — T2 moves the loan leg only.
  const monthlyIncome = qm.monthlyIncome;
  const newMonthlyCashflow = cf.monthlyCashflow - delta; // @financial-math-allowed: admin compare relay — replicates the T2 substitution to COMPUTE the declared after-value; not a user-facing producer (HR-3)
  const newSavingsRate = monthlyIncome > 0 ? (newMonthlyCashflow / monthlyIncome) * 100 : 0;
  const newDebtServiceRatio = monthlyIncome > 0 ? (newMonthlyLoanCost / monthlyIncome) * 100 : 0;

  const paths: ComparedPath[] = [
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.monthlyLoanRepayments',
      before: r2(oldMonthlyLoan),
      after: r2(newMonthlyLoanCost),
      arithmetic: `Σ canonical per-loan resolved cost (actuals-first) = ${r2(newMonthlyLoanCost)}; was Σ raw minRepayment→monthly = ${r2(oldMonthlyLoan)}`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.annualLoanRepayments',
      before: r2(cf.annualLoanRepayments),
      after: r2(newMonthlyLoanCost * 12),
      arithmetic: 'annual = Σ per-loan monthly × 12 — derived from the monthly COMPONENTS, never from a rounded monthly total (VR-045 §2.1)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.monthlyCashflow',
      before: r2(cf.monthlyCashflow),
      after: r2(newMonthlyCashflow),
      arithmetic: `income ${r2(monthlyIncome)} (T1, frozen) − expenses ${r2(cf.monthlyExpenses)} − loans ${r2(newMonthlyLoanCost)}`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.savingsRate', // @financial-math-allowed: this is a PATH STRING naming the declared quantity in the before/after contract, not a read of it (HR-3 admin relay)
      before: r2(cf.savingsRate),
      after: r2(newSavingsRate),
      arithmetic: `${r2(newMonthlyCashflow)} ÷ ${r2(monthlyIncome)} × 100`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.debtServiceRatio',
      before: r2(cf.debtServiceRatio),
      after: r2(newDebtServiceRatio),
      arithmetic: `${r2(newMonthlyLoanCost)} ÷ ${r2(monthlyIncome)} × 100`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.monthlyCashflow',
      before: r2(qm.monthlyCashflow),
      after: r2(newMonthlyCashflow),
      arithmetic: 'mirrors cashflow.monthlyCashflow',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.savingsRate',
      before: r2(qm.savingsRate),
      after: r2(newSavingsRate),
      arithmetic: 'mirrors cashflow.savingsRate',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.debt.metrics.debtServiceRatio',
      before: r2(snapshot.debt?.metrics?.debtServiceRatio ?? 0),
      after: r2(newDebtServiceRatio),
      arithmetic: 'the ONE debt-service ratio — currently a second producer over raw minRepayment',
    },
  ];

  // ---- the moneyFlow interest-only skip, measured ------------------------
  const skipped = perLoan.filter((l) => l.skippedByMoneyFlow);
  const moneyFlowSkip = {
    finding:
      'moneyFlowService.ts:382 skips any loan with no declared repayment — the interest-only shape. Those loans contribute $0 to the entity money-flow while /dashboard/expenses shows their canonical cost.',
    skippedLoans: skipped.map((l) => ({
      name: l.name,
      isInterestOnly: l.isInterestOnly,
      contributesToMoneyFlow: 0,
      canonicalMonthly: l.newMonthly,
    })),
    monthlyUnderstatement: r2(skipped.reduce((s, l) => s + l.newMonthly, 0)),
  };

  return NextResponse.json({
    success: true,
    tranche: 'T2 — loan cost (MON-130)',
    sha: deployedSha(),
    userId,
    capturedAt: new Date().toISOString(),
    summary: {
      oldMonthlyLoanCost: r2(oldMonthlyLoan),
      newMonthlyLoanCost: r2(newMonthlyLoanCost),
      deltaMonthly: r2(delta),
      deltaAnnual: r2(delta * 12),
      loanCount: loanRows.length,
    },
    perLoan,
    paths,
    moneyFlowSkip,
    moneyFlowTotals: {
      // Present so the relay's own consumer figure can be tied out.
      totalIncome: moneyFlow?.totalIncome ?? null,
    },
    notes: [
      'SCAFFOLD-ONLY: reads both paths; changes no producer, consumer or rendered number.',
      '/dashboard/expenses per-loan rows are ALREADY canonical — T2 moves masterFinancialService ONTO them. If those rows move, that is a defect (T2 brief §5).',
      'effectiveRate is MON-142 evidence, surfaced only — no consumer applies it.',
    ],
  });
}
