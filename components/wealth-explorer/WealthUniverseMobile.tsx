/**
 * WealthUniverseMobile — Apple Maps-style hybrid for `/dashboard/entities`
 * on mobile viewports (<md). Compact spatial canvas on top + draggable
 * bottom sheet (peek / half / full snap states) with search + filter +
 * selected-entity detail card + entity list. Tapping a tile and tapping
 * a list row stay in sync.
 *
 * Source of truth: Stitch screen `72ea8d79fa7e4a0c865a2c2a9d73d198`
 * Artefact: `.stitch/designs/wealth-explorer-mobile-v1-dark.{html,png}`
 *
 * Reuses the same data layer as the desktop canvas
 * (`useWealthExplorerData()` → `/api/wealth-graph` → `layoutWealthExplorer`).
 * Renders independently — no shared component with WealthUniverseCanvas
 * to keep refactor risk low for the first ship. Extraction policy
 * (CLAUDE.md §12.8) — extract on the second use, not the first.
 *
 * Semantic zoom (Phase WX.4, 2026-06-10): the CANVAS renders the
 * collapsed Level 1 layout (entities only, count badges + "$X held"),
 * unfolding one constellation on tap. The bottom-sheet LIST keeps the
 * fully-expanded layout ('all') — that's where granular asset browsing
 * lives on mobile.
 * Semantic-zoom SoT: screen `e5ecb8d170cc4fbdbc336413cd9948d2`,
 * artefact `.stitch/designs/wealth-universe-zoom/universe-level1-mobile-dark.{html,png}`.
 */

'use client';

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  Scroll,
  Shield,
  Box,
  Umbrella,
  Rocket,
  User,
  Home,
  Car,
  LineChart,
  CircleDollarSign,
  Banknote,
  Users,
  ChevronRight,
  CheckCircle2,
  TreePine,
  Sparkles,
  AlertTriangle,
  type LucideIcon,
  PiggyBank,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { layoutWealthExplorer } from '@/lib/data/wealthExplorerLayout';
import {
  NODE_ACCENT,
  RIBBON_COLOR,
  type WealthNode,
  type WealthNodeType,
  type WealthRelationship,
} from '@/lib/data/wealthExplorerTypes';
import { useWealthExplorerData } from '@/lib/hooks/useWealthExplorerData';
import Link from 'next/link';
import type { WealthGraphAsset } from '@/lib/services/wealthGraphService';

const NODE_GLYPH: Record<WealthNodeType, LucideIcon> = {
  'holding-company': Briefcase,
  'trustee-company': Scroll,
  'smsf-trustee-company': Shield,
  'other-company': Box,
  'trust': Umbrella,
  'smsf': Rocket,
  'individual': User,
  'asset-property': Home,
  'asset-vehicle': Car,
  'asset-investment': LineChart,
  'asset-cash': CircleDollarSign,
  'asset-loan': Banknote,
  'ownership-group': Users,
};

const FILTER_CHIPS: Array<{
  id: 'all' | 'people' | 'trusts' | 'smsf' | 'companies' | 'properties' | 'investments' | 'cash' | 'vehicles';
  label: string;
  types: WealthNodeType[] | 'all';
}> = [
  { id: 'all', label: 'All', types: 'all' },
  { id: 'people', label: 'People', types: ['individual'] },
  { id: 'trusts', label: 'Trusts', types: ['trust'] },
  { id: 'smsf', label: 'SMSF', types: ['smsf', 'smsf-trustee-company'] },
  { id: 'companies', label: 'Companies', types: ['holding-company', 'trustee-company', 'other-company'] },
  { id: 'properties', label: 'Properties', types: ['asset-property'] },
  { id: 'investments', label: 'Investments', types: ['asset-investment'] },
  { id: 'cash', label: 'Cash', types: ['asset-cash'] },
  { id: 'vehicles', label: 'Vehicles', types: ['asset-vehicle'] },
];

// Compact tile-size multiplier for mobile. 0.78 leaves tiles legible
// without crowding 13 nodes — increased from 0.55 (2026-05-31 Reza
// feedback: "tiles too small to read").
const COMPACT_SIZE_SCALE = 0.78;

// Snap-state heights (px from bottom). Used by the bottom sheet drag.
// Default opens at PEEK (handle + search only) so the map gets the
// full canvas area — increased from 'half' (2026-05-31 Reza feedback:
// "the map is very small"). Sheet auto-rises to 'half' when a tile is
// tapped; X on the detail card drops it back to 'peek'.
const SNAP_PEEK = 96;
const SNAP_HALF_FRAC = 0.55;
const SNAP_FULL_FRAC = 0.92;

type SnapState = 'peek' | 'half' | 'full';

