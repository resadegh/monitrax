/**
 * Phase 44 Part 1b — entity-graph traversal queries (SSOT).
 *
 * Pure functions over an in-memory `EntityGraph`. This is the single
 * source of truth for every "walk the graph" question — "who controls
 * X?", "the ownership chain of X", "who is the trustee of trust T?",
 * "is X an associate of Y?". The tax engine, the calc engines, the
 * entity UI and the AI advisor all READ these; none re-walks the graph
 * itself (CLAUDE.md §12.2 / PHASE_44_ENTITY_GRAPH.md §8.4).
 *
 * Pure: no I/O, no clock reads (the caller supplies `asOf`), no tax or
 * financial arithmetic (§8.3). Loading the graph from the database is
 * the service layer's job (Part 1b-ii).
 *
 * `getTrusteesOf()` is the canonical replacement for the frozen
 * `LegalEntity.parentEntityId` self-FK (§10) — every consumer that used
 * to read `parentEntityId` for "who is the trustee" reads it here.
 */

import type { EntityRelationshipType } from '@prisma/client';
import {
  type EntityGraph,
  type GraphNode,
  type GraphEdge,
  type BeneficialOwnershipRecord,
  isEdgeActiveAt,
} from './types';

// =============================================================================
// EDGE-TYPE GROUPS
// =============================================================================

/** Ownership edges — equity in an entity (§6.5 ownership chain). */
const OWNERSHIP_EDGE_TYPES: ReadonlySet<EntityRelationshipType> =
  new Set<EntityRelationshipType>(['SHAREHOLDER_OF', 'UNITHOLDER_OF', 'PARTNER_OF']);

/**
 * Control edges (§3A control sub-graph). `TRUSTEE_OF` and `DIRECTOR_OF`
 * are *determinative* — the holder directs the entity. The rest are
 * control *indicators*: an appointor "can typically appoint/remove the
 * trustee" but that is not universal proof of control (§5, corrected v3).
 */
const DETERMINATIVE_CONTROL_TYPES: ReadonlySet<EntityRelationshipType> =
  new Set<EntityRelationshipType>(['TRUSTEE_OF', 'DIRECTOR_OF']);

const INDICATOR_CONTROL_TYPES: ReadonlySet<EntityRelationshipType> =
  new Set<EntityRelationshipType>([
    'APPOINTOR_OF',
    'GUARDIAN_OF',
    'POWER_HOLDER_OF',
    'SHAREHOLDER_OF',
    'MEMBER_OF',
  ]);

// =============================================================================
// PRIMITIVES
// =============================================================================

/** Look up a node by id. Returns `undefined` if it is not in the graph. */
export function getNode(graph: EntityGraph, entityId: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === entityId);
}

/** Every edge in force at `asOf`. */
export function activeEdges(graph: EntityGraph, asOf: Date): GraphEdge[] {
  return graph.edges.filter((e) => isEdgeActiveAt(e, asOf));
}

/** Active edges leaving `entityId`, optionally filtered to one type. */
export function edgesFrom(
  graph: EntityGraph,
  entityId: string,
  asOf: Date,
  type?: EntityRelationshipType,
): GraphEdge[] {
  return graph.edges.filter(
    (e) =>
      e.fromEntityId === entityId &&
      isEdgeActiveAt(e, asOf) &&
      (type === undefined || e.type === type),
  );
}

/** Active edges arriving at `entityId`, optionally filtered to one type. */
export function edgesTo(
  graph: EntityGraph,
  entityId: string,
  asOf: Date,
  type?: EntityRelationshipType,
): GraphEdge[] {
  return graph.edges.filter(
    (e) =>
      e.toEntityId === entityId &&
      isEdgeActiveAt(e, asOf) &&
      (type === undefined || e.type === type),
  );
}

/** Distinct nodes for a set of entity ids, preserving graph order. */
function nodesFor(graph: EntityGraph, ids: Iterable<string>): GraphNode[] {
  const idSet = new Set(ids);
  return graph.nodes.filter((n) => idSet.has(n.id));
}

// =============================================================================
// TRUSTEE QUERIES — the parentEntityId replacement (§10)
// =============================================================================

/**
 * The trustee entities of a trust / SMSF / deceased estate, as at `asOf`.
 *
 * This is the canonical replacement for reading `LegalEntity.parentEntityId`
 * (§10). Unlike the single self-FK it replaces, it returns *every* current
 * trustee — a fund can have two individual trustees, and one corporate
 * trustee can be shared across several trusts.
 */
export function getTrusteesOf(
  graph: EntityGraph,
  trustEntityId: string,
  asOf: Date,
): GraphNode[] {
  const trusteeIds = edgesTo(graph, trustEntityId, asOf, 'TRUSTEE_OF').map(
    (e) => e.fromEntityId,
  );
  return nodesFor(graph, trusteeIds);
}

/** The trusts / SMSFs / estates an entity is currently a trustee of. */
export function getTrustsAdministeredBy(
  graph: EntityGraph,
  trusteeEntityId: string,
  asOf: Date,
): GraphNode[] {
  const trustIds = edgesFrom(graph, trusteeEntityId, asOf, 'TRUSTEE_OF').map(
    (e) => e.toEntityId,
  );
  return nodesFor(graph, trustIds);
}

