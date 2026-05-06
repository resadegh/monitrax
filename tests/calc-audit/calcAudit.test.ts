/**
 * Phase 41i — Calculation Audit System tests.
 *
 * Three test groups:
 *   1. Registry — bootstrap, listing, category grouping, throws on
 *      duplicate / missing fixtures.
 *   2. Differential runner — assertion-based PASS/FAIL/ERROR; handles
 *      async engines; aggregates the report.
 *   3. End-to-end — runs the full differential against every
 *      registered engine in the app and expects 0 failures
 *      (ensures no engine has regressed since fixture lock-in).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  calcEngineRegistry,
  runDifferential,
  runOne,
} from '@/lib/calc-audit';
import type { CalcEngine } from '@/lib/calc-audit';

beforeAll(() => {
  // Importing `@/lib/calc-audit` auto-bootstraps the registry; no
  // additional setup needed.
});

describe('calcEngineRegistry — bootstrap + structure', () => {
  it('registers engines from every category (TAX / CORE / PROPERTY)', () => {
    const buckets = calcEngineRegistry.byCategory();
    expect(buckets.TAX?.length ?? 0).toBeGreaterThan(0);
    expect(buckets.CORE?.length ?? 0).toBeGreaterThan(0);
    expect(buckets.PROPERTY?.length ?? 0).toBeGreaterThan(0);
  });

  it('lists engines alphabetically (locale-aware)', () => {
    const names = calcEngineRegistry.list().map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('every registered engine has at least one fixture', () => {
    for (const e of calcEngineRegistry.list()) {
      expect(e.fixtures.length).toBeGreaterThan(0);
    }
  });

  it('every fixture has at least one assertion', () => {
    for (const e of calcEngineRegistry.list()) {
      for (const f of e.fixtures) {
        expect(f.assertions.length).toBeGreaterThan(0);
      }
    }
  });

  it('every engine has sourcePath pointing at lib/', () => {
    for (const e of calcEngineRegistry.list()) {
      expect(e.sourcePath.startsWith('lib/')).toBe(true);
    }
  });

  it('totalFixtures matches the sum of per-engine fixtures', () => {
    const sum = calcEngineRegistry
      .list()
      .reduce((acc, e) => acc + e.fixtures.length, 0);
    expect(calcEngineRegistry.totalFixtures()).toBe(sum);
  });

  it('throws on duplicate registration', () => {
    const existing = calcEngineRegistry.list()[0];
    expect(() => calcEngineRegistry.register(existing)).toThrow(/already registered/);
  });

  it('throws when registering an engine without fixtures', () => {
    expect(() =>
      calcEngineRegistry.register({
        name: '__test__.empty',
        description: 'has no fixtures',
        category: 'OTHER',
        sourcePath: 'lib/__test__/empty.ts',
        execute: () => 0,
        fixtures: [],
      }),
    ).toThrow(/at least one fixture/i);
  });
});

describe('runDifferential — full app sweep', () => {
  it('produces a report covering every registered fixture', async () => {
    const report = await runDifferential();
    expect(report.totalEngines).toBe(calcEngineRegistry.size());
    expect(report.totalFixtures).toBe(calcEngineRegistry.totalFixtures());
    expect(report.results.length).toBe(report.totalFixtures);
  });

  it('every fixture passes against the current engine implementation (drift baseline)', async () => {
    const report = await runDifferential();
    const failures = report.results.filter((r) => r.status !== 'PASS');
    if (failures.length > 0) {
      const detail = failures
        .map(
          (f) =>
            `${f.engineName}::${f.fixtureName} [${f.status}] ${
              f.failedAssertions?.join('; ') ?? f.errorMessage ?? ''
            }`,
        )
        .join('\n');
      throw new Error(`Calc audit drift detected:\n${detail}`);
    }
    expect(report.failed).toBe(0);
    expect(report.errored).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });

  it('records duration for each fixture', async () => {
    const report = await runDifferential();
    for (const r of report.results) {
      expect(typeof r.durationMs).toBe('number');
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('runOne — fixture detection', () => {
  it('PASS when assertions hold', async () => {
    const fakeEngine: CalcEngine<{ x: number }, { y: number }> = {
      name: '__test__.passing',
      description: 'always returns y = 2x',
      category: 'OTHER',
      sourcePath: 'lib/__test__/fake.ts',
      execute: (input) => ({ y: input.x * 2 }),
      fixtures: [
        {
          name: 'simple',
          description: 'x=5 → y=10',
          input: { x: 5 },
          assertions: [
            { description: 'y is 10', check: (r) => r.y === 10 },
          ],
        },
      ],
    };
    const result = await runOne(fakeEngine, fakeEngine.fixtures[0]);
    expect(result.status).toBe('PASS');
  });

  it('FAIL when an assertion misses, with assertion description in failedAssertions', async () => {
    const fakeEngine: CalcEngine<{ x: number }, { y: number }> = {
      name: '__test__.failing',
      description: 'returns wrong y',
      category: 'OTHER',
      sourcePath: 'lib/__test__/fake.ts',
      execute: () => ({ y: 999 }),
      fixtures: [
        {
          name: 'detect drift',
          description: 'expects y=10 but engine returns 999',
          input: { x: 5 },
          assertions: [
            { description: 'y must be 10', check: (r) => r.y === 10 },
            { description: 'y must be positive', check: (r) => r.y > 0 },
          ],
        },
      ],
    };
    const result = await runOne(fakeEngine, fakeEngine.fixtures[0]);
    expect(result.status).toBe('FAIL');
    expect(result.failedAssertions).toContain('y must be 10');
    expect(result.failedAssertions).not.toContain('y must be positive');
  });

  it('ERROR when engine throws, with error message captured', async () => {
    const fakeEngine: CalcEngine<{ x: number }, number> = {
      name: '__test__.throwing',
      description: 'always throws',
      category: 'OTHER',
      sourcePath: 'lib/__test__/fake.ts',
      execute: () => {
        throw new Error('boom');
      },
      fixtures: [
        {
          name: 'oops',
          description: 'engine crashes',
          input: { x: 1 },
          assertions: [{ description: 'never runs', check: () => true }],
        },
      ],
    };
    const result = await runOne(fakeEngine, fakeEngine.fixtures[0]);
    expect(result.status).toBe('ERROR');
    expect(result.errorMessage).toContain('boom');
  });

  it('handles async engine.execute()', async () => {
    const fakeEngine: CalcEngine<{ x: number }, { y: number }> = {
      name: '__test__.async',
      description: 'async engine',
      category: 'OTHER',
      sourcePath: 'lib/__test__/fake.ts',
      execute: async (input) => ({ y: input.x * 3 }),
      fixtures: [
        {
          name: 'async pass',
          description: 'x=4 → y=12',
          input: { x: 4 },
          assertions: [{ description: 'y is 12', check: (r) => r.y === 12 }],
        },
      ],
    };
    const result = await runOne(fakeEngine, fakeEngine.fixtures[0]);
    expect(result.status).toBe('PASS');
  });

  it('catches thrown assertion (treats as failed assertion)', async () => {
    const fakeEngine: CalcEngine<{ x: number }, { y: number }> = {
      name: '__test__.assertion-throws',
      description: 'assertion throws',
      category: 'OTHER',
      sourcePath: 'lib/__test__/fake.ts',
      execute: () => ({ y: 1 }),
      fixtures: [
        {
          name: 'throwing assertion',
          description: 'predicate throws',
          input: { x: 1 },
          assertions: [
            {
              description: 'this throws',
              check: () => {
                throw new Error('predicate boom');
              },
            },
          ],
        },
      ],
    };
    const result = await runOne(fakeEngine, fakeEngine.fixtures[0]);
    expect(result.status).toBe('FAIL');
    expect(result.failedAssertions?.[0]).toContain('predicate boom');
  });
});

describe('Per-engine fixture coverage (HR-3 — every engine auditable)', () => {
  it('TAX category includes capTracker, GST, NSW land tax, NSW stamp duty, loss rules', () => {
    const taxNames = calcEngineRegistry
      .list()
      .filter((e) => e.category === 'TAX')
      .map((e) => e.name);
    expect(taxNames).toContain('tax.capTracker');
    expect(taxNames).toContain('tax.gstCalculator');
    expect(taxNames).toContain('tax.landTax.NSW');
    expect(taxNames).toContain('tax.stampDuty.NSW');
    expect(taxNames).toContain('tax.trustLossRules');
    expect(taxNames).toContain('tax.companyLossRules');
    expect(taxNames).toContain('tax.crossStateLandTax');
  });

  it('CORE category includes net worth, income, expense, loan aggregators', () => {
    const coreNames = calcEngineRegistry
      .list()
      .filter((e) => e.category === 'CORE')
      .map((e) => e.name);
    expect(coreNames).toContain('core.netWorth');
    expect(coreNames).toContain('core.incomeAggregator');
    expect(coreNames).toContain('core.expenseAggregator');
    expect(coreNames).toContain('core.loanAggregator');
  });

  it('PROPERTY category includes LVR, equity, rental yield', () => {
    const propNames = calcEngineRegistry
      .list()
      .filter((e) => e.category === 'PROPERTY')
      .map((e) => e.name);
    expect(propNames).toContain('property.LVR');
    expect(propNames).toContain('property.equity');
    expect(propNames).toContain('property.rentalYield');
  });
});
