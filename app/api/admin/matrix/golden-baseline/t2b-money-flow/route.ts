/**
 * MON-131 T2-B compare relay — the per-entity money flow, both bases at once.
 *
 * WHAT IT IS FOR. `.audit/expected-moves-t2b.json` cannot be written from a
 * test: previews bind to the dev DB, so the before/after values only exist in
 * production. This route measures both arms against the SAME live data in one
 * request and returns, per numeric leaf, the current value and the canonical
 * one. Its output is the contract's provenance.
 *
 * THE DEFECT IT MEASURES. `moneyFlowService` skips any loan with no declared
 * repayment, so both interest-only Bankwest loans and the HECS debt contribute
 * **$0** to the entity flow — `2,518.34 + 1,191.25 + 83.33 = $3,792.92/mo`,
 * measured by the T2 relay's `moneyFlowSkip` block at `915704f0`. VR-047 then
 * confirmed the consequence on screen: after T2 part A, Home's budget tile
 * reads $12,779 while the Sankey still reads the understated figure. Two
 * surfaces that used to agree on the same wrong number now visibly disagree.
 *
 * WHY IT CALLS THE REAL ENGINE TWICE rather than re-aggregating. `getMoneyFlow`
 * is not a pure engine taking injectable legs — it fetches its own loan rows
 * and does the per-entity aggregation, the surplus flooring and the edge
 * building inline. A relay that re-implemented any of that would be comparing
 * a replica to the original, which is the MON-035 parity failure: a checker
 * that shares a source with the thing it checks cannot see them diverge. So
 * the basis switch lives INSIDE the producer (`LoanCostBasis`), both arms run
 * the real `getMoneyFlow`, and the migration is then a one-word default flip
 * whose effect this capture has already measured.
 *
 * THE SURPLUS FLOOR IS THE REASON THIS SWEEP CANNOT BE A HAND-LIST.
 * `surplus = max(0, income − tax − essential − discretionary − loans −
 * distributed)`. Raising the loan leg does NOT simply move `Loan repayments`
 * by the delta: an entity already at zero surplus absorbs nothing, one above
 * zero absorbs part of it, and `totalOutflow` can stop equalling `totalIncome`
 * as a result. Which entity lands where is a property of live data, not of
 * arithmetic anyone can do in advance — exactly why T2's own list missed five
 * paths across three rounds and had to be replaced by a sweep. Every numeric
 * leaf is diffed here; nothing is enumerated by name.
 *
 * SCAFFOLD-ONLY: reads both paths, changes no producer, no consumer and no
 * rendered number. The default basis is unchanged.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { resolveSoleUserId, deployedSha } from '@/lib/matrix/goldenBaseline';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import type { CashflowLoan } from '@/lib/calculations/propertyCashflow';

export const dynamic = 'force-dynamic';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Diff every numeric leaf of two same-shaped trees. Arrays are joined on a
 * stable key (`id` then `name` then `label` then `source|target`) rather than
 * by index, because an entity that was skipped under one basis and present
 * under the other would otherwise shift every later row and report a wall of
 * false moves.
 */
