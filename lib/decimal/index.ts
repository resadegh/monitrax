/**
 * Q-DEC PR 2.A — Decimal precision foundation public surface.
 *
 * Q-DEC is the precision foundation that unblocks Phase 45's 10-year
 * What-If projections. 10-year horizons compound Float rounding error
 * to visibly-wrong cents; the entire product promise is "regulator-
 * grade accuracy, every number traceable." Pre-revenue is the cheap
 * time to fix it.
 *
 * **Sequence (per `docs/IMPLEMENTATION_PLAN.md` workstream 0·WI):**
 *   - PR 1 / 1.5 ✅ MERGED — additive `*_decimal` columns on every
 *     money-bearing model (PR #974 + PR #975).
 *   - PR 2 (now, split A-E) — engines compose Decimal end-to-end and
 *     return BOTH paths (back-compat). Shadow-comparison harness
 *     catches any drift between paths.
 *   - PR 3 — route handlers + components consume Decimal; Float
 *     removed from engine signatures.
 *   - PR 4 — Float DB columns dropped (after 7-day parallel-run
 *     shows zero diff; CLAUDE.md §12.11 destructive-write checklist
 *     mandatory).
 *
 * **Architectural rules (CLAUDE.md §0 architect lens + §12.2 SSOT):**
 *   - The ONLY entry to Decimal-land is `toDecimal` / `toDecimalRequired`.
 *   - The ONLY exit is `fromDecimal`.
 *   - Mid-computation MUST stay in Decimal — never round inside an
 *     engine. Rounding only happens at the OUTPUT boundary.
 *   - Engines compose via `sumDecimal`, `.plus`, `.minus`, `.times`,
 *     `.div` — never via `+`, `-`, `*`, `/` (those would silently
 *     coerce to Float).
 */

export { Decimal } from './types';
export type {
  MoneyValue,
  RoundingPolicy,
  DecimalDiff,
  ShadowComparisonResult,
  ShadowComparisonReport,
} from './types';

export {
  toDecimal,
  toDecimalRequired,
  fromDecimal,
  sumDecimal,
  decimalDiff,
  isCloseEnough,
  getPolicyTolerance,
} from './convert';
