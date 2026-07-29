'use client';

/**
 * Phase 53 N2 — Neomatrix Explorer (admin-only 3D knowledge-graph viewer).
 *
 * Renders the financial-logic knowledge graph (`financial-graph.json`, served
 * by `/api/admin/neomatrix/graph`) as a navigable force-directed graph:
 * orbit / zoom / pan, nodes coloured by domain, click → inspector (formula,
 * inputs, file:line, lineage, authority, worked example, verified badge).
 *
 * ADMIN-ONLY. Not a user surface — it exposes internal architecture
 * (engine names, file:line, formulas). Per CLAUDE.md §18.2 the admin portal is
 * a separate design system and is NOT Stitch-first-bound; this surface carries
 * the dark-cosmos glass vocabulary as a deliberate immersive data-viz choice.
 * Design reference: `.stitch/designs/neomatrix/explorer-desktop-dark.png`.
 *
 * THREE VIEWS, one axis. `Semantic` and `Proven` render the verified Layer-1
 * graph coloured by DOMAIN. `Structural` (NI-5b) renders the whole-codebase
 * Graphify Layer 0 — server-aggregated, drilled by directory — coloured by
 * ARCHITECTURAL LAYER on the same `db → engine → service → route → ui` axis the
 * semantic schema uses (`lib/admin/neomatrix/structuralLayers.ts`, shared with
 * the route so both ends group and colour on ONE definition). It used to colour
 * by a hash of the directory name, which was pretty and said nothing.
 *
 * NOTHING ABOUT SCALE IS HARDCODED HERE. Every count, total and cap shown to a
 * human is read from the payload; a truncated page says so in the place it is
 * truncated and offers the larger fetch from there. The previous version shipped
 * "8,587 nodes", "8,589 symbols", "~97 directory clusters" and "top 800 by
 * connections" as literals — written when Layer 0 covered two roots, still on
 * screen after it grew to nine plus prisma/.
 *
 * The 3D canvas is `react-force-graph-3d` (three.js), dynamically imported
 * (ssr:false) so three.js stays out of the SSR bundle and only loads on this
 * admin route. The 2D/3D toggle drives `numDimensions` on the same WebGL scene
 * (no second dependency).
 *
 * The graph is METADATA ONLY — no CDR/user data (Phase 53 §9).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  LAYER_COLORS,
  LAYER_SCOPE,
  STRUCTURAL_LAYERS,
  type StructuralLayer,
} from '@/lib/admin/neomatrix/structuralLayers';

// three.js needs `window`; load only on the client.
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// ── Domain palette (matches the §18.7.2 / approved Stitch design) ────────────
const DOMAIN_COLORS: Record<string, string> = {
  core: '#0EA5E9',
  tax: '#8B5CF6',
  health: '#22C55E',
  cfo: '#F59E0B',
  intelligence: '#06B6D4',
  reports: '#E11D48',
  neobrain: '#EC4899',
};
const NEUTRAL = '#64748B';
// Bridge nodes in the proven view (non-proven lineage intermediates) render in a
// muted slate so the proven engines keep full domain colour and stand out.
const BRIDGE_DIM = '#334155';
// Island nodes (known production-unwired engines) render amber so they read as
// "intentionally not connected (planned)", not an accidental break.
const ISLAND_AMBER = '#F59E0B';
const DOMAINS = ['core', 'tax', 'health', 'cfo', 'intelligence', 'reports', 'neobrain'] as const;
// The FULL semantic layer enum (financial-graph.schema.md). This used to be
// ['db','engine','ui'] — `service` and `route` are legal schema values, so every
// service/route node fell into the "other" chip and the rail could not name the
// layer it was showing. The four input-builder orchestrators modelled on
// 2026-07-29 are all `layer: 'service'`, which is exactly the case that made the
// omission visible.
const LAYERS = ['db', 'engine', 'service', 'route', 'ui'] as const;
const TRAIL = ['T', 'R', 'A', 'I', 'L'] as const;

interface RawNode {
  id: string;
  kind: string;
  label: string;
  file: string | null;
  line: number | null;
  layer: string | null;
  domain: string | null;
  trailStage: string | null;
  regime: string | null;
  produces: string | null;
  formula: string | null;
  authority: string | null;
  inputs: Array<{ name: string; unit?: string; type?: string; note?: string }>;
  workedExample: string | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  status: string | null;
  proven?: boolean; // engine/orchestrator with a calc-audit fixture (tagged by the API)
  // Structural (Layer-0) nodes only: the architectural layer the server derived
  // from the file path (`lib/admin/neomatrix/structuralLayers.ts`). Semantic
  // nodes carry their own `layer` from the schema instead; the two are the same
  // axis, which is the point — see the LAYER_COLORS legend.
  structuralLayer?: StructuralLayer;
}
interface RawEdge {
  from: string;
  to: string;
  type: string;
  source: string;
  evidence?: string | null;
}
interface RawGraph {
  version?: string;
  nodes: RawNode[];
  edges: RawEdge[];
}

// react-force-graph node/link shape (links use source/target).
type GNode = RawNode & { degree: number; color: string; val: number; bridge?: boolean; island?: boolean };
type GLink = { source: string; target: string; type: string };

// Structural view (NI-5b) — server-AGGREGATED payloads (the browser never
// downloads the full structural JSON; that was the load hang). `clusters` = one
// super-node per real directory; `dir`/`search` = a ranked page of symbols.
//
// The shapes below MIRROR the route (`app/api/admin/neomatrix/structural`) and
// deliberately include its honesty fields. `totals`/`layerCounts` exist so the
// UI can state the real size of the codebase instead of carrying a hardcoded
// figure that goes stale — the old client shipped "8,587 nodes", "8,589
// symbols", "2.7 MB" and "~97 directory clusters" as literals while Layer 0 had
// grown past twice that. `returned`/`total`/`truncated`/`limit` exist because a
// page cut to 800 with no notice reads as "this is all there is".
type StructuralTotals = { symbols: number; relations: number; files: number; directories: number };
type StructuralCluster = { id: string; label: string; count: number; layer: StructuralLayer };
type StructuralSymbol = {
  id: string;
  label: string;
  file: string;
  line: number;
  layer: StructuralLayer;
  degree: number;
};
type StructuralPayload =
  | {
      mode: 'clusters';
      nodes: StructuralCluster[];
      edges: Array<{ from: string; to: string; weight: number }>;
      totals: StructuralTotals;
      layerCounts: Record<string, number>;
    }
  | {
      mode: 'dir' | 'search';
      dir?: string;
      nodes: StructuralSymbol[];
      edges: Array<{ from: string; to: string; type: string }>;
      returned: number;
      total: number;
      truncated: boolean;
      limit: number;
      maxLimit: number;
    };

// Structural colour = ARCHITECTURAL LAYER, not a hash of the directory name.
// Until 2026-07-29 this was `hsl(hash(dirname))` — visually busy and
// semantically empty: `lib/tax-engine` and `app/api` got unrelated hues, so the
// picture could not answer "where does the DB become an engine, and where does
// an engine become a route?". Colouring on the same db → engine → service →
// route → ui axis the semantic schema uses makes the two views read on ONE
// dimension, and makes cross-layer wiring the thing the eye actually follows.
function structuralColor(layer: StructuralLayer | undefined): string {
  return layer ? LAYER_COLORS[layer] ?? NEUTRAL : NEUTRAL;
}

/** 16149 → "16.1k". Used only where a chip is too narrow for the full figure. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10000 ? 2 : 1).replace(/\.?0+$/, '')}k`;
}

function nodeColor(n: RawNode): string {
  if (n.structuralLayer) return structuralColor(n.structuralLayer);
  if (n.domain && DOMAIN_COLORS[n.domain]) return DOMAIN_COLORS[n.domain];
  return NEUTRAL;
}

export function NeomatrixExplorer() {
  const [graph, setGraph] = useState<RawGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dims, setDims] = useState<2 | 3>(3);
  const [search, setSearch] = useState('');
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set(DOMAINS));
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set([...LAYERS, 'other']));
  // View toggle: 'all' = the verified semantic Neomatrix · 'proven' = only the
  // calc-audit-proven engines + their 1-hop lineage · 'structural' (NI-5b) = the
  // whole-codebase Graphify structural graph, lazy-loaded and server-aggregated.
  // Its size is READ FROM the payload, never written here.
  const [view, setView] = useState<'all' | 'proven' | 'structural'>('all');
  // Structural view (NI-5b): server-aggregated payload for the current drill /
  // search state. Default = directory clusters; drilling/searching refetches.
  const [structuralData, setStructuralData] = useState<StructuralPayload | null>(null);
  const [structuralLoading, setStructuralLoading] = useState(false);
  const [structuralError, setStructuralError] = useState<string | null>(null);
  // Whole-codebase totals, captured from the cluster overview (the only payload
  // that carries them) and kept while drilled in, so the chip and the rail can
  // state the real scale from a drill-down too.
  const [structuralTotals, setStructuralTotals] = useState<StructuralTotals | null>(null);
  const [structuralLayerCounts, setStructuralLayerCounts] = useState<Record<string, number>>({});
  // Structural layer filter — multi-select, applied CLIENT-side. The server
  // deliberately has no `?layer=` param: filtering the overview server-side
  // would drop every cross-layer edge, and the cross-layer wiring is the whole
  // point of the overview.
  const [activeStructuralLayers, setActiveStructuralLayers] = useState<Set<string>>(
    new Set(STRUCTURAL_LAYERS),
  );
  // Page size for a drill / search. Raised by the truncation banner, so a capped
  // view is not just DECLARED — it is escapable from the place it is declared.
  const [structuralLimit, setStructuralLimit] = useState<number | null>(null);
  // Drill-down: null = directory-cluster overview · a dir = that directory's symbols.
  const [expandedDir, setExpandedDir] = useState<string | null>(null);
  const provenCount = useMemo(() => graph?.nodes.filter((n) => n.proven).length ?? 0, [graph]);

  // Semantic memos (degree, colourById, filtered, islands) read the semantic graph;
  // the structural view is fed separately from `structuralData`.
  const activeGraph = graph;

  // Semantic islands: nodes NOT in the main connected component. These are the
  // known production-unwired engines (div152 / psi / fteIee — each a 2-node pair
  // with its law node). We surface them HONESTLY (the graph is never faked — they
  // ARE disconnected in the app) but badge them so they read as intentional, not
  // broken. Wiring them (the deferred tax-overlay plan) connects them for real.
  const islandIds = useMemo(() => {
    if (!graph) return new Set<string>();
    const adj = new Map<string, string[]>();
    graph.nodes.forEach((n) => adj.set(n.id, []));
    graph.edges.forEach((e) => {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    });
    // Find the largest component (the "main graph").
    const seen = new Set<string>();
    let main: string[] = [];
    for (const n of graph.nodes) {
      if (seen.has(n.id)) continue;
      const stack = [n.id];
      const comp: string[] = [];
      seen.add(n.id);
      while (stack.length) {
        const c = stack.pop()!;
        comp.push(c);
        for (const m of adj.get(c) ?? []) if (!seen.has(m)) (seen.add(m), stack.push(m));
      }
      if (comp.length > main.length) main = comp;
    }
    const mainSet = new Set(main);
    return new Set(graph.nodes.filter((n) => !mainSet.has(n.id)).map((n) => n.id));
  }, [graph]);

  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // ── Load the graph (admin API) ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/neomatrix/graph')
      .then(async (r) => {
        if (!r.ok) throw new Error(`Graph request failed (${r.status})`);
        const json = await r.json();
        return (json.data ?? json) as RawGraph;
      })
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load graph');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Structural fetch (NI-5b) — server-aggregated, param-driven, abortable ───
  // Refetches the small payload for the current (drill, search) state. The
  // browser never downloads the full graph. A timeout converts any hang into a
  // visible error + Retry instead of an infinite "Loading…".
  const [structuralReloadKey, setStructuralReloadKey] = useState(0);
  useEffect(() => {
    if (view !== 'structural') return;
    const q = search.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    else if (expandedDir) params.set('dir', expandedDir);
    if (structuralLimit) params.set('limit', String(structuralLimit));
    const qs = params.toString();
    const url = `/api/admin/neomatrix/structural${qs ? `?${qs}` : ''}`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    let cancelled = false;
    setStructuralLoading(true);
    setStructuralError(null);
    // Debounce search keystrokes; drill/cluster fetch immediately.
    const delay = q ? 300 : 0;
    const run = setTimeout(() => {
      fetch(url, { signal: ctrl.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Structural request failed (${r.status})`);
          const json = await r.json();
          return (json.data ?? json) as StructuralPayload;
        })
        .then((d) => {
          if (cancelled) return;
          setStructuralData(d);
          // Only the cluster overview carries the whole-codebase totals; hold on
          // to them so a drill-down can still say what it is a slice OF.
          if (d.mode === 'clusters') {
            setStructuralTotals(d.totals);
            setStructuralLayerCounts(d.layerCounts ?? {});
          }
        })
        .catch((e) => {
          if (cancelled) return;
          const msg = e instanceof DOMException && e.name === 'AbortError' ? 'Structural graph timed out — Retry.' : e instanceof Error ? e.message : 'Failed to load structural graph';
          setStructuralError(msg);
        })
        .finally(() => {
          clearTimeout(timeout);
          if (!cancelled) setStructuralLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(run);
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [view, expandedDir, search, structuralLimit, structuralReloadKey]);

  // A raised page size belongs to the view that raised it. Moving to another
  // directory (or to a search) starts from the default again, so "show all
  // 3,574" never silently becomes a standing 5,000-row fetch everywhere.
  useEffect(() => {
    setStructuralLimit(null);
  }, [expandedDir, search]);

  // ── Size to container ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Tighten the layout so connected nodes cluster (edges become legible) ────
  // The structural view draws far more nodes per frame than the semantic one, so
  // it needs a looser charge + shorter links or the ball explodes; the semantic
  // graph reads best tighter. (Both counts are payload-driven — no literals.)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !activeGraph) return;
    const structural = view === 'structural';
    try {
      fg.d3Force('link')?.distance(structural ? 18 : 34);
      fg.d3Force('charge')?.strength(structural ? -18 : -55);
      fg.d3ReheatSimulation?.();
    } catch {
      /* ref/forces unavailable — layout falls back to defaults */
    }
  }, [activeGraph, view]);

  // ── Degree map (node size by connection count) ─────────────────────────────
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    activeGraph?.edges.forEach((e) => {
      d.set(e.from, (d.get(e.from) ?? 0) + 1);
      d.set(e.to, (d.get(e.to) ?? 0) + 1);
    });
    return d;
  }, [activeGraph]);

  // id → node, for the inspector + lineage labels. Structural symbols come from
  // the loaded payload; semantic nodes from the graph.
  const nodeById = useMemo(() => {
    const m = new Map<string, RawNode>();
    if (view === 'structural') {
      if (structuralData && structuralData.mode !== 'clusters') {
        for (const n of structuralData.nodes) {
          m.set(n.id, {
            id: n.id, kind: 'structural', label: n.label, file: n.file, line: n.line,
            layer: n.layer, domain: null, trailStage: null, regime: null,
            produces: `${n.degree} structural relation${n.degree === 1 ? '' : 's'}`,
            formula: null, authority: null, inputs: [], workedExample: null, verifiedBy: null,
            verifiedDate: null, status: null, structuralLayer: n.layer,
          });
        }
      }
    } else {
      activeGraph?.nodes.forEach((n) => m.set(n.id, n));
    }
    return m;
  }, [view, activeGraph, structuralData]);

  // id → colour (semantic), used as a fallback by linkSourceColor.
  const colorById = useMemo(() => {
    const m = new Map<string, string>();
    activeGraph?.nodes.forEach((n) => m.set(n.id, nodeColor(n)));
    return m;
  }, [activeGraph]);

  // Cluster id (`dir::lib/tax-engine`) → its architectural layer, so a
  // cross-directory edge in the overview is tinted by the layer it LEAVES. That
  // is what makes `db → engine → service → route → ui` visible as a direction
  // rather than a wall of undifferentiated grey lines.
  const clusterLayerById = useMemo(() => {
    const m = new Map<string, StructuralLayer>();
    if (structuralData?.mode === 'clusters') {
      for (const c of structuralData.nodes) m.set(c.id, c.layer);
    }
    return m;
  }, [structuralData]);

  // A link's source can be a string id (pre-simulation) or a node object (post).
  // Structural: cluster ids (dir::X) and symbol ids both colour by LAYER.
  const linkSourceColor = useCallback(
    (l: { source: string | { id?: string } }) => {
      const id = typeof l.source === 'object' ? l.source?.id : l.source;
      if (!id) return NEUTRAL;
      const cluster = clusterLayerById.get(id);
      if (cluster) return structuralColor(cluster);
      const n = nodeById.get(id);
      if (n?.structuralLayer) return structuralColor(n.structuralLayer);
      return colorById.get(id) || NEUTRAL;
    },
    [colorById, nodeById, clusterLayerById],
  );

  // ── Proven view: proven nodes + their 1-hop lineage neighbours ─────────────
  // Proven engines rarely link DIRECTLY to one another — their lineage runs
  // THROUGH intermediate nodes (inputs, numbers, orchestrators). Showing only
  // the 60 proven nodes therefore drops almost every edge (the "disconnected
  // proven view" bug). The honest fix is to also keep the real bridging nodes
  // adjacent to a proven node (a node is `bridge` if it's pulled in only because
  // it neighbours a proven node). We never fabricate direct proven→proven edges
  // — we surface the genuine intermediates so the lineage is legible.
  const provenScope = useMemo(() => {
    if (!graph || view !== 'proven') return null;
    const provenIds = new Set(graph.nodes.filter((n) => n.proven).map((n) => n.id));
    const keep = new Set(provenIds);
    for (const e of graph.edges) {
      if (provenIds.has(e.from)) keep.add(e.to);
      if (provenIds.has(e.to)) keep.add(e.from);
    }
    return { provenIds, keep };
  }, [graph, view]);

  // ── Filtered SEMANTIC graph (structural is handled by structuralView) ───────
  const filtered = useMemo(() => {
    if (!activeGraph || view === 'structural') return { nodes: [] as GNode[], links: [] as GLink[] };
    const q = search.trim().toLowerCase();
    const layerKey = (n: RawNode) => (n.layer && (LAYERS as readonly string[]).includes(n.layer) ? n.layer : 'other');
    const visible = new Set<string>();
    const nodes: GNode[] = [];
    for (const n of activeGraph.nodes) {
      const domainOk = n.domain ? activeDomains.has(n.domain) : true;
      const layerOk = activeLayers.has(layerKey(n));
      const searchOk = !q || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
      const viewOk = view === 'all' || (provenScope?.keep.has(n.id) ?? false);
      if (domainOk && layerOk && searchOk && viewOk) {
        visible.add(n.id);
        const deg = degree.get(n.id) ?? 0;
        // In proven view, a kept node that isn't itself proven is a bridge —
        // render it dim + small so the proven engines (full domain colour) pop.
        const bridge = view === 'proven' && !(provenScope?.provenIds.has(n.id) ?? false);
        // An island = a known production-unwired engine. Amber so it reads as
        // "intentionally not connected (planned)", not an accidental break.
        const island = islandIds.has(n.id);
        nodes.push({
          ...n,
          degree: deg,
          color: bridge ? BRIDGE_DIM : island ? ISLAND_AMBER : nodeColor(n),
          val: bridge ? 1.5 : 2 + deg * 1.4,
          bridge,
          island,
        });
      }
    }
    const links: GLink[] = [];
    for (const e of activeGraph.edges) {
      if (visible.has(e.from) && visible.has(e.to)) {
        links.push({ source: e.from, target: e.to, type: e.type });
      }
    }
    return { nodes, links };
  }, [activeGraph, search, activeDomains, activeLayers, degree, view, provenScope, islandIds]);

  // ── Structural view (NI-5b): map the server-aggregated payload to GNodes ────
  // The server already did the clustering / drill / search + capping; the client
  // just shapes the small payload for the canvas. No 8.6k-node client work.
  const baseRaw = {
    layer: null, domain: null, trailStage: null, regime: null, produces: null,
    formula: null, authority: null, inputs: [] as RawNode['inputs'], workedExample: null,
    verifiedBy: null, verifiedDate: null, status: null,
  };
  const structuralView = useMemo(() => {
    if (view !== 'structural' || !structuralData) return { nodes: [] as GNode[], links: [] as GLink[] };
    // The layer filter runs HERE, on the loaded payload, so an edge between two
    // still-visible layers survives. Filtering server-side would have cut the
    // cross-layer edges — the one thing the overview exists to show.
    const layerOk = (l: StructuralLayer) => activeStructuralLayers.has(l);

    if (structuralData.mode === 'clusters') {
      const nodes: GNode[] = structuralData.nodes
        .filter((c) => layerOk(c.layer))
        .map((c) => ({
          ...baseRaw, id: c.id, kind: 'cluster', label: c.label, file: c.label, line: null,
          layer: c.layer, structuralLayer: c.layer,
          produces: `${c.count.toLocaleString()} symbols · ${LAYER_SCOPE[c.layer]}`,
          degree: c.count, color: structuralColor(c.layer),
          val: 4 + Math.log2(c.count + 1) * 2.2,
        }));
      const visible = new Set(nodes.map((n) => n.id));
      const links: GLink[] = structuralData.edges
        .filter((e) => visible.has(e.from) && visible.has(e.to))
        .map((e) => ({ source: e.from, target: e.to, type: 'depends' }));
      return { nodes, links };
    }

    // dir / search — symbols. Size by the degree within the returned subset (the
    // server's whole-graph `degree` ranks the page; this sizes what is drawn).
    const kept = structuralData.nodes.filter((n) => layerOk(n.layer));
    const visible = new Set(kept.map((n) => n.id));
    const deg = new Map<string, number>();
    for (const e of structuralData.edges) {
      if (!visible.has(e.from) || !visible.has(e.to)) continue;
      deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
      deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
    }
    const nodes: GNode[] = kept.map((n) => ({
      ...baseRaw, id: n.id, kind: 'structural', label: n.label, file: n.file, line: n.line,
      layer: n.layer, structuralLayer: n.layer,
      produces: `${n.degree} structural relation${n.degree === 1 ? '' : 's'}`,
      degree: deg.get(n.id) ?? 0, color: structuralColor(n.layer),
      val: 1 + Math.min(deg.get(n.id) ?? 0, 6) * 0.5,
    }));
    const links: GLink[] = structuralData.edges
      .filter((e) => visible.has(e.from) && visible.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, type: e.type }));
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, structuralData, activeStructuralLayers]);

  // The dataset actually drawn (semantic → filtered · structural → structuralView).
  const rendered = view === 'structural' ? structuralView : filtered;

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // Lineage of the selected node (in / out edges with the other node's label).
  // Capped at 40 each — a structural file node can have 100+ `contains` edges.
  const lineage = useMemo(() => {
    if (!selected) return { out: [] as RawEdge[], inc: [] as RawEdge[] };
    // Structural: the loaded subset's edges; semantic: the graph's edges.
    const edges: Array<{ from: string; to: string; type: string }> =
      view === 'structural'
        ? structuralData && structuralData.mode !== 'clusters'
          ? structuralData.edges
          : []
        : activeGraph?.edges ?? [];
    return {
      out: edges.filter((e) => e.from === selected.id).slice(0, 40) as RawEdge[],
      inc: edges.filter((e) => e.to === selected.id).slice(0, 40) as RawEdge[],
    };
  }, [view, activeGraph, structuralData, selected]);

  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const handleNodeClick = useCallback((node: { id?: string | number }) => {
    const id = node?.id != null ? String(node.id) : null;
    if (!id) return;
    // Clicking a directory cluster drills into its symbols (not an inspect).
    if (id.startsWith('dir::')) {
      setExpandedDir(id.slice('dir::'.length));
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[calc(100vh-5rem)] w-full overflow-hidden rounded-2xl bg-[#050913]">
      {/* Ambient sky→indigo mesh glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 40%, rgba(14,165,233,0.10), transparent 70%), radial-gradient(50% 40% at 70% 70%, rgba(79,70,229,0.10), transparent 70%)',
        }}
      />

      {/* ── 3D / 2D canvas ─────────────────────────────────────────────────── */}
      {activeGraph && !error && (
        <ForceGraph3D
          ref={fgRef}
          graphData={rendered}
          width={size.w}
          height={size.h}
          numDimensions={dims}
          backgroundColor="rgba(0,0,0,0)"
          nodeColor={(n: object) => (n as GNode).color}
          nodeVal={(n: object) => (n as GNode).val}
          nodeLabel={(n: object) => {
            const g = n as GNode;
            const sub =
              g.kind === 'cluster'
                ? `${g.produces ?? ''} · click to expand`
                : g.kind === 'structural'
                  ? `${g.file ?? ''}${g.line != null ? ':' + g.line : ''}`
                  : `${g.kind}${g.domain ? ' · ' + g.domain : ''}${g.island ? ' · unwired (planned)' : ''}`;
            return `<div style="font-family:Inter,sans-serif;font-size:12px;color:#e2e8f0">${g.label}<br/><span style="color:#94a3b8">${sub}</span></div>`;
          }}
          nodeOpacity={view === 'structural' ? 0.85 : 0.92}
          nodeResolution={view === 'structural' ? 8 : 16}
          // Edges: tinted by their source node's colour. Structural view drops the
          // directional particles + thins the links for performance.
          linkColor={(l: object) => linkSourceColor(l as { source: string | { id?: string } })}
          linkOpacity={view === 'structural' ? 0.22 : 0.45}
          linkWidth={view === 'structural' ? 0.25 : 0.6}
          linkDirectionalParticles={view === 'structural' ? 0 : 2}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={(l: object) => linkSourceColor(l as { source: string | { id?: string } })}
          onNodeClick={handleNodeClick}
          enableNodeDrag={false}
          showNavInfo={false}
        />
      )}

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-5">
        <div className="pointer-events-auto">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Neomatrix{' '}
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">3D</span>
          </h1>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Financial-logic knowledge graph</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {/* Legend. Semantic views are coloured by DOMAIN; the structural view by
              ARCHITECTURAL LAYER — the same db → engine → service → route → ui
              axis the semantic schema uses, which is why both legends belong in
              the same slot rather than one being hidden behind a tooltip. */}
          {view !== 'structural' ? (
            <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl lg:flex">
              {DOMAINS.map((d) => (
                <span key={d} className="flex items-center gap-1.5 text-[11px] capitalize text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[d] }} />
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl lg:flex">
              {STRUCTURAL_LAYERS.map((l) => (
                <span
                  key={l}
                  title={`${LAYER_SCOPE[l]}${structuralLayerCounts[l] ? ` — ${structuralLayerCounts[l].toLocaleString()} symbols` : ''}`}
                  className={`flex items-center gap-1.5 text-[11px] transition ${
                    activeStructuralLayers.has(l) ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: activeStructuralLayers.has(l) ? LAYER_COLORS[l] : 'transparent', border: `1px solid ${LAYER_COLORS[l]}` }}
                  />
                  {l}
                </span>
              ))}
            </div>
          )}
          {/* View toggle (NI-5): semantic graph ⇄ proven engines ⇄ structural.
              Labelled "Semantic" (not "All") so it doesn't imply the Graphify
              structural census — this explorer renders the verified SEMANTIC
              Neomatrix; the structural layer is a separate view (NI-5b).
              Every count here is READ from a payload. The structural chip used
              to be the literal "Structural (8.6k)" and the tooltip the literal
              "8,587 symbols across lib/ + app/", both written when Layer 0
              covered two roots; it now covers nine plus prisma/, so the portal
              was quoting a codebase Monitrax no longer is. Before the totals
              land the chip simply says "Structural" — no number is better than
              a wrong one. */}
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xl">
            {([
              ['all', `Semantic (${graph?.nodes.length ?? 0})`],
              ['proven', `Proven (${provenCount})`],
              ['structural', structuralTotals ? `Structural (${compact(structuralTotals.symbols)})` : 'Structural'],
            ] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={
                  v === 'proven'
                    ? 'Only the calc-audit-proven engines + their 1-hop lineage'
                    : v === 'structural'
                      ? structuralTotals
                        ? `The whole-codebase Graphify structural graph — ${structuralTotals.symbols.toLocaleString()} symbols and ${structuralTotals.relations.toLocaleString()} relations across ${structuralTotals.files.toLocaleString()} files in ${structuralTotals.directories.toLocaleString()} directories, coloured by architectural layer`
                        : 'The whole-codebase Graphify structural graph (Layer 0), coloured by architectural layer'
                      : 'Every node in the verified semantic Neomatrix'
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  view === v ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {/* 2D / 3D toggle */}
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xl">
            {([2, 3] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDims(d)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  dims === d ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Left filter rail ───────────────────────────────────────────────── */}
      <div className="absolute left-5 top-24 z-10 w-64 rounded-[22px] border border-white/10 bg-[#0E1424]/70 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          className="w-full rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
        />

        {view !== 'structural' ? (
          <>
            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">Domain</p>
              <div className="space-y-1.5">
                {DOMAINS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleSet(activeDomains, d, setActiveDomains)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-sm capitalize transition ${
                      activeDomains.has(d) ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full transition"
                      style={{
                        backgroundColor: activeDomains.has(d) ? DOMAIN_COLORS[d] : 'transparent',
                        boxShadow: activeDomains.has(d) ? `0 0 8px ${DOMAIN_COLORS[d]}` : 'none',
                        border: `1px solid ${DOMAIN_COLORS[d]}`,
                      }}
                    />
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">Layer</p>
              <div className="flex flex-wrap gap-1.5">
                {[...LAYERS, 'other'].map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleSet(activeLayers, l, setActiveLayers)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      activeLayers.has(l)
                        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
                        : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            {/* Prominent back affordance — clears the drill + search → clusters */}
            {(expandedDir || search) && (
              <button
                onClick={() => {
                  setExpandedDir(null);
                  setSearch('');
                  setSelectedId(null);
                }}
                className="flex w-full items-center gap-1.5 rounded-[10px] border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
              >
                <span aria-hidden>←</span> Back to all directories
              </button>
            )}
            {/* Current location */}
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
              <span>Directories</span>
              {expandedDir && !search && (
                <>
                  <span className="text-slate-600">/</span>
                  <span className="font-mono text-slate-200">{expandedDir}</span>
                </>
              )}
              {search && (
                <>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-200">search “{search.trim()}”</span>
                </>
              )}
            </div>
            {/* Copy reads from the payload. It used to hardcode "all 8,589
                symbols" and "top 800 by connections" — the first went stale, the
                second was a lie whenever the page was NOT capped. */}
            <p className="text-[11px] leading-relaxed text-slate-500">
              {search
                ? `Searching ${structuralTotals ? `all ${structuralTotals.symbols.toLocaleString()}` : 'all'} symbols across the codebase.`
                : expandedDir
                  ? 'Symbols in this directory, ranked by connections. Click a node to inspect its file:line + relations.'
                  : `Whole-codebase structural graph (Graphify Layer 0), grouped by directory${
                      structuralTotals
                        ? ` — ${structuralTotals.symbols.toLocaleString()} symbols · ${structuralTotals.relations.toLocaleString()} relations · ${structuralTotals.files.toLocaleString()} files · ${structuralTotals.directories.toLocaleString()} directories`
                        : ''
                    }. Click a directory to drill in, or search to find any symbol.`}
            </p>

            {/* Truncation, stated where it happens and escapable from there.
                `prisma/` holds 3,574 symbols and `app/api/` 1,328; under the old
                flat 800 cap both drew a confident, wrong subset with no notice
                anywhere in the UI. */}
            {structuralData && structuralData.mode !== 'clusters' && structuralData.truncated && (
              <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
                Showing the {structuralData.returned.toLocaleString()} most-connected of{' '}
                <span className="font-semibold">{structuralData.total.toLocaleString()}</span> symbols — this view is
                truncated.
                {structuralData.limit < structuralData.maxLimit && (
                  <button
                    onClick={() =>
                      setStructuralLimit(Math.min(structuralData.total, structuralData.maxLimit))
                    }
                    className="mt-1.5 block w-full rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/20"
                  >
                    Load all {Math.min(structuralData.total, structuralData.maxLimit).toLocaleString()}
                  </button>
                )}
                {structuralData.total > structuralData.maxLimit && (
                  <span className="mt-1 block text-amber-300/80">
                    Ceiling is {structuralData.maxLimit.toLocaleString()} per view — narrow with search to see the rest.
                  </span>
                )}
              </div>
            )}
            {structuralData && structuralData.mode !== 'clusters' && !structuralData.truncated && (
              <p className="text-[11px] text-slate-500">
                Complete — all {structuralData.total.toLocaleString()} matching symbols are drawn.
              </p>
            )}

            {/* Architectural layer filter (client-side, so cross-layer edges live) */}
            <div className="pt-1">
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Layer</p>
                <button
                  onClick={() =>
                    setActiveStructuralLayers(
                      activeStructuralLayers.size === STRUCTURAL_LAYERS.length
                        ? new Set()
                        : new Set(STRUCTURAL_LAYERS),
                    )
                  }
                  className="text-[10px] text-slate-500 transition hover:text-slate-300"
                >
                  {activeStructuralLayers.size === STRUCTURAL_LAYERS.length ? 'none' : 'all'}
                </button>
              </div>
              <div className="space-y-1">
                {STRUCTURAL_LAYERS.map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleSet(activeStructuralLayers, l, setActiveStructuralLayers)}
                    title={LAYER_SCOPE[l]}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition ${
                      activeStructuralLayers.has(l) ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full transition"
                      style={{
                        backgroundColor: activeStructuralLayers.has(l) ? LAYER_COLORS[l] : 'transparent',
                        boxShadow: activeStructuralLayers.has(l) ? `0 0 8px ${LAYER_COLORS[l]}` : 'none',
                        border: `1px solid ${LAYER_COLORS[l]}`,
                      }}
                    />
                    <span className="flex-1">{l}</span>
                    {structuralLayerCounts[l] != null && (
                      <span className="tabular-nums text-[10px] text-slate-500">
                        {structuralLayerCounts[l].toLocaleString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Name what a layer COVERS when exactly one is selected — that is
                  the moment the mapping is load-bearing and the moment a reader
                  would otherwise have to guess it. */}
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
                {activeStructuralLayers.size === 0
                  ? 'No layer selected — nothing to draw.'
                  : activeStructuralLayers.size === 1
                    ? LAYER_SCOPE[[...activeStructuralLayers][0] as StructuralLayer]
                    : `${activeStructuralLayers.size} of ${STRUCTURAL_LAYERS.length} layers · cross-layer edges are kept, so db → engine → service → route → ui stays readable.`}
              </p>
            </div>
          </div>
        )}

        {/* Drawn / loaded, always as a ratio in the structural view, so a layer
            filter never looks like the whole picture. */}
        <p className="mt-5 text-[11px] tabular-nums text-slate-500">
          {rendered.nodes.length.toLocaleString()}
          {view === 'structural'
            ? structuralData
              ? structuralData.mode === 'clusters'
                ? ` / ${structuralData.nodes.length.toLocaleString()} directories`
                : ` / ${structuralData.nodes.length.toLocaleString()} symbols loaded`
              : !expandedDir && !search
                ? ' directories'
                : ' symbols'
            : ` / ${activeGraph?.nodes.length ?? 0} nodes`}{' '}
          · {rendered.links.length.toLocaleString()} edges
        </p>
      </div>

      {/* ── Right inspector ────────────────────────────────────────────────── */}
      {selected && (
        <div className="absolute right-5 top-24 z-10 max-h-[calc(100vh-9rem)] w-[340px] overflow-y-auto rounded-[22px] border border-white/10 bg-[#0E1424]/80 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: nodeColor(selected) }}
              >
                {selected.kind}
                {selected.domain ? ` · ${selected.domain}` : ''}
                {!selected.domain && selected.structuralLayer ? ` · ${selected.structuralLayer}` : ''}
              </p>
              <h2 className="mt-1 break-words font-mono text-sm font-semibold text-slate-100">{selected.label}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {selected.status && (
                <span className="rounded-full bg-emerald-500/14 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
                  {selected.status === 'documented' || selected.status === 'verified' ? '✓ Verified' : selected.status}
                </span>
              )}
              <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-slate-300" aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          {islandIds.has(selected.id) && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              ⚠ <span className="font-semibold">Unwired (planned).</span> This engine is built + tested but has no
              production caller yet, so it sits apart from the main graph. Wiring it is the deferred tax-overlay plan
              (`docs/blueprint/TAX_OVERLAY_WIRING_PLAN.md`) — it connects for real when wired, never faked.
            </div>
          )}

          {selected.produces && <p className="mt-3 text-xs leading-relaxed text-slate-400">{selected.produces}</p>}

          {selected.formula && (
            <Section label="Formula">
              <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
                {selected.formula}
              </pre>
            </Section>
          )}

          {selected.inputs?.length > 0 && (
            <Section label="Inputs">
              <ul className="space-y-1">
                {selected.inputs.map((inp, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-slate-300">{inp.name}</span>
                    {inp.unit && (
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        {inp.unit}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {selected.file && (
            <Section label="Source">
              <code className="text-xs text-sky-300">
                {selected.file}
                {selected.line != null ? `:${selected.line}` : ''}
              </code>
            </Section>
          )}

          {(lineage.out.length > 0 || lineage.inc.length > 0) && (
            <Section label="Lineage">
              <div className="flex flex-wrap gap-1.5">
                {lineage.out.map((e, i) => (
                  <LineagePill key={`o${i}`} dir="→" type={e.type} label={nodeById.get(e.to)?.label ?? e.to} />
                ))}
                {lineage.inc.map((e, i) => (
                  <LineagePill key={`i${i}`} dir="←" type={e.type} label={nodeById.get(e.from)?.label ?? e.from} />
                ))}
              </div>
            </Section>
          )}

          {selected.authority && (
            <Section label="Authority">
              <p className="text-xs leading-relaxed text-slate-300">{selected.authority}</p>
            </Section>
          )}

          {selected.workedExample && (
            <Section label="Worked example">
              <p className="font-mono text-xs leading-relaxed text-emerald-300/90">{selected.workedExample}</p>
            </Section>
          )}

          {selected.verifiedDate && (
            <p className="mt-4 text-[10px] text-slate-600">Verified {selected.verifiedDate}</p>
          )}
        </div>
      )}

      {/* ── States ─────────────────────────────────────────────────────────── */}
      {!graph && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          Loading knowledge graph…
        </div>
      )}
      {view === 'structural' && structuralLoading && !structuralData && !structuralError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          Loading structural graph…
        </div>
      )}
      {view === 'structural' && structuralError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{structuralError}</p>
          <button
            onClick={() => setStructuralReloadKey((k) => k + 1)}
            className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs text-slate-200 hover:bg-white/[0.12]"
          >
            Retry
          </button>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>
        </div>
      )}

      {!selected && graph && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-[11px] text-slate-600">
          Drag to orbit · scroll to zoom ·{' '}
          {view === 'structural' && !expandedDir && !search ? 'click a directory to drill in' : 'click a node to inspect'}
        </p>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function LineagePill({ dir, type, label }: { dir: string; type: string; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
      <span className="text-slate-500">{dir}</span>
      <span className="text-slate-500">{type}</span>
      <span className="truncate font-mono">{label}</span>
    </span>
  );
}
