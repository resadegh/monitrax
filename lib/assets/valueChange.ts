/**
 * Asset value-change presentation — ONE source (CLAUDE.md §12.2.1).
 *
 * The API computes `depreciation = purchasePrice − currentValue` (POSITIVE = the
 * asset LOST value, NEGATIVE = it GAINED value) and the matching
 * `depreciationPercent = depreciation / purchasePrice × 100`. Several surfaces
 * render this, and the rule is always the same:
 *
 *   • the DIRECTION (appreciation vs depreciation) decides the label + colour +
 *     icon, and
 *   • the PERCENT is shown as a MAGNITUDE — an appreciating asset must never
 *     read as "−200% depreciation" (MON-041). The direction is conveyed by the
 *     label/colour/icon, not by a minus sign on the number.
 *
 * Centralised here so the Assets list tile (AssetTile) and the Assets page
 * dialogs render the SAME rule — no per-site drift (the MON-041 bug was two
 * dialog sites showing the raw signed percent while AssetTile abs'd it).
 */

export type AssetValueDirection = 'appreciation' | 'depreciation' | 'unchanged';

/**
 * Direction of an asset's value change from the signed `depreciation`
 * (purchase − current). Positive → depreciation, negative → appreciation,
 * zero → unchanged.
 */
export function assetValueDirection(depreciation: number): AssetValueDirection {
  if (depreciation > 0) return 'depreciation';
  if (depreciation < 0) return 'appreciation';
  return 'unchanged';
}

/**
 * The percent to DISPLAY — always non-negative. The sign lives in the direction
 * (label/colour/icon), never in the number the user reads (MON-041).
 */
export function assetValueChangeMagnitudePercent(depreciationPercent: number): number {
  return Math.abs(depreciationPercent);
}
