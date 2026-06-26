/**
 * Phase 53 NI-5b — Neomatrix STRUCTURAL graph admin API (server-aggregated).
 *
 * GET /api/admin/neomatrix/structural
 *   Serves the Layer-0 Graphify structural graph (8,589 symbols across lib/ +
 *   app/) — the whole-codebase skeleton, distinct from the verified SEMANTIC
 *   Neomatrix (`/graph`, ~231 nodes).
 *
 * AGGREGATED SERVER-SIDE so the browser never has to download or process the
 * full 2.7 MB graph (that 2.7 MB payload was the cause of the "structural view
 * won't load" hang — NI-5b.2). The default response is ~97 directory clusters
 * (a few KB). Drill-down + search are param-driven and capped:
 *
 *   (default)        → directory clusters: one super-node per top-level dir +
 *                      aggregated cross-dir dependency edges (tiny).
 *   ?dir=lib/cfo     → that directory's symbols (top 800 by degree) + their
 *                      intra-dir edges.
 *   ?q=netWorth      → symbols whose id/label matches (top 800) + edges among them.
 *
 * Metadata only — ids, labels, file:line, structural relations (no CDR/user
 * data, Phase 53 §9). Admin-gated (file:line is internal architecture).
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

const CAP = 800; // max symbols returned for a drill / search (keeps payloads small)
const topDir = (file: string | null): string => (file ? file.split('/').slice(0, 2).join('/') : '(none)');

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

  const nodeTuples = structural.nodes as RawNodeTuple[];
  const edgeTuples = structural.edges as RawEdgeTuple[];
  const fileById = new Map<string, string>();
  for (const [id, , file] of nodeTuples) fileById.set(id, file);

  const url = new URL(request.url);
  const dir = url.searchParams.get('dir');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  // Degree (used to rank which symbols to keep when capping a drill / search).
  const degree = new Map<string, number>();
  for (const [, from, to] of edgeTuples) {
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
  }

  // ── SEARCH — symbols matching the query, across the whole codebase ──────────
  if (q) {
    const matched = nodeTuples.filter(([id, label]) => label.toLowerCase().includes(q) || id.toLowerCase().includes(q));
    const capped = matched
      .sort((a, b) => (degree.get(b[0]) ?? 0) - (degree.get(a[0]) ?? 0))
      .slice(0, CAP);
    return ok(symbolsPayload('search', capped, edgeTuples), { matched: matched.length });
  }

  // ── DRILL — one directory's symbols ─────────────────────────────────────────
  if (dir) {
    const inDir = nodeTuples.filter(([, , file]) => topDir(file) === dir);
    const capped = inDir
      .sort((a, b) => (degree.get(b[0]) ?? 0) - (degree.get(a[0]) ?? 0))
      .slice(0, CAP);
    return ok(symbolsPayload('dir', capped, edgeTuples, dir), { total: inDir.length });
  }

  // ── DEFAULT — directory-cluster overview (tiny) ─────────────────────────────
  const count = new Map<string, number>();
  for (const [, , file] of nodeTuples) {
    const d = topDir(file);
    count.set(d, (count.get(d) ?? 0) + 1);
  }
  const clusterEdge = new Map<string, number>();
  for (const [, from, to] of edgeTuples) {
    const a = topDir(fileById.get(from) ?? null);
    const b = topDir(fileById.get(to) ?? null);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    clusterEdge.set(k, (clusterEdge.get(k) ?? 0) + 1);
  }
  const nodes = [...count.entries()].map(([d, c]) => ({ id: `dir::${d}`, label: d, count: c }));
  const edges = [...clusterEdge.entries()].map(([k, weight]) => {
    const [a, b] = k.split('|');
    return { from: `dir::${a}`, to: `dir::${b}`, weight };
  });
  return ok({ mode: 'clusters', nodes, edges }, { directories: nodes.length, totalSymbols: nodeTuples.length });
}

function symbolsPayload(
  mode: 'dir' | 'search',
  capped: RawNodeTuple[],
  edgeTuples: RawEdgeTuple[],
  dir?: string,
) {
  const visible = new Set(capped.map(([id]) => id));
  const nodes = capped.map(([id, label, file, line]) => ({ id, label, file, line }));
  const edges: Array<{ from: string; to: string; type: string }> = [];
  for (const [type, from, to] of edgeTuples) {
    if (visible.has(from) && visible.has(to)) edges.push({ from, to, type });
  }
  return { mode, dir, nodes, edges, capped: capped.length };
}

function ok(data: Record<string, unknown>, meta: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, meta: { timestamp: new Date().toISOString(), ...meta } });
}
