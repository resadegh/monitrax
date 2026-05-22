/**
 * Phase 44 Part 1b-ii — the entity-relationship service (SSOT writer).
 *
 * The ONLY writer of `EntityRelationship`. Every API route and UI flow
 * that mutates the typed entity graph goes through here — a relationship
 * is created / ended / deleted nowhere else (CLAUDE.md §12.2,
 * PHASE_44_ENTITY_GRAPH.md §8.4).
 *
 * The contract on every write:
 *   1. Ownership-checked — both entities belong to the calling user.
 *   2. Duplicate-guarded — a new edge may not overlap an existing
 *      [from, to, type] edge's time window (without this, "≥1 director"
 *      passes with two copies of one director — schema §7 note).
 *   3. Validity-classified INSIDE the write transaction — `validityMatrix`
 *      grades the edge (§6.2) and the whole graph (§6.5). Only an
 *      IMPOSSIBLE_SYSTEM_ERROR is rejected; a NON_COMPLIANT structure is
 *      RECORDED and flagged, never erased (§6.1, §9).
 *   4. Structural state persisted — the new edge's `structuralState`, plus
 *      every entity whose §6.1 state changed as a result of the write.
 *   5. Audited — fire-and-forget after the transaction commits.
 *
 * This service performs NO tax or financial arithmetic (§8.3) — it writes
 * the graph and reads the pure `lib/entity-graph/` rules engine.
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, EntityRelationshipType, BeneficiaryClass } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';
import type { EntityGraph, GraphNode, GraphEdge, ValidityResult } from '@/lib/entity-graph/types';
import { classifyEdge, classifyGraph } from '@/lib/entity-graph/validityMatrix';

// =============================================================================
// CANVAS GRAPH-VIEW READ — the single read the Part 1c entity-structure
// canvas consumes (PHASE_44_ENTITY_GRAPH.md §11A). One round-trip: nodes
// (with the display fields the role-coloured boxes need) + edges (with the
// metadata the relationship-detail panel reads). The canvas re-runs the
// pure `lib/entity-graph/` rules engine over this shape (§8.4) — it never
// re-aggregates and performs no tax/financial arithmetic (§8.3).
// =============================================================================

/** A canvas node — the pure `GraphNode` plus the box's display essentials. */
export interface EntityGraphViewNode extends GraphNode {
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
}

/** A canvas edge — the pure `GraphEdge` plus both entity names + detail-panel metadata. */
export interface EntityGraphViewEdge extends GraphEdge {
  fromEntityName: string;
  toEntityName: string;
  partnerInterestPct: number | null;
  notes: string | null;
  verifiedAt: Date | null;
}

export interface EntityGraphView {
  nodes: EntityGraphViewNode[];
  edges: EntityGraphViewEdge[];
}

/**
 * Load a user's entity graph in the canvas-ready shape. This is NOT a
 * duplicate of `/api/entities` (a flat list) — it returns the relational
 * graph (nodes + typed edges + structural metadata) the §11A canvas
 * renders. Tenancy-scoped to the calling user.
 */
export async function getEntityGraphView(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<EntityGraphView> {
  const [entities, relationships] = await Promise.all([
    client.legalEntity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        role: true,
        name: true,
        abn: true,
        acn: true,
        tfnEncrypted: true,
        companySubtype: true,
        trustType: true,
        estateAdministrationStatus: true,
        structuralState: true,
        accountantVerified: true,
        unsupportedStructure: true,
      },
    }),
    client.entityRelationship.findMany({
      where: { userId },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        id: true,
        fromEntityId: true,
        toEntityId: true,
        type: true,
        effectiveFrom: true,
        effectiveTo: true,
        beneficiaryClass: true,
        partnerInterestPct: true,
        familyRelation: true,
        lprReason: true,
        appointorPower: true,
        powerType: true,
        powerSubject: true,
        notes: true,
        structuralState: true,
        accountantVerified: true,
        verifiedAt: true,
        fromEntity: { select: { name: true } },
        toEntity: { select: { name: true } },
      },
    }),
  ]);

  return {
    nodes: entities.map((e) => ({
      id: e.id,
      type: e.type,
      role: e.role,
      name: e.name,
      abn: e.abn,
      acn: e.acn,
      hasTfn: e.tfnEncrypted != null && e.tfnEncrypted.length > 0,
      companySubtype: e.companySubtype,
      trustType: e.trustType,
      estateAdministrationStatus: e.estateAdministrationStatus,
      structuralState: e.structuralState,
      accountantVerified: e.accountantVerified,
      unsupportedStructure: e.unsupportedStructure,
    })),
    edges: relationships.map((r) => ({
      id: r.id,
      fromEntityId: r.fromEntityId,
      toEntityId: r.toEntityId,
      fromEntityName: r.fromEntity.name,
      toEntityName: r.toEntity.name,
      type: r.type,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      beneficiaryClass: r.beneficiaryClass,
      partnerInterestPct: r.partnerInterestPct === null ? null : Number(r.partnerInterestPct),
      familyRelation: r.familyRelation,
      lprReason: r.lprReason,
      appointorPower: r.appointorPower,
      powerType: r.powerType,
      powerSubject: r.powerSubject,
      notes: r.notes,
      structuralState: r.structuralState,
      accountantVerified: r.accountantVerified,
      verifiedAt: r.verifiedAt,
    })),
  };
}

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

