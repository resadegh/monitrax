/**
 * /api/entities/graph — Phase 44 Part 1c
 *
 * GET — the user's entity graph in the canvas-ready shape: nodes (with
 *       the display fields the role-coloured boxes need) + typed,
 *       time-bounded edges (with the metadata the relationship-detail
 *       panel reads). One round-trip for the §11A entity-structure
 *       canvas (PHASE_44_ENTITY_GRAPH.md §11A).
 *
 * This is NOT a duplicate of `/api/entities` (CLAUDE.md §12.4) — that
 * returns a flat entity list; this returns the relational graph
 * (nodes + edges). Same two-SSOT rationale as master-snapshot vs
 * portfolio/snapshot (CLAUDE.md §12.2).
 *
 * SSOT: thin handler. The read lives in `getEntityGraphView()` in
 * `lib/services/entityRelationshipService.ts` (CLAUDE.md §6.1, §12.2).
 * No tax/financial arithmetic — the graph is a pure data layer (§8.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getEntityGraphView } from '@/lib/services/entityRelationshipService';

export const GET = withPermission('entity.read', async (_request: NextRequest, auth) => {
  try {
    const graph = await getEntityGraphView(auth.userId);
    return NextResponse.json({
      data: graph,
      _meta: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
    });
  } catch (error) {
    console.error('Entity graph view error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load entity graph.';
    return NextResponse.json(
      { error: { code: 'GRAPH_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});
