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
