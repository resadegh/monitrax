/**
 * Wealth Explorer — shared types + design tokens.
 *
 * Surface SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 * Artefact: `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 *
 * Semantic-zoom pass (Phase WX.4, 2026-06-10) SoT:
 *   Level 1 desktop  — screen `770687a1c73c42f0b4fd5686782bf5f3`
 *   Level 2 desktop  — screen `068403f1296440508b601c2fc32d5e20`
 *   Level 1 mobile   — screen `e5ecb8d170cc4fbdbc336413cd9948d2`
 *   Widget Level 1   — screen `80c21d51c38242d883bec3d6875fabe6`
 *   Artefacts: `.stitch/designs/wealth-universe-zoom/*.{html,png}`
 */

import type { WealthGraphAssetKind } from '@/lib/services/wealthGraphService';

export type WealthNodeType =
  | 'holding-company'
  | 'trustee-company'
  | 'smsf-trustee-company'
  | 'other-company'
  | 'trust'
  | 'smsf'
  | 'individual'
  | 'asset-property'
  | 'asset-vehicle'
  | 'asset-investment'
  | 'asset-cash'
  | 'asset-loan'
  | 'ownership-group'; // synthetic node for joint-tenancy / tenants-in-common

export interface WealthNode {
  id: string;
  type: WealthNodeType;
  name: string;
  shortName?: string;
  subtitle?: string;
  value?: string;
  /** % of canvas — x from left, y from top. Organic placement. */
  position: { x: number; y: number };
  /** Diameter in px at base zoom. Larger = more significant. */
  size: number;
  /** Gravitational anchor (YOU). Renders with pulsing emerald rings. */
  isAnchor?: boolean;
  /** Featured entity — gets the emerald focal ring at rest. */
  isFocal?: boolean;
  /**
   * For asset nodes: which entity holds it. Used by the detail panel to
   * jump to the owning entity on click.
   */
  ownerEntityId?: string;
  /**
   * Tier marker for layout debug + filter chips. Entities sit in tier 1
   * (controllers / vehicles), assets in tier 2, individuals in tier 3.
   * 'cluster' (Phase WX.4.1) — synthetic per-type aggregate of one
   * entity's holdings, used at Level 1 when the universe has too few
   * entities to aggregate into ("3 Properties · $2.1M"). Clusters
   * expand like entities but never open the entity detail panel.
   */
  tier?: 'entity' | 'asset' | 'individual' | 'group' | 'cluster';
  /**
   * Semantic zoom (Phase WX.4) — for entity / group nodes, the
   * aggregate of the assets this node holds. At Level 1 the canvas
   * renders this as a count badge + "$X held" line instead of
   * individual asset tiles. `totalValue` sums non-loan holdings only —
   * counting loan principal as "held" wealth would overstate.
   */
  assetSummary?: { count: number; totalValue: number };
  /**
   * Semantic zoom — for asset nodes, the canvas node they unfolded
   * from (an entity id, or `group-<id>` for jointly-held assets).
   * Lets the canvas keep the right constellation open when the user
   * selects a satellite.
   */
  parentNodeId?: string;
  /** Semantic zoom — true on entity/group nodes whose satellites are unfolded. */
  isExpanded?: boolean;
  /**
   * WX.5.3 — true when tapping this node unfolds a focused scene
   * (clusters always; groups with holdings; entities with holdings
   * OUTSIDE cluster mode). In cluster mode the per-type clusters carry
   * the way in, so the entity itself only opens the detail card —
   * the redundant all-holdings middle layer was removed (Reza
   * 2026-06-11). Tap handlers MUST check this flag, never
   * `assetSummary` (which also powers totals and stays set).
   */
  isExpandable?: boolean;
}

export type RelationshipType =
  | 'owns'
  | 'controls'
  | 'trustee'
  | 'beneficiary'
  | 'member'
  | 'household'
  | 'holds'
  // Phase 2 — Money Flow lens. Both flow kinds render as emerald
  // animated ribbons; the canvas may differentiate by kind in a later
  // iteration (e.g. franked-dividend halo).
  | 'flow-distribution'
  | 'flow-dividend';

export interface WealthRelationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
  /**
   * Phase 2 — for flow ribbons, the gross $ amount of this flow leg.
   * Drives the ribbon label (formatted) + tooltip detail. Undefined
   * for non-flow ribbons.
   */
  amount?: number;
  /**
   * Phase 2 — §12.14 FW-2 verbatim notice the canvas surfaces when a
   * post-reform regime applies but the Bill has not assented.
   * Undefined when no notice applies.
   */
  reformNotice?: string;
  /**
   * Phase 2 enhancement — for flow ribbons, the FY this flow belongs
   * to. Drives FY-slider filtering. Undefined for non-flow ribbons.
   */
  financialYear?: string;
}

/** Type → accent colour token (hex). Drives inner glow + ribbon stroke. */
export const NODE_ACCENT: Record<WealthNodeType, string> = {
  'holding-company': '#38BDF8',
  'trustee-company': '#7DD3FC',
  'smsf-trustee-company': '#6EE7B7',
  'other-company': '#FBBF24',
  'trust': '#818CF8',
  'smsf': '#34D399',
  'individual': '#A78BFA',
  'asset-property': '#38BDF8',
  'asset-vehicle': '#FBBF24',
  'asset-investment': '#818CF8',
  'asset-cash': '#34D399',
  'asset-loan': '#F87171', // amber-rose for debt
  'ownership-group': '#F0ABFC', // pink-violet — matches household ribbon
};

/** Relationship → ribbon stroke colour. */
export const RIBBON_COLOR: Record<RelationshipType, string> = {
  owns: '#34D399',
  controls: '#7DD3FC',
  trustee: '#FBBF24',
  beneficiary: '#A78BFA',
  member: '#6EE7B7',
  household: '#F0ABFC',
  holds: '#38BDF8',
  // Money flow — bright emerald, distinguishes cash movement from
  // structural ribbons even when the latter are also rendered.
  'flow-distribution': '#34D399',
  'flow-dividend': '#34D399',
};

/**
 * WX.5.4 — canonical click-through target for an asset bubble / row.
 * Single source of truth for the universe surfaces (desktop panel,
 * mobile card, linked-asset rows) — the per-component copies drifted
 * (investments + super gained Asset Spotlight detail pages in Phases
 * 45.2.1 / 45.2.2 while the maps still pointed at the lists).
 *
 * Kinds without an individual detail page fall back to their list
 * route — landing somewhere useful always beats a dead-end (§6.7).
 */
export function assetHrefFor(kind: WealthGraphAssetKind, id: string): string {
  switch (kind) {
    case 'property': return `/dashboard/properties/${id}`;
    case 'loan': return `/dashboard/loans/${id}`;
    case 'account': return '/dashboard/accounts';
    case 'investment-account': return `/dashboard/investments/accounts/${id}`;
    case 'asset': return '/dashboard/assets';
    case 'super': return `/dashboard/investments/super/${id}`;
  }
}

/** WX.5.4 — warm CTA wording per asset kind (§14.3 — never clinical). */
export function assetCtaLabelFor(kind: WealthGraphAssetKind): string {
  switch (kind) {
    case 'property': return 'Open property details';
    case 'loan': return 'Open loan details';
    case 'account': return 'View in My Accounts';
    case 'investment-account': return 'Open investment details';
    case 'asset': return 'View in My Wealth';
    case 'super': return 'Open super details';
  }
}
