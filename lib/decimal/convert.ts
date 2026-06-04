/**
 * Q-DEC PR 2.A — Decimal conversion + comparison utilities.
 *
 * Pure functions. No I/O. No globals. Every function is deterministic.
 *
 * **Policy boundaries (CLAUDE.md §0 architect lens):**
 *   - `toDecimal` is the ONLY allowed way to enter Decimal-land. Every
 *     boundary (DB read, API input, user form) calls this once.
 *   - `fromDecimal` is the ONLY allowed way to exit. Every boundary
 *     (API response, component prop, log line) calls this once.
 *   - Mid-computation MUST stay in Decimal — never round inside an
 *     engine. The shadow harness exists precisely to catch any rounding
 *     drift between the Float path and the Decimal path.
 */

import { Decimal } from './types';
import type { RoundingPolicy, DecimalDiff } from './types';

/**
 * Rounding precision per policy. Mirrors the Prisma column annotations
 * (`Decimal(19, 4)` for currency; `Decimal(9, 6)` for some rate columns).
 */
const POLICY_DECIMAL_PLACES: Record<RoundingPolicy, number> = {
  currency: 2,
  rate: 4,
  units: 4,
  percentage: 4,
};

/**
 * Default tolerance per policy. A diff is "within tolerance" iff it's
 * smaller than half the smallest representable unit at that policy's
 * decimal places — i.e. it rounds to the same display value.
 *   - Currency 2 dp → 0.005 (rounds to the same cent)
 *   - Rate     4 dp → 0.00005 (rounds to the same basis point at 4 dp)
 *   - Units    4 dp → 0.00005
 *   - Percent  4 dp → 0.00005
 */
const POLICY_TOLERANCE: Record<RoundingPolicy, Decimal> = {
  currency: new Decimal('0.005'),
  rate: new Decimal('0.00005'),
  units: new Decimal('0.00005'),
  percentage: new Decimal('0.00005'),
};

/**
 * The ONLY allowed entry into Decimal-land. Accepts:
 *   - `number` — coerced via string to avoid IEEE-754 rounding traps
 *     (`new Decimal(0.1 + 0.2)` would carry the Float error in).
 *   - `string` — parsed as-is.
 *   - `Decimal` — passthrough (idempotent).
 *   - `null` / `undefined` — return `null` (engine callers pass through
 *     missing values without crashing).
 *
 * IEEE-754 trap example: `0.1 + 0.2 === 0.30000000000000004`. If a
 * Float caller passes `0.3` to `new Decimal(0.3)` directly, decimal.js
 * preserves the binary error. Going via `String(0.3)` forces JS to
 * emit `"0.3"` first, which Decimal then parses cleanly.
 */
export function toDecimal(value: number | string | Decimal | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return new Decimal(String(value));
  }
  return new Decimal(value);
}

/**
 * Required variant — throws if the input is null/undefined/non-finite.
 * Use this when the caller has already validated the input is present
 * and a missing value indicates a real bug, not a benign nullable
 * column.
 */
export function toDecimalRequired(value: number | string | Decimal): Decimal {
  const result = toDecimal(value);
  if (result === null) {
    throw new TypeError(`toDecimalRequired: expected a finite numeric value, got ${value}`);
  }
  return result;
}

/**
 * The ONLY allowed exit from Decimal-land. Rounds per policy and emits
 * a `number` for the legacy Float-typed surface (API responses,
 * component props, log lines).
 *
 * Uses HALF_EVEN (banker's rounding) — the ATO standard for tax
 * computations and the only rounding mode that doesn't introduce
 * systematic upward drift over many operations.
 */
export function fromDecimal(value: Decimal | null, policy: RoundingPolicy = 'currency'): number {
  if (value === null) return 0;
  const dp = POLICY_DECIMAL_PLACES[policy];
  // Decimal.ROUND_HALF_EVEN === 6 in decimal.js's enum.
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_EVEN).toNumber();
}

/**
 * Sum a list of Decimal values. Convenience around `.plus()` for
 * engines that previously used `Array.reduce(sum + Number(x), 0)`.
 * Null values are skipped (treated as 0) to match the Float path's
 * `Number(x || 0)` pattern.
 */
export function sumDecimal(values: ReadonlyArray<Decimal | null | undefined>): Decimal {
  let total = new Decimal(0);
  for (const v of values) {
    if (v !== null && v !== undefined) total = total.plus(v);
  }
  return total;
}

/**
 * Compare a Float path output to a Decimal path output for the same
 * input. Returns a `DecimalDiff` the shadow harness can aggregate.
 *
 * `pctDiff` uses `max(|float|, |decimal|, epsilon=1)` as the
 * denominator — `epsilon=1` avoids dividing by zero when both
 * values are zero (the most common "no data" case).
 */
export function decimalDiff(
  floatValue: number,
  decimalValue: Decimal,
  policy: RoundingPolicy = 'currency',
): DecimalDiff {
  const floatAsDec = toDecimalRequired(floatValue);
  const absDiff = floatAsDec.minus(decimalValue).abs();
  const denominator = Decimal.max(floatAsDec.abs(), decimalValue.abs(), new Decimal(1));
  const pctDiff = absDiff.div(denominator);
  const tolerance = POLICY_TOLERANCE[policy];
  const withinTolerance = absDiff.lessThanOrEqualTo(tolerance);
  return {
    floatValue,
    decimalValue,
    absDiff,
    pctDiff,
    withinTolerance,
    policy,
    tolerance,
  };
}

/**
 * Convenience boolean wrapper for callers that just want yes/no.
 * Same tolerance logic as `decimalDiff`.
 */
export function isCloseEnough(
  floatValue: number,
  decimalValue: Decimal,
  policy: RoundingPolicy = 'currency',
): boolean {
  return decimalDiff(floatValue, decimalValue, policy).withinTolerance;
}

/**
 * Expose the policy table for callers that want to override tolerance
 * on a specific diff (e.g. a fixture that expects tighter precision
 * than the default).
 */
export function getPolicyTolerance(policy: RoundingPolicy): Decimal {
  return POLICY_TOLERANCE[policy];
}
