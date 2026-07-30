/**
 * MON-131 — GOLDEN BASELINE capture + diff (the ONE implementation).
 *
 * Extracted from `scripts/matrix/golden-baseline.mjs` (Tranche −1, PR #1525)
 * so the CLI and the admin Matrix-relay routes (`/api/admin/matrix/*`,
 * Tranche −1b) share a single capture/diff implementation. Adding a second
 * capture implementation would be a MON-131 violation in the tool built to
 * detect MON-131 violations — extend THIS module instead.
 *
 * COVERAGE — stated precisely (§22.2.4): the capture invokes the CANONICAL
 * ORCHESTRATOR TREES (master snapshot, tax position, CFO components, risk
 * radar, money flow, health input+report, loan costs) — every leaf producer
 * feeding them is exercised through the real path, so a semantic change in a
 * captured tree's inputs shows as a moved leaf. It does NOT invoke all ~336
 * catalogued producers individually; per-producer capture grows as Phase A
 * contracts enumerate signatures — extend CAPTURES in the same PR as each
 * contract. Design record: docs/architecture/REFERENCE_NUMBERS_DESIGN.md §10.
 */
import { createHash } from 'crypto';
import prisma from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';
import { computeCFOComponents } from '@/lib/cfo/scoreCalculator';
import { scanForRisks } from '@/lib/cfo/riskRadar';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import { buildHealthInput } from '@/lib/health/buildHealthInput';
import { generateHealthReport } from '@/lib/health/aggregateEngine';
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import type { CashflowLoan } from '@/lib/calculations/propertyCashflow';

/** The deployed commit — never a git call (no git in the Lambda). */
export function deployedSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    || 'unknown';
}

// ── serialization: Maps → objects, Dates → ISO, Decimals → number ───────────
export function plain(v: unknown, depth = 0): unknown {
  if (depth > 24) return '«depth-capped»';
  if (v === null || v === undefined) return v;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString();
  const maybeDecimal = v as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === 'function') return maybeDecimal.toNumber();
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, val] of v) o[String(k)] = plain(val, depth + 1);
    return o;
  }
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'function') continue;
      o[k] = plain(val, depth + 1);
    }
    return o;
  }
  return String(v);
}

// ── numeric-leaf walk (diff basis) ──────────────────────────────────────────
export function numericLeaves(node: unknown, path: string, out: Map<string, number>): void {
  if (typeof node === 'number') { out.set(path, node); return; }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v, i) => numericLeaves(v, `${path}[${i}]`, out)); return; }
  for (const [k, v] of Object.entries(node as Record<string, unknown>))
    numericLeaves(v, path ? `${path}.${k}` : k, out);
}

// ── volatile-leaf exclusion (T1-B brief §1.4 / VR-043 §1.4) ─────────────────
/**
 * Numeric leaves that change with the CALENDAR, not with code. VR-043 §1.4:
 * `staleness.oldestManualAgeDays` moved 41 → 42 across a day boundary with
 * zero code change — inside the hashed set that is a false STOP at every
 * day boundary, and a gate that cries wolf gets ignored. Timestamps/UUIDs
 * are strings (never hashed — `numericLeaves` is numeric-only); this list
 * covers the NUMERIC calendar-derived leaves. Applied by BOTH `hashBaseline`
 * and `diffBaselines` so the hash detector and the G7 diff agree.
 * Extending this list changes the hash — re-issue the reference (the
 * post-change capture becomes the new reference of record).
 */
export const VOLATILE_LEAF_PATTERNS: RegExp[] = [
  /\.staleness\.oldestManualAgeDays$/,
];

function isVolatileLeaf(path: string): boolean {
  return VOLATILE_LEAF_PATTERNS.some((p) => p.test(path));
}

// ── canonical hash summary (T1 start-gate brief §1.2 / VR-042 §2.3) ─────────
/**
 * THE canonical baseline hash — defined HERE, once, so the route, the CLI and
 * the tests all hash identically (§12.2.1). Construction: every numeric leaf
 * as `path=value` (JS number stringification), sorted lexicographically by
 * path, joined with `\n`, SHA-256 hex. Two captures with the same hash have
 * moved nothing, anywhere; localising a mismatch still needs the full tree.
 *
 * `captureErrors` is the partial-capture tripwire: a failed capture writes a
 * string `__captureError` stub (0 numeric leaves), so an 8-tree capture can
 * silently be missing a tree's entire numeric content — the drift-log D8
 * lesson (the unpersisted 1,767-leaf capture is consistent with exactly that).
 * A hash summary with a non-empty `captureErrors` is NOT a valid baseline.
 *
 * NOTE ON COMPARABILITY: VR-042's in-session hash (`700935f3…`) predates this
 * definition and its construction was not recorded — it is NOT comparable to
 * hashes produced here. The reference of record is the first `?format=hash`
 * capture taken after this ships (ledger Instrumentation row).
 */
export interface BaselineHashSummary {
  /** Leaves in the HASHED set (volatile calendar leaves excluded). */
  leafCount: number;
  treeHash: string;
  perTree: Record<string, number>;
  captureErrors: string[];
  /** Calendar-derived numeric leaves excluded from the hash (§1.4). */
  volatileExcluded: number;
}

