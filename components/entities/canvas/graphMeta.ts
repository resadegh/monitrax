/**
 * Phase 44 Part 1c — entity-structure canvas metadata (§11A).
 *
 * Pure presentational lookup tables for the canvas: per-entity-type
 * iconography + labels (the full Phase 44 widened taxonomy, all 20
 * `LegalEntityType` values), per-relationship-type labels + visual
 * category, and the lens-toggle edge-filter sets.
 *
 * Design rules (CLAUDE.md §16.4):
 *  - Icons are lucide component *references*, not JSX — keeps this a
 *    plain `.ts` module the canvas + dialogs all import.
 *  - Lens edge-sets mirror the §3A dimensions (legal title / beneficial
 *    ownership / control kept separate). The Control lens reuses the
 *    exact control-edge set `lib/entity-graph/queries.ts` defines for
 *    `getControllersOf()` — one SSOT for "what is a control edge".
 *  - The canvas COMPUTES NOTHING (§8.4 / §11A) — these are display
 *    constants only.
 *
 * Doc: docs/blueprint/PHASE_44_ENTITY_GRAPH.md §11A, §3A, §5.
 */

import type { LegalEntityType, EntityRelationshipType } from '@prisma/client';
import {
  Archive,
  Box,
  Briefcase,
  Building,
  Building2,
  Crown,
  Handshake,
  Landmark,
  Layers,
  Scroll,
  Shapes,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// ENTITY-TYPE METADATA — all 20 LegalEntityType values
// =============================================================================

export interface EntityTypeMeta {
  /** Full label for dialogs. */
  label: string;
  /** Short label for the canvas box. */
  short: string;
  icon: LucideIcon;
}

export const ENTITY_TYPE_META: Record<LegalEntityType, EntityTypeMeta> = {
  PERSONAL_NAME: { label: 'Personal name', short: 'Personal', icon: User },
  INDIVIDUAL: { label: 'Individual', short: 'Individual', icon: User },
  COMPANY: { label: 'Company (Pty Ltd / Ltd)', short: 'Company', icon: Building2 },
  FOREIGN_COMPANY: { label: 'Foreign company', short: 'Foreign Co', icon: Building2 },
  DISCRETIONARY_TRUST: { label: 'Discretionary / family trust', short: 'Disc. Trust', icon: Crown },
  UNIT_TRUST: { label: 'Unit trust', short: 'Unit Trust', icon: Layers },
  FIXED_TRUST: { label: 'Fixed trust', short: 'Fixed Trust', icon: Crown },
  HYBRID_TRUST: { label: 'Hybrid trust', short: 'Hybrid Trust', icon: Layers },
  BARE_TRUST: { label: 'Bare / holding trust', short: 'Bare Trust', icon: Box },
  TESTAMENTARY_TRUST: { label: 'Testamentary trust', short: 'Test. Trust', icon: Scroll },
  DECEASED_ESTATE: { label: 'Deceased estate', short: 'Estate', icon: Scroll },
  SMSF: { label: 'Self-managed super fund', short: 'SMSF', icon: Landmark },
  PARTNERSHIP: { label: 'Partnership', short: 'Partnership', icon: Handshake },
  SOLE_TRADER: { label: 'Sole trader', short: 'Sole Trader', icon: Briefcase },
  INCORPORATED_ASSOCIATION: {
    label: 'Incorporated association',
    short: 'Assoc.',
    icon: Users,
  },
  CO_OPERATIVE: { label: 'Co-operative', short: 'Co-op', icon: Users },
  STRATA_BODY_CORPORATE: {
    label: 'Strata body corporate',
    short: 'Strata',
    icon: Building,
  },
  CUSTODIAN_PLATFORM: { label: 'Custodian / platform', short: 'Custodian', icon: Archive },
  OTHER: { label: 'Other structure', short: 'Other', icon: Shapes },
};

/** Safe lookup — an unknown enum value (post-migration drift) falls back. */
export function entityTypeMeta(type: LegalEntityType): EntityTypeMeta {
  return ENTITY_TYPE_META[type] ?? { label: type, short: type, icon: Shapes };
}

// =============================================================================
// RELATIONSHIP-TYPE METADATA — all 19 EntityRelationshipType values
// =============================================================================

/**
 * Visual category — drives edge colour. Mirrors the §3A dimensions:
 * legal title / beneficial ownership / control are kept distinct, and
 * the canvas paints them in distinct hues so the "All" lens stays
 * readable.
 */
export type EdgeCategory = 'control' | 'ownership' | 'eligibility' | 'office' | 'family';

export interface RelationshipTypeMeta {
  /** Connector label on the canvas + the dialog row. */
  label: string;
  category: EdgeCategory;
  /**
   * `true` → solid, slightly heavier line: a *determinative* /
   * legal-title edge (trustee, director, executor). `false` → dashed:
   * an influence / indicator / eligibility edge (§5 — an appointor is a
   * control *indicator*, not proof).
   */
  strong: boolean;
}

export const RELATIONSHIP_TYPE_META: Record<EntityRelationshipType, RelationshipTypeMeta> = {
  TRUSTEE_OF: { label: 'Trustee', category: 'control', strong: true },
  APPOINTOR_OF: { label: 'Appointor', category: 'control', strong: false },
  GUARDIAN_OF: { label: 'Guardian', category: 'control', strong: false },
  POWER_HOLDER_OF: { label: 'Power holder', category: 'control', strong: false },
  SETTLOR_OF: { label: 'Settlor', category: 'office', strong: false },
  BENEFICIARY_OF: { label: 'Beneficiary', category: 'eligibility', strong: false },
  EXECUTOR_OF: { label: 'Executor', category: 'office', strong: true },
  ADMINISTRATOR_OF: { label: 'Administrator', category: 'office', strong: true },
  LEGAL_PERSONAL_REPRESENTATIVE_FOR: { label: 'Legal rep', category: 'office', strong: false },
  UNITHOLDER_OF: { label: 'Unitholder', category: 'ownership', strong: true },
  SHAREHOLDER_OF: { label: 'Shareholder', category: 'ownership', strong: true },
  DIRECTOR_OF: { label: 'Director', category: 'control', strong: true },
  SECRETARY_OF: { label: 'Secretary', category: 'office', strong: false },
  PUBLIC_OFFICER_OF: { label: 'Public officer', category: 'office', strong: false },
  MEMBER_OF: { label: 'Member', category: 'eligibility', strong: true },
  PARTNER_OF: { label: 'Partner', category: 'ownership', strong: true },
  OPERATES_AS_SOLE_TRADER: { label: 'Operates as', category: 'office', strong: true },
  FAMILY_MEMBER_OF: { label: 'Family', category: 'family', strong: false },
  ASSOCIATE_OF: { label: 'Associate', category: 'family', strong: false },
};

export function relationshipTypeMeta(type: EntityRelationshipType): RelationshipTypeMeta {
  return RELATIONSHIP_TYPE_META[type] ?? { label: type, category: 'office', strong: false };
}

/** Per-category edge stroke colour (muted — edges must not out-shout the role-coloured boxes). */
export const EDGE_CATEGORY_COLOUR: Record<EdgeCategory, string> = {
  control: '#6366f1', // indigo-500 — "who runs this"
  ownership: '#c026d3', // fuchsia-600 — "who owns this"
  eligibility: '#0ea5e9', // sky-500 — "who could receive" (eligibility, not actual)
  office: '#64748b', // slate-500 — statutory offices
  family: '#d97706', // amber-600 — family / associate
};

// =============================================================================
// LENS CONFIG — the §11A lens toggle
// =============================================================================

export type CanvasLens = 'control' | 'ownership' | 'money' | 'all';

export interface LensDef {
  id: CanvasLens;
  label: string;
  /** One-line "what this lens answers" — shown under the toggle. */
  blurb: string;
}

/** Lens order — Control is the default ("who controls this" is most users' first question, §11A). */
export const LENSES: readonly LensDef[] = [
  { id: 'control', label: 'Control', blurb: 'Who runs this structure — trustees, directors, appointors.' },
  { id: 'ownership', label: 'Ownership', blurb: 'Who owns the equity — shareholders, unitholders, partners.' },
  {
    id: 'money',
    label: 'Money flow',
    blurb: 'Where the money actually goes — income → entities → outflows.',
  },
  { id: 'all', label: 'All', blurb: 'Every relationship at once — the whole picture.' },
];

/**
 * The Control lens edge set — identical to the determinative + indicator
 * control edges `lib/entity-graph/queries.ts` uses for `getControllersOf()`.
 * One SSOT for "what counts as control".
 */
const CONTROL_LENS_EDGES: ReadonlySet<EntityRelationshipType> = new Set<EntityRelationshipType>([
  'TRUSTEE_OF',
  'DIRECTOR_OF',
  'APPOINTOR_OF',
  'GUARDIAN_OF',
  'POWER_HOLDER_OF',
  'SHAREHOLDER_OF',
  'MEMBER_OF',
]);

/** The Ownership lens edge set — the §6.5 ownership-chain edges (equity in an entity). */
const OWNERSHIP_LENS_EDGES: ReadonlySet<EntityRelationshipType> = new Set<EntityRelationshipType>([
  'SHAREHOLDER_OF',
  'UNITHOLDER_OF',
  'PARTNER_OF',
]);

const ALL_RELATIONSHIP_TYPES = Object.keys(RELATIONSHIP_TYPE_META) as EntityRelationshipType[];

/**
 * Does the active lens show this edge type? The `money` lens is handled
 * separately — it swaps the graph for the money-flow Sankey (§11A) — so
 * it is never asked here.
 */
export function lensShowsEdge(lens: Exclude<CanvasLens, 'money'>, type: EntityRelationshipType): boolean {
  switch (lens) {
    case 'control':
      return CONTROL_LENS_EDGES.has(type);
    case 'ownership':
      return OWNERSHIP_LENS_EDGES.has(type);
    case 'all':
      return true;
    default:
      return false;
  }
}

/** Relationship types offered in the "add relationship" form, grouped for the picker. */
export const RELATIONSHIP_TYPE_GROUPS: ReadonlyArray<{
  group: string;
  types: EntityRelationshipType[];
}> = [
  { group: 'Control', types: ['TRUSTEE_OF', 'DIRECTOR_OF', 'APPOINTOR_OF', 'GUARDIAN_OF', 'POWER_HOLDER_OF'] },
  { group: 'Ownership', types: ['SHAREHOLDER_OF', 'UNITHOLDER_OF', 'PARTNER_OF'] },
  { group: 'Trust / estate', types: ['BENEFICIARY_OF', 'SETTLOR_OF', 'EXECUTOR_OF', 'ADMINISTRATOR_OF'] },
  { group: 'Super', types: ['MEMBER_OF'] },
  {
    group: 'Office & other',
    types: [
      'SECRETARY_OF',
      'PUBLIC_OFFICER_OF',
      'LEGAL_PERSONAL_REPRESENTATIVE_FOR',
      'OPERATES_AS_SOLE_TRADER',
      'FAMILY_MEMBER_OF',
      'ASSOCIATE_OF',
    ],
  },
];

export { ALL_RELATIONSHIP_TYPES };
