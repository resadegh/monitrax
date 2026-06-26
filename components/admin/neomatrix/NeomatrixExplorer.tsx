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
 * The 3D canvas is `react-force-graph-3d` (three.js), dynamically imported
 * (ssr:false) so three.js stays out of the SSR bundle and only loads on this
 * admin route. The 2D/3D toggle drives `numDimensions` on the same WebGL scene
 * (no second dependency).
 *
 * The graph is METADATA ONLY — no CDR/user data (Phase 53 §9).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

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
const LAYERS = ['db', 'engine', 'ui'] as const;
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

// Top-level dir (e.g. "lib/tax-engine", "app/api") — the structural-view grouping.
function topDir(file: string | null): string {
  if (!file) return '';
  return file.split('/').slice(0, 2).join('/');
}
// Deterministic dir → hue, so the 8,587-node structural view colours by codebase
// area (stable across renders, no palette to maintain).
function dirColor(file: string | null): string {
  const d = topDir(file);
  if (!d) return NEUTRAL;
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) % 360;
  return `hsl(${h}, 68%, 62%)`;
}

function nodeColor(n: RawNode): string {
  if (n.domain && DOMAIN_COLORS[n.domain]) return DOMAIN_COLORS[n.domain];
  if (n.kind === 'structural') return dirColor(n.file);
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
  // whole-codebase Graphify structural graph (8,587 nodes, lazy-loaded).
  const [view, setView] = useState<'all' | 'proven' | 'structural'>('all');
  const [structuralGraph, setStructuralGraph] = useState<RawGraph | null>(null);
  const [structuralLoading, setStructuralLoading] = useState(false);
  // Structural view drill-down: null = directory-cluster overview · a dir = that
  // directory's symbols expanded (NI-5b renders ~97 clusters by default, not the
  // 8.6k-node hairball, so it loads instantly and is navigable).
  const [expandedDir, setExpandedDir] = useState<string | null>(null);
  const provenCount = useMemo(() => graph?.nodes.filter((n) => n.proven).length ?? 0, [graph]);

  // The dataset downstream memos (degree, nodeById, lineage) read: structural view
  // → the full structural graph; else the semantic graph.
  const activeGraph = view === 'structural' ? structuralGraph : graph;

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

  // ── Lazy-load the structural graph (NI-5b) on first switch ─────────────────
  // ~2 MB / 8,587 nodes — fetched only when the user opens the Structural view,
  // never on the default page load.
  useEffect(() => {
    if (view !== 'structural' || structuralGraph || structuralLoading) return;
    let cancelled = false;
    setStructuralLoading(true);
    fetch('/api/admin/neomatrix/structural')
      .then(async (r) => {
        if (!r.ok) throw new Error(`Structural graph request failed (${r.status})`);
        const json = await r.json();
        return (json.data ?? json) as RawGraph;
      })
      .then((g) => {
        if (!cancelled) setStructuralGraph(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load structural graph');
      })
      .finally(() => {
        if (!cancelled) setStructuralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, structuralGraph, structuralLoading]);

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
  // Structural (8,587 nodes) needs a looser charge + shorter links or the ball
  // explodes; the semantic graph (~231) reads best tighter.
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

  const nodeById = useMemo(() => {
    const m = new Map<string, RawNode>();
    activeGraph?.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [activeGraph]);

  // id → colour, for tinting edges + particles by their source node.
  const colorById = useMemo(() => {
    const m = new Map<string, string>();
    activeGraph?.nodes.forEach((n) => m.set(n.id, nodeColor(n)));
    return m;
  }, [activeGraph]);

  // A link's source can be a string id (pre-simulation) or a node object (post).
  const linkSourceColor = useCallback(
    (l: { source: string | { id?: string } }) => {
      const id = typeof l.source === 'object' ? l.source?.id : l.source;
      return (id && colorById.get(id)) || NEUTRAL;
    },
    [colorById],
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

  // ── Structural view (NI-5b): directory clusters → drill-down → search ───────
  // Default = ~97 directory super-nodes (instant render, no 8.6k-node freeze).
  // Click a cluster → expand that directory's symbols (capped 800 by degree).
  // Searching bypasses clustering and matches across all 8,589 symbols.
  const STRUCTURAL_CAP = 800;
  const structuralView = useMemo(() => {
    if (view !== 'structural' || !structuralGraph) return { nodes: [] as GNode[], links: [] as GLink[] };
    const q = search.trim().toLowerCase();
    const visibleSubset = (subset: RawNode[]) => {
      const vis = new Set(subset.map((n) => n.id));
      const nodes: GNode[] = subset.map((n) => {
        const deg = degree.get(n.id) ?? 0;
        return { ...n, degree: deg, color: nodeColor(n), val: 1 + Math.min(deg, 6) * 0.5 };
      });
      const links: GLink[] = [];
      for (const e of structuralGraph.edges) if (vis.has(e.from) && vis.has(e.to)) links.push({ source: e.from, target: e.to, type: e.type });
      return { nodes, links };
    };
    // SEARCH — across every symbol, regardless of cluster/expand state.
    if (q) {
      const matched = structuralGraph.nodes
        .filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
        .slice(0, STRUCTURAL_CAP);
      return visibleSubset(matched);
    }
    // EXPANDED — one directory's symbols (capped by degree).
    if (expandedDir) {
      let inDir = structuralGraph.nodes.filter((n) => topDir(n.file) === expandedDir);
      if (inDir.length > STRUCTURAL_CAP) {
        inDir = [...inDir].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, STRUCTURAL_CAP);
      }
      return visibleSubset(inDir);
    }
    // CLUSTER overview — one super-node per top-level directory.
    const cnt = new Map<string, number>();
    for (const n of structuralGraph.nodes) {
      const d = topDir(n.file);
      cnt.set(d, (cnt.get(d) ?? 0) + 1);
    }
    const nodes: GNode[] = [...cnt.entries()].map(([d, c]) => ({
      id: `dir::${d}`,
      kind: 'cluster',
      label: d,
      file: d,
      line: null,
      layer: null,
      domain: null,
      trailStage: null,
      regime: null,
      produces: `${c} symbols`,
      formula: null,
      authority: null,
      inputs: [],
      workedExample: null,
      verifiedBy: null,
      verifiedDate: null,
      status: null,
      degree: c,
      color: dirColor(d),
      val: 4 + Math.log2(c + 1) * 2.2,
    }));
    const ce = new Map<string, number>();
    const dirOf = (id: string) => topDir(nodeById.get(id)?.file ?? null);
    for (const e of structuralGraph.edges) {
      const a = dirOf(e.from);
      const b = dirOf(e.to);
      if (!a || !b || a === b) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      ce.set(k, (ce.get(k) ?? 0) + 1);
    }
    const links: GLink[] = [...ce.keys()].map((k) => {
      const [a, b] = k.split('|');
      return { source: `dir::${a}`, target: `dir::${b}`, type: 'depends' };
    });
    return { nodes, links };
  }, [view, structuralGraph, expandedDir, search, degree, nodeById]);

  // The dataset actually drawn (semantic → filtered · structural → structuralView).
  const rendered = view === 'structural' ? structuralView : filtered;

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // Lineage of the selected node (in / out edges with the other node's label).
  // Capped at 40 each — a structural file node can have 100+ `contains` edges.
  const lineage = useMemo(() => {
    if (!activeGraph || !selected) return { out: [] as RawEdge[], inc: [] as RawEdge[] };
    return {
      out: activeGraph.edges.filter((e) => e.from === selected.id).slice(0, 40),
      inc: activeGraph.edges.filter((e) => e.to === selected.id).slice(0, 40),
    };
  }, [activeGraph, selected]);

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
          {/* Domain legend (semantic views only — structural colours by directory) */}
          {view !== 'structural' && (
            <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl lg:flex">
              {DOMAINS.map((d) => (
                <span key={d} className="flex items-center gap-1.5 text-[11px] capitalize text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[d] }} />
                  {d}
                </span>
              ))}
            </div>
          )}
          {/* View toggle (NI-5): semantic graph ⇄ proven engines only. Labelled
              "Semantic" (not "All") so it doesn't imply the 8,587-node Graphify
              structural census — this explorer renders the verified SEMANTIC
              Neomatrix; the structural layer is a separate view (NI-5b). */}
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xl">
            {([
              ['all', `Semantic (${graph?.nodes.length ?? 0})`],
              ['proven', `Proven (${provenCount})`],
              ['structural', `Structural (${structuralGraph?.nodes.length ?? '8.6k'})`],
            ] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={
                  v === 'proven'
                    ? 'Only the calc-audit-proven engines + their 1-hop lineage'
                    : v === 'structural'
                      ? 'The whole-codebase Graphify structural graph (8,587 symbols across lib/ + app/), coloured by directory'
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
            {/* Breadcrumb: directory clusters → an expanded directory */}
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <button
                onClick={() => setExpandedDir(null)}
                className={`rounded px-1.5 py-0.5 transition ${expandedDir && !search ? 'text-sky-300 hover:text-sky-200' : 'text-slate-400'}`}
              >
                All directories
              </button>
              {expandedDir && !search && (
                <>
                  <span className="text-slate-600">/</span>
                  <span className="font-mono text-slate-200">{expandedDir}</span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {search
                ? 'Searching all 8,589 symbols.'
                : expandedDir
                  ? 'Symbols in this directory (top 800 by connections). Click a node to inspect its file:line + relations.'
                  : 'Whole-codebase structural graph (Graphify Layer 0), grouped by top-level directory. Click a directory to drill in, or search to find any symbol.'}
            </p>
          </div>
        )}

        <p className="mt-5 text-[11px] tabular-nums text-slate-500">
          {rendered.nodes.length}
          {view === 'structural' && !expandedDir && !search ? ' directories' : ` / ${activeGraph?.nodes.length ?? 0} nodes`} ·{' '}
          {rendered.links.length} edges
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
      {view === 'structural' && structuralLoading && !structuralGraph && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          Loading structural graph (~8.6k nodes)…
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
