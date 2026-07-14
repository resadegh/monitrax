/**
 * NEOAUDIT §2 TIER 2 — combinatorial mutation vs an INDEPENDENT oracle
 * (CLAUDE.md Part 23; NEOAUDIT.md §8 step-6).
 *
 * The engine is never checked against itself: the production
 * `getMasterFinancialSnapshot` is compared, on every mutated fixture, against
 * `deriveOracle` — a from-scratch Decimal re-derivation (snapshotOracle.ts). A
 * composition/mapping bug the mutation exposes makes the two disagree.
 *
 * Order matters:
 *  1. ANCHOR the oracle to the hand-computed golden manifest (EXPECTED) — so the
 *     oracle is tied to the §19.2 hand computation, not just to the engine.
 *  2. Confirm production == oracle on the golden base.
 *  3. Run every mutation: production ≈ oracle (the combinatorial check).
 *  4. Negative controls prove the harness can fail.
 *
 * COVERAGE BOUNDARY (§20.6 / §22.2.4): verifies the HEADLINE snapshot numbers
 * (net worth + its asset/liability components, monthly income/expenses/
 * repayments/cashflow, savings rate) agree between the real service and an
 * independent Decimal derivation across the mutation matrix. It does NOT cover
 * PAYG-gross income, rental fragmentation, actuals, tax, or the GRDCS relational
 * layer (those are Ring-0 / Tier-3 / other harnesses — see snapshotOracle.ts scope).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));
vi.mock('@/lib/db', () => {
  const proxy = new Proxy({}, {
    get(_t, model: string | symbol) {
      if (typeof model === 'symbol' || model === 'then' || model === 'catch') return undefined;
      const db = holder.db as Record<string, unknown> | null;
      if (!db) throw new Error('[Tier2] no active golden db set');
      return (db as Record<string, unknown>)[model];
    },
  });
  return { default: proxy, prisma: proxy };
});

import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { GOLDEN_DB, GOLDEN_USER_ID, EXPECTED, createGoldenDbFrom } from '../goldenHousehold';
import { deriveOracle } from './snapshotOracle';
import { mutationCases } from './mutations';

type Rows = Record<string, { id?: string }[]>;

async function snapshotOf(rows: Rows) {
  holder.db = createGoldenDbFrom(rows) as unknown as Record<string, unknown>;
  return getMasterFinancialSnapshot(GOLDEN_USER_ID);
}
afterEach(() => { holder.db = null as unknown as Record<string, unknown>; });

// float(engine) vs Decimal(oracle), both 2dp on the flow fields → rounding-aware.
const close = (a: number, b: number) => Math.abs(a - b) <= 0.02 + 1e-6 * Math.abs(b);

/** Assert every headline number of a production snapshot matches the oracle. */
function expectAgrees(snap: Awaited<ReturnType<typeof getMasterFinancialSnapshot>>, oracle: ReturnType<typeof deriveOracle>, label: string) {
  const q = snap.quickMetrics;
  const checks: [string, number, number][] = [
    ['netWorth', snap.netWorth.netWorth, oracle.netWorth],
    ['assets.total', snap.netWorth.assets.total, oracle.assets.total],
    ['liabilities.total', snap.netWorth.liabilities.total, oracle.liabilities.total],
    ['monthlyIncome', q.monthlyIncome, oracle.monthlyIncome],
    ['monthlyExpenses', q.monthlyExpenses, oracle.monthlyExpenses],
    ['monthlyLoanRepayments', q.monthlyLoanRepayments, oracle.monthlyRepayments],
    ['monthlyCashflow', q.monthlyCashflow, oracle.monthlyCashflow],
    ['savingsRate', q.savingsRate, oracle.savingsRate],
  ];
  for (const [field, prod, orc] of checks) {
    expect(close(prod, orc), `${label} · ${field}: engine ${prod} vs oracle ${orc}`).toBe(true);
  }
}

describe('Tier 2 — the oracle is anchored to the hand-computed manifest', () => {
  it('deriveOracle(golden) reproduces EXPECTED (§19.2 hand computation)', () => {
    const o = deriveOracle(GOLDEN_DB as unknown as Rows);
    expect(o.assets.total).toBe(EXPECTED.assets.total);       // 992,000
    expect(o.liabilities.total).toBe(EXPECTED.liabilities.total); // 520,000
    expect(o.netWorth).toBe(EXPECTED.netWorth);               // 472,000
    expect(o.monthlyIncome).toBe(EXPECTED.cashflow.monthlyNetIncome); // 10,400
    expect(o.monthlyExpenses).toBe(EXPECTED.expensesMonthly.total);   // 1,700
    expect(o.monthlyRepayments).toBe(EXPECTED.cashflow.monthlyLoanRepayments); // 3,400
    expect(o.monthlyCashflow).toBe(EXPECTED.cashflow.monthlyCashflow);         // 5,300
    expect(o.savingsRate).toBe(EXPECTED.cashflow.savingsRate);                 // 50.96
  });
});

describe('Tier 2 — production == oracle on the golden base', () => {
  it('the real snapshot agrees with the independent oracle', async () => {
    const snap = await snapshotOf(structuredClone(GOLDEN_DB) as unknown as Rows);
    expectAgrees(snap, deriveOracle(GOLDEN_DB as unknown as Rows), 'golden');
  });
});

describe('Tier 2 — combinatorial mutations: production ≈ independent oracle', () => {
  const cases = mutationCases();
  it(`covers ${cases.length} mutations across freq × ownership × loan × one-offs × neg-equity × entity-mix`, () => {
    expect(cases.length).toBeGreaterThanOrEqual(25);
  });
  for (const c of cases) {
    it(`agrees on: ${c.name}`, async () => {
      const snap = await snapshotOf(c.rows as unknown as Rows);
      expectAgrees(snap, deriveOracle(c.rows as unknown as Rows), c.name);
    });
  }
});

describe('Tier 2 — negative controls (the harness can fail)', () => {
  it('a deliberately wrong oracle (net worth off by 1) is caught', async () => {
    const snap = await snapshotOf(structuredClone(GOLDEN_DB) as unknown as Rows);
    const wrong = { ...deriveOracle(GOLDEN_DB as unknown as Rows) };
    wrong.netWorth = wrong.netWorth + 1;
    expect(() => expectAgrees(snap, wrong, 'wrong')).toThrow();
  });

  it('a one-off expense that the oracle wrongly counts as monthly diverges', async () => {
    // Prove the exclusion is load-bearing: if the oracle counted a one-off, it
    // would disagree with the engine (which correctly excludes it).
    const rows = structuredClone(GOLDEN_DB) as unknown as Rows;
    (rows.expense as Record<string, unknown>[]).push({ id: 'e-x', ownerEntityId: null, name: 'oneoff', amount: 5000, frequency: 'MONTHLY', category: 'OTHER', isEssential: false, isRecurring: false, isTaxDeductible: false, propertyId: null, loanId: null, assetId: null, budgetedAmount: null, lastReconciled: null });
    const snap = await snapshotOf(rows);
    const oracleCorrect = deriveOracle(rows);      // excludes the one-off
    const oracleWrong = { ...oracleCorrect, monthlyExpenses: oracleCorrect.monthlyExpenses + 5000 };
    expectAgrees(snap, oracleCorrect, 'oneoff-correct');            // engine agrees with correct oracle
    expect(() => expectAgrees(snap, oracleWrong, 'oneoff-wrong')).toThrow(); // and would catch a wrong one
  });
});
