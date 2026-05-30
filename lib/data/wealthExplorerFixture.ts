/**
 * Wealth Explorer — fixture data for the surface-design preview.
 *
 * Hard-coded Renew Group structure (8 entities + 5 assets + 2 individuals)
 * matching the v5 Stitch reference in
 * `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 * (screen `a3b43b9164d74f1c8ec53bc20f319cbd`).
 *
 * This is a SURFACE-DESIGN PREVIEW. No real entity-service hookup yet — that
 * comes after Reza signs off on the visual. Coordinates are % of the canvas
 * so the layout breathes with viewport size.
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
  /** % of canvas — x from left, y from top. Organic placement, NOT a grid. */
  position: { x: number; y: number };
  /** Diameter in px at base zoom. Larger = more significant in the universe. */
  size: number;
  /** The gravitational anchor (YOU). Renders with pulsing emerald rings. */
  isAnchor?: boolean;
  /** Currently-featured entity — gets the emerald focal ring. */
  isFocal?: boolean;
  /** Demo hover state — magnified + popover anchored to it. */
  isHovered?: boolean;
}

export type RelationshipType =
  | 'owns'         // ownership (emerald)
  | 'controls'     // director / appointer (sky)
  | 'trustee'      // ATF — Acting as Trustee For (sky)
  | 'beneficiary'  // distribution recipient (violet)
  | 'member'       // SMSF member (emerald soft)
  | 'household'    // intimate household tie (pink-violet)
  | 'holds';       // entity → asset (colour by asset type)

export interface WealthRelationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
  /** Demo-active ribbon — full brightness + particle stream. */
  active?: boolean;
}

export const WEALTH_NODES: WealthNode[] = [
  // YOU — anchor, gravitational centre
  {
    id: 'you',
    type: 'individual',
    name: 'Reza Sadegh',
    shortName: 'YOU',
    subtitle: 'Director · Beneficiary · Member',
    position: { x: 50, y: 60 },
    size: 96,
    isAnchor: true,
  },
  // Newsha — intimate orbit beside YOU
  {
    id: 'newsha',
    type: 'individual',
    name: 'Newsha Javahery',
    shortName: 'Newsha',
    subtitle: 'Spouse · Director · Beneficiary',
    position: { x: 58, y: 67 },
    size: 72,
  },

  // Corporate cluster — upper-left
  {
    id: 'family-trust',
    type: 'trust',
    name: 'Renew Investment Family Trust',
    shortName: 'Family Trust',
    subtitle: 'Discretionary Trust',
    position: { x: 27, y: 32 },
    size: 84,
    isFocal: true,
  },
  {
    id: 'group-holding',
    type: 'holding-company',
    name: 'Renew Group Holding Pty Ltd',
    shortName: 'Group Holding',
    subtitle: 'Holding Co',
    position: { x: 15, y: 18 },
    size: 64,
  },
  {
    id: 'investment-pty',
    type: 'trustee-company',
    name: 'Renew Investment Pty Ltd',
    shortName: 'Investment Pty',
    subtitle: 'Trustee Co',
    position: { x: 26, y: 13 },
    size: 56,
  },
  {
    id: 'holding-co',
    type: 'other-company',
    name: 'Renew Holding Co Pty Ltd',
    shortName: 'Holding Co',
    subtitle: 'Beneficiary',
    position: { x: 11, y: 42 },
    size: 56,
  },

  // SMSF cluster — upper-right
  {
    id: 'renew-super',
    type: 'smsf',
    name: 'Renew Super',
    shortName: 'Renew Super',
    subtitle: 'Self-Managed Super Fund',
    position: { x: 75, y: 30 },
    size: 80,
  },
  {
    id: 'smsf-pty',
    type: 'smsf-trustee-company',
    name: 'Renew SMSF Pty Ltd',
    shortName: 'SMSF Pty',
    subtitle: 'SMSF Trustee',
    position: { x: 86, y: 16 },
    size: 52,
  },

  // Property asset — mid-left, HOVERED for the demo
  {
    id: 'home',
    type: 'asset-property',
    name: 'HOME — Laguna NSW',
    shortName: 'HOME',
    subtitle: '903 Boree Valley Rd',
    value: '$850K',
    position: { x: 38, y: 48 },
    size: 80,
    isHovered: true,
  },

  // Investment + cash — mid-right
  {
    id: 'stake',
    type: 'asset-investment',
    name: 'Stake Portfolio',
    shortName: 'Stake',
    subtitle: 'Stake · AUD',
    value: '$0',
    position: { x: 64, y: 44 },
    size: 60,
  },
  {
    id: 'smsf-cash',
    type: 'asset-cash',
    name: 'SMSF Cash',
    shortName: 'SMSF Cash',
    subtitle: 'Ausiex',
    value: '$300K',
    position: { x: 72, y: 52 },
    size: 68,
  },

  // Personal vehicles — lower, close to owners
  {
    id: 'landcruiser',
    type: 'asset-vehicle',
    name: 'Toyota Landcruiser ‘79',
    shortName: 'Landcruiser',
    subtitle: 'Vehicle',
    value: '$27K',
    position: { x: 40, y: 80 },
    size: 54,
  },
  {
    id: 'vw-golf',
    type: 'asset-vehicle',
    name: 'VW Golf GTI ‘18',
    shortName: 'VW Golf',
    subtitle: 'Vehicle',
    value: '$30K',
    position: { x: 62, y: 82 },
    size: 54,
  },
];