// =============================================================================
// CONTROL
// =============================================================================

export interface ControlLink {
  controllerEntityId: string;
  via: EntityRelationshipType;
  /**
   * `true` for `TRUSTEE_OF` / `DIRECTOR_OF` — the holder directs the
   * entity. `false` for appointor / guardian / power-holder / shareholder
   * / member — a control *indicator*, not proof (§5, §3A). A consumer
   * doing a real control test must still weigh the deed and shareholdings.
   */
  determinative: boolean;
}

export interface ControlResult {
  entityId: string;
  controllers: ControlLink[];
}

/**
 * Who controls / influences `entityId` — the §3A control sub-graph.
 * Returns determinative controllers (trustee, director) and control
 * indicators (appointor, guardian, power-holder, shareholder, member)
 * separately flagged. This is a *structural* answer; it is not a
 * conclusive legal control determination (§5, §9).
 */
export function getControllersOf(
  graph: EntityGraph,
  entityId: string,
  asOf: Date,
): ControlResult {
  const controllers: ControlLink[] = [];
  for (const edge of edgesTo(graph, entityId, asOf)) {
    if (DETERMINATIVE_CONTROL_TYPES.has(edge.type)) {
      controllers.push({
        controllerEntityId: edge.fromEntityId,
        via: edge.type,
        determinative: true,
      });
    } else if (INDICATOR_CONTROL_TYPES.has(edge.type)) {
      controllers.push({
        controllerEntityId: edge.fromEntityId,
        via: edge.type,
        determinative: false,
      });
    }
  }
  return { entityId, controllers };
}

// =============================================================================
// OWNERSHIP CHAIN
// =============================================================================

export interface OwnershipLink {
  ownerEntityId: string;
  ownedEntityId: string;
  via: EntityRelationshipType;
}

export interface OwnershipChainResult {
  rootEntityId: string;
  /** Every ownership edge in the upward closure from the root. */
  links: OwnershipLink[];
  /**
   * `true` if a circular cross-holding was encountered (§6.5). Circular
   * cross-shareholdings are legal and recorded — but a consumer must NOT
   * recursively attribute value/tax through an unresolved cycle.
   */
  cycleDetected: boolean;
}

/**
 * The upward ownership closure of `entityId` — who holds equity in it,
 * and recursively who holds equity in those owners — via `SHAREHOLDER_OF`
 * / `UNITHOLDER_OF` / `PARTNER_OF` (§6.5). Structure only: the percentage
 * attribution belongs to the calc/tax engines reading `ShareParcel`.
 */
export function getOwnershipChain(
  graph: EntityGraph,
  entityId: string,
  asOf: Date,
): OwnershipChainResult {
  const links: OwnershipLink[] = [];
  const seenLink = new Set<string>();
  const onStack = new Set<string>();
  let cycleDetected = false;

  const walk = (ownedId: string): void => {
    if (onStack.has(ownedId)) {
      cycleDetected = true;
      return;
    }
    onStack.add(ownedId);
    for (const edge of edgesTo(graph, ownedId, asOf)) {
      if (!OWNERSHIP_EDGE_TYPES.has(edge.type)) continue;
      const linkKey = `${edge.fromEntityId}>${edge.toEntityId}:${edge.type}`;
      if (!seenLink.has(linkKey)) {
        seenLink.add(linkKey);
        links.push({
          ownerEntityId: edge.fromEntityId,
          ownedEntityId: edge.toEntityId,
          via: edge.type,
        });
      }
      walk(edge.fromEntityId);
    }
    onStack.delete(ownedId);
  };

  walk(entityId);
  return { rootEntityId: entityId, links, cycleDetected };
}

// =============================================================================
// CYCLE DETECTION (§6.5) — traversal primitives
// =============================================================================

/**
 * Find a cycle in the `TRUSTEE_OF` control chain, if one exists (§6.5).
 * No entity may be its own trustee-ancestor. Returns the cycle as an
 * ordered list of entity ids (the first id repeats conceptually at the
 * end), or `null` if the chain is acyclic. `validityMatrix` applies the
 * §6.5 judgement — a `TRUSTEE_OF` self-cycle is an IMPOSSIBLE_SYSTEM_ERROR.
 */
export function findTrusteeCycle(graph: EntityGraph, asOf: Date): string[] | null {
  return findDirectedCycle(graph, asOf, (e) => e.type === 'TRUSTEE_OF');
}

/**
 * Find every cycle in the ownership graph (`SHAREHOLDER_OF` +
 * `UNITHOLDER_OF` + `PARTNER_OF`) — circular cross-holdings (§6.5).
 * These are LEGAL: they are detected and recorded, never rejected.
 * Returns one representative entity-id list per distinct cycle.
 */
export function findOwnershipCycles(graph: EntityGraph, asOf: Date): string[][] {
  return findAllDirectedCycles(graph, asOf, (e) => OWNERSHIP_EDGE_TYPES.has(e.type));
}

