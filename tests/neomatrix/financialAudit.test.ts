/**
 * Neomatrix A1 — EXECUTABLE, LAW-REFERENCED AUDIT (Phase 53 §14 A1).
 *
 * This is the step that makes the Neomatrix a *referee* over the code, not a
 * mirror of it. For each audited engine we:
 *   1. state the governing law / formula (the authority — NOT the code),
 *   2. hand-derive the expected output FROM that law (CLAUDE.md §19.2 step 3),
 *   3. run the REAL engine and assert its output equals the law-derived value.
 *
 * A passing case is a *law-anchored lock*: if the engine ever drifts from the
 * law, this fails. A genuine mismatch is a `suspected-issue` — it is NOT
 * committed as a failing assertion; it is raised with Reza with the law
 * citation + wrong-vs-right numbers, and the engine is left unchanged
 * (CLAUDE.md §10/§19 — documentation/model only, never silently fix).
 *
 * Every audited node id must exist in financial-graph.json — the audit is tied
 * to the model. Documentation/model + test only; no financial logic changed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateNetWorth } from '@/lib/calculations/netWorthCalculator';
import { resolveCanonicalCashflow } from '@/lib/calculations/canonicalCashflow';

const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);
const nodeIds = new Set(graph.nodes.map((n: { id: string }) => n.id));

/** One law-referenced audit case. `expected` is derived from `law`, not the code. */
interface AuditCase {
  node: string; // must exist in the Neomatrix graph
  law: string; // the governing authority (external to the code)
  derivation: string; // how `expected` was hand-computed from `law`
  actual: () => number; // runs the REAL engine
  expected: number;
}

const CASES: AuditCase[] = [
  // ── Net worth — the accounting identity (assets − liabilities) ──────────────
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Accounting identity: net worth = Σ assets − Σ liabilities',
    derivation: 'property 800,000 + cash 20,000 + (100 units × $50 = 5,000) − loan 600,000 = 225,000',
    actual: () =>
      calculateNetWorth(
        [{ currentValue: 800000 }],
        [{ currentBalance: 20000 }],
        [{ units: 100, currentPrice: 50 }],
        [{ principal: 600000 }],
      ).netWorth,
    expected: 225000,
  },
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Investment market value = units × (currentPrice ?? averagePrice); falls back to average price when no current price',
    derivation: '200 units × averagePrice $25 (no currentPrice) = 5,000; no liabilities → net worth 5,000',
    actual: () =>
      calculateNetWorth([], [], [{ units: 200, averagePrice: 25 }], []).netWorth,
    expected: 5000,
  },
  {
    node: 'engine.netWorthCalculator.calculateNetWorth',
    law: 'Phase 39.5 rule: super counted UNLESS fundType === "SMSF" (SMSF wealth flows through the SMSF entity\'s owned assets — counting both double-counts)',
    derivation: 'INDUSTRY super 100,000 counted; SMSF super 100,000 excluded → net worth 100,000',
    actual: () =>
      calculateNetWorth(
        [],
        [],
        [],
        [],
        [
          { balance: 100000, fundType: 'INDUSTRY' },
          { balance: 100000, fundType: 'SMSF' },
        ],
      ).netWorth,
    expected: 100000,
  },

  // ── Canonical cashflow — the actuals-vs-declared SSOT (CLAUDE.md §19.1) ──────
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'CLAUDE.md §19.1: actuals win when present. savingsRate = net / inflow × 100',
    derivation: 'hasActualData=true → net 4,000; savingsRate = 4,000 / 10,000 × 100 = 40',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: true, inflow: 10000, outflow: 6000, net: 4000, avgOutflow: 5500 },
        { inflow: 8000, outflow: 5000, net: 3000 },
      ).savingsRate,
    expected: 40,
  },
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'CLAUDE.md §19.1: declared is the fallback ONLY when no actual data. savingsRate = net / inflow × 100',
    derivation: 'hasActualData=false → declared net 3,000; savingsRate = 3,000 / 8,000 × 100 = 37.5',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: false, inflow: 0, outflow: 0, net: 0, avgOutflow: 0 },
        { inflow: 8000, outflow: 5000, net: 3000 },
      ).savingsRate,
    expected: 37.5,
  },
  {
    node: 'engine.canonicalCashflow.resolveCanonicalCashflow',
    law: 'savingsRate is 0 when there is no inflow (no divide-by-zero)',
    derivation: 'declared inflow 0 → savingsRate 0',
    actual: () =>
      resolveCanonicalCashflow(
        { hasActualData: false, inflow: 0, outflow: 0, net: 0, avgOutflow: 0 },
        { inflow: 0, outflow: 500, net: -500 },
      ).savingsRate,
    expected: 0,
  },
];

describe('Neomatrix A1 — executable law-referenced audit (model refs the code)', () => {
  it('every audited node exists in financial-graph.json (audit tied to the model)', () => {
    const missing = CASES.map((c) => c.node).filter((id) => !nodeIds.has(id));
    expect(missing).toEqual([]);
  });

  for (const c of CASES) {
    it(`${c.node} matches the law: ${c.derivation}`, () => {
      // The engine's output MUST equal the value the LAW says it should be.
      // A mismatch here is a suspected-issue to raise with Reza — never a
      // licence to change the engine.
      expect(c.actual()).toBeCloseTo(c.expected, 2);
    });
  }
});