// =============================================================================
// ERRORS
// =============================================================================

export type RelationshipErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'DUPLICATE_EDGE'
  | 'IMPOSSIBLE_EDGE'
  | 'RELATIONSHIP_NOT_FOUND';

/**
 * Thrown when a write is rejected. Only an IMPOSSIBLE_SYSTEM_ERROR edge,
 * a duplicate, a missing entity or a missing relationship is rejected —
 * a legally non-compliant (but representable) structure is NOT thrown;
 * it is recorded with `structuralState = NON_COMPLIANT_BUT_RECORDED`.
 * The route layer maps this to a 4xx.
 */
export class RelationshipValidationError extends Error {
  constructor(
    public readonly code: RelationshipErrorCode,
    message: string,
    public readonly issues?: ValidityResult['issues'],
  ) {
    super(message);
    this.name = 'RelationshipValidationError';
  }
}

// =============================================================================
// GRAPH LOADING — Prisma rows → the pure in-memory `EntityGraph`
// =============================================================================

const NODE_SELECT = {
  id: true,
  type: true,
  role: true,
  name: true,
  companySubtype: true,
  trustType: true,
  estateAdministrationStatus: true,
  structuralState: true,
  accountantVerified: true,
  unsupportedStructure: true,
} as const;

const EDGE_SELECT = {
  id: true,
  fromEntityId: true,
  toEntityId: true,
  type: true,
  effectiveFrom: true,
  effectiveTo: true,
  beneficiaryClass: true,
  familyRelation: true,
  lprReason: true,
  appointorPower: true,
  powerType: true,
  powerSubject: true,
  structuralState: true,
  accountantVerified: true,
} as const;

/**
 * Load a user's full entity graph into the pure in-memory `EntityGraph`
 * shape the `lib/entity-graph/` rules engine consumes. Tenancy-scoped —
 * only the calling user's entities + edges.
 */
export async function loadEntityGraph(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<EntityGraph> {
  const [nodes, edges] = await Promise.all([
    client.legalEntity.findMany({ where: { userId }, select: NODE_SELECT }),
    client.entityRelationship.findMany({ where: { userId }, select: EDGE_SELECT }),
  ]);
  return { nodes: nodes as GraphNode[], edges: edges as GraphEdge[] };
}

// =============================================================================
// HELPERS
// =============================================================================

/** Do two time windows overlap? A null end is treated as open-ended (+∞). */
function windowsOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = bTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return aFrom.getTime() < bEnd && bFrom.getTime() < aEnd;
}

/**
 * Re-classify the whole graph after a write and persist every entity
 * whose §6.1 structural state changed. Bounded — one user's graph is
 * small — and correct: adding one edge can change a transitively-related
 * entity's validity (e.g. a new DIRECTOR_OF edge changes the SMSF whose
 * corporate trustee that company is). Runs inside the caller's transaction.
 */
async function reconcileEntityStates(
  userId: string,
  graph: EntityGraph,
  tx: PrismaTxOrClient,
): Promise<void> {
  const report = classifyGraph(graph, new Date());
  for (const node of graph.nodes) {
    const computed = report.entities.get(node.id)?.state;
    if (computed && computed !== node.structuralState) {
      // §12.11 — `structuralState` is a system-derived classification
      // owned exclusively by the validity engine; never user-entered data.
      // The composite `where` confines the write to the caller's entity.
      await tx.legalEntity.update({
        where: { id: node.id, userId },
        data: { structuralState: computed },
      });
    }
  }
}

// =============================================================================
// CREATE
// =============================================================================

