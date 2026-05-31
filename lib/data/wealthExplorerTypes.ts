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
  | 'asset-cash';

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
}

export type RelationshipType =
  | 'owns'
  | 'controls'
  | 'trustee'
  | 'beneficiary'
  | 'member'
  | 'household'
  | 'holds';

export interface WealthRelationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
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
};
