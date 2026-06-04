/**
 * Q-DEC PR 2.A — Shadow comparison harness.
 *
 * Extends the Phase 41I differential runner with a parallel-run
 * comparator: given a single fixture input, run BOTH the Float
 * engine and the Decimal engine, and produce a `DecimalDiff` for
 * every result field.
 *
 * **Why this exists.** Q-DEC PR 3 will swap the canonical engine
 * output from Float to Decimal. Before that's safe, we need
 * cross-checked evidence that the two paths produce the same
 * answer to within policy tolerance for every fixture across every
 * engine. This harness is how that evidence is produced.
 *
 * **Determinism contract** (same as `runDifferential.ts`): no DB,
 * no clock dependencies (other than `Date.now()` for timing), no
 * network. Same fixtures + same engines → same output.
 *
 * **Tolerance** is policy-driven (`lib/decimal/convert.ts:POLICY_TOLERANCE`):
 *   - Currency 2 dp → 0.005 (rounds to the same cent)
 *   - Rate     4 dp → 0.00005
 *   - Units    4 dp → 0.00005
 *   - Percent  4 dp → 0.00005
 * A field can override its policy in the per-field map passed to
 * `runShadowComparison`.
 */

import { Decimal } from '@/lib/decimal';
import { decimalDiff } from '@/lib/decimal';
import type {
  DecimalDiff,
  RoundingPolicy,
  ShadowComparisonResult,
  ShadowComparisonReport,
} from '@/lib/decimal/types';

/**
 * The function-under-shadow. Engines registered for shadow comparison
 * provide a `floatExecute` (the legacy Float path, returning a flat
 * object of `number`s) and a `decimalExecute` (the new Decimal path,
 * returning the same shape but with `Decimal` values).
 *
 * Both functions MUST accept the same input. Both functions MUST
 * return objects with the same keys.
 */
export interface ShadowEngine<TInput, TOutputFloat, TOutputDecimal> {
  name: string;
  description: string;
  sourcePath: string;
  floatExecute: (input: TInput) => TOutputFloat | Promise<TOutputFloat>;
  decimalExecute: (input: TInput) => TOutputDecimal | Promise<TOutputDecimal>;
  /**
   * Per-field rounding policy. Field name → policy. Unlisted fields
   * default to 'currency' tolerance.
   *
   * Example: `{ netWorth: 'currency', interestRate: 'rate' }`.
   */
  fieldPolicy?: Record<string, RoundingPolicy>;
  fixtures: ReadonlyArray<{
    name: string;
    description: string;
    input: TInput;
  }>;
}

/**
 * Run one fixture through both engines and produce a per-field diff.
 *
 * Implementation notes:
 *   - We recursively flatten the output objects into `path.to.field`
 *     keys so that nested-object outputs (e.g. `NetWorthResult.breakdown.*`)
 *     get compared field-by-field, not as opaque objects.
 *   - The flatten walks the FLOAT output's keys (canonical source); a
 *     Decimal-side key that's missing from Float surfaces as a failed
 *     field at the path that DID exist.
 *   - Arrays are walked positionally; mismatched lengths fail the run.
 */
export async function runShadowComparison<TInput, TOutputFloat, TOutputDecimal>(
  engine: ShadowEngine<TInput, TOutputFloat, TOutputDecimal>,
  fixture: ShadowEngine<TInput, TOutputFloat, TOutputDecimal>['fixtures'][number],
): Promise<ShadowComparisonResult> {
  const start = Date.now();
  try {
    const [floatOutput, decimalOutput] = await Promise.all([
      Promise.resolve(engine.floatExecute(fixture.input)),
      Promise.resolve(engine.decimalExecute(fixture.input)),
    ]);

    const floatFlat = flatten(floatOutput);
    const decimalFlat = flatten(decimalOutput);

    const diffs: Record<string, DecimalDiff> = {};
    const failedFields: string[] = [];
    const fieldPolicy = engine.fieldPolicy ?? {};

    for (const [path, floatValue] of Object.entries(floatFlat)) {
      const decimalValue = decimalFlat[path];
      if (decimalValue === undefined) {
        failedFields.push(`${path} — missing on Decimal path`);
        continue;
      }
      const policy = fieldPolicy[path] ?? 'currency';
      const diff = decimalDiff(
        toNumber(floatValue),
        toDecimalSafe(decimalValue),
        policy,
      );
      diffs[path] = diff;
      if (!diff.withinTolerance) {
        failedFields.push(path);
      }
    }

    // Any Decimal-side key absent from Float-side surfaces as a diff too
    // (catches the "engine returns extra fields" bug).
    for (const path of Object.keys(decimalFlat)) {
      if (!(path in floatFlat)) {
        failedFields.push(`${path} — missing on Float path`);
      }
    }

    const status = failedFields.length === 0 ? 'PASS' : 'DIFF';
    return {
      engineName: engine.name,
      fixtureName: fixture.name,
      status,
      diffs,
      failedFields,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      engineName: engine.name,
      fixtureName: fixture.name,
      status: 'ERROR',
      diffs: {},
      failedFields: [],
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Aggregate a list of shadow engines into a single report. Mirrors the
 * `DifferentialReport` shape for the existing Phase 41I harness so the
 * admin portal can render both views with the same renderer.
 */
export async function runShadowComparisonReport(
  engines: ReadonlyArray<ShadowEngine<unknown, unknown, unknown>>,
): Promise<ShadowComparisonReport> {
  const startedAt = new Date().toISOString();
  const results: ShadowComparisonResult[] = [];
  let totalFixtures = 0;
  for (const engine of engines) {
    for (const fixture of engine.fixtures) {
      totalFixtures += 1;
      results.push(await runShadowComparison(engine, fixture));
    }
  }
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    totalEngines: engines.length,
    totalFixtures,
    passed: results.filter((r) => r.status === 'PASS').length,
    diffed: results.filter((r) => r.status === 'DIFF').length,
    errored: results.filter((r) => r.status === 'ERROR').length,
    results,
  };
}

/**
 * Flatten a nested object/array into `path.to.field` → leaf. Leaves
 * are anything that isn't a plain object or an array — numbers,
 * strings, booleans, Decimals, null/undefined. Decimals are NOT
 * recursed into (they're terminal scalars from the comparator's
 * point of view).
 */
function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (value === null || value === undefined) return { [prefix]: value };
  if (value instanceof Decimal) return { [prefix]: value };
  if (typeof value !== 'object') return { [prefix]: value };
  const out: Record<string, unknown> = {};
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const childPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
      Object.assign(out, flatten(item, childPrefix));
    });
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const childPrefix = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flatten(v, childPrefix));
  }
  return out;
}

/**
 * Coerce a leaf value from the Float-flattened object to a number.
 * Skips comparison cleanly for null/undefined by returning 0 — the
 * Float engine's `Number(x || 0)` convention.
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal) return value.toNumber();
  if (typeof value === 'string') return Number(value);
  return 0;
}

/**
 * Coerce a leaf value from the Decimal-flattened object to a Decimal.
 * If the Decimal path returned a `number` (engine bug — should have
 * returned a Decimal), we coerce defensively so the diff is computed
 * and the fixture surfaces the issue rather than throwing.
 */
function toDecimalSafe(value: unknown): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) return new Decimal(0);
  if (typeof value === 'number') return new Decimal(String(value));
  if (typeof value === 'string') return new Decimal(value);
  return new Decimal(0);
}
