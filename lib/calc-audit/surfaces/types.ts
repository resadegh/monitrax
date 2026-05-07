/**
 * Phase 41i.6 — Surface-level numerical audit types.
 *
 * Every user-facing financial tile / page / surface registers a
 * `SurfaceDescriptor`. The 41i.6c runtime audit harness:
 *   1. Calls the descriptor's `invokeCanonicalSource(userId)`
 *   2. Projects the result via `extractRenderedValue`
 *   3. Compares against the actual rendered DOM value (or the
 *      component's data-binding path)
 *   4. Persists a finding when the diff exceeds tolerance
 *
 * Per spec doc §10 (admin UI) — every L4_SURFACE_AUDIT finding renders
 * with the descriptor's full canonical chain (`surfaceId` / `route` /
 * `canonicalSource.{service,method,fieldPath}` / canonicalValue /
 * renderedValue / diff / userId).
 *
 * **Stable identifier rule**: `surfaceId` is the audit-finding key;
 * never rename. New tiles get new ids; refactored tiles update the
 * `extractRenderedValue` projection but keep the id stable.
 */

import 'server-only';

/**
 * Diff tolerance for the audit harness. Per D-41i.6-2 (sign-off block):
 *   - AUD: zero cents (absolute = 0)
 *   - Ratios / percentages: 0.01 (one basis point)
 *   - Health scores (0-100): 0.5 (half a point)
 *
 * Defaults documented in `DEFAULT_TOLERANCE_BY_KIND`. Each descriptor
 * may override via the `tolerance` field.
 */
export interface DiffTolerance {
  /** Absolute units — for AUD, this is in cents; for scores, half-points. */
  absolute?: number;
  /** Relative — for ratios + percentages. 0.01 = 1bp. */
  relative?: number;
}

/**
 * The "kind" classifies the surface's value type so the audit harness
 * can apply the right default tolerance + format the diff message
 * appropriately on the admin UI.
 */
export type SurfaceValueKind =
  | 'AUD'        // Currency — exact match (zero cents tolerance by default)
  | 'PERCENT'    // Percentage 0..100 or 0..1 — 1bp tolerance default
  | 'RATIO'      // Ratio — 1bp tolerance default
  | 'SCORE'      // 0..100 score — 0.5pt tolerance default
  | 'COUNT'      // Integer count — exact match
  | 'MONTHS'     // Months count (e.g. "months covered" emergency fund) — exact match
  | 'DATE';      // ISO date — exact match (string compare)

export const DEFAULT_TOLERANCE_BY_KIND: Record<SurfaceValueKind, DiffTolerance> = {
  AUD: { absolute: 0 },
  PERCENT: { relative: 0.01 },
  RATIO: { relative: 0.01 },
  SCORE: { absolute: 0.5 },
  COUNT: { absolute: 0 },
  MONTHS: { absolute: 0 },
  DATE: { absolute: 0 },
};

/**
 * Metadata fields used by:
 *   - the admin UI (display chain to the operator)
 *   - the 41i.6b CI static-analysis pass (greps component imports
 *     against the registered `service` to flag inline math on a
 *     surface that should consume from canonical instead)
 *   - documentation (every descriptor IS the spec for that surface)
 */
export interface CanonicalSourceMetadata {
  /**
   * Module path (relative to repo root) — e.g.
   * `lib/services/masterFinancialService.ts`. Used by the static-
   * analysis pass + the admin-UI display.
   */
  service: string;
  /**
   * Function / method name — e.g. `getMasterFinancialSnapshot`. Used
   * by the static-analysis pass + the admin-UI display.
   */
  method: string;
  /**
   * Dotted field path on the returned object — e.g.
   * `cashflow.monthly`. Used by the admin-UI display + as the
   * audit-finding's path label.
   */
  fieldPath: string;
}

/**
 * Optional render conditions — the harness skips firing a finding
 * when the canonical value matches one of these (e.g. the tile
 * shows "—" instead of "$0" so a zero-canonical-value matches the
 * "—" render).
 */
export interface RenderConditions {
  skipWhenZero?: boolean;
  skipWhenNull?: boolean;
}

export interface SurfaceDescriptor {
  /**
   * Stable identifier — never rename. Used as the audit-finding key
   * on the `CalcAuditFinding.engineName` column (the existing schema
   * field repurposes `engineName` for surfaces — same column, same
   * lifecycle).
   */
  surfaceId: string;

  /** Human-readable description for the admin queue card. */
  description: string;

  /** Route the surface lives on (clickable deeplink in the admin UI). */
  route: string;

  /** What kind of value this surface renders — drives default tolerance. */
  kind: SurfaceValueKind;

  /** Documentation + static-analysis metadata for the canonical source. */
  canonicalSource: CanonicalSourceMetadata;

  /**
   * Diff tolerance (overrides the `kind`-based default). Most descriptors
   * leave this undefined and inherit the default.
   */
  tolerance?: DiffTolerance;

  /**
   * Runtime invoker — called by the audit harness with the target
   * userId. Returns whatever the canonical source returns; the harness
   * passes the result to `extractRenderedValue`. Throws are caught
   * by the harness and surfaced as INFO-severity findings (the source
   * itself is broken, not a divergence).
   */
  invokeCanonicalSource: (userId: string) => Promise<unknown>;

  /**
   * Project the source result to the single number this surface
   * renders. Returns `null` when the surface would render "—" or be
   * absent — the harness checks `renderConditions` to decide whether
   * to skip the finding.
   */
  extractRenderedValue: (sourceResult: unknown) => number | null;

  /**
   * Optional — when the surface has any conditional rendering logic,
   * describe it here so the harness doesn't fire spurious findings
   * for the zero/null state.
   */
  renderConditions?: RenderConditions;
}

/**
 * Helper — given a descriptor and a concrete diff (canonical vs
 * rendered), decide if the diff exceeds the descriptor's tolerance.
 *
 * Rules (per spec doc §10 + D-41i.6-2):
 *   - A perfect match (absDiff = 0) NEVER exceeds tolerance.
 *   - When `absolute` is set: any divergence within `absolute` units
 *     does NOT exceed (regardless of `relative`).
 *   - When `relative` is set: any divergence within `relative` ratio
 *     of the canonical value does NOT exceed (regardless of `absolute`).
 *   - When BOTH are set: passing EITHER bound counts as not-exceeding
 *     (more permissive — useful for "AUD with rounding" tolerances).
 *   - When NEITHER is defined for a non-zero diff: exceeds (defensive
 *     default — descriptor authors must set tolerance explicitly).
 */
export function exceedsTolerance(
  descriptor: SurfaceDescriptor,
  canonical: number,
  rendered: number,
): boolean {
  const absDiff = Math.abs(canonical - rendered);
  if (absDiff === 0) return false;

  const tol = descriptor.tolerance ?? DEFAULT_TOLERANCE_BY_KIND[descriptor.kind];

  if (typeof tol.absolute === 'number' && absDiff <= tol.absolute) {
    return false;
  }
  if (typeof tol.relative === 'number' && canonical !== 0) {
    const relDiff = absDiff / Math.abs(canonical);
    if (relDiff <= tol.relative) return false;
  }
  return true;
}
