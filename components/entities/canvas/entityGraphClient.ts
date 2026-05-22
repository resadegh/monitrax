/**
 * Phase 44 Part 1c — entity-structure canvas client data layer (§11A).
 *
 * Fetch + rehydration helpers for the canvas. The canvas is
 * PRESENTATIONAL ONLY (§8.4 / §11A) — this module fetches the graph
 * from `/api/entities/graph`, rehydrates JSON date strings into `Date`
 * objects so the result satisfies the pure `EntityGraph` contract, and
 * wraps the relationship write endpoints. It performs no aggregation
 * and no tax/financial arithmetic (§8.3).
 *
 * The rehydrated `CanvasGraph` is structurally a superset of the pure
 * `EntityGraph` — so `classifyGraph()` / `queries.ts` consume it
 * directly, no adapter needed.
 */

import type { GraphNode, GraphEdge } from '@/lib/entity-graph/types';
import type { EntityRelationshipType, BeneficiaryClass } from '@prisma/client';

// =============================================================================
// CANVAS GRAPH SHAPES
// =============================================================================

/** A canvas node — the pure `GraphNode` plus the box's display essentials. */
export interface CanvasNode extends GraphNode {
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
}

/** A canvas edge — the pure `GraphEdge` plus both entity names + detail-panel metadata. */
export interface CanvasEdge extends GraphEdge {
  fromEntityName: string;
  toEntityName: string;
  partnerInterestPct: number | null;
  notes: string | null;
  verifiedAt: Date | null;
}

/** The whole canvas graph. Structurally assignable to the pure `EntityGraph`. */
export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

// Raw (over-the-wire) shapes — dates arrive as ISO strings.
interface RawNode extends Omit<GraphNode, never> {
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
}
interface RawEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  fromEntityName: string;
  toEntityName: string;
  type: EntityRelationshipType;
  effectiveFrom: string;
  effectiveTo: string | null;
  beneficiaryClass: BeneficiaryClass | null;
  partnerInterestPct: number | null;
  familyRelation: string | null;
  lprReason: string | null;
  appointorPower: string[];
  powerType: string | null;
  powerSubject: string | null;
  notes: string | null;
  structuralState: GraphNode['structuralState'];
  accountantVerified: boolean;
  verifiedAt: string | null;
}

// =============================================================================
// ERROR EXTRACTION — handles both Monitrax API error shapes (CLAUDE.md §6.6)
// =============================================================================

/** Pull a human-readable message out of either API error shape. */
export function extractApiError(body: unknown, status: number, fallback: string): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) return `${status} ${err}`;
    if (err && typeof err === 'object') {
      const message = (err as { message?: unknown }).message;
      const code = (err as { code?: unknown }).code;
      if (typeof message === 'string' && message.length > 0) {
        return code ? `${status} ${message} (${code})` : `${status} ${message}`;
      }
      if (typeof code === 'string') return `${status} ${code}`;
    }
  }
  return `${status} ${fallback}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return extractApiError(body, res.status, fallback);
}

// =============================================================================
// READ
// =============================================================================

/** Fetch + rehydrate the user's entity graph for the canvas. */
export async function fetchEntityGraph(token: string): Promise<CanvasGraph> {
  const res = await fetch('/api/entities/graph', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to load the entity graph.'));
  const json = (await res.json()) as { data?: { nodes: RawNode[]; edges: RawEdge[] } };
  const data = json.data ?? { nodes: [], edges: [] };
  return {
    nodes: data.nodes.map((n) => ({ ...n })),
    edges: data.edges.map((e) => ({
      ...e,
      effectiveFrom: new Date(e.effectiveFrom),
      effectiveTo: e.effectiveTo ? new Date(e.effectiveTo) : null,
      verifiedAt: e.verifiedAt ? new Date(e.verifiedAt) : null,
    })),
  };
}

// =============================================================================
// WRITE — relationships
// =============================================================================

export interface NewRelationship {
  fromEntityId: string;
  toEntityId: string;
  type: EntityRelationshipType;
  effectiveFrom?: string;
  beneficiaryClass?: BeneficiaryClass | null;
  familyRelation?: string | null;
  lprReason?: string | null;
  notes?: string | null;
}

/** Create a relationship edge. Returns the new edge's id + its §6.1 validity. */
export async function createRelationshipRequest(
  token: string,
  body: NewRelationship,
): Promise<void> {
  const res = await fetch('/api/entities/relationships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to create the relationship.'));
}

/** End a relationship by setting `effectiveTo` (default: now). */
export async function endRelationshipRequest(
  token: string,
  relationshipId: string,
  effectiveTo?: string,
): Promise<void> {
  const res = await fetch(`/api/entities/relationships/${relationshipId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ effectiveTo: effectiveTo ?? new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to end the relationship.'));
}

/** Hard-delete a relationship (a mistaken entry). */
export async function deleteRelationshipRequest(
  token: string,
  relationshipId: string,
): Promise<void> {
  const res = await fetch(`/api/entities/relationships/${relationshipId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete the relationship.'));
}
