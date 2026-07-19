/**
 * Accessibility buckets — the "Hidden Wealth" lens engine (MON-012).
 *
 * Partitions a user's NET WORTH into three buckets by how soon the wealth can
 * be reached, so the buckets ALWAYS tie out to net worth by construction:
 *
 *   liquidToday + accessible + lockedLongTerm === netWorth
 *
 * The tie-out is the whole point. Before MON-012 the buckets summed to
 * `totalAssets − mortgages` (mortgages were netted inside property equity, but
 * credit cards and personal/HECS debt were netted NOWHERE, and non-liquid cash
 * such as term deposits was dropped entirely) — so they overstated net worth.
 * The reported case failed tie-out by exactly $64,572 = $37,076 (floored
 * property equity, MON-011) + $2,496 (credit card not netted) + $25,000 (HECS
 * in no bucket).
 *
 * The fix: partition net worth, netting every liability against the bucket that
 * matches its time-horizon, and source EVERY value from the canonical
 * `NetWorthResult` (§12.2.1 — one source, no re-aggregation):
 *
 *   • Liquid Today     = liquid cash − credit cards   (immediate claim on cash)
 *   • Accessible       = investments + non-liquid cash (term deposits — sellable
 *                        within ~days, not spendable today)
 *   • Locked Long-Term = property equity (canonical net-of-mortgage) + super +
 *                        personal assets − long-term non-mortgage debt (HECS /
 *                        personal loans). Mortgages are already netted inside
 *                        property equity.
 *
 * Proof: expand the three buckets over the canonical fields —
 *   (cash − creditCards) + (investments + (accounts − cash))
 *     + (properties − mortgages + super + personalAssets − personalLoans)
 *   = accounts + investments + properties + super + personalAssets
 *       − (mortgages + creditCards + personalLoans)
 *   = assets.total − liabilities.total
 *   = netWorth. ∎
 *
 * Pure — no I/O, no DB, no snapshot fetch. The route (and any future surface)
 * reads the canonical `getMasterFinancialSnapshot()` and calls this.
 *
 * @see app/api/dashboard/hidden-wealth/route.ts
 * @see lib/calculations/netWorthCalculator.ts (the one net-worth source)
 * @see docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md
 */

import type { NetWorthResult } from './netWorthCalculator';

export interface AccessibilityBuckets {
  /** Spendable cash, net of credit-card balances (may be negative). */
  liquidToday: number;
  /** Investments + non-liquid cash (term deposits) — sellable within ~days. */
  accessible: number;
  /** Property equity + super + personal assets − long-term non-mortgage debt. */
  lockedLongTerm: number;
  // Components, for the drill-down + transparency (all from NetWorthResult):
  cash: number;
  nonLiquidCash: number;
  investments: number;
  propertyEquity: number;
  superannuation: number;
  personalAssets: number;
  creditCards: number;
  /** Long-term non-mortgage debt (HECS, personal/car loans). */
  longTermDebt: number;
}

/**
 * Split net worth into accessibility buckets.
 *
 * @param netWorth   Canonical net-worth result (`snapshot.netWorth`).
 * @param liquidCash THE canonical liquid cash (`snapshot.quickMetrics.liquidCash`)
 *                   — MON-031/064: now the DEPLOYABLE figure, i.e. spendable
 *                   cash-account balances NET of credit cards. The engine
 *                   reconstructs the gross cash basis internally (net + cards)
 *                   so the bucket partition + tie-out are unchanged, and
 *                   `liquidToday` equals the canonical figure BY CONSTRUCTION
 *                   — one liquid number on every surface.
 */
export function computeAccessibilityBuckets(
  netWorth: NetWorthResult,
  liquidCash: number,
): AccessibilityBuckets {
  const { assets, liabilities, breakdown } = netWorth;

  // MON-031/064: the canonical input is NET of credit cards; the cash-account
  // partition below needs the GROSS spendable balance.
  const grossLiquidCash = liquidCash + liabilities.creditCards;

  // Non-liquid cash = every cash account minus the spendable subset. Term
  // deposits etc. live here — accessible, but not spendable today. Guarded at
  // 0 so a data quirk (gross liquid > accounts) never yields a negative bucket
  // component; the tie-out below is preserved because the same value is added
  // to `accessible` and removed from the liquid basis.
  const nonLiquidCash = Math.max(0, assets.accounts - grossLiquidCash);
  const liquidBasis = assets.accounts - nonLiquidCash; // == min(grossLiquidCash, accounts)

  const liquidToday = liquidBasis - liabilities.creditCards;
  const accessible = assets.investments + nonLiquidCash;
  const propertyEquity = breakdown.propertyEquity; // properties − mortgages (unfloored)
  const lockedLongTerm =
    propertyEquity +
    assets.superannuation +
    assets.personalAssets -
    liabilities.personalLoans;

  return {
    liquidToday,
    accessible,
    lockedLongTerm,
    cash: liquidBasis,
    nonLiquidCash,
    investments: assets.investments,
    propertyEquity,
    superannuation: assets.superannuation,
    personalAssets: assets.personalAssets,
    creditCards: liabilities.creditCards,
    longTermDebt: liabilities.personalLoans,
  };
}
