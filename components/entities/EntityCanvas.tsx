'use client';

/**
 * Phase 44 Part 1c — the entity-structure canvas (§11A).
 *
 * The digital, live equivalent of the org chart an accountant hands a
 * client: role-coloured boxes per entity, labelled connectors per
 * relationship. The five improvements over a static PDF (§11A):
 *
 *  1. Colour by role — the established Phase 41c palette.
 *  2. Progressive disclosure — the box shows the essentials; full
 *     detail opens in the entity-detail dialog on click.
 *  3. The lens toggle — Control / Ownership / Money flow / All. Because
 *     §3A keeps legal title / beneficial ownership / control distinct,
 *     the canvas shows one dimension at a time instead of a tangle.
 *  4. Interactive + navigable — click a box → its detail; click a
 *     connector → the relationship detail; §6.1 state badge per box.
 *  5. Layered auto-layout (dagre) + manual nudge (persisted).
 *
 * PRESENTATIONAL ONLY (§8.4 / §11A): this component reads the graph
 * from `/api/entities/graph`, runs the pure `lib/entity-graph/` rules
 * engine for the validity badges, and renders. It computes nothing
 * financial and performs no tax arithmetic (§8.3). The interaction
 * engine is React Flow; the look is entirely Monitrax's own.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Loader2,
  AlertCircle,
  Plus,
  RotateCcw,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/context/AuthContext';
import { ROLE_PALETTE, ROLE_LABELS, type LegalEntityRole } from './types';
import { MoneyFlowSankey } from './MoneyFlowSankey';
import type { MoneyFlowResult } from '@/lib/services/moneyFlowService';
import {
  EntityCanvasNode,
  type EntityNodeData,
  type EntityCanvasNodeType,
} from './canvas/EntityCanvasNode';
import { EntityDetailDialog } from './EntityDetailDialog';
import { RelationshipDetailDialog } from './RelationshipDetailDialog';
import {
  fetchEntityGraph,
  extractApiError,
  type CanvasGraph,
  type CanvasNode,
  type CanvasEdge,
} from './canvas/entityGraphClient';
import {
  LENSES,
  type CanvasLens,
  lensShowsEdge,
  relationshipTypeMeta,
  EDGE_CATEGORY_COLOUR,
} from './canvas/graphMeta';
import { layoutGraph, loadNudges, saveNudges, clearNudges, type XYPosition } from './canvas/layout';
import { classifyGraph, type GraphValidityReport } from '@/lib/entity-graph/validityMatrix';
import { isEdgeActiveAt } from '@/lib/entity-graph/types';
import { formatAbn } from '@/lib/utils/auValidators';

// React Flow needs a stable nodeTypes reference.
const NODE_TYPES = { entity: EntityCanvasNode };

// =============================================================================
// FLOW BUILDERS
// =============================================================================

/** Compute the box's one key line — "Trustee: …" for trusts, ABN otherwise (§11A point 2). */
function keyLineFor(node: CanvasNode, graph: CanvasGraph, asOf: Date): string | null {
  const isTrustLike = [
    'DISCRETIONARY_TRUST',
    'UNIT_TRUST',
    'FIXED_TRUST',
    'HYBRID_TRUST',
    'BARE_TRUST',
    'TESTAMENTARY_TRUST',
    'SMSF',
    'DECEASED_ESTATE',
  ].includes(node.type);
  if (isTrustLike) {
    const trustees = graph.edges
      .filter(
        (e) => e.toEntityId === node.id && e.type === 'TRUSTEE_OF' && isEdgeActiveAt(e, asOf),
      )
      .map((e) => e.fromEntityName);
    if (trustees.length > 0) {
      return `Trustee: ${trustees.slice(0, 2).join(', ')}${trustees.length > 2 ? '…' : ''}`;
    }
  }
  if (node.abn) return `ABN ${formatAbn(node.abn)}`;
  return null;
}

interface BuiltFlow {
  nodes: EntityCanvasNodeType[];
  edges: Edge[];
}

