/**
 * Q-DEC PR 2.A — Decimal types.
 *
 * Public types for the Decimal precision foundation. Engines compose
 * `Decimal` end-to-end without ever rounding mid-computation; the only
 * rounding happens at the OUTPUT boundary (currency 2dp, rates 4dp,
 * units 4dp, percentages 4dp) per `RoundingPolicy` below.
 *
 * **Why a discriminated `MoneyValue` union?**
 * During PR 2 every engine returns BOTH the legacy Float path and
 * the new Decimal path so callers don't break. PR 3 swaps the
 * primary to Decimal. PR 4 drops Float entirely. The discriminator
 * lets the shadow-comparison harness know which value came from
 * which path without trusting the engine's word.
 *
 * **Why `Prisma.Decimal` (decimal.js under the hood)?**
 * Prisma's `@prisma/client` re-exports `Decimal` from `decimal.js`.
 * Using Prisma's re-export means we don't add a runtime dependency,
 * we don't fork the type, and DB-resident Decimal columns flow
 * through the engines without conversion.
 */

import { Prisma } from '@prisma/client';

export type Decimal = Prisma.Decimal;
export const Decimal = Prisma.Decimal;

/**
 * Discriminated `MoneyValue`. The `kind` tag tells the shadow-harness
 * which path produced the value — never trust the engine's claim,
 * always check the discriminator.
 */
export type MoneyValue =
  | { kind: 'float'; value: number }
  | { kind: 'decimal'; value: Decimal };

/**
 * Rounding policy at the output boundary. Internal arithmetic stays
 * at decimal.js's default 20-significant-figure precision; rounding
 * only happens when the value LEAVES the engine.
 *
 * - Currency: 2 dp, HALF_EVEN (banker's rounding — ATO standard for
 *   tax computations to avoid systematic upward drift).
 * - Rates: 4 dp, HALF_EVEN (interest rates, marginal rates).
 * - Units: 4 dp, HALF_EVEN (share quantities, allocation fractions).
 * - Percentages: 4 dp, HALF_EVEN (LVR, allocation %).
 */
export type RoundingPolicy = 'currency' | 'rate' | 'units' | 'percentage';

/**
 * Result of comparing a Float-path output and a Decimal-path output
 * for the same input. Used by the shadow-comparison harness.
 *
 * - `absDiff` — `|float - decimal|` as a Decimal.
 * - `pctDiff` — `absDiff / max(|float|, |decimal|, epsilon)` as a Decimal.
 * - `withinTolerance` — true iff `absDiff <= tolerance`.
 *
 * The tolerance is policy-driven: currency comparisons default to
 * 0.005 (rounds to the same cent), rates to 0.00005 (rounds to the
 * same basis point at 4 dp), etc.
 */
export interface DecimalDiff {
  floatValue: number;
  decimalValue: Decimal;
  absDiff: Decimal;
  pctDiff: Decimal;
  withinTolerance: boolean;
  policy: RoundingPolicy;
  tolerance: Decimal;
}

/**
 * Outcome of one shadow-comparison run. Aggregates the per-field
 * diffs. Status PASS iff every diff is `withinTolerance`.
 */
export interface ShadowComparisonResult {
  engineName: string;
  fixtureName: string;
  status: 'PASS' | 'DIFF' | 'ERROR';
  /** Map of result-field name → diff. Empty when status === 'ERROR'. */
  diffs: Record<string, DecimalDiff>;
  /** Fields whose `withinTolerance === false`. */
  failedFields: string[];
  errorMessage?: string;
  durationMs: number;
}

/**
 * Aggregated report — mirrors `DifferentialReport` for the existing
 * Phase 41I harness so the admin portal can render both views.
 */
export interface ShadowComparisonReport {
  startedAt: string;
  completedAt: string;
  totalEngines: number;
  totalFixtures: number;
  passed: number;
  diffed: number;
  errored: number;
  results: ShadowComparisonResult[];
}