export const WEALTH_RELATIONSHIPS: WealthRelationship[] = [
  // Household — intimate orbit
  { id: 'r-household', from: 'newsha', to: 'you', type: 'household', label: 'Household' },

  // Director relationships (back-edges from individuals to companies)
  { id: 'r-you-group', from: 'you', to: 'group-holding', type: 'controls', label: 'Director' },
  { id: 'r-you-inv-pty', from: 'you', to: 'investment-pty', type: 'controls', label: 'Director' },
  { id: 'r-you-smsf-pty', from: 'you', to: 'smsf-pty', type: 'controls', label: 'Director' },
  { id: 'r-newsha-inv-pty', from: 'newsha', to: 'investment-pty', type: 'controls', label: 'Director' },
  { id: 'r-newsha-smsf-pty', from: 'newsha', to: 'smsf-pty', type: 'controls', label: 'Director' },

  // Ownership chain
  { id: 'r-group-inv-pty', from: 'group-holding', to: 'investment-pty', type: 'owns', label: 'Owns 100%' },
  { id: 'r-group-holding-co', from: 'group-holding', to: 'holding-co', type: 'owns', label: 'Owns' },

  // Acting as Trustee For
  { id: 'r-inv-pty-trust', from: 'investment-pty', to: 'family-trust', type: 'trustee', label: 'ATF' },
  { id: 'r-smsf-pty-super', from: 'smsf-pty', to: 'renew-super', type: 'trustee', label: 'ATF' },

  // Entity → asset (holds)
  { id: 'r-trust-home', from: 'family-trust', to: 'home', type: 'holds', label: 'Holds', active: true },
  { id: 'r-trust-stake', from: 'family-trust', to: 'stake', type: 'holds', label: 'Holds' },
  { id: 'r-super-cash', from: 'renew-super', to: 'smsf-cash', type: 'holds', label: 'Holds' },

  // Beneficiary relationships
  { id: 'r-trust-newsha', from: 'family-trust', to: 'newsha', type: 'beneficiary', label: 'Beneficiary' },
  { id: 'r-trust-you', from: 'family-trust', to: 'you', type: 'beneficiary', label: 'Beneficiary' },
  { id: 'r-trust-holding-co', from: 'family-trust', to: 'holding-co', type: 'beneficiary', label: 'Beneficiary' },

  // SMSF members
  { id: 'r-super-newsha', from: 'renew-super', to: 'newsha', type: 'member', label: 'Member' },
  { id: 'r-super-you', from: 'renew-super', to: 'you', type: 'member', label: 'Member' },

  // Personal vehicle ownership
  { id: 'r-you-landcruiser', from: 'you', to: 'landcruiser', type: 'owns', label: 'Owns' },
  { id: 'r-newsha-golf', from: 'newsha', to: 'vw-golf', type: 'owns', label: 'Owns' },
];

/** Type → accent colour token (hex). Drives inner glow + ribbon stroke. */
export const NODE_ACCENT: Record<WealthNodeType, string> = {
  'holding-company': '#38BDF8',         // sky
  'trustee-company': '#7DD3FC',         // sky-light (dashed border in UI)
  'smsf-trustee-company': '#6EE7B7',    // emerald-light (dashed border in UI)
  'other-company': '#FBBF24',           // amber
  'trust': '#818CF8',                   // indigo
  'smsf': '#34D399',                    // emerald
  'individual': '#A78BFA',              // violet
  'asset-property': '#38BDF8',          // sky
  'asset-vehicle': '#FBBF24',           // amber
  'asset-investment': '#818CF8',        // indigo
  'asset-cash': '#34D399',              // emerald
};

/** Relationship → ribbon stroke colour. */
export const RIBBON_COLOR: Record<RelationshipType, string> = {
  owns: '#34D399',         // emerald
  controls: '#7DD3FC',     // sky (dimmed for director back-edges)
  trustee: '#FBBF24',      // amber (ATF = control)
  beneficiary: '#A78BFA',  // violet
  member: '#6EE7B7',       // emerald soft
  household: '#F0ABFC',    // pink-violet
  holds: '#38BDF8',        // sky (overridden per asset type at render)
};