/** Build React Flow nodes + edges from the graph, the active lens + nudges. */
function buildFlow(
  graph: CanvasGraph,
  lens: Exclude<CanvasLens, 'money'>,
  nudges: Record<string, XYPosition>,
  report: GraphValidityReport,
): BuiltFlow {
  const asOf = new Date();

  // Edges: active now AND shown by the active lens.
  const lensEdges = graph.edges.filter(
    (e) => isEdgeActiveAt(e, asOf) && lensShowsEdge(lens, e.type),
  );

  const positions = layoutGraph(
    graph.nodes.map((n) => n.id),
    lensEdges.map((e) => ({ source: e.fromEntityId, target: e.toEntityId })),
  );

  const nodes: EntityCanvasNodeType[] = graph.nodes.map((n) => {
    const validity = report.entities.get(n.id);
    const data: EntityNodeData = {
      name: n.name,
      entityType: n.type,
      role: n.role,
      keyLine: keyLineFor(n, graph, asOf),
      state: validity?.state ?? n.structuralState,
      stateReason:
        validity && validity.issues.length > 0
          ? validity.issues.map((i) => i.message).join(' · ')
          : null,
      accountantVerified: n.accountantVerified,
      hasTfn: n.hasTfn,
      unsupportedStructure: n.unsupportedStructure,
    };
    return {
      id: n.id,
      type: 'entity',
      position: nudges[n.id] ?? positions.get(n.id) ?? { x: 0, y: 0 },
      data,
    };
  });

  const edges: Edge[] = lensEdges.map((e) => {
    const meta = relationshipTypeMeta(e.type);
    const colour = EDGE_CATEGORY_COLOUR[meta.category];
    const flagged = report.edges.get(e.id)?.state === 'NON_COMPLIANT_BUT_RECORDED';
    return {
      id: e.id,
      source: e.fromEntityId,
      target: e.toEntityId,
      type: 'smoothstep',
      label: meta.label,
      labelBgPadding: [5, 2] as [number, number],
      labelBgBorderRadius: 6,
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelStyle: { fontSize: 10, fontWeight: 600, fill: colour },
      markerEnd: { type: MarkerType.ArrowClosed, color: colour, width: 16, height: 16 },
      style: {
        stroke: flagged ? '#f59e0b' : colour,
        strokeWidth: meta.strong ? 2 : 1.5,
        strokeDasharray: meta.strong ? undefined : '5 4',
        strokeOpacity: 0.75,
      },
    };
  });

  return { nodes, edges };
}

// =============================================================================
// LEGEND
// =============================================================================