export interface CreateRelationshipInput {
  fromEntityId: string;
  toEntityId: string;
  type: EntityRelationshipType;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  beneficiaryClass?: BeneficiaryClass | null;
  partnerInterestPct?: number | null;
  partnerCapitalAmount?: number | null;
  familyRelation?: string | null;
  lprReason?: string | null;
  appointorPower?: string[];
  powerType?: string | null;
  powerSubject?: string | null;
  tfnQuoted?: boolean | null;
  sourceDocumentId?: string | null;
  notes?: string | null;
}

export interface RelationshipWriteResult {
  relationshipId: string;
  /** The §6.1 classification of the written edge. */
  validity: ValidityResult;
}

/**
 * Create an `EntityRelationship`. The whole operation runs in one
 * transaction so the §6 validity classification cannot race a concurrent
 * write. An IMPOSSIBLE_SYSTEM_ERROR edge is rejected; a NON_COMPLIANT
 * edge is recorded with its flagged state (§6.1).
 */
export async function createRelationship(
  userId: string,
  input: CreateRelationshipInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<RelationshipWriteResult> {
  const effectiveFrom = input.effectiveFrom ?? new Date();
  const effectiveTo = input.effectiveTo ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const graph = await loadEntityGraph(userId, tx);
    const fromNode = graph.nodes.find((n) => n.id === input.fromEntityId);
    const toNode = graph.nodes.find((n) => n.id === input.toEntityId);
    if (!fromNode || !toNode) {
      throw new RelationshipValidationError(
        'ENTITY_NOT_FOUND',
        'One or both entities in this relationship do not exist or are not owned by you.',
      );
    }

    // Duplicate guard — reject an overlapping [from, to, type] window.
    const duplicate = graph.edges.some(
      (e) =>
        e.fromEntityId === input.fromEntityId &&
        e.toEntityId === input.toEntityId &&
        e.type === input.type &&
        windowsOverlap(e.effectiveFrom, e.effectiveTo, effectiveFrom, effectiveTo),
    );
    if (duplicate) {
      throw new RelationshipValidationError(
        'DUPLICATE_EDGE',
        'An overlapping relationship of this type already exists between these entities for this period.',
      );
    }

    // Classify the proposed edge against the §6.2 grammar.
    const proposed: GraphEdge = {
      id: '__proposed__',
      fromEntityId: input.fromEntityId,
      toEntityId: input.toEntityId,
      type: input.type,
      effectiveFrom,
      effectiveTo,
      beneficiaryClass: input.beneficiaryClass ?? null,
      familyRelation: input.familyRelation ?? null,
      lprReason: input.lprReason ?? null,
      appointorPower: input.appointorPower ?? [],
      powerType: input.powerType ?? null,
      powerSubject: input.powerSubject ?? null,
      structuralState: 'VALID',
      accountantVerified: false,
    };
    const validity = classifyEdge(graph, proposed, new Date());
    if (validity.state === 'IMPOSSIBLE_SYSTEM_ERROR') {
      throw new RelationshipValidationError(
        'IMPOSSIBLE_EDGE',
        'This relationship is impossible inside the data model and cannot be recorded.',
        validity.issues,
      );
    }

    // Persist the edge with its computed §6.1 state (VALID or
    // NON_COMPLIANT_BUT_RECORDED — both are recorded, §9).
    const created = await tx.entityRelationship.create({
      data: {
        userId,
        fromEntityId: input.fromEntityId,
        toEntityId: input.toEntityId,
        type: input.type,
        effectiveFrom,
        effectiveTo,
        beneficiaryClass: input.beneficiaryClass ?? null,
        partnerInterestPct: input.partnerInterestPct ?? null,
        partnerCapitalAmount: input.partnerCapitalAmount ?? null,
        familyRelation: input.familyRelation ?? null,
        lprReason: input.lprReason ?? null,
        appointorPower: input.appointorPower ?? [],
        powerType: input.powerType ?? null,
        powerSubject: input.powerSubject ?? null,
        tfnQuoted: input.tfnQuoted ?? null,
        sourceDocumentId: input.sourceDocumentId ?? null,
        notes: input.notes ?? null,
        structuralState: validity.state,
      },
      select: { id: true },
    });

    // Re-classify the graph with the new edge present + persist deltas.
    proposed.id = created.id;
    proposed.structuralState = validity.state;
    await reconcileEntityStates(userId, { nodes: graph.nodes, edges: [...graph.edges, proposed] }, tx);

    return { relationshipId: created.id, validity };
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'EntityRelationship',
    entityId: result.relationshipId,
    metadata: { type: input.type, structuralState: result.validity.state },
    ...requestMeta,
  }).catch(() => {});

  return result;
}