/** Depth-first search for a single directed cycle over a filtered edge set. */
function findDirectedCycle(
  graph: EntityGraph,
  asOf: Date,
  edgeFilter: (e: GraphEdge) => boolean,
): string[] | null {
  const adjacency = buildAdjacency(graph, asOf, edgeFilter);
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const dfs = (nodeId: string): string[] | null => {
    visited.add(nodeId);
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (onStack.has(next)) {
        const start = stack.indexOf(next);
        return stack.slice(start);
      }
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    onStack.delete(nodeId);
    return null;
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      const found = dfs(node.id);
      if (found) return found;
    }
  }
  return null;
}

/** Depth-first search collecting every distinct directed cycle. */
function findAllDirectedCycles(
  graph: EntityGraph,
  asOf: Date,
  edgeFilter: (e: GraphEdge) => boolean,
): string[][] {
  const adjacency = buildAdjacency(graph, asOf, edgeFilter);
  const cycles: string[][] = [];
  const seenCycle = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visited = new Set<string>();

  const recordCycle = (cycle: string[]): void => {
    // Canonicalise (rotate to the smallest id) so the same cycle found
    // from two entry points is not double-counted.
    const min = [...cycle].sort()[0];
    const rotateAt = cycle.indexOf(min);
    const canonical = [...cycle.slice(rotateAt), ...cycle.slice(0, rotateAt)];
    const key = canonical.join('>');
    if (!seenCycle.has(key)) {
      seenCycle.add(key);
      cycles.push(canonical);
    }
  };

  const dfs = (nodeId: string): void => {
    visited.add(nodeId);
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (onStack.has(next)) {
        const start = stack.indexOf(next);
        recordCycle(stack.slice(start));
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    onStack.delete(nodeId);
  };

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }
  return cycles;
}

/** Build a `from → [to, ...]` adjacency map over the filtered active edges. */
function buildAdjacency(
  graph: EntityGraph,
  asOf: Date,
  edgeFilter: (e: GraphEdge) => boolean,
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!isEdgeActiveAt(edge, asOf) || !edgeFilter(edge)) continue;
    const list = adjacency.get(edge.fromEntityId);
    if (list) list.push(edge.toEntityId);
    else adjacency.set(edge.fromEntityId, [edge.toEntityId]);
  }
  return adjacency;
}

// =============================================================================
// ASSOCIATE TEST (Div 7A input)
// =============================================================================

/**
 * A *structural* approximation of whether two entities are associates
 * (Div 7A / SMSF related-party / land-tax grouping input). Returns
 * `true` when the graph shows a `FAMILY_MEMBER_OF` link, an
 * accountant-confirmed `ASSOCIATE_OF` link, or a control relationship
 * between the two — in either direction.
 *
 * This is NOT the authoritative ITAA 1936 s318 associate test — that
 * test is the tax engine's, applied in Part 2 (§8.2 / §8.3). This
 * function is a graph-structural indicator the engine consumes.
 */
export function isAssociateOf(
  graph: EntityGraph,
  entityA: string,
  entityB: string,
  asOf: Date,
): boolean {
  if (entityA === entityB) return false;

  const directLink = graph.edges.some(
    (e) =>
      isEdgeActiveAt(e, asOf) &&
      (e.type === 'FAMILY_MEMBER_OF' || e.type === 'ASSOCIATE_OF') &&
      ((e.fromEntityId === entityA && e.toEntityId === entityB) ||
        (e.fromEntityId === entityB && e.toEntityId === entityA)),
  );
  if (directLink) return true;

  const aControlsB = getControllersOf(graph, entityB, asOf).controllers.some(
    (c) => c.controllerEntityId === entityA,
  );
  const bControlsA = getControllersOf(graph, entityA, asOf).controllers.some(
    (c) => c.controllerEntityId === entityB,
  );
  return aControlsB || bControlsA;
}

// =============================================================================
// BENEFICIAL OWNERSHIP (§3A)
// =============================================================================

/**
 * Resolve the beneficial owner of a specific asset / parcel (§3A, §7).
 * Legal title equals beneficial ownership *unless* an active
 * `BeneficialOwnershipOverride` says otherwise (nominee, bare trust,
 * custodian). Returns the beneficial owner's entity id — falling back
 * to the legal owner when no override applies.
 */
export function resolveBeneficialOwner(
  legalOwnerEntityId: string,
  ownedObjectType: string,
  ownedObjectId: string,
  overrides: BeneficialOwnershipRecord[],
  asOf: Date,
): string {
  const match = overrides.find(
    (o) =>
      o.legalOwnerEntityId === legalOwnerEntityId &&
      o.ownedObjectType === ownedObjectType &&
      o.ownedObjectId === ownedObjectId &&
      o.effectiveFrom.getTime() <= asOf.getTime() &&
      (o.effectiveTo === null || o.effectiveTo.getTime() > asOf.getTime()),
  );
  return match ? match.beneficialOwnerEntityId : legalOwnerEntityId;
}
