/**
 * NEOAUDIT §2 TIER 3 — METAMORPHIC INVARIANTS over the REAL master snapshot
 * (CLAUDE.md Part 23 Ring 2/3; NEOAUDIT.md §8 step-6).
 *
 * Tier 1 (authored scenarios) and the Ring-0-gen property tests each pin ONE
 * derivation. Metamorphic laws are different: they assert a RELATION between two
 * runs of the WHOLE service on inputs that differ by a controlled perturbation —
 * "if I change X, Y must change by exactly f(X), and Z must not move at all."
 * These catch the combination bugs no single enumerated example can (NEOAUDIT §2
 * Tier 3): a flow leaking into a stock, a ratio that isn't scale-invariant, a
 * sale that discontinuously drops the whole asset instead of its equity.
 *
 * HOW IT RUNS: the golden "Avalon" rows are deep-cloned and perturbed; the mock
 * `@/lib/db` serves the ACTIVE clone; `getMasterFinancialSnapshot` recomputes
 * from scratch each call (no cache — masterFinancialService.ts:1853), so the two
 * runs are independent. We compare `quickMetrics` / `netWorth` across the pair.
 *
 * Perturbations are fast-check-driven over the AMOUNT/SCALE so the law is proven
 * for a RANGE of inputs, not one lucky number (Tier 3's whole point).
 *
 * COVERAGE BOUNDARY (§20.6 / §22.2.4): verifies four snapshot-level metamorphic
 * laws (expense-flow, income-flow, scale-invariance, property-sale continuity) on
 * the DECLARED-basis golden household, through the real service. It does NOT:
 *  - assert the absolute golden numbers (that is ring2.masterSnapshot.test.ts);
 *  - exercise the ACTUALS path (the golden book has no transactions — the
 *    "add a transfer ⇒ nothing changes" law needs an actuals-basis fixture and
 *    is tracked as a follow-up, NOT claimed here);
 *  - verify any rendered page (R2-vis).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';

// The mock delegates to a mutable holder so each metamorphic run can swap in a
// freshly-perturbed clone of the golden rows. vi.hoisted lifts the holder above
// the hoisted vi.mock factory.
const holder = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));
vi.mock('@/lib/db', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, model: string | symbol) {
        if (typeof model === 'symbol' || model === 'then' || model === 'catch') return undefined;
        const db = holder.db as Record<string, unknown> | null;
        if (!db) throw new Error('[Ring3 metamorphic] no active golden db set for this run');
        return (db as Record<string, unknown>)[model];
      },
    },
  );
  return { default: proxy, prisma: proxy };
});

import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { GOLDEN_DB, GOLDEN_USER_ID, createGoldenDbFrom } from './goldenHousehold';

type Rows = Record<string, { id?: string }[]>;

/** Deep-clone the golden rows so a perturbation never leaks into the next case. */
function cloneGolden(): Rows {
  return structuredClone(GOLDEN_DB) as unknown as Rows;
}

/** Run the REAL master snapshot over a specific rows object. */
async function snapshotOf(rows: Rows) {
  holder.db = createGoldenDbFrom(rows) as unknown as Record<string, unknown>;
  return getMasterFinancialSnapshot(GOLDEN_USER_ID);
}

afterEach(() => {
  holder.db = null as unknown as Record<string, unknown>;
});

// ── Perturbations ──────────────────────────────────────────────────────────
function addMonthlyExpense(rows: Rows, amount: number): Rows {
  (rows.expense as Record<string, unknown>[]).push({
    id: `e-added-${amount}`, ownerEntityId: null, name: 'Added expense', amount,
    frequency: 'MONTHLY', category: 'OTHER', isEssential: false, isRecurring: true,
    isTaxDeductible: false, propertyId: null, loanId: null, assetId: null,
    budgetedAmount: null, lastReconciled: null,
  });
  return rows;
}

