/**
 * Phase 44 Part 1b — entity-graph in-memory representation + leaf utilities.
 *
 * This is the leaf module of `lib/entity-graph/` — it carries the data
 * shapes the graph layer works in, the node-type group predicates the
 * §6 grammar is expressed in, and the time-bounding helper. It has no
 * dependency on `queries.ts` or `validityMatrix.ts`, so those two can
 * both import it without a cycle (CLAUDE.md §12.9).
 *
 * Design contract: docs/blueprint/PHASE_44_ENTITY_GRAPH.md §3A, §5–§8.4.
 *
 * The graph layer is PURE. `GraphNode` / `GraphEdge` are plain in-memory
 * reductions of the Prisma `LegalEntity` / `EntityRelationship` rows —
 * loading them from the database is the service layer's job (Part 1b-ii).
 * Nothing in `lib/entity-graph/` performs I/O or tax arithmetic (§8.3).
 */

import type {
  LegalEntityType,
  LegalEntityRole,
  CompanySubtype,
  TrustType,
  EntityRelationshipType,
  BeneficiaryClass,
  StructuralState,
  BeneficialOwnershipBasis,
} from '@prisma/client';

// =============================================================================
// GRAPH SHAPES
// =============================================================================

/** A node — a `LegalEntity`, reduced to what the §6 grammar reads. */
export interface GraphNode {
  id: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  name: string;
  /** Drives the §6.4 company branch — a guarantee company has members, not shareholders. */
  companySubtype: CompanySubtype | null;
  trustType: TrustType | null;
  /** EARLY / PARTLY / FULLY_ADMINISTERED / FINAL_DISTRIBUTION_COMPLETE — §6.4 estate rule. */
  estateAdministrationStatus: string | null;
  /** The persisted §6.1 state. The grammar recomputes it; this is the last-stored value. */
  structuralState: StructuralState;
  accountantVerified: boolean;
  /** true when type === 'OTHER' — outside the supported grammar (§3, §4). */
  unsupportedStructure: boolean;
}

/** An edge — an `EntityRelationship`, reduced. Directed `from → to`, time-bounded. */
export interface GraphEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: EntityRelationshipType;
  effectiveFrom: Date;
  /** null = still current. */
  effectiveTo: Date | null;
  beneficiaryClass: BeneficiaryClass | null;
  /** FAMILY_MEMBER_OF — SPOUSE / DE_FACTO / CHILD / PARENT / SIBLING / OTHER_RELATIVE. */
  familyRelation: string | null;
  /** LEGAL_PERSONAL_REPRESENTATIVE_FOR — DEATH / INCAPACITY / MINOR / EPOA / OTHER. */
  lprReason: string | null;
  /** APPOINTOR_OF — CAN_REMOVE_TRUSTEE / CAN_APPOINT_TRUSTEE / ... */
  appointorPower: string[];
  powerType: string | null;
  powerSubject: string | null;
  structuralState: StructuralState;
  accountantVerified: boolean;
}

/** The whole graph for one user, loaded in memory. */
export interface EntityGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * An asset-scoped beneficial-ownership override (§3A, §7). NOT part of
 * `EntityGraph` — beneficial ownership attaches to a specific asset /
 * parcel, not to the entity graph. `resolveBeneficialOwner()` reads it.
 */