function Legend() {
  const roles: LegalEntityRole[] = [
    'PERSONAL',
    'HOLDING',
    'OPERATING',
    'INVESTMENT',
    'SUPERANNUATION',
    'CORPORATE_TRUSTEE',
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-2 text-[10px] text-slate-500 dark:text-slate-400">
      {roles.map((r) => (
        <span key={r} className="inline-flex items-center gap-1">
          <span
            className={`inline-block h-2 w-2 rounded-full ${ROLE_PALETTE[r].iconBg} ring-1 ring-slate-300 dark:ring-slate-700`}
          />
          {ROLE_LABELS[r]}
        </span>
      ))}
      <span className="text-slate-300 dark:text-slate-600">|</span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-px w-4 border-t-2 border-slate-400" />
        legal / determinative
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-px w-4 border-t border-dashed border-slate-400" />
        indicator / influence
      </span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface EntityCanvasProps {
  /** Bumped by the page when its entity list mutates — triggers a refetch. */
  reloadSignal: number;
  onAddEntity: () => void;
  onEditEntity: (entityId: string) => void;
}

export function EntityCanvas({ reloadSignal, onAddEntity, onEditEntity }: EntityCanvasProps) {
  const { token, user } = useAuth();
  const userId = user?.id ?? 'anon';

  const [graph, setGraph] = useState<CanvasGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<CanvasLens>('control');
  const [nudges, setNudges] = useState<Record<string, XYPosition>>({});

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<EntityCanvasNodeType>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedEntity, setSelectedEntity] = useState<CanvasNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<CanvasEdge | null>(null);

  // Money-flow lens — lazily fetched (§11A folds the Sankey in as a lens).
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlowResult | null>(null);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [moneyError, setMoneyError] = useState<string | null>(null);

  // -- Load the graph -----------------------------------------------------------
  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const g = await fetchEntityGraph(token);
      setGraph(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the entity graph.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload, reloadSignal]);

  // Load saved manual nudges once the user id is known.
  useEffect(() => {
    setNudges(loadNudges(userId));
  }, [userId]);

  // -- Money flow (lazy) --------------------------------------------------------
  useEffect(() => {
    if (lens !== 'money' || moneyFlow || moneyLoading || moneyError || !token) return;
    setMoneyLoading(true);
    fetch('/api/money-flow', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) {
          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            /* not JSON */
          }
          throw new Error(extractApiError(body, res.status, 'Failed to load money flow.'));
        }
        const json = (await res.json()) as { data?: MoneyFlowResult };
        setMoneyFlow(json.data ?? null);
      })
      .catch((err) => setMoneyError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setMoneyLoading(false));
  }, [lens, moneyFlow, moneyLoading, moneyError, token]);

  // The §6 validity report — one classifyGraph run, shared by the canvas
  // badges and the entity-detail dialog (SSOT rules engine, §8.4).
  const report = useMemo(() => (graph ? classifyGraph(graph, new Date()) : null), [graph]);

  // -- Rebuild the flow when the graph, lens or nudges change -------------------
  const built = useMemo(() => {
    if (!graph || lens === 'money' || !report) return null;
    return buildFlow(graph, lens, nudges, report);
  }, [graph, lens, nudges, report]);

  useEffect(() => {
    if (built) {
      setRfNodes(built.nodes);
      setRfEdges(built.edges);
    }
  }, [built, setRfNodes, setRfEdges]);

  // -- Interaction --------------------------------------------------------------
  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      const found = graph?.nodes.find((n) => n.id === node.id) ?? null;
      setSelectedEntity(found);
    },
    [graph],
  );

  const handleEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      const found = graph?.edges.find((x) => x.id === edge.id) ?? null;
      setSelectedEdge(found);
    },
    [graph],
  );

  const handleNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setNudges((prev) => {
        const next = { ...prev, [node.id]: { x: node.position.x, y: node.position.y } };
        saveNudges(userId, next);
        return next;
      });
    },
    [userId],
  );

  const handleResetLayout = useCallback(() => {
    clearNudges(userId);
    setNudges({});
  }, [userId]);

  // -- Render -------------------------------------------------------------------
  if (loading && !graph) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200/70 bg-white/60 p-16 dark:border-slate-700/50 dark:bg-slate-900/60">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
        <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Couldn&rsquo;t load your structure canvas.</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200/70 bg-white/60 p-16 dark:border-slate-700/50 dark:bg-slate-900/60">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const activeLens = LENSES.find((l) => l.id === lens) ?? LENSES[0];
  const hasNudges = Object.keys(nudges).length > 0;

  return (
    <div className="space-y-3">
      {/* Lens toggle + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            role="tablist"
            aria-label="Structure lens"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/70 p-1 text-sm shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/70"
          >
            {LENSES.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={lens === l.id}
                onClick={() => setLens(l.id)}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  lens === l.id
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-xs text-slate-500 dark:text-slate-400">
            {activeLens.blurb}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lens !== 'money' && hasNudges && (
            <Button variant="ghost" size="sm" onClick={handleResetLayout}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset layout
            </Button>
          )}
          <Button size="sm" onClick={onAddEntity}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add entity
          </Button>
        </div>
      </div>

      {/* Money-flow lens — the folded-in Sankey (§11A) */}
      {lens === 'money' && (
        <div>
          {moneyLoading && (
            <div className="flex items-center justify-center rounded-3xl border border-slate-200/70 bg-white/60 p-16 dark:border-slate-700/50 dark:bg-slate-900/60">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}
          {!moneyLoading && moneyError && (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <p className="font-medium">Couldn&rsquo;t load your money flow.</p>
              <p className="mt-1 text-xs opacity-80">{moneyError}</p>
            </div>
          )}
          {!moneyLoading && !moneyError && moneyFlow && <MoneyFlowSankey flow={moneyFlow} />}
        </div>
      )}

      {/* Graph canvas — Control / Ownership / All lenses */}
      {lens !== 'money' && (
        <>
          <div
            className="relative h-[620px] overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/70 via-white/50 to-amber-50/20 shadow-sm ring-1 ring-slate-900/[0.04] dark:border-slate-700/50 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-950/70"
            aria-label={`Entity structure canvas — ${activeLens.label} lens`}
          >
            {graph.nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Network className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No entities to draw yet.
                </p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
                  Add a trust, SMSF, company or partnership and it will appear here.
                </p>
              </div>
            ) : (
              <ReactFlow
                key={lens}
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={NODE_TYPES}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onNodeDragStop={handleNodeDragStop}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={1.6}
                proOptions={{ hideAttribution: false }}
              >
                <Background gap={20} size={1} color="#cbd5e1" />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(n) => {
                    const role = (n.data as EntityNodeData | undefined)?.role;
                    switch (role) {
                      case 'HOLDING':
                        return '#6366f1';
                      case 'OPERATING':
                        return '#10b981';
                      case 'INVESTMENT':
                        return '#c026d3';
                      case 'SUPERANNUATION':
                        return '#8b5cf6';
                      case 'CORPORATE_TRUSTEE':
                        return '#64748b';
                      default:
                        return '#d97706';
                    }
                  }}
                />
              </ReactFlow>
            )}
          </div>
          <Legend />
        </>
      )}

      {/* Click-through dialogs */}
      {graph && (
        <EntityDetailDialog
          open={!!selectedEntity}
          entity={selectedEntity}
          graph={graph}
          issues={
            selectedEntity
              ? report?.entities.get(selectedEntity.id)?.issues.map((i) => i.message) ?? []
              : []
          }
          token={token ?? ''}
          onClose={() => setSelectedEntity(null)}
          onChanged={reload}
          onEditEntity={(id) => {
            setSelectedEntity(null);
            onEditEntity(id);
          }}
        />
      )}
      <RelationshipDetailDialog
        open={!!selectedEdge}
        edge={selectedEdge}
        token={token ?? ''}
        onClose={() => setSelectedEdge(null)}
        onChanged={reload}
      />
    </div>
  );
}