function addMonthlyIncome(rows: Rows, amount: number): Rows {
  // type OTHER, no salaryType/propertyId → getGrossAmount = amount × freq→monthly,
  // net = gross (no PAYG), untouched by the rental dedup (MON-009). Adds exactly
  // `amount` to monthly net income.
  (rows.income as Record<string, unknown>[]).push({
    id: `i-added-${amount}`, ownerEntityId: null, name: 'Added income', amount,
    frequency: 'MONTHLY', type: 'OTHER', salaryType: null, netAmount: null,
    grossAmount: null, paygWithholding: null, isTaxable: true, propertyId: null,
    investmentAccountId: null, budgetedAmount: null, lastReconciled: null,
  });
  return rows;
}

const MONEY_SCALE_FIELDS: Record<string, string[]> = {
  expense: ['amount'], income: ['amount'], account: ['currentBalance'],
  loan: ['principal', 'minRepayment'], property: ['currentValue', 'purchasePrice'],
  investmentHolding: ['averagePrice', 'currentPrice'], investmentAccount: ['cashBalance'],
  superannuationAccount: ['currentBalance'], asset: ['currentValue'],
};

function scaleAll(rows: Rows, k: number): Rows {
  for (const [model, fields] of Object.entries(MONEY_SCALE_FIELDS)) {
    for (const row of (rows[model] as Record<string, unknown>[]) ?? []) {
      for (const f of fields) if (typeof row[f] === 'number') row[f] = (row[f] as number) * k;
    }
  }
  return rows;
}

/** A sale removes the asset, its secured loan(s), its rent and its expenses. */
function sellProperty(rows: Rows, propertyId: string): Rows {
  rows.property = (rows.property as Record<string, unknown>[]).filter((p) => p.id !== propertyId) as never;
  rows.loan = (rows.loan as Record<string, unknown>[]).filter((l) => l.propertyId !== propertyId) as never;
  rows.income = (rows.income as Record<string, unknown>[]).filter((i) => i.propertyId !== propertyId) as never;
  rows.expense = (rows.expense as Record<string, unknown>[]).filter((e) => e.propertyId !== propertyId) as never;
  return rows;
}

const NUM_RUNS = 25; // deliberate — each case runs the full service twice