export interface BeneficialOwnershipRecord {
  id: string;
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  ownedObjectType: string;
  ownedObjectId: string;
  basis: BeneficialOwnershipBasis;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// =============================================================================
// VALIDITY RESULT SHAPES
// =============================================================================

/**
 * Issue severity → §6.1 three-state mapping:
 *   IMPOSSIBLE → IMPOSSIBLE_SYSTEM_ERROR  (service rejects the write)
 *   ERROR      → NON_COMPLIANT_BUT_RECORDED (recorded + flagged; tax downgraded)
 *   WARNING    → VALID, but surfaced to the user (e.g. "no appointor")
 *   INFO       → VALID, advisory only
 */
export type IssueSeverity = 'IMPOSSIBLE' | 'ERROR' | 'WARNING' | 'INFO';

export interface ValidityIssue {
  severity: IssueSeverity;
  /** Machine code, stable for UI mapping — e.g. 'SMSF_MEMBER_COUNT'. */
  code: string;
  message: string;
  /** The entity id or edge id this issue concerns. */
  subjectId: string;
}

export interface ValidityResult {
  state: StructuralState;
  issues: ValidityIssue[];
}

/**
 * Derive the §6.1 structural state from a set of issues. The most
 * severe issue wins: any IMPOSSIBLE → IMPOSSIBLE_SYSTEM_ERROR; else any
 * ERROR → NON_COMPLIANT_BUT_RECORDED; else VALID.
 */
export function deriveState(issues: ValidityIssue[]): StructuralState {
  if (issues.some((i) => i.severity === 'IMPOSSIBLE')) {
    return 'IMPOSSIBLE_SYSTEM_ERROR';
  }
  if (issues.some((i) => i.severity === 'ERROR')) {
    return 'NON_COMPLIANT_BUT_RECORDED';
  }
  return 'VALID';
}

// =============================================================================
// NODE-TYPE GROUPS — the vocabulary the §6 grammar is written in
// =============================================================================

/**
 * Natural persons. `PERSONAL_NAME` is retained for migration safety but
 * is semantically an `INDIVIDUAL` (§4) — the grammar treats them alike.
 * A `SOLE_TRADER` is NOT here: it is its own node, bound 1:1 to an
 * individual via `OPERATES_AS_SOLE_TRADER`.
 */
export const INDIVIDUAL_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'INDIVIDUAL',
  'PERSONAL_NAME',
]);

/** Registered companies — the share-capital / director grammar applies. */
export const COMPANY_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'COMPANY',
  'FOREIGN_COMPANY',
]);

/** Every trust shape. A trust is NOT a legal person — its trustee holds title (§3A, §5). */
export const TRUST_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'FIXED_TRUST',
  'HYBRID_TRUST',
  'BARE_TRUST',
  'TESTAMENTARY_TRUST',
]);

/**
 * Trust-style targets a `TRUSTEE_OF` edge may point at (§6.2) — every
 * trust plus the SMSF and the deceased estate (an executor is a kind of
 * trustee for the estate's assets).
 */
export const TRUSTEE_TARGET_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  ...TRUST_TYPES,
  'SMSF',
  'DECEASED_ESTATE',
]);

/**
 * Trusts that take `BENEFICIARY_OF` edges (§6.2) — discretionary-style
 * trusts plus SMSF and deceased estate. A unit trust uses `UNITHOLDER_OF`
 * (a fixed entitlement), not `BENEFICIARY_OF`.
 */
export const BENEFICIARY_TARGET_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'DISCRETIONARY_TRUST',
  'HYBRID_TRUST',
  'TESTAMENTARY_TRUST',
  'BARE_TRUST',
  'SMSF',
  'DECEASED_ESTATE',
]);

/**
 * Trusts that issue units (`UNITHOLDER_OF` target, §6.2). A hybrid trust
 * is included — it has unit features by definition (§4).
 */
export const UNIT_ISSUING_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'UNIT_TRUST',
  'HYBRID_TRUST',
]);

/** Discretionary-style trusts whose §6.4 validity needs trustee + beneficiaries + (warn) appointor. */
export const DISCRETIONARY_TRUST_TYPES: ReadonlySet<LegalEntityType> = new Set<LegalEntityType>([
  'DISCRETIONARY_TRUST',
  'HYBRID_TRUST',
  'TESTAMENTARY_TRUST',
]);

export const isIndividualType = (t: LegalEntityType): boolean => INDIVIDUAL_TYPES.has(t);
export const isCompanyType = (t: LegalEntityType): boolean => COMPANY_TYPES.has(t);
export const isTrustType = (t: LegalEntityType): boolean => TRUST_TYPES.has(t);

// =============================================================================
// TIME-BOUNDING
// =============================================================================

/**
 * Is the edge in force at `asOf`? Every edge is time-bounded (§3) —
 * `effectiveFrom` inclusive, `effectiveTo` exclusive (null = open-ended).
 * The graph layer is pure, so the caller always supplies `asOf` rather
 * than the function reading the clock — keeps results deterministic.
 */
export function isEdgeActiveAt(edge: GraphEdge, asOf: Date): boolean {
  if (edge.effectiveFrom.getTime() > asOf.getTime()) return false;
  if (edge.effectiveTo !== null && edge.effectiveTo.getTime() <= asOf.getTime()) {
    return false;
  }
  return true;
}
