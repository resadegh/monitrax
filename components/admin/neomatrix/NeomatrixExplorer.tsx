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
type GNode = RawNode & { degree: number; color: string; val: number; bridge?: boolean };
type GLink = { source: string; target: string; type: string };

function nodeColor(n: RawNode): string {
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
  // View toggle (NI-5): 'all' = every node · 'proven' = only the calc-audit-proven
  // engines + the edges among them (trace the verified core's lineage).
  const [view, setView] = useState<'all' | 'proven'>('all');
  const provenCount = useMemo(() => graph?.nodes.filter((n) => n.proven).length ?? 0, [graph]);

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
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !graph) return;
    try {
      // Shorter links pull related nodes together; mild repulsion keeps spacing.
      fg.d3Force('link')?.distance(34);
      fg.d3Force('charge')?.strength(-55);
      fg.d3ReheatSimulation?.();
    } catch {
      /* ref/forces unavailable — layout falls back to defaults */
    }
  }, [graph]);

  // ── Degree map (node size by connection count) ─────────────────────────────
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    graph?.edges.forEach((e) => {
      d.set(e.from, (d.get(e.from) ?? 0) + 1);
      d.set(e.to, (d.get(e.to) ?? 0) + 1);
    });
    return d;
  }, [graph]);

  const nodeById = useMemo(() => {
    const m = new Map<string, RawNode>();
    graph?.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graph]);

  // id → domain colour, for tinting edges + particles by their source node.
  const colorById = useMemo(() => {
    const m = new Map<string, string>();
    graph?.nodes.forEach((n) => m.set(n.id, nodeColor(n)));
    return m;
  }, [graph]);

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

  // ── Filtered graph passed to the canvas ────────────────────────────────────
  const filtered = useMemo(() => {
    if (!graph) return { nodes: [] as GNode[], links: [] as GLink[] };
    const q = search.trim().toLowerCase();
    const layerKey = (n: RawNode) => (n.layer && (LAYERS as readonly string[]).includes(n.layer) ? n.layer : 'other');
    const visible = new Set<string>();
    const nodes: GNode[] = [];
    for (const n of graph.nodes) {
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
        nodes.push({
          ...n,
          degree: deg,
          color: bridge ? BRIDGE_DIM : nodeColor(n),
          val: bridge ? 1.5 : 2 + deg * 1.4,
          bridge,
        });
      }
    }
    const links: GLink[] = [];
    for (const e of graph.edges) {
      if (visible.has(e.from) && visible.has(e.to)) {
        links.push({ source: e.from, target: e.to, type: e.type });
      }
    }
    return { nodes, links };
  }, [graph, search, activeDomains, activeLayers, degree, view, provenScope]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // Lineage of the selected node (in / out edges with the other node's label).
  const lineage = useMemo(() => {
    if (!graph || !selected) return { out: [] as RawEdge[], inc: [] as RawEdge[] };
    return {
      out: graph.edges.filter((e) => e.from === selected.id),
      inc: graph.edges.filter((e) => e.to === selected.id),
    };
  }, [graph, selected]);

  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const handleNodeClick = useCallback((node: { id?: string | number }) => {
    if (node?.id != null) setSelectedId(String(node.id));
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
      {graph && !error && (
        <ForceGraph3D
          ref={fgRef}
          graphData={filtered}
          width={size.w}
          height={size.h}
          numDimensions={dims}
          backgroundColor="rgba(0,0,0,0)"
          nodeColor={(n: object) => (n as GNode).color}
          nodeVal={(n: object) => (n as GNode).val}
          nodeLabel={(n: object) => {
            const g = n as GNode;
            return `<div style="font-family:Inter,sans-serif;font-size:12px;color:#e2e8f0">${g.label}<br/><span style="color:#94a3b8">${g.kind}${g.domain ? ' · ' + g.domain : ''}</span></div>`;
          }}
          nodeOpacity={0.92}
          nodeResolution={16}
          // Edges: tinted by their source node's domain, clearly visible, with
          // flowing directional particles so relationships read as "alive".
          linkColor={(l: object) => linkSourceColor(l as { source: string | { id?: string } })}
          linkOpacity={0.45}
          linkWidth={0.6}
          linkDirectionalParticles={2}
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
          {/* Domain legend */}
          <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl lg:flex">
            {DOMAINS.map((d) => (
              <span key={d} className="flex items-center gap-1.5 text-[11px] capitalize text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[d] }} />
                {d}
              </span>
            ))}
          </div>
          {/* View toggle (NI-5): All nodes ⇄ Proven engines only */}
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xl">
            {([
              ['all', 'All'],
              ['proven', `Proven (${provenCount})`],
            ] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={v === 'proven' ? 'Only the calc-audit-proven engines + their lineage' : 'Every node in the graph'}
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

        <p className="mt-5 text-[11px] tabular-nums text-slate-500">
          {filtered.nodes.length} / {graph?.nodes.length ?? 0} nodes · {filtered.links.length} edges
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
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>
        </div>
      )}

      {!selected && graph && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-[11px] text-slate-600">
          Drag to orbit · scroll to zoom · click a node to inspect
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