export function hashBaseline(captures: BaselineTree): BaselineHashSummary {
  const all = new Map<string, number>();
  numericLeaves(captures, '', all);
  // T1-B §1.4: calendar-derived numeric leaves are excluded from the hash
  // (they'd emit a false STOP at every day boundary). perTree counts below
  // stay raw so a tree's coverage is still visible.
  const lines = [...all.entries()]
    .filter(([p]) => !isVolatileLeaf(p))
    .map(([p, v]) => `${p}=${v}`)
    .sort()
    .join('\n');
  const perTree: Record<string, number> = {};
  const captureErrors: string[] = [];
  for (const [key, tree] of Object.entries(captures)) {
    const leaves = new Map<string, number>();
    numericLeaves(tree, '', leaves);
    perTree[key] = leaves.size;
    if (tree && typeof tree === 'object' && '__captureError' in (tree as Record<string, unknown>)) {
      captureErrors.push(key);
    }
  }
  const volatileExcluded = [...all.keys()].filter((p) => isVolatileLeaf(p)).length;
  return {
    leafCount: all.size - volatileExcluded,
    treeHash: createHash('sha256').update(lines).digest('hex'),
    perTree,
    captureErrors,
    volatileExcluded,
  };
}

/** Rendered Part-C cluster (VR-041) — static reference constants pinning what
 *  Reza SAW; not live captures (REFERENCE_NUMBERS_DESIGN.md §10). */
export const RENDERED_PART_C = {
  netWorth: 3401782, liquid: 301808, committed: 14261, loansMonthly: 12779,
  rentalMonthly: 10102, taxNet: 37786, taxableIncome: 145426,
  deductions: 172325, medicareLevy: 2909, payg: 11129,
} as const;

export interface BaselineTree {
  [key: string]: unknown;
}

/**
 * The capture registry. Key = `file:function` (the producer being pinned).
 * Extend this list — never fork a second capture implementation (§22.2).
 */
const CAPTURES: Array<[string, (userId: string) => Promise<unknown>]> = [
  ['lib/services/masterFinancialService.ts:getMasterFinancialSnapshot',
    (userId) => getMasterFinancialSnapshot(userId)],
  ['lib/tax-engine/position/userTaxPosition.ts:getUserTaxPosition',
    (userId) => getUserTaxPosition(userId)],
  ['lib/cfo/scoreCalculator.ts:computeCFOComponents',
    (userId) => computeCFOComponents(userId)],
  ['lib/cfo/riskRadar.ts:scanForRisks',
    (userId) => scanForRisks(userId)],
  ['lib/services/moneyFlowService.ts:getMoneyFlow',
    (userId) => getMoneyFlow(userId)],
  ['lib/health/buildHealthInput.ts:buildHealthInput',
    (userId) => buildHealthInput(userId)],
  ['lib/health/aggregateEngine.ts:generateHealthReport',
    async (userId) => generateHealthReport(await buildHealthInput(userId))],
  ['lib/services/loanCosts.ts:resolveLoanCostsForUser',
    async (userId) => {
      const loans = await prisma.loan.findMany({ where: { userId } });
      return resolveLoanCostsForUser(userId, loans as unknown as CashflowLoan[]);
    }],
];

/** Resolve the sole user when none is specified (same rule as the CLI). */
export async function resolveSoleUserId(): Promise<
  { userId: string } | { candidates: Array<{ id: string; email: string | null }> }
> {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length === 1) return { userId: users[0].id };
  return { candidates: users };
}

/** Capture every registry entry for one user. A single capture's failure is
 *  recorded in-tree (`__captureError`), never fatal to the run. */
export async function captureGoldenBaseline(userId: string): Promise<BaselineTree> {
  const captures: BaselineTree = {};
  for (const [key, run] of CAPTURES) {
    try {
      captures[key] = plain(await run(userId));
    } catch (e) {
      captures[key] = { __captureError: String((e as Error)?.message ?? e) };
    }
  }
  return captures;
}

// ── diff: three outcomes, only three (brief §11.2) ──────────────────────────
export interface ExpectedMove {
  pathPrefix: string;
  why?: string;
  arithmetic?: string;
}

export interface BaselineDiff {
  verdict: 'CLEAN' | 'EXPECTED_ONLY' | 'STOP';
  unchanged: number;
  declared: Array<{ path: string; old: number; new: number }>;
  unexpected: Array<{ path: string; old: number; new: number }>;
  added: string[];
  removed: string[];
}

export function diffBaselines(
  oldCaptures: BaselineTree,
  newCaptures: BaselineTree,
  expectedMoves: ExpectedMove[] = [],
): BaselineDiff {
  const a = new Map<string, number>(); numericLeaves(oldCaptures, '', a);
  const b = new Map<string, number>(); numericLeaves(newCaptures, '', b);
  const changed: Array<{ path: string; old: number; new: number }> = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [p, v] of b) {
    if (isVolatileLeaf(p)) continue; // §1.4: calendar leaves never count as movement
    if (!a.has(p)) added.push(p);
    else if (Math.abs((a.get(p) as number) - v) > 1e-9) changed.push({ path: p, old: a.get(p) as number, new: v });
  }
  for (const p of a.keys()) if (!b.has(p) && !isVolatileLeaf(p)) removed.push(p);

  const isExpected = (p: string) => expectedMoves.some((e) => p.startsWith(e.pathPrefix));
  const declared = changed.filter((c) => isExpected(c.path));
  const unexpected = changed.filter((c) => !isExpected(c.path));

  return {
    verdict: unexpected.length ? 'STOP' : declared.length ? 'EXPECTED_ONLY' : 'CLEAN',
    unchanged: b.size - changed.length - added.length,
    declared,
    unexpected,
    added,
    removed,
  };
}
