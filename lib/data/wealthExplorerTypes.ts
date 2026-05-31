/**
 * Wealth Explorer — shared types + design tokens.
 *
 * Surface SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 * Artefact: `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 */

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
   */
  tier?: 'entity' | 'asset' | 'individual' | 'group';
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
