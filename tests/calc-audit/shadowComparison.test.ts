/**
 * Q-DEC PR 2.A — Shadow comparison harness tests.
 *
 * Mechanical tests of the harness itself — does it flatten outputs,
 * does it pair Float-vs-Decimal correctly, does it surface DIFF,
 * does it survive engine throws.
 *
 * The net-worth shadow run lives in
 * `tests/calculations/netWorthCalculator.decimal.test.ts` — that's
 * the real end-to-end proof.
 */

import { describe, it, expect } from 'vitest';
import {
  runShadowComparison,
  runShadowComparisonReport,
  type ShadowEngine,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';

// A minimal engine that returns a flat numeric result. Float-side
// pre-rounds at every step (introduces error); Decimal-side stays
// exact and only converts at the boundary.
const cleanEngine: ShadowEngine<{ a: number; b: number }, { sum: number }, { sum: Decimal }> = {
  name: 'mech.cleanSum',
  description: 'a + b — should match exactly across paths.',
  sourcePath: 'tests/calc-audit/shadowComparison.test.ts',
  floatExecute: ({ a, b }) => ({ sum: a + b }),
  decimalExecute: ({ a, b }) => ({ sum: new Decimal(String(a)).plus(new Decimal(String(b))) }),
  fixtures: [
    {
      name: 'simple integer add',
      description: '1 + 2 = 3',
      input: { a: 1, b: 2 },
    },
    {
      name: '0.1 + 0.2 IEEE-754 trap',
      description: 'Float says 0.30000000000000004; Decimal says 0.3. Diff < currency tolerance.',
      input: { a: 0.1, b: 0.2 },
    },
  ],
};

// Engine that deliberately disagrees more than currency tolerance —
// to prove DIFF surfaces correctly.
const driftingEngine: ShadowEngine<{ x: number }, { y: number }, { y: Decimal }> = {
  name: 'mech.driftingSum',
  description: 'Float path is biased by +0.5; Decimal path is exact.',
  sourcePath: 'tests/calc-audit/shadowComparison.test.ts',
  floatExecute: ({ x }) => ({ y: x + 0.5 }),
  decimalExecute: ({ x }) => ({ y: new Decimal(String(x)) }),
  fixtures: [
    { name: 'baseline drift', description: 'Should surface DIFF.', input: { x: 100 } },
  ],
};

// Engine with nested output structure — tests the flatten().
const nestedEngine: ShadowEngine<
  { v: number },
  { outer: { inner: number; sibling: number }; top: number },
  { outer: { inner: Decimal; sibling: Decimal }; top: Decimal }
> = {
  name: 'mech.nested',
  description: 'Tests flatten() on nested output objects.',
  sourcePath: 'tests/calc-audit/shadowComparison.test.ts',
  floatExecute: ({ v }) => ({ outer: { inner: v, sibling: v * 2 }, top: v * 3 }),
  decimalExecute: ({ v }) => {
    const d = new Decimal(String(v));
    return {
      outer: { inner: d, sibling: d.times(2) },
      top: d.times(3),
    };
  },
  fixtures: [{ name: 'value 10', description: '', input: { v: 10 } }],
};

// Engine whose Decimal path throws — proves ERROR status surfaces.
const throwingEngine: ShadowEngine<{ x: number }, { y: number }, { y: Decimal }> = {
  name: 'mech.throwing',
  description: 'Decimal path throws — should surface ERROR.',
  sourcePath: 'tests/calc-audit/shadowComparison.test.ts',
  floatExecute: ({ x }) => ({ y: x }),
  decimalExecute: () => {
    throw new Error('boom');
  },
  fixtures: [{ name: 'any input', description: '', input: { x: 1 } }],
};

describe('runShadowComparison — single fixture', () => {
  it('PASS when paths agree to within currency tolerance', async () => {
    const result = await runShadowComparison(cleanEngine, cleanEngine.fixtures[0]);
    expect(result.status).toBe('PASS');
    expect(result.failedFields).toEqual([]);
    expect(result.diffs.sum.withinTolerance).toBe(true);
  });

  it('PASS on the 0.1+0.2 trap — diff is within currency tolerance', async () => {
    const result = await runShadowComparison(cleanEngine, cleanEngine.fixtures[1]);
    expect(result.status).toBe('PASS');
    // The diff exists (Float drifts by ~4e-17), but it's under 0.005.
    expect(result.diffs.sum.absDiff.lessThan(new Decimal('0.005'))).toBe(true);
  });

  it('DIFF when paths disagree beyond tolerance', async () => {
    const result = await runShadowComparison(driftingEngine, driftingEngine.fixtures[0]);
    expect(result.status).toBe('DIFF');
    expect(result.failedFields).toContain('y');
    expect(result.diffs.y.absDiff.equals(new Decimal('0.5'))).toBe(true);
  });

  it('ERROR when an engine throws', async () => {
    const result = await runShadowComparison(throwingEngine, throwingEngine.fixtures[0]);
    expect(result.status).toBe('ERROR');
    expect(result.errorMessage).toBe('boom');
  });
});

describe('flatten on nested outputs', () => {
  it('compares nested object fields independently', async () => {
    const result = await runShadowComparison(nestedEngine, nestedEngine.fixtures[0]);
    expect(result.status).toBe('PASS');
    // Each leaf gets its own path entry.
    expect(Object.keys(result.diffs).sort()).toEqual(
      ['outer.inner', 'outer.sibling', 'top'].sort(),
    );
  });
});

describe('runShadowComparisonReport — aggregation', () => {
  it('aggregates pass/diff/error counts and lists every result', async () => {
    const report = await runShadowComparisonReport([cleanEngine, driftingEngine, throwingEngine]);
    expect(report.totalEngines).toBe(3);
    expect(report.totalFixtures).toBe(4); // 2 + 1 + 1
    expect(report.passed).toBe(2);
    expect(report.diffed).toBe(1);
    expect(report.errored).toBe(1);
    expect(report.results).toHaveLength(4);
  });
});
