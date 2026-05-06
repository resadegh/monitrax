/**
 * Phase 41i — L1 Differential runner.
 *
 * Runs every registered calc engine's fixtures and produces a
 * `DifferentialReport`. CI calls this via `npm run audit:fixtures`
 * (script wired up in `package.json`). The admin portal also calls
 * it on demand to refresh the dashboard.
 *
 * **Determinism contract**: this runner is pure — no DB, no clock
 * dependencies (other than `Date.now()` for timing), no network.
 * Same registered engines + same fixtures → same output.
 *
 * **Assertion-based**: each fixture defines a list of independent
 * `check(actual)` predicates. Fixture passes iff every assertion
 * passes. Failure surface lists *which* assertions failed — high
 * signal for the admin queue.
 */

import { calcEngineRegistry } from './registry';
import type {
  CalcEngine,
  CalcFixture,
  DifferentialReport,
  FixtureRunResult,
} from './types';

export async function runDifferential(): Promise<DifferentialReport> {
  const startedAt = new Date().toISOString();
  const engines = calcEngineRegistry.list();
  const results: FixtureRunResult[] = [];

  for (const engine of engines) {
    for (const fixture of engine.fixtures) {
      results.push(await runOne(engine, fixture));
    }
  }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    totalEngines: engines.length,
    totalFixtures: calcEngineRegistry.totalFixtures(),
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    errored: results.filter((r) => r.status === 'ERROR').length,
    results,
  };
}

export async function runOne<TInput, TOutput>(
  engine: CalcEngine<TInput, TOutput>,
  fixture: CalcFixture<TInput, TOutput>,
): Promise<FixtureRunResult> {
  const start = Date.now();
  try {
    const actual = await Promise.resolve(engine.execute(fixture.input));
    const failed: string[] = [];
    for (const a of fixture.assertions) {
      try {
        if (!a.check(actual)) failed.push(a.description);
      } catch (err) {
        failed.push(
          `${a.description} — assertion threw: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    const durationMs = Date.now() - start;
    if (failed.length === 0) {
      return {
        engineName: engine.name,
        fixtureName: fixture.name,
        status: 'PASS',
        durationMs,
      };
    }
    return {
      engineName: engine.name,
      fixtureName: fixture.name,
      status: 'FAIL',
      failedAssertions: failed,
      durationMs,
    };
  } catch (err) {
    return {
      engineName: engine.name,
      fixtureName: fixture.name,
      status: 'ERROR',
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
