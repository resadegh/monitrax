/**
 * MON-131 Tranche −1b — Matrix Relay: route-vs-CLI single-implementation
 * parity + the three-outcome diff contract.
 *
 * Proves (precisely — §22.2.4): (1) the CLI script and BOTH baseline routes
 * import the ONE capture/diff module (`lib/matrix/goldenBaseline.ts`) and
 * define no second capture implementation; (2) `diffBaselines` yields exactly
 * the three outcomes with the documented verdict mapping; (3) the `plain()`
 * serializer normalises Map/Date/Decimal identically for both callers.
 * It does NOT prove any captured number is correct (Axis C of the Number
 * Ledger — stays with the Matrix), and it does NOT run a live capture (no DB
 * in CI).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/lib/db', () => ({ default: {} }));

import {
  plain,
  numericLeaves,
  diffBaselines,
  deployedSha,
  hashBaseline,
  RENDERED_PART_C,
} from '@/lib/matrix/goldenBaseline';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('single implementation — CLI and routes share lib/matrix/goldenBaseline', () => {
  const CLI = read('scripts/matrix/golden-baseline.mjs');
  const ROUTE_CAPTURE = read('app/api/admin/matrix/golden-baseline/route.ts');
  const ROUTE_DIFF = read('app/api/admin/matrix/golden-baseline/diff/route.ts');

  it('the CLI imports the module and hosts no capture table of its own', () => {
    expect(CLI).toContain("import('../../lib/matrix/goldenBaseline.ts')");
    expect(CLI).not.toMatch(/const\s+CAPTURES\s*=/);
    expect(CLI).not.toMatch(/function\s+plain\s*\(/);
    expect(CLI).not.toMatch(/getMasterFinancialSnapshot|getUserTaxPosition|computeCFOComponents/);
  });

  it('both routes import the module and host no capture/diff logic of their own', () => {
    for (const src of [ROUTE_CAPTURE, ROUTE_DIFF]) {
      expect(src).toContain("from '@/lib/matrix/goldenBaseline'");
      expect(src).not.toMatch(/const\s+CAPTURES\s*=/);
      expect(src).not.toMatch(/function\s+plain\s*\(/);
      expect(src).not.toMatch(/numericLeaves\s*\(/);
    }
    expect(ROUTE_DIFF).toContain('diffBaselines(');
  });

  it('the admin-only HR-3 prohibition is carried on every route', () => {
    for (const p of [
      'app/api/admin/matrix/golden-baseline/route.ts',
      'app/api/admin/matrix/golden-baseline/diff/route.ts',
      'app/api/admin/matrix/census/route.ts',
    ]) {
      expect(read(p), p).toContain('No user-facing');
    }
  });
});

describe('diffBaselines — three outcomes, only three', () => {
  const oldT = { 'a.ts:f': { x: 100, y: 200, list: [1, 2] } };

  it('CLEAN when nothing moved', () => {
    const d = diffBaselines(oldT, structuredClone(oldT));
    expect(d.verdict).toBe('CLEAN');
    expect(d.unchanged).toBe(4);
    expect(d.declared).toHaveLength(0);
    expect(d.unexpected).toHaveLength(0);
  });

  it('EXPECTED_ONLY when every move has a pathPrefix entry', () => {
    const d = diffBaselines(oldT, { 'a.ts:f': { x: 150, y: 200, list: [1, 2] } }, [
      { pathPrefix: 'a.ts:f.x', why: 'tranche N migration', arithmetic: '100 + 50' },
    ]);
    expect(d.verdict).toBe('EXPECTED_ONLY');
    expect(d.declared).toEqual([{ path: 'a.ts:f.x', old: 100, new: 150 }]);
    expect(d.unexpected).toHaveLength(0);
  });

  it('STOP when any figure moves undeclared — even alongside declared moves', () => {
    const d = diffBaselines(
      oldT,
      { 'a.ts:f': { x: 150, y: 999, list: [1, 2] } },
      [{ pathPrefix: 'a.ts:f.x' }],
    );
    expect(d.verdict).toBe('STOP');
    expect(d.unexpected).toEqual([{ path: 'a.ts:f.y', old: 200, new: 999 }]);
  });

  it('added and removed leaves are reported, never silently absorbed', () => {
    const d = diffBaselines(oldT, { 'a.ts:f': { x: 100, y: 200, list: [1, 2], z: 5 } });
    expect(d.added).toEqual(['a.ts:f.z']);
    const d2 = diffBaselines(oldT, { 'a.ts:f': { x: 100, list: [1, 2] } });
    expect(d2.removed).toEqual(['a.ts:f.y']);
  });

  it('sub-1e-9 float noise does not count as movement', () => {
    const d = diffBaselines({ k: { v: 0.1 + 0.2 } }, { k: { v: 0.3 } });
    expect(d.verdict).toBe('CLEAN');
  });
});

describe('plain() serializer — one normalisation for both callers', () => {
  it('Maps → objects, Dates → ISO, Decimal-likes → number, functions dropped', () => {
    const out = plain({
      m: new Map([['loan-1', { monthly: 1191 }]]),
      d: new Date('2026-07-29T00:00:00Z'),
      dec: { toNumber: () => 42.5 },
      fn: () => 1,
      n: null,
    }) as Record<string, unknown>;
    expect(out.m).toEqual({ 'loan-1': { monthly: 1191 } });
    expect(out.d).toBe('2026-07-29T00:00:00.000Z');
    expect(out.dec).toBe(42.5);
    expect('fn' in out).toBe(false);
    expect(out.n).toBeNull();
  });

  it('numericLeaves paths are stable across array + object nesting', () => {
    const m = new Map<string, number>();
    numericLeaves({ a: [{ b: 1 }, 2], c: { d: 3 } }, '', m);
    expect([...m.entries()]).toEqual([
      ['a[0].b', 1],
      ['a[1]', 2],
      ['c.d', 3],
    ]);
  });
});

describe('constants', () => {
  it('deployedSha never shells out and always returns a string', () => {
    expect(typeof deployedSha()).toBe('string');
  });

  it('RENDERED_PART_C pins the VR-041 figures', () => {
    expect(RENDERED_PART_C.netWorth).toBe(3401782);
    expect(RENDERED_PART_C.loansMonthly).toBe(12779);
    expect(RENDERED_PART_C.committed).toBe(14261);
  });
});

// T1 start-gate brief §1.2 — the canonical hash summary (`?format=hash`).
// Ratchet class: a partial capture must never masquerade as a full baseline
// (drift log D8 — the unpersisted 1,767-leaf capture is consistent with a
// silent __captureError tree at 0 numeric leaves).
describe('hashBaseline — THE canonical hash + the partial-capture tripwire', () => {
  const tree = {
    'a.ts:engineA': { x: 1, y: { z: 2.5 } },
    'b.ts:engineB': { list: [3, { w: 4 }] },
  };

  it('is deterministic and key-order independent', () => {
    const reordered = {
      'b.ts:engineB': { list: [3, { w: 4 }] },
      'a.ts:engineA': { y: { z: 2.5 }, x: 1 },
    };
    const h1 = hashBaseline(tree);
    const h2 = hashBaseline(reordered);
    expect(h1.treeHash).toBe(h2.treeHash);
    expect(h1.leafCount).toBe(4);
    expect(h1.perTree).toEqual({ 'a.ts:engineA': 2, 'b.ts:engineB': 2 });
    expect(h1.captureErrors).toEqual([]);
  });

  it('a single moved leaf changes the hash (the CLEAN/STOP gate basis)', () => {
    const moved = { ...tree, 'a.ts:engineA': { x: 1, y: { z: 2.6 } } };
    expect(hashBaseline(moved).treeHash).not.toBe(hashBaseline(tree).treeHash);
  });

  it('a failed capture is reported in captureErrors and contributes 0 numeric leaves', () => {
    const partial = {
      ...tree,
      'c.ts:engineC': { __captureError: 'timeout after 25s' },
    };
    const h = hashBaseline(partial);
    expect(h.captureErrors).toEqual(['c.ts:engineC']);
    expect(h.perTree['c.ts:engineC']).toBe(0);
    // trees count stays 3 while the numeric content silently lost engineC —
    // exactly why a non-empty captureErrors invalidates the baseline.
    expect(Object.keys(h.perTree)).toHaveLength(3);
    expect(h.leafCount).toBe(4);
  });
});