export default function WealthUniverseMobile() {
  const { layout: baseLayout, snapshot, loading, error, refetch } = useWealthExplorerData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phase WX.4 — which entity (or `group-<id>`) has its constellation
  // unfolded on the canvas.
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  // Phase WX.5 — microscopic camera zoom between layers (mirrors desktop).
  const [cameraOrigin, setCameraOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [cameraDirection, setCameraDirection] = useState<'in' | 'out'>('in');
  const prefersReducedMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<typeof FILTER_CHIPS[number]['id']>('all');
  const [snap, setSnap] = useState<SnapState>('peek');
  const [viewportHeight, setViewportHeight] = useState<number>(844);
  // Phase 1.1 — beneficial-ownership lens toggle (mirrors desktop).
  const [lensMode, setLensMode] = useState<'legal' | 'beneficial'>('legal');
  // Phase 2 — Structure / Money Flow primary lens (mirrors desktop).
  const [flowMode, setFlowMode] = useState<'structure' | 'money-flow'>('structure');
  // Phase 2 enhancement — FY-slider state (mirrors desktop).
  const [selectedFy, setSelectedFy] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const snapHeights = useMemo(() => {
    return {
      peek: SNAP_PEEK,
      half: Math.round(viewportHeight * SNAP_HALF_FRAC),
      full: Math.round(viewportHeight * SNAP_FULL_FRAC),
    };
  }, [viewportHeight]);

  const sheetHeight = snapHeights[snap];

  // Phase WX.4 — two layouts from the one snapshot. The canvas renders
  // the collapsed Level 1 (+ tapped constellation); the bottom-sheet
  // list keeps the fully-expanded graph so granular asset browsing is
  // untouched. The layout function is pure and cheap.
  const canvasLayout = useMemo(
    () =>
      snapshot
        ? layoutWealthExplorer(snapshot, { expandedEntityIds: expandedIds })
        : baseLayout,
    [snapshot, expandedIds, baseLayout],
  );
  const fullLayout = useMemo(
    () => (snapshot ? layoutWealthExplorer(snapshot, { assetDetail: 'all' }) : baseLayout),
    [snapshot, baseLayout],
  );
  const layout = canvasLayout;

  const nodes = useMemo(() => canvasLayout?.nodes ?? [], [canvasLayout]);
  const relationships = useMemo(() => canvasLayout?.relationships ?? [], [canvasLayout]);
  const listNodes = useMemo(() => fullLayout?.nodes ?? [], [fullLayout]);
  const listRelationships = useMemo(() => fullLayout?.relationships ?? [], [fullLayout]);
  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, n])),
    [nodes],
  );
  const listNodesById = useMemo(
    () => Object.fromEntries(listNodes.map(n => [n.id, n])),
    [listNodes],
  );
  // Selection resolves against the FULL graph — an asset tapped in the
  // list must resolve even before its constellation unfolds on canvas.
  const selectedNode = selectedId ? listNodesById[selectedId] : null;

  // Deep-link focus (mirrors desktop): widget bubbles carry ?focus=<node>.
  const searchParams = useSearchParams();
  const focusAppliedRef = useRef(false);
  useEffect(() => {
    if (focusAppliedRef.current || nodes.length === 0) return;
    const focus = searchParams?.get('focus');
    if (!focus) {
      focusAppliedRef.current = true;
      return;
    }
    focusAppliedRef.current = true;
    const node = nodesById[focus] ?? listNodesById[focus];
    if (!node) return;
    setSelectedId(focus);
    if (node.tier !== 'asset' && node.isExpandable) {
      setCameraOrigin({ x: node.position.x, y: node.position.y });
      setCameraDirection('in');
      setExpandedIds([focus]);
    }
    // Sheet stays at peek — the arrival zoom is the moment; details on demand.
  }, [searchParams, nodes, nodesById, listNodesById]);

  const visibleTypes = useMemo<Set<WealthNodeType> | null>(() => {
    const chip = FILTER_CHIPS.find(c => c.id === activeFilter);
    if (!chip || chip.types === 'all') return null;
    return new Set(chip.types);
  }, [activeFilter]);

  const matchedNodeIds = useMemo<Set<string> | null>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(listNodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id));
  }, [listNodes, searchQuery]);

  function nodeOpacity(node: WealthNode): number {
    let opacity = 1;
    if (visibleTypes && !visibleTypes.has(node.type)) opacity *= 0.18;
    if (matchedNodeIds && !matchedNodeIds.has(node.id)) opacity *= 0.35;
    return opacity;
  }

  function isRibbonActive(r: WealthRelationship): boolean {
    if (!selectedId) return false;
    return r.from === selectedId || r.to === selectedId;
  }
  // Phase 1.1 — beneficial-ownership lens (mirrors desktop).
  const hasBeneficialOverride = useMemo(
    () => relationships.some(r => r.id.startsWith('boo-')),
    [relationships],
  );
  // Phase 2 — Money Flow lens (mirrors desktop).
  const flowRibbons = useMemo(
    () => relationships.filter(isFlowRibbon),
    [relationships],
  );
  const hasFlows = flowRibbons.length > 0;
  // Phase 2 enhancement — FY-slider data (mirrors desktop).
  const moneyFlowFy = layout?.moneyFlowFy ?? null;
  const moneyFlowFyOptions = useMemo(
    () => layout?.moneyFlowFyOptions ?? [],
    [layout],
  );
  useEffect(() => {
    if (selectedFy === null && moneyFlowFy) setSelectedFy(moneyFlowFy);
  }, [moneyFlowFy, selectedFy]);
  // Pending-Royal-Assent count is scoped to the selected FY so the
  // §12.14 surface tracks what the user can actually see on the canvas.
  const pendingReformFlowCount = useMemo(
    () =>
      flowRibbons.filter(
        r => !!r.reformNotice && (!selectedFy || r.financialYear === selectedFy),
      ).length,
    [flowRibbons, selectedFy],
  );
  function isLensDimmed(r: WealthRelationship): boolean {
    if (!hasBeneficialOverride) return false;
    if (lensMode === 'beneficial') return r.type === 'holds';
    return r.id.startsWith('boo-');
  }
  function isRibbonDimmed(r: WealthRelationship): boolean {
    if (flowMode === 'money-flow') {
      if (!isFlowRibbon(r)) return true;
      if (selectedFy && r.financialYear && r.financialYear !== selectedFy) return true;
    } else {
      if (isFlowRibbon(r)) return true;
    }
    if (isLensDimmed(r)) return true;
    if (!selectedId) return false;
    return r.from !== selectedId && r.to !== selectedId;
  }

  function onTapTile(id: string) {
    // Phase WX.4 — selection drives the canvas expansion. Tapping an
    // asset keeps its parent constellation open; tapping an entity
    // unfolds its own. Cluster tiles (WX.4.1) exist only on the canvas
    // layout, so resolve there first.
    const node = nodesById[id] ?? listNodesById[id];
    if (node?.tier === 'asset') {
      // Assets open the detail card — the one case the sheet rises.
      setSelectedId(id);
      if (node.parentNodeId) setExpandedIds([node.parentNodeId]);
      if (snap === 'peek') setSnap('half');
      return;
    }
    // Tapping the bubble you're already inside zooms back out (WX.5.1).
    if (expandedIds[0] === id) {
      zoomOut();
      return;
    }
    setSelectedId(id);
    // WX.5.3 — expandability is the layout's call (`isExpandable`):
    // in cluster mode tapping the entity opens its card, not the
    // removed all-holdings layer (too busy on a phone — Reza
    // 2026-06-11).
    if (node?.isExpandable) {
      // Zooming IN keeps the canvas dominant — the sheet stays put
      // (Reza 2026-06-10: "the list keeps coming up and takes most of
      // the page").
      setCameraOrigin({ x: node.position.x, y: node.position.y });
      setCameraDirection('in');
      setExpandedIds([id]);
    } else {
      // No scene to unfold — the card IS the response. Raise the sheet
      // so the tap visibly lands (same contract as asset taps).
      setExpandedIds([]);
      if (snap === 'peek') setSnap('half');
    }
  }

  /** Fly back out to the universe (reverse camera). */
  function zoomOut() {
    setCameraDirection('out');
    setSelectedId(null);
    setExpandedIds([]);
  }

  function clearSelection() {
    zoomOut();
    setSnap('peek');
  }

  // Loading / error / empty states share the same shell.
  if (loading) {
    return (
      <Shell>
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <Sparkles size={14} className="animate-pulse" />
            <span>Loading your wealth universe…</span>
          </div>
        </div>
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div
            className="max-w-sm rounded-2xl p-5 text-center"
            style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}
          >
            <div className="text-[14px] font-semibold text-amber-200">Couldn&rsquo;t load your structure</div>
            <div className="mt-1 text-[12px] text-amber-200/70">{error}</div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        </div>
      </Shell>
    );
  }
  if (layout?.isEmpty || nodes.length === 0) {
    return (
      <Shell>
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}
            >
              <TreePine size={24} color="#A78BFA" strokeWidth={1.5} />
            </div>
            <div className="mt-4 text-[15px] font-semibold text-white">Your wealth universe is just you so far</div>
            <p className="mt-2 text-[12px] leading-relaxed text-white/55">
              Add a family trust, an SMSF, or a Pty Ltd to see your structure here.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // Canvas takes the area above the sheet (no page header now — saves
  // 84px of vertical space; the dashboard's existing tab strip provides
  // context).
  const canvasHeight = Math.max(220, viewportHeight - sheetHeight - 16);

  return (
    <Shell>
      <DustMoteLayer />

      {/* Compact canvas — fills the area above the sheet. The page-level
          header (in app/dashboard/entities/page.tsx) is hidden on mobile
          so the canvas can use the full vertical space without three
          stacked header rows. */}
      <div
        className="absolute left-0 right-0 z-20"
        style={{
          top: 8,
          height: canvasHeight,
          transition: 'height 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Phase WX.5 — layered scenes with the microscopic camera zoom
            (mirrors desktop): zoom IN magnifies the old layer toward
            the tapped bubble and racks it out of focus; the inner
            layer sharpens in. Back = reversed. */}
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={expandedIds[0] ?? 'universe'}
            className="absolute inset-0"
            style={{ transformOrigin: `${cameraOrigin.x}% ${cameraOrigin.y}%` }}
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : cameraDirection === 'in'
                  ? { opacity: 0, scale: 0.5 }
                  : { opacity: 0, scale: 2.4 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : cameraDirection === 'in'
                  ? { opacity: 0, scale: 2.4 }
                  : { opacity: 0, scale: 0.5 }
            }
            // Scale-only on mobile: iOS Safari frame-drops animated
            // filter:blur, which made WX.5 imperceptible (Reza). Deeper
            // range + slightly longer ride = the microscopic feel.
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* SVG ribbons */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {relationships.map(r => (
                <Ribbon
                  key={r.id}
                  rel={r}
                  nodes={nodesById}
                  isActive={isRibbonActive(r)}
                  isDimmed={isRibbonDimmed(r)}
                />
              ))}
            </svg>
            {/* Tiles */}
            {nodes.map(node => (
              <MobileTile
                key={node.id}
                node={node}
                glyph={NODE_GLYPH[node.type]}
                accent={NODE_ACCENT[node.type]}
                isSelected={selectedId === node.id}
                visibilityOpacity={nodeOpacity(node)}
                onTap={() => onTapTile(node.id)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* WX.5.1 — the way back + the ownership trail. The trail keeps
          the layer's OWNER visible at every depth so asset ownership is
          always trackable (Reza 2026-06-10: "the owner of the layer
          should always be available in each layer"). */}
      {expandedIds.length > 0 && (() => {
        const sceneParent = nodes.find(n => n.tier !== 'asset' && n.isExpanded);
        const trail = sceneParent
          ? sceneParent.tier === 'cluster' && sceneParent.subtitle
            ? `${sceneParent.subtitle} › ${sceneParent.shortName}`
            : sceneParent.tier === 'group'
              ? `${sceneParent.shortName} · ${sceneParent.subtitle ?? ''}`
              : sceneParent.shortName
          : '';
        return (
          <div className="absolute left-4 right-4 top-4 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium text-white/85 active:scale-95"
              style={{
                background: 'rgba(19, 26, 46, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <ChevronRight size={13} className="rotate-180" strokeWidth={2} />
              Universe
            </button>
            {trail && (
              <span
                className="truncate rounded-full px-3 py-2 text-[11px] font-medium text-white/60"
                style={{
                  background: 'rgba(19, 26, 46, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {trail}
              </span>
            )}
          </div>
        );
      })()}

      {/* Bottom sheet */}
      <BottomSheet
        snap={snap}
        snapHeights={snapHeights}
        onSnapChange={setSnap}
      >
        {/* Phase 2 — Structure / Money Flow primary lens. Renders only
            when there's at least one CONFIRMED flow this FY. */}
        {hasFlows && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <div
              className="inline-flex h-7 items-center overflow-hidden rounded-full"
              style={{
                background: 'rgba(19, 26, 46, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setFlowMode('structure')}
                className="h-7 rounded-full px-3 text-[10px] font-medium transition"
                style={
                  flowMode === 'structure'
                    ? {
                        background: 'rgba(125, 211, 252, 0.14)',
                        border: '1px solid rgba(125, 211, 252, 0.4)',
                        color: '#BAE6FD',
                      }
                    : { color: 'rgba(255, 255, 255, 0.6)' }
                }
                aria-pressed={flowMode === 'structure'}
              >
                Structure
              </button>
              <button
                type="button"
                onClick={() => setFlowMode('money-flow')}
                className="h-7 rounded-full px-3 text-[10px] font-medium transition"
                style={
                  flowMode === 'money-flow'
                    ? {
                        background: 'rgba(52, 211, 153, 0.16)',
                        border: '1px solid rgba(52, 211, 153, 0.45)',
                        color: '#A7F3D0',
                      }
                    : { color: 'rgba(255, 255, 255, 0.6)' }
                }
                aria-pressed={flowMode === 'money-flow'}
              >
                Money flow
              </button>
            </div>
            {flowMode === 'money-flow' && pendingReformFlowCount > 0 && (
              <div
                className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium"
                style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  color: '#FCD34D',
                }}
                title="One or more distributions would be subject to the 30% minimum tax on discretionary-trust taxable income (Phase 41E Measure 3) once the Bill receives Royal Assent. Amounts shown are gross."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                {pendingReformFlowCount} pending
              </div>
            )}
          </div>
        )}

        {/* Phase 2 enhancement — FY-slider strip. Renders only in
            money-flow mode, when ≥1 FY has data. Horizontal scrollable
            row of FY pills. Each pill is the FY canonical label
            (FY25-26 etc.); selected pill is emerald-tinted. */}
        {flowMode === 'money-flow' && moneyFlowFyOptions.length > 0 && (
          <div className="overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="pr-1 text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
                FY
              </span>
              {moneyFlowFyOptions.map(fy => {
                const active = fy === selectedFy;
                return (
                  <button
                    key={fy}
                    type="button"
                    onClick={() => setSelectedFy(fy)}
                    className="flex h-7 flex-shrink-0 items-center rounded-full px-2.5 text-[10px] font-medium tabular-nums transition"
                    style={
                      active
                        ? {
                            background: 'rgba(52, 211, 153, 0.16)',
                            border: '1px solid rgba(52, 211, 153, 0.45)',
                            color: '#A7F3D0',
                          }
                        : {
                            background: 'rgba(19, 26, 46, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'rgba(255, 255, 255, 0.55)',
                          }
                    }
                    aria-pressed={active}
                    aria-label={`Show money flow for ${formatFyLabel(fy)}`}
                  >
                    {formatFyLabel(fy)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 1.1 — Legal / Beneficial lens toggle. Renders only
            when there's a beneficial-ownership override in the graph AND
            the primary lens is in 'structure' mode. */}
        {hasBeneficialOverride && flowMode === 'structure' && (
          <div className="px-4 pb-2">
            <div
              className="inline-flex h-7 items-center overflow-hidden rounded-full"
              style={{
                background: 'rgba(19, 26, 46, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => setLensMode('legal')}
                className="h-7 rounded-full px-3 text-[10px] font-medium transition"
                style={
                  lensMode === 'legal'
                    ? {
                        background: 'rgba(56, 189, 248, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#7DD3FC',
                      }
                    : { color: 'rgba(255, 255, 255, 0.6)' }
                }
                aria-pressed={lensMode === 'legal'}
              >
                Legal
              </button>
              <button
                type="button"
                onClick={() => setLensMode('beneficial')}
                className="h-7 rounded-full px-3 text-[10px] font-medium transition"
                style={
                  lensMode === 'beneficial'
                    ? {
                        background: 'rgba(167, 139, 250, 0.16)',
                        border: '1px solid rgba(167, 139, 250, 0.45)',
                        color: '#C4B5FD',
                      }
                    : { color: 'rgba(255, 255, 255, 0.6)' }
                }
                aria-pressed={lensMode === 'beneficial'}
              >
                Beneficial
              </button>
            </div>
          </div>
        )}

        {/* Filter chips — horizontal scroll. Search pill removed for
            mobile (2026-05-31 Reza feedback: 'not sure if the search
            section is needed on mobile view where the screen is
            smaller'). With small entity counts, the filter chips alone
            are enough; users can scroll the list directly. Search can
            return later if user-data scales beyond ~20 entities. */}
        <div className="overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5">
            {FILTER_CHIPS.map(chip => {
              const count =
                chip.types === 'all'
                  ? listNodes.length
                  : listNodes.filter(n => (chip.types as WealthNodeType[]).includes(n.type)).length;
              const active = chip.id === activeFilter;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id)}
                  className="flex h-7 flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium"
                  style={{
                    background: active ? 'rgba(52, 211, 153, 0.12)' : 'rgba(19, 26, 46, 0.7)',
                    border: active ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: active ? '#6EE7B7' : 'rgba(255, 255, 255, 0.65)',
                  }}
                >
                  <span>{chip.label}</span>
                  <span className="rounded-full px-1 text-[9px] tabular-nums" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected entity detail card. Phase 3 Level 3 — pass linked
            assets from the in-memory snapshot for the list-with-
            click-through. */}
        {selectedNode && (
          <div className="px-4 pb-3">
            <SelectedEntityCard
              node={selectedNode}
              // Close the CARD only — stay inside the current layer
              // (WX.5.1: closing details must not eject the user from
              // the bubble). The Universe pill / re-tap zooms out.
              onClose={() => {
                setSelectedId(null);
                setSnap('peek');
              }}
              assets={
                snapshot
                  ? snapshot.assets.filter(a => a.ownerEntityId === selectedNode.id)
                  : []
              }
            />
          </div>
        )}

        {/* Entity list */}
        <div className="px-4 pb-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              All entities · {listNodes.length}
            </div>
          </div>
          <ul className="space-y-1">
            {listNodes
              .filter(n => (visibleTypes ? visibleTypes.has(n.type) : true))
              .filter(n => (matchedNodeIds ? matchedNodeIds.has(n.id) : true))
              .map(node => {
                const Glyph = NODE_GLYPH[node.type];
                const accent = NODE_ACCENT[node.type];
                const isSel = selectedId === node.id;
                // Compute "Holds N" — count of outgoing ribbons of type
                // 'holds' in the FULL graph (the canvas layout folds
                // these away at Level 1).
                const holdsCount = listRelationships.filter(
                  r => r.from === node.id && r.type === 'holds',
                ).length;
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onTapTile(node.id)}
                      className="flex w-full items-center gap-3 rounded-xl py-2.5 pl-2 pr-3 text-left transition"
                      style={{
                        background: isSel ? 'rgba(52, 211, 153, 0.07)' : 'transparent',
                        borderLeft: isSel ? '2px solid rgba(52, 211, 153, 0.75)' : '2px solid transparent',
                      }}
                    >
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: `${accent}1a`,
                          border: `1px solid ${accent}33`,
                        }}
                      >
                        <Glyph size={15} color={accent} strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-white">
                          {node.shortName ?? node.name}
                        </div>
                        <div className="truncate text-[10px] uppercase tracking-wide text-white/40">
                          {node.subtitle ?? prettifyType(node.type)}
                          {node.value ? ` · ${node.value}` : ''}
                        </div>
                      </div>
                      {holdsCount > 0 && (
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium text-white/70"
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          Holds {holdsCount}
                        </span>
                      )}
                      <ChevronRight size={14} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </BottomSheet>
    </Shell>
  );
}

// ============================================================================
// SHELL — the dark canvas page background
// ============================================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="wealth-universe-mobile-shell relative h-[calc(100vh-220px)] min-h-[640px] w-full overflow-hidden rounded-2xl"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0A0E1F 0%, #060914 60%, #050810 100%)',
      }}
    >
      <style jsx>{`
        @keyframes wealth-mote-drift {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(6px, -4px); }
          50% { transform: translate(-3px, 8px); }
          75% { transform: translate(-8px, -3px); }
        }
        @keyframes wealth-anchor-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes wealth-satellite-pop {
          0% { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.wealth-universe-mobile-shell *) {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

// ============================================================================
// DUST MOTE LAYER
// ============================================================================

function DustMoteLayer() {
  const motes = Array.from({ length: 24 }, (_, i) => {
    const seed = (i + 1) * 9301;
    const x = seed % 100;
    const y = (seed * 7) % 100;
    const size = 1 + ((seed * 3) % 3);
    const opacity = 0.03 + ((seed * 11) % 7) * 0.01;
    const delay = (i * 0.7) % 8;
    const isEmerald = i % 6 === 0;
    return { x, y, size, opacity, delay, isEmerald };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            backgroundColor: m.isEmerald ? '#34D399' : '#FFFFFF',
            opacity: m.opacity,
            filter: `blur(${m.size > 2 ? 1 : 0.5}px)`,
            animation: `wealth-mote-drift ${12 + (i % 6)}s ease-in-out ${m.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// MOBILE TILE — smaller than desktop, simpler chrome
// ============================================================================

function MobileTile({
  node,
  glyph: Glyph,
  accent,
  isSelected,
  visibilityOpacity,
  onTap,
}: {
  node: WealthNode;
  glyph: LucideIcon;
  accent: string;
  isSelected: boolean;
  visibilityOpacity: number;
  onTap: () => void;
}) {
  const isAnchor = !!node.isAnchor;
  const isFocal = !!node.isFocal || isSelected;
  const renderedSize = Math.max(28, node.size * COMPACT_SIZE_SCALE);

  const accentRgb = hexToRgb(accent);
  const innerGlow = accentRgb
    ? `inset 0 0 ${isSelected ? 18 : 10}px rgba(${accentRgb}, ${isSelected ? 0.35 : 0.2})`
    : 'none';
  const outerGlow = accentRgb
    ? `0 0 ${isSelected ? 24 : 14}px rgba(${accentRgb}, ${isSelected ? 0.3 : 0.12})`
    : '';

  const anchorRings = isAnchor ? (
    <>
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -8,
          border: '1.5px solid rgba(52, 211, 153, 0.45)',
          animation: 'wealth-anchor-pulse 2.4s ease-out infinite',
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -16,
          border: '1px solid rgba(52, 211, 153, 0.25)',
          animation: 'wealth-anchor-pulse 2.4s ease-out 0.6s infinite',
        }}
      />
    </>
  ) : null;

  const focalRing = isFocal ? (
    <span
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: -4,
        border: '1.5px solid rgba(52, 211, 153, 0.75)',
        boxShadow: '0 0 14px rgba(52, 211, 153, 0.3)',
      }}
    />
  ) : null;

  const isDashed = node.type === 'trustee-company' || node.type === 'smsf-trustee-company';
  const border = isSelected
    ? `1.5px solid ${accent}`
    : isDashed
      ? '1px dashed rgba(255, 255, 255, 0.18)'
      : '1px solid rgba(255, 255, 255, 0.12)';

  return (
    <button
      type="button"
      onClick={onTap}
      className="absolute appearance-none"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: 'translate(-50%, -50%)',
        opacity: visibilityOpacity,
        zIndex: isSelected ? 30 : isAnchor ? 20 : 10,
      }}
    >
      <div
        className="relative"
        style={{
          width: renderedSize,
          height: renderedSize,
          // Phase WX.4 — satellites pop in when a constellation unfolds.
          animation:
            node.tier === 'asset'
              ? 'wealth-satellite-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) both'
              : undefined,
        }}
      >
        {anchorRings}
        {focalRing}
        <div
          className="flex h-full w-full items-center justify-center text-white"
          style={{
            borderRadius: '30%',
            background: 'rgba(19, 26, 46, 0.92)',
            border,
            boxShadow: `${innerGlow}, ${outerGlow}`,
          }}
        >
          <Glyph size={Math.max(14, renderedSize * 0.36)} color={accent} strokeWidth={1.6} />
        </div>
        {/* Phase WX.4 — Level 1 count badge (holdings folded into this
            tile). Hidden once the constellation unfolds. */}
        {node.assetSummary && !node.isExpanded && (
          <span
            className="absolute -bottom-1 -right-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-semibold tabular-nums text-white/90"
            style={{
              background: 'rgba(13, 18, 36, 0.95)',
              border: `1px solid ${accent}66`,
            }}
          >
            {node.assetSummary.count}
          </span>
        )}
        {isAnchor && (
          <div
            className="absolute -top-3 left-1/2 inline-block -translate-x-1/2 rounded-full px-1 py-0.5 text-[8px] font-semibold tracking-[0.12em]"
            style={{
              background: 'rgba(52, 211, 153, 0.18)',
              color: '#6EE7B7',
              border: '1px solid rgba(52, 211, 153, 0.4)',
            }}
          >
            ★ YOU
          </div>
        )}
        {/* Label below tile — 2026-05-31 Reza feedback: 'tiles too small
            to read'. Width caps to prevent overlap with neighbours. */}
        <div
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-center"
          style={{ width: Math.max(64, renderedSize * 1.8) }}
        >
          <div className="truncate text-[9px] font-medium leading-tight text-white/85">
            {node.shortName ?? node.name}
          </div>
          {node.value && (
            <div className="truncate text-[9px] font-semibold tabular-nums leading-tight" style={{ color: accent }}>
              {node.value}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// RIBBON
// ============================================================================

function buildRibbonPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bow = Math.min(dist * 0.18, 8);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const midX = (fromX + toX) / 2 + perpX * bow;
  const midY = (fromY + toY) / 2 + perpY * bow;
  return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
}

function Ribbon({
  rel,
  nodes,
  isActive,
  isDimmed,
}: {
  rel: WealthRelationship;
  nodes: Record<string, WealthNode>;
  isActive: boolean;
  isDimmed: boolean;
}) {
  const fromNode = nodes[rel.from];
  const toNode = nodes[rel.to];
  if (!fromNode || !toNode) return null;
  const isFlow = isFlowRibbon(rel);
  const stroke = RIBBON_COLOR[rel.type];
  // Mobile is denser — flow ribbons read at 0.5 to stay visible against
  // the smaller canvas + tile-heavy composition.
  const opacity = isActive ? 0.9 : isDimmed ? 0.06 : isFlow ? 0.5 : 0.22;
  const strokeWidth = isActive ? 1.5 : isFlow ? 1.1 : 0.9;
  const path = buildRibbonPath(fromNode.position.x, fromNode.position.y, toNode.position.x, toNode.position.y);
  return (
    <g style={{ opacity, transition: 'opacity 0.4s ease' }}>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isFlow && !isDimmed ? '1.4 0.8' : undefined}
      >
        {isFlow && !isDimmed && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-2.2"
            dur="1.8s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </g>
  );
}

/** Phase 2 — true if this ribbon is a Money Flow (distribution or dividend). */
function isFlowRibbon(r: WealthRelationship): boolean {
  return r.type === 'flow-distribution' || r.type === 'flow-dividend';
}

// ============================================================================
// SELECTED ENTITY CARD (inside the bottom sheet) — mirrors EntityDetailPanel's
// content density on desktop. Fetches /api/entities/[id] on demand.
// ============================================================================

interface EntityDetail {
  id: string;
  name: string;
  type: string;
  role: string;
  abn: string | null;
  acn: string | null;
  tradingName: string | null;
  establishedDate: string | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  trustType: string | null;
  ownedObjectsCount: {
    properties: number;
    loans: number;
    accounts: number;
    investmentAccounts: number;
    assets: number;
  };
}

function SelectedEntityCard({
  node,
  onClose,
  assets = [],
}: {
  node: WealthNode;
  onClose: () => void;
  /** Phase 3 Level 3 — assets held by this entity (in-memory pass-through). */
  assets?: WealthGraphAsset[];
}) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch real entity records — synthetic ownership-group nodes
  // and asset nodes don't have /api/entities/[id] records.
  const isEntity =
    node.type !== 'ownership-group' &&
    !node.type.startsWith('asset-');

  useEffect(() => {
    if (!isEntity) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/entities/${node.id}`, { headers });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setDetail(json.entity ?? json.data ?? json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [node.id, isEntity, token]);

  const accent = NODE_ACCENT[node.type];
  const Glyph = NODE_GLYPH[node.type];

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(26, 34, 68, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `0 0 0 1px ${accent}33, 0 12px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}
        >
          <Glyph size={20} color={accent} strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight text-white">
            {node.name}
          </div>
          {node.subtitle && (
            <div className="truncate text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: accent }}>
              {node.subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/60"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Active pill */}
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          color: '#6EE7B7',
        }}
      >
        <CheckCircle2 size={11} strokeWidth={1.5} />
        <span>Active</span>
      </div>

      {/* Asset/group nodes — show their value + owner context, skip the
          /api/entities fetch */}
      {!isEntity && (
        <>
          {node.value && (
            <div className="mb-2 text-[20px] font-semibold tabular-nums text-white">{node.value}</div>
          )}
          <div className="text-[11px] text-white/55">
            {node.type === 'ownership-group'
              ? 'Joint ownership group · members linked above'
              : 'Owned by an entity in your structure'}
          </div>
        </>
      )}

      {/* Loading */}
      {isEntity && loading && (
        <div className="py-6 text-center text-[11px] text-white/45">Loading details…</div>
      )}

      {/* Error */}
      {isEntity && error && (
        <div className="flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
          <AlertTriangle size={13} color="#FBBF24" strokeWidth={1.5} />
          <div>
            <div className="font-medium text-amber-200">Couldn&rsquo;t load full details</div>
            <div className="mt-0.5 text-amber-200/70">{error}</div>
          </div>
        </div>
      )}

      {/* Real entity detail content */}
      {isEntity && detail && (
        <div className="space-y-4">
          {/* Identity */}
          <Section title="Identity">
            {detail.abn && <Row label="ABN" value={detail.abn} />}
            {detail.acn && <Row label="ACN" value={detail.acn} />}
            {detail.tradingName && <Row label="Trading as" value={detail.tradingName} />}
            {detail.establishedDate && (
              <Row
                label="Established"
                value={new Date(detail.establishedDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
              />
            )}
            {detail.trustType && (
              <Row label="Trust type" value={detail.trustType.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase())} />
            )}
          </Section>

          {/* Parent */}
          {detail.parentEntityName && (
            <Section title="Controlled by">
              <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Briefcase size={14} color="#7DD3FC" strokeWidth={1.5} />
                <div className="flex-1 truncate text-[12px] text-white/90">{detail.parentEntityName}</div>
                <ChevronRight size={12} color="rgba(255,255,255,0.4)" />
              </div>
            </Section>
          )}

          {/* Asset counts */}
          <Section title="Holds">
            <div className="grid grid-cols-2 gap-2">
              <AssetCountTile icon={Home} label="Properties" count={detail.ownedObjectsCount.properties} accent="#38BDF8" />
              <AssetCountTile icon={LineChart} label="Investments" count={detail.ownedObjectsCount.investmentAccounts} accent="#818CF8" />
              <AssetCountTile icon={CircleDollarSign} label="Accounts" count={detail.ownedObjectsCount.accounts} accent="#34D399" />
              <AssetCountTile icon={Box} label="Other assets" count={detail.ownedObjectsCount.assets} accent="#FBBF24" />
            </div>
          </Section>

          {/* Phase 3 Level 3 — Linked assets list with click-through.
              Renders only when ≥1 asset exists. Replaces the prior
              dead-end "Open full entity file →" CTA (it pointed back
              to /dashboard/entities, which is where the user
              already is). */}
          {assets.length > 0 && (
            <Section title="Linked assets">
              <div className="space-y-1.5">
                {assets.map(a => (
                  <LinkedAssetRow key={a.id} asset={a} onNavigate={onClose} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-white/90">{value}</span>
    </div>
  );
}

function AssetCountTile({
  icon: Icon,
  label,
  count,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  accent: string;
}) {
  const dim = count === 0;
  return (
    <div
      className="rounded-xl p-2.5"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <Icon size={13} color={accent} strokeWidth={1.5} />
      <div className="mt-1.5 text-[16px] font-semibold tabular-nums text-white">{count}</div>
      <div className="text-[9px] text-white/45">{label}</div>
    </div>
  );
}

// ============================================================================
// BOTTOM SHEET — draggable, 3 snap points
// ============================================================================

function BottomSheet({
  snap,
  snapHeights,
  onSnapChange,
  children,
}: {
  snap: SnapState;
  snapHeights: Record<SnapState, number>;
  onSnapChange: (snap: SnapState) => void;
  children: React.ReactNode;
}) {
  const dragControls = useDragControls();
  const height = snapHeights[snap];

  function snapNearest(deltaY: number, velocityY: number): SnapState {
    // Negative deltaY = dragging UP (sheet grows). Positive deltaY = down.
    const projected = height - deltaY + velocityY * 0.2;
    const candidates: SnapState[] = ['peek', 'half', 'full'];
    let best: SnapState = snap;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.abs(snapHeights[c] - projected);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  return (
    <motion.div
      className="absolute left-0 right-0 bottom-0 z-40 flex flex-col"
      style={{
        height,
        background: 'rgba(13, 18, 32, 0.96)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.45)',
      }}
      animate={{ height }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        const next = snapNearest(info.offset.y, info.velocity.y);
        onSnapChange(next);
      }}
    >
      {/* Drag handle — only this is the drag affordance. The chevron is
          an explicit one-tap minimise (WX.5.1: "not possible to
          minimise it"). */}
      <div className="relative flex h-7 w-full flex-shrink-0 items-center justify-center">
        <button
          type="button"
          onPointerDown={e => dragControls.start(e)}
          aria-label="Drag sheet"
          className="flex h-full w-full items-center justify-center"
          style={{ touchAction: 'none' }}
        >
          <span
            className="block h-1 w-10 rounded-full"
            style={{ background: 'rgba(255, 255, 255, 0.25)' }}
          />
        </button>
        {snap !== 'peek' && (
          <button
            type="button"
            aria-label="Minimise sheet"
            onClick={() => onSnapChange('peek')}
            className="absolute right-3 top-1 flex h-6 w-6 items-center justify-center rounded-full text-white/60"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <ChevronRight size={13} className="rotate-90" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pt-2">{children}</div>
    </motion.div>
  );
}

// ============================================================================
// helpers
// ============================================================================

function hexToRgb(hex: string): string | null {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return null;
  const [r, g, b] = m.map(c => parseInt(c, 16));
  return `${r}, ${g}, ${b}`;
}

function prettifyType(t: WealthNodeType): string {
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Phase 2 enhancement — `'2025-26'` → `'FY25-26'` (canonical label). */
function formatFyLabel(fy: string): string {
  const m = fy.match(/^(\d{4})-(\d{2})$/);
  if (!m) return fy;
  return `FY${m[1].slice(-2)}-${m[2]}`;
}

// =============================================================================
// Phase 3 Level 3 — linked asset row (mirrors desktop EntityDetailPanel
// `LinkedAssetRow`, lighter padding for the mobile bottom sheet).
// =============================================================================

function LinkedAssetRow({
  asset,
  onNavigate,
}: {
  asset: WealthGraphAsset;
  onNavigate: () => void;
}) {
  const { icon: Icon, accent } = assetGlyphFor(asset.kind);
  const href = assetHrefFor(asset);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl p-2.5"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}44` }}
      >
        <Icon size={13} color={accent} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-white/95">{asset.name}</div>
        <div className="truncate text-[10px] text-white/45">
          {asset.subtype ?? asset.context ?? assetKindLabel(asset.kind)}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <div className="text-[11px] font-semibold tabular-nums text-white/85">
          {formatAssetValue(asset.value)}
        </div>
        <ChevronRight size={11} color="rgba(255,255,255,0.4)" />
      </div>
    </Link>
  );
}

function assetGlyphFor(kind: WealthGraphAsset['kind']): { icon: LucideIcon; accent: string } {
  switch (kind) {
    case 'property': return { icon: Home, accent: '#38BDF8' };
    case 'loan': return { icon: Banknote, accent: '#F87171' };
    case 'account': return { icon: CircleDollarSign, accent: '#34D399' };
    case 'investment-account': return { icon: LineChart, accent: '#818CF8' };
    case 'asset': return { icon: Box, accent: '#FBBF24' };
    case 'super': return { icon: PiggyBank, accent: '#818CF8' }; // Phase 47 B1
  }
}

function assetHrefFor(asset: WealthGraphAsset): string {
  switch (asset.kind) {
    case 'property': return `/dashboard/properties/${asset.id}`;
    case 'loan': return `/dashboard/loans/${asset.id}`;
    case 'account': return '/dashboard/accounts';
    case 'investment-account': return '/dashboard/investments/accounts';
    case 'asset': return '/dashboard/assets';
    case 'super': return '/dashboard/investments/super'; // Phase 47 B1
  }
}

function assetKindLabel(kind: WealthGraphAsset['kind']): string {
  switch (kind) {
    case 'property': return 'Property';
    case 'loan': return 'Loan';
    case 'account': return 'Account';
    case 'investment-account': return 'Investment';
    case 'asset': return 'Asset';
    case 'super': return 'Super'; // Phase 47 B1
  }
}

function formatAssetValue(v: number): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toFixed(0)}`;
}
