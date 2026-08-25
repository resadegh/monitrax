/**
 * MON-182 — THE portfolio-LVR producer (SSOT §12.2.1, M3 punch-list §C-3).
 *
 * Before this module, two live producers disagreed on the same data:
 * /api/portfolio/snapshot divided ALL liabilities (personal loans + credit
 * cards included) by ALL property value (RENTAL rows included) → 41.3%,
 * while the properties page divided owned property-attached principal by
 * owned value in screen arithmetic → 40.8%. One producer wins; this is it.
 *
 * THE BASIS (named on every surface that renders the number):
 *   - OWNED properties only (`type !== 'RENTAL'` — a rented dwelling is not
 *     the user's asset, so it belongs in neither side of the ratio);
 *   - property-attached loan principal ONLY (a personal loan or credit card
 *     never belongs in a property LVR; a loan attached to a RENTAL row
 *     leaves the ratio with its property).
 *
 * Rounded HERE to 2dp — the producer owns its precision (the MON-154
 * lesson: one quantity at two precisions is a drift bug). Render sites
 * format for display only (both show one decimal).
 *
 * Consumers: /api/portfolio/snapshot `gearing.portfolioLVR` (the scoreboard
 * portfolio tile reads it) + the properties page hero. Screens only read.
 */

export interface PortfolioLvrProperty {
  type: string;
  currentValue: number;
  loans?: readonly { principal: number }[] | null;
}

/** Owned-properties portfolio LVR as a percent (2dp), 0 when no owned value. */
export function calculateOwnedPortfolioLvr(
  properties: readonly PortfolioLvrProperty[]
): number {
  const owned = properties.filter((p) => p.type !== 'RENTAL');
  const ownedValue = owned.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  if (ownedValue <= 0) return 0;
  const attachedDebt = owned.reduce(
    (sum, p) => sum + (p.loans ?? []).reduce((s, l) => s + (l.principal || 0), 0),
    0
  );
  return Math.round((attachedDebt / ownedValue) * 10000) / 100;
}
