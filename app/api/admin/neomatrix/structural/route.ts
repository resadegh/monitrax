/**
 * Phase 53 NI-5b — Neomatrix STRUCTURAL graph admin API.
 *
 * GET /api/admin/neomatrix/structural
 *   Returns the Layer-0 Graphify structural graph (`structural-graph.json`)
 *   for the admin explorer's "Structural" view — the whole-codebase symbol
 *   skeleton (8,587 nodes / 15,041 edges across lib/ + app/), distinct from
 *   the verified SEMANTIC Neomatrix (`/graph`, ~231 nodes).
 *
 * This is the "full scale" view: every function/file/symbol the Graphify
 * AST pass extracted, the completeness denominator the build gate counts
 * against. It is METADATA ONLY (ids, labels, file:line, structural relations
 * like contains/calls/imports) — NO CDR/user data (Phase 53 §9). Admin-gated
 * because file:line is internal architecture, not user content.
 *
 * The on-disk shape is compact arrays (node = [id, label, file, line];
 * edge = [relation, from, to, file, line]); we expand to the {nodes, edges}
 * object shape the explorer consumes. This route is lazy-fetched only when
 * the user switches to the Structural view (it is ~2 MB), so it never bloats
 * the default page load.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import structural from '@/docs/financial-logic/graph/structural/structural-graph.json';

// Compact on-disk tuples. Kept local so a graphify format change is caught here.
type RawNodeTuple = [id: string, label: string, file: string, line: number];
type RawEdgeTuple = [relation: string, from: string, to: string, file: string, line: number];

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // Same permission as the semantic graph + calc-audit — an architecture surface.
  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'You do not have permission to view the Neomatrix structural graph',
        },
      },
      { status: 403 },
    );
  }

  // Expand compact tuples → the {nodes, edges} object shape the explorer reads.
  // kind='structural' so the explorer renders it without the semantic fields
  // (formula/authority/lineage-as-data-flow) it doesn't have.
  const nodes = (structural.nodes as RawNodeTuple[]).map(([id, label, file, line]) => ({
    id,
    kind: 'structural',
    label,
    file,
    line,
  }));
  const edges = (structural.edges as RawEdgeTuple[]).map(([type, from, to]) => ({ from, to, type }));

  return NextResponse.json({
    success: true,
    data: { version: structural._meta?.generator ?? 'structural', nodes, edges },
    meta: {
      timestamp: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      files: structural._meta?.counts?.files ?? null,
    },
  });
}