describe('Tier 3 metamorphic — expense is a FLOW (hits cashflow, never net worth)', () => {
  it('add $X/mo expense ⇒ Δcashflow = −X, Δexpenses = +X, ΔnetWorth = 0', async () => {
    const base = await snapshotOf(cloneGolden());
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20_000 }), async (x) => {
        const after = await snapshotOf(addMonthlyExpense(cloneGolden(), x));
        expect(after.quickMetrics.monthlyExpenses).toBeCloseTo(base.quickMetrics.monthlyExpenses + x, 6);
        expect(after.quickMetrics.monthlyCashflow).toBeCloseTo(base.quickMetrics.monthlyCashflow - x, 6);
        // Net worth is a STOCK — a monthly expense must not move it.
        expect(after.netWorth.netWorth).toBeCloseTo(base.netWorth.netWorth, 6);
        expect(after.quickMetrics.totalAssets).toBeCloseTo(base.quickMetrics.totalAssets, 6);
        expect(after.quickMetrics.totalLiabilities).toBeCloseTo(base.quickMetrics.totalLiabilities, 6);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Tier 3 metamorphic — income is a FLOW (raises cashflow + savings rate)', () => {
  it('add $X/mo income ⇒ Δincome = +X, Δcashflow = +X, savingsRate ↑, ΔnetWorth = 0', async () => {
    const base = await snapshotOf(cloneGolden());
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20_000 }), async (x) => {
        const after = await snapshotOf(addMonthlyIncome(cloneGolden(), x));
        expect(after.quickMetrics.monthlyIncome).toBeCloseTo(base.quickMetrics.monthlyIncome + x, 6);
        expect(after.quickMetrics.monthlyCashflow).toBeCloseTo(base.quickMetrics.monthlyCashflow + x, 6);
        expect(after.quickMetrics.savingsRate).toBeGreaterThan(base.quickMetrics.savingsRate);
        expect(after.netWorth.netWorth).toBeCloseTo(base.netWorth.netWorth, 6);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Tier 3 metamorphic — SCALE INVARIANCE (totals scale by k, ratios do not)', () => {
  it('scale ALL amounts by k>0 ⇒ netWorth/income/expenses/cashflow ×k, savingsRate unchanged', async () => {
    const base = await snapshotOf(cloneGolden());
    await fc.assert(
      fc.asyncProperty(fc.double({ min: 0.25, max: 8, noNaN: true, noDefaultInfinity: true }), async (k) => {
        const after = await snapshotOf(scaleAll(cloneGolden(), k));
        // Rounding-aware: cashflowOrchestrator rounds monthlyCashflow to 2dp
        // (Math.round(n*100)/100), so scale-then-round ≠ round-then-scale by up to
        // 0.005·(1+k) ≤ 0.045 for k≤8. netWorth/income/expenses are exact sums (no
        // rounding), so the 0.05 absolute + 1e-6 relative tolerance covers both.
        const scaleClose = (a: number, b: number) => Math.abs(a - b) <= 0.05 + 1e-6 * Math.abs(b);
        expect(scaleClose(after.netWorth.netWorth, base.netWorth.netWorth * k)).toBe(true);
        expect(scaleClose(after.quickMetrics.monthlyIncome, base.quickMetrics.monthlyIncome * k)).toBe(true);
        expect(scaleClose(after.quickMetrics.monthlyExpenses, base.quickMetrics.monthlyExpenses * k)).toBe(true);
        expect(scaleClose(after.quickMetrics.monthlyCashflow, base.quickMetrics.monthlyCashflow * k)).toBe(true);
        // savingsRate = cashflow / income — a pure ratio, invariant under scale
        // (the true ratio is identical for every k; it rounds to the same 2dp).
        expect(after.quickMetrics.savingsRate).toBeCloseTo(base.quickMetrics.savingsRate, 4);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Tier 3 metamorphic — SALE CONTINUITY (net worth drops by EQUITY, not value)', () => {
  it('sell the property ⇒ ΔnetWorth = −equity; Δcashflow removes rent − repayment', async () => {
    const base = await snapshotOf(cloneGolden());
    const after = await snapshotOf(sellProperty(cloneGolden(), 'p-avalon'));
    // Golden: value 800,000 − loan 500,000 = 300,000 equity.
    const equity = 800_000 - 500_000;
    expect(base.netWorth.netWorth - after.netWorth.netWorth).toBeCloseTo(equity, 6);
    // The property was cashflow-NEGATIVE (rent 2,600 − loan 3,000 = −400/mo): selling
    // it IMPROVES monthly cashflow by exactly 400 (removes −2,600 income + −3,000 repay).
    expect(after.quickMetrics.monthlyCashflow - base.quickMetrics.monthlyCashflow).toBeCloseTo(400, 6);
    // Assets drop by the value, liabilities by the loan — continuity, not a jump.
    expect(base.quickMetrics.totalAssets - after.quickMetrics.totalAssets).toBeCloseTo(800_000, 6);
    expect(base.quickMetrics.totalLiabilities - after.quickMetrics.totalLiabilities).toBeCloseTo(500_000, 6);
  });
});

describe('Tier 3 metamorphic — NEGATIVE CONTROLS (the harness can fail)', () => {
  it('a metric that SHOULD move actually moves (adding expense is not a no-op)', async () => {
    const base = await snapshotOf(cloneGolden());
    const after = await snapshotOf(addMonthlyExpense(cloneGolden(), 500));
    expect(after.quickMetrics.monthlyCashflow).not.toBeCloseTo(base.quickMetrics.monthlyCashflow, 6);
  });

  it('scale by k=1 is the identity (guards the scaler itself)', async () => {
    const base = await snapshotOf(cloneGolden());
    const after = await snapshotOf(scaleAll(cloneGolden(), 1));
    expect(after.netWorth.netWorth).toBeCloseTo(base.netWorth.netWorth, 6);
  });
});
