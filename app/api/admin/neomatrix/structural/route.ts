/**
 * Phase 53 NI-5b — Neomatrix STRUCTURAL graph admin API (server-aggregated).
 *
 * GET /api/admin/neomatrix/structural
 *   Serves the Layer-0 structural graph — the whole-codebase skeleton, distinct
 *   from the verified SEMANTIC Neomatrix (`/graph`).
 *
 *   Scope is NOT hardcoded here and NOT described in prose that can drift: it is
 *   `structural._meta` (roots + counts), written by the generator and echoed in
 *   every response's `meta`. Until 2026-07-29 this header claimed "8,589 symbols
 *   across lib/ + app/" and the client rendered a hardcoded "Structural (8.6k)"
 *   chip; Layer 0 had meanwhile grown to nine roots plus `prisma/schema.prisma`
 *   and roughly twice the symbols, so the portal was describing a codebase
 *   Monitrax no longer is. Numbers shown to a human now come from the file.
 *
 * AGGREGATED SERVER-SIDE so the browser never downloads or processes the full
 * graph (that payload was the cause of the "structural view won't load" hang —
 * NI-5b.2). The default response is a few KB of directory clusters. Drill-down
 * and search are param-driven:
 *
 *   (default)         → directory clusters: one super-node per directory +
 *                       aggregated cross-directory dependency edges (tiny).
 *   ?dir=lib/cfo      → that directory's symbols (by degree) + intra-dir edges.
 *   ?q=netWorth       → symbols whose id/label matches + edges among them.
 *   ?limit=2000       → raise the page size (bounded by MAX_LIMIT).
 *
 * TRUNCATION IS NEVER SILENT. A drill or search reports `total`, `returned` and
 * `truncated` in the DATA (not merely in `meta`), because a capped view that
 * looks complete reads as "this is all there is". `prisma/` alone holds 3,574
 * symbols and `app/api/` 1,328 — under the old flat 800 cap both rendered as a
 * confident, wrong subset with no notice anywhere in the UI.
 *
 * Clustering and the architectural layer axis (`db → engine → service → route →
 * ui`, plus the non-runtime `types`/`test`/`tooling`) live in
 * `lib/admin/neomatrix/structuralLayers.ts`, shared with the explorer client so
 * server and browser group and colour the codebase on ONE definition.
 *
 * Metadata only — ids, labels, file:line, structural relations (no CDR/user
 * data, Phase 53 §9). Admin-gated (file:line is internal architecture).
 *
 * BUNDLE NOTE (measured 2026-07-29): the structural JSON is 4.6 MB and is
 * statically imported, so it is inlined into this function's bundle. That is a
 * deliberate trade — a static import cannot fail at runtime, whereas reading the
 * file from disk needs `outputFileTracingIncludes` to be correct in production.
 * The per-request cost is the part that was actually fixable without deployment
 * risk, and is fixed below: every derived index is built ONCE per instance in
 * `index()`, not per request as before.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { dirOf, layerOf, type StructuralLayer } from '@/lib/admin/neomatrix/structuralLayers';
import structural from '@/docs/financial-logic/graph/structural/structural-graph.json';

// Static JSON import + fs-free indexing; Node runtime for predictable memory.
export const runtime = 'nodejs';

// Compact on-disk tuples. Kept local so a graphify format change is caught here.
type RawNodeTuple = [id: string, label: string, file: string, line: number];
type RawEdgeTuple = [relation: string, from: string, to: string, file: string, line: number];

const DEFAULT_LIMIT = 800; // page size for a drill / search
const MAX_LIMIT = 5000; // hard ceiling — covers the largest single cluster (prisma, 3,574)

// ── One-time derived indices (per lambda instance, not per request) ───────────
interface Index {
  nodeTuples: RawNodeTuple[];
  edgeTuples: RawEdgeTuple[];
  fileById: Map<string, string>;
  degree: Map<string, number>;
  layerById: Map<string, StructuralLayer>;
  clusters: Array<{ id: string; label: string; count: number; layer: StructuralLayer }>;
  clusterEdges: Array<{ from: string; to: string; weight: number }>;
  layerCounts: Record<string, number>;
}
let _index: Index | null = null;

function index(): Index {
  if (_index) return _index;

  const nodeTuples = structural.nodes as RawNodeTuple[];
  const edgeTuples = structural.edges as RawEdgeTuple[];

  const fileById = new Map<string, string>();
  const layerById = new Map<string, StructuralLayer>();
  const count = new Map<string, number>();
  const layerCounts: Record<string, number> = {};
  // Per-cluster layer tally. A cluster is a directory and layer derives from the
  // path prefix, so this is uniform in practice — but it is TALLIED rather than
  // assumed, so a future root that mixes layers inside one directory shows its
  // majority instead of silently mislabelling every symbol under it.
  const clusterLayers = new Map<string, Map<StructuralLayer, number>>();

  for (const [id, , file] of nodeTuples) {
    fileById.set(id, file);
    const layer = layerOf(file);
    layerById.set(id, layer);
    layerCounts[layer] = (layerCounts[layer] ?? 0) + 1;
    const d = dirOf(file);
    count.set(d, (count.get(d) ?? 0) + 1);
    if (!clusterLayers.has(d)) clusterLayers.set(d, new Map());
    const lc = clusterLayers.get(d)!;
    lc.set(layer, (lc.get(layer) ?? 0) + 1);
  }

  const degree = new Map<string, number>();
  const clusterEdge = new Map<string, number>();
  for (const [, from, to] of edgeTuples) {
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
    const a = dirOf(fileById.get(from) ?? null);
    const b = dirOf(fileById.get(to) ?? null);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    clusterEdge.set(k, (clusterEdge.get(k) ?? 0) + 1);
  }

  const clusters = [...count.entries()]
    .map(([d, c]) => {
      const tally = clusterLayers.get(d)!;
      let layer: StructuralLayer = 'other';
      let best = -1;
      for (const [l, n] of tally) if (n > best) ((best = n), (layer = l));
      return { id: `dir::${d}`, label: d, count: c, layer };
    })
    .sort((a, b) => b.count - a.count);

  const clusterEdges = [...clusterEdge.entries()].map(([k, weight]) => {
    const [a, b] = k.split('|');
    return { from: `dir::${a}`, to: `dir::${b}`, weight };
  });

  _index = { nodeTuples, edgeTuples, fileById, degree, layerById, clusters, clusterEdges, layerCounts };
  return _index;
}

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

  const idx = index();
  const url = new URL(request.url);
  const dir = url.searchParams.get('dir');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = clampLimit(url.searchParams.get('limit'));

  const scope = { roots: structural._meta?.roots ?? [], counts: structural._meta?.counts ?? {} };

  // Every node and cluster carries its `layer`, and the CLIENT filters on it
  // (multi-select). Deliberately not a server param: filtering the overview to a
  // single layer server-side would drop every cross-layer edge, and the
  // cross-layer wiring — db → engine → service → route → ui — is the whole point
  // of the overview. Payloads are already small, so the filter costs nothing in
  // the browser and keeps the architecture legible while it is applied.

  // ── SEARCH — symbols matching the query, across the whole codebase ───────────
  if (q) {
    const matched = idx.nodeTuples.filter(
      ([id, label]) => label.toLowerCase().includes(q) || id.toLowerCase().includes(q),
    );
    return ok(page('search', matched, idx, limit, undefined), { ...scope, matched: matched.length });
  }

  // ── DRILL — one directory's symbols ─────────────────────────────────────────
  if (dir) {
    const inDir = idx.nodeTuples.filter(([, , file]) => dirOf(file) === dir);
    return ok(page('dir', inDir, idx, limit, dir), { ...scope, total: inDir.length });
  }

  // ── DEFAULT — directory-cluster overview (tiny) ──────────────────────────────
  return ok(
    {
      mode: 'clusters',
      nodes: idx.clusters,
      edges: idx.clusterEdges,
      // The whole-codebase totals, so the UI can state the real size of what it
      // is summarising instead of carrying a hardcoded figure that goes stale.
      totals: {
        symbols: idx.nodeTuples.length,
        relations: idx.edgeTuples.length,
        files: (structural.files as string[] | undefined)?.length ?? 0,
        directories: idx.clusters.length,
      },
      layerCounts: idx.layerCounts,
    },
    { ...scope, directories: idx.clusters.length, totalSymbols: idx.nodeTuples.length },
  );
}

function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/**
 * Rank by degree, cut to `limit`, and SAY SO. `total`/`returned`/`truncated`
 * ride in the data because the client renders the data — a cap reported only in
 * `meta` is a cap nobody sees.
 */
function page(
  mode: 'dir' | 'search',
  matching: RawNodeTuple[],
  idx: Index,
  limit: number,
  dir: string | undefined,
) {
  const capped = [...matching]
    .sort((a, b) => (idx.degree.get(b[0]) ?? 0) - (idx.degree.get(a[0]) ?? 0))
    .slice(0, limit);

  const visible = new Set(capped.map(([id]) => id));
  const nodes = capped.map(([id, label, file, line]) => ({
    id,
    label,
    file,
    line,
    layer: idx.layerById.get(id) ?? layerOf(file),
    degree: idx.degree.get(id) ?? 0,
  }));

  const edges: Array<{ from: string; to: string; type: string }> = [];
  for (const [type, from, to] of idx.edgeTuples) {
    if (visible.has(from) && visible.has(to)) edges.push({ from, to, type });
  }

  return {
    mode,
    dir,
    nodes,
    edges,
    returned: capped.length,
    total: matching.length,
    truncated: matching.length > capped.length,
    limit,
    maxLimit: MAX_LIMIT,
  };
}

function ok(data: Record<string, unknown>, meta: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, meta: { timestamp: new Date().toISOString(), ...meta } });
}