// =============================================================================
// END (time-bound close) + DELETE
// =============================================================================

/**
 * End an `EntityRelationship` by setting its `effectiveTo` — a director
 * resigns, shares are sold, a trust vests. This is the normal way a
 * relationship stops being current; the edge is retained for history
 * (CGT dates, director tenure all depend on it — §3).
 */
export async function endRelationship(
  userId: string,
  relationshipId: string,
  effectiveTo: Date,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.entityRelationship.findFirst({
      where: { id: relationshipId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new RelationshipValidationError(
        'RELATIONSHIP_NOT_FOUND',
        'Relationship not found or not owned by you.',
      );
    }
    // §12.11 — composite `where` confines the write to the caller's edge;
    // `effectiveTo` is the only column written.
    await tx.entityRelationship.update({
      where: { id: relationshipId, userId },
      data: { effectiveTo },
    });
    await reconcileEntityStates(userId, await loadEntityGraph(userId, tx), tx);
  });

  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'EntityRelationship',
    entityId: relationshipId,
    metadata: { ended: true },
    ...requestMeta,
  }).catch(() => {});
}

/**
 * Hard-delete an `EntityRelationship` — for a mistaken entry. A
 * relationship that genuinely ended should be closed with
 * `endRelationship` instead, so the history is kept (§3).
 */
export async function deleteRelationship(
  userId: string,
  relationshipId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.entityRelationship.findFirst({
      where: { id: relationshipId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new RelationshipValidationError(
        'RELATIONSHIP_NOT_FOUND',
        'Relationship not found or not owned by you.',
      );
    }
    // §12.11 — composite `where` confines the delete to the caller's edge.
    await tx.entityRelationship.delete({ where: { id: relationshipId, userId } });
    await reconcileEntityStates(userId, await loadEntityGraph(userId, tx), tx);
  });

  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'EntityRelationship',
    entityId: relationshipId,
    ...requestMeta,
  }).catch(() => {});
}

// =============================================================================
// READ
// =============================================================================

export interface RelationshipSummary {
  id: string;
  fromEntityId: string;
  fromEntityName: string;
  toEntityId: string;
  toEntityName: string;
  type: EntityRelationshipType;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  structuralState: GraphNode['structuralState'];
  accountantVerified: boolean;
}

/** List a user's relationships, newest first, with both entity names resolved. */
export async function listRelationships(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<RelationshipSummary[]> {
  const rows = await client.entityRelationship.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromEntityId: true,
      toEntityId: true,
      type: true,
      effectiveFrom: true,
      effectiveTo: true,
      structuralState: true,
      accountantVerified: true,
      fromEntity: { select: { name: true } },
      toEntity: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fromEntityId: r.fromEntityId,
    fromEntityName: r.fromEntity.name,
    toEntityId: r.toEntityId,
    toEntityName: r.toEntity.name,
    type: r.type,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    structuralState: r.structuralState,
    accountantVerified: r.accountantVerified,
  }));
}

// =============================================================================
// ACCOUNTANT VERIFICATION (§9 — the accountant-review share-pass, Q4)
// =============================================================================

/**
 * Flip a relationship's `accountantVerified` provenance flag and stamp
 * `verifiedAt`. The accountant-review share-pass turns this flag into a
 * professional sign-off (PHASE_44_ENTITY_GRAPH.md §9): the user hands
 * their accountant the structure report, the accountant confirms, the
 * user marks the confirmed edges verified.
 *
 * This changes provenance only — never structure — so the §6 validity
 * classification is not re-run. No tax arithmetic (§8.3).
 */
export async function setRelationshipAccountantVerified(
  userId: string,
  relationshipId: string,
  verified: boolean,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.entityRelationship.findFirst({
    where: { id: relationshipId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new RelationshipValidationError(
      'RELATIONSHIP_NOT_FOUND',
      'Relationship not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write to the caller's edge;
  // only the provenance columns (`accountantVerified` + `verifiedAt`) are
  // written. Neither is user-entered financial data.
  await prisma.entityRelationship.update({
    where: { id: relationshipId, userId },
    data: { accountantVerified: verified, verifiedAt: verified ? new Date() : null },
  });

  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'EntityRelationship',
    entityId: relationshipId,
    metadata: { accountantVerified: verified },
    ...requestMeta,
  }).catch(() => {});
}

export { windowsOverlap as _windowsOverlapForTest };
