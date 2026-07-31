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
import { calculateCashflow } from '@/lib/calculations/cashflowOrchestrator';
import { assembleBankedIncomeForUser } from '@/lib/income/banked/assembly';
import { bankedTotalsFromResult } from '@/lib/income/banked/aggregator';
import { calculateDebtMetrics } from '@/lib/calculations/loanAggregator';
import { toMonthly } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

interface ComparedPath {
  path: string;
  before: number;
  after: number | null;
  arithmetic: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Every numeric leaf whose value differs between two objects, as dotted paths.
 *
 * THE DERIVATION SWEEP (added 2026-07-31, after the SECOND capture).
 *
 * The first two rounds enumerated declared paths from a HAND-WRITTEN LIST, and
 * a list is the wrong instrument: round 1 missed `cashflow.annualCashflow` /
 * `.annualSurplus` ($47,551.71), round 2 missed `cashflow.monthlySurplus` and
 * `debt.metrics.monthlyRepayments` ($3,962.64) — and reading the assembly for
 * this change surfaced a FIFTH, `quickMetrics.monthlyLoanRepayments`, that no
 * round had found. Adding names fixed names; it never fixed the method, and
 * under G7 every miss stops the tranche.
 *
 * So the declaration is now produced BY CONSTRUCTION: re-run the REAL engines
 * with the canonical per-loan cost substituted for the raw `minRepayment`, and
 * diff. Whatever moves, moves — no judgement, no list, nothing to forget.
 */
function diffNumericLeaves(
  before: unknown,
  after: unknown,
  prefix: string,
  out: Array<{ path: string; before: number; after: number }> = [],
): Array<{ path: string; before: number; after: number }> {
  if (typeof before === 'number' && typeof after === 'number') {
    if (Number.isFinite(before) && Number.isFinite(after) && r2(before) !== r2(after)) {
      out.push({ path: prefix, before: r2(before), after: r2(after) });
    }
    return out;
  }
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const k of Object.keys(after as Record<string, unknown>)) {
      diffNumericLeaves(
        (before as Record<string, unknown>)[k],
        (after as Record<string, unknown>)[k],
        prefix ? `${prefix}.${k}` : k,
        out,
      );
    }
  }
  return out;
}

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
  // Expenses + banked income are fetched so the sweep can re-run the REAL
  // engine on the REAL inputs — same filter master applies at
  // masterFinancialService.ts:1853 (`isRecurring !== false`). Reading them here
  // is measurement, not a second producer: the relay renders nothing.
  const [snapshot, moneyFlow, expenseRows, bankedAssembled] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    getMoneyFlow(userId),
    prisma.expense.findMany({
      where: { userId },
      select: { amount: true, frequency: true, isEssential: true, isRecurring: true },
    }),
    assembleBankedIncomeForUser(userId),
  ]);
  const engineExpenseLegs = expenseRows
    .filter((e) => e.isRecurring !== false)
    .map((e) => ({ amount: e.amount, frequency: e.frequency, isEssential: e.isEssential }));

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
  const newAnnualCashflow = cf.annualIncome - cf.annualExpenses - newMonthlyLoanCost * 12; // @financial-math-allowed: admin compare relay — the ANNUAL pair was MISSING from the first capture (the Matrix caught a $47,551.71 undeclared move that would have stopped the tranche at G7). Derived from annual components per VR-045 §2.1; not a user-facing producer (HR-3)
  const newSavingsRate = monthlyIncome > 0 ? (newMonthlyCashflow / monthlyIncome) * 100 : 0;
  const newDebtServiceRatio = monthlyIncome > 0 ? (newMonthlyLoanCost / monthlyIncome) * 100 : 0;

  // ---- THE DERIVATION SWEEP — declared paths BY CONSTRUCTION --------------
  // Re-run the REAL engines with the canonical per-loan cost substituted for
  // the raw minRepayment, then diff. Note the old input FILTERS OUT loans with
  // no minRepayment (masterFinancialService.ts:1861) — which is exactly why
  // both interest-only loans vanish today. The canonical input carries every
  // loan, so the filter is gone by construction.
  const canonicalLoanLegs = loanRows.map((l) => ({
    minRepayment: resolved.get(l.id)?.monthly ?? 0,
    repaymentFrequency: 'MONTHLY',
  }));

  const newCashflow = calculateCashflow({
    incomeTotals: bankedTotalsFromResult(bankedAssembled.banked),
    expenses: engineExpenseLegs,
    loans: canonicalLoanLegs,
  } as never);

  const newDebtMetrics = calculateDebtMetrics(
    loanRows.map((l) => ({
      principal: Number(l.principal ?? 0),
      minRepayment: resolved.get(l.id)?.monthly ?? 0,
      repaymentFrequency: 'MONTHLY',
      interestRateAnnual: Number(l.interestRateAnnual ?? 0),
      isInterestOnly: l.isInterestOnly ?? false,
      ownerEntityId: l.ownerEntityId,
    })),
    monthlyIncome,
  );

  const cashflowMoves = diffNumericLeaves(cf, newCashflow, 'cashflow');
  const debtMoves = diffNumericLeaves(
    snapshot.debt?.metrics ?? {},
    newDebtMetrics,
    'debt.metrics',
  );

  // quickMetrics MIRRORS cashflow leaves (masterFinancialService.ts:2031+), so
  // any quickMetrics leaf holding a value that just moved, moves with it.
  const movedByOldValue = new Map<number, number>();
  for (const m of cashflowMoves) movedByOldValue.set(m.before, m.after);
  const quickMoves: Array<{ path: string; before: number; after: number }> = [];
  for (const [k, v] of Object.entries(qm as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const hit = movedByOldValue.get(r2(v));
    if (hit !== undefined && r2(v) !== hit) {
      quickMoves.push({ path: `quickMetrics.${k}`, before: r2(v), after: hit });
    }
  }

  const P = 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.';
  const paths: ComparedPath[] = [...cashflowMoves, ...debtMoves, ...quickMoves].map((m) => ({
    path: `${P}${m.path}`,
    before: m.before,
    after: m.after,
    arithmetic:
      'DERIVATION SWEEP: produced by re-running the real engine with the canonical per-loan cost substituted, then diffing. Not a hand-listed path.',
  }));

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
      'DEFERRAL (D18/X3, stated not omitted): savingsRate here is a straight substitution — the WHOLE loan payment is treated as spending. X3 separates PRINCIPAL out of spending and into saving, which changes the numerator SHAPE, not just its size. If X3 lands in T2 this figure moves again; if it does not, this deferral is the record of why. The split needs per-loan interest/principal, which MON-143 (offset netting) gates.',
      'monthlyInterestFloor does NOT net the offset — MON-143, raised from this relay. The canonical producer is the only one of four that breaches D21 (Guildford floors at 1,964.67 vs 384.45, 5.1x). Latent today (Guildford resolves via ACTUALS) but it MUST be fixed before the migration, or every consumer inherits it.',
    ],
  });
}