function diffNumericLeaves(
  before: unknown,
  after: unknown,
  prefix: string,
  out: Array<{ path: string; before: number | null; after: number | null }> = [],
): Array<{ path: string; before: number | null; after: number | null }> {
  if (typeof before === 'number' || typeof after === 'number') {
    const b = typeof before === 'number' && Number.isFinite(before) ? r2(before) : null;
    const a = typeof after === 'number' && Number.isFinite(after) ? r2(after) : null;
    if (b !== a) out.push({ path: prefix, before: b, after: a });
    return out;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const bArr = Array.isArray(before) ? before : [];
    const aArr = Array.isArray(after) ? after : [];
    const keyOf = (row: unknown, i: number): string => {
      const o = row as Record<string, unknown> | null;
      if (o && typeof o === 'object') {
        for (const k of ['id', 'name', 'label']) {
          if (typeof o[k] === 'string') return String(o[k]);
        }
        if (typeof o.source === 'string' && typeof o.target === 'string') {
          return `${o.source}->${o.target}`;
        }
      }
      return `#${i}`;
    };
    const bMap = new Map(bArr.map((row, i) => [keyOf(row, i), row]));
    const aMap = new Map(aArr.map((row, i) => [keyOf(row, i), row]));
    for (const k of new Set([...bMap.keys(), ...aMap.keys()])) {
      diffNumericLeaves(bMap.get(k), aMap.get(k), `${prefix}[${k}]`, out);
    }
    return out;
  }
  if ((before && typeof before === 'object') || (after && typeof after === 'object')) {
    const b = (before ?? {}) as Record<string, unknown>;
    const a = (after ?? {}) as Record<string, unknown>;
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      diffNumericLeaves(b[k], a[k], prefix ? `${prefix}.${k}` : k, out);
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

  // ---- both arms, the REAL engine, the SAME live data --------------------
  const [oldFlow, newFlow] = await Promise.all([
    getMoneyFlow(userId, prisma, { loanCostBasis: 'DECLARED' }),
    getMoneyFlow(userId, prisma, { loanCostBasis: 'CANONICAL' }),
  ]);

  // ---- per-loan evidence, so the declaration can cite it ------------------
  const loanRows = await prisma.loan.findMany({
    where: { userId },
    select: {
      id: true, name: true, principal: true, interestRateAnnual: true,
      minRepayment: true, repaymentFrequency: true, isInterestOnly: true,
      ownerEntityId: true,
    },
    orderBy: { name: 'asc' },
  });
  const resolved = await resolveLoanCostsForUser(userId, loanRows as unknown as CashflowLoan[]);
  const entityNames = new Map(
    (await prisma.legalEntity.findMany({ where: { userId }, select: { id: true, name: true } }))
      .map((e) => [e.id, e.name]),
  );

  const perLoan = loanRows.map((l) => {
    const canonicalMonthly = resolved.get(l.id)?.monthly ?? 0;
    // The OLD contribution, replicated here ONLY to label the evidence — the
    // measured move comes from the engine diff above, never from this.
    const declaredMonthly =
      Number(l.minRepayment ?? 0) > 0 ? Number(l.minRepayment) : 0; // @source-lock-allowed: admin compare relay — labelling which loans the OLD arm skips is this route's entire purpose (T2-B; HR-3). Not a user-facing producer, and no MEASURED value comes from this line — every number in `moves` is the diff of two real getMoneyFlow runs.
    return {
      name: l.name,
      ownerEntity: entityNames.get(l.ownerEntityId) ?? l.ownerEntityId,
      isInterestOnly: l.isInterestOnly,
      principal: Number(l.principal ?? 0),
      skippedByOldBasis: declaredMonthly <= 0,
      canonicalMonthly: r2(canonicalMonthly),
      canonicalAnnual: r2(canonicalMonthly * 12),
    };
  });

  const skipped = perLoan.filter((l) => l.skippedByOldBasis);
  const moves = diffNumericLeaves(oldFlow, newFlow, '');

  return NextResponse.json({
    success: true,
    tranche: 'T2-B — money flow loan leg (MON-130, the remaining producers)',
    sha: deployedSha(),
    userId,
    capturedAt: new Date().toISOString(),
    summary: {
      loanCount: loanRows.length,
      // The identity assertion the handout checks BEFORE any number is read.
      entityCount: oldFlow.entities.length,
      oldTotalLoans: r2(oldFlow.outflows.find((o) => o.label === 'Loan repayments')?.amount ?? 0),
      newTotalLoans: r2(newFlow.outflows.find((o) => o.label === 'Loan repayments')?.amount ?? 0),
      skippedByOldBasis: skipped.length,
      monthlyUnderstatement: r2(skipped.reduce((s, l) => s + l.canonicalMonthly, 0)),
      annualUnderstatement: r2(skipped.reduce((s, l) => s + l.canonicalAnnual, 0)),
      // totalOutflow === totalIncome is an identity of the OLD tree. The
      // surplus floor can break it under CANONICAL, and whether it does is a
      // property of live data — reported, never assumed either way.
      oldOutflowEqualsIncome: r2(oldFlow.totalOutflow) === r2(oldFlow.totalIncome),
      newOutflowEqualsIncome: r2(newFlow.totalOutflow) === r2(newFlow.totalIncome),
    },
    perLoan,
    moveCount: moves.length,
    moves,
    notes: [
      'SCAFFOLD-ONLY: reads both paths; changes no producer, consumer or rendered number. The default basis is unchanged.',
      'Every leaf here is MEASURED by diffing two runs of the REAL getMoneyFlow. Nothing is hand-enumerated — the derivation-sweep method, after T2 part A proved a named list misses paths (five across three rounds).',
      'Arrays are joined on id/name/label, not index, so an entity present under one basis and absent under the other reports as itself rather than shifting every later row.',
      'The surplus floor means the per-entity moves do NOT simply sum to the loan delta. Read summary.newOutflowEqualsIncome before treating totalOutflow as an invariant.',
    ],
  });
}
