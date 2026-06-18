/**
 * WealthUniverseCanvas — interactive Wealth Explorer canvas.
 *
 * v3 — real data via `useWealthExplorerData()` (`/api/entities`), live
 * hover with Apple Dock fan magnification, click-to-open
 * `EntityDetailPanel`, working search + filter chips. Layout positions
 * come from `wealthExplorerLayout.ts`.
 *
 * v4 — semantic zoom (Phase WX.4, 2026-06-10). Level 1 renders ONLY
 * entity tiles, each aggregating its holdings into a count badge +
 * "$X held" line; selecting an entity unfolds its asset constellation
 * (Level 2) while the rest of the universe recedes. This is the
 * structural fix for "tiles shrink into an unreadable smudge as node
 * count grows" — what's shown changes with zoom level, not just how
 * big it is (Apple Maps principle). The decorative zoom buttons were
 * removed — they never had handlers.
 *
 * Surface SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 * Artefact: `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 * Semantic-zoom SoT: screens `770687a1c73c42f0b4fd5686782bf5f3` (L1) +
 * `068403f1296440508b601c2fc32d5e20` (L2)
 * Artefacts: `.stitch/designs/wealth-universe-zoom/universe-level{1,2}-desktop-dark.{html,png}`
 *
 * Phase 47 Stage E2 (2026-06-13) — tax-flow overlay. In the Money Flow
 * lens, entity tiles carry a per-entity tax-position pip (emerald ✓ =
 * computed with no caveats; amber N = N items pending/assumed) sourced
 * from `WealthGraphEntity.taxStatus`, plus a legend pill. Status only —
 * never a tax dollar (the engine's `result` stays server-side). Built
 * code-first; Stitch backfill per CLAUDE.md §18.2.1 — screen
 * `8e2871ee0fc64e78a5361d86155c66eb`, artefact
 * `.stitch/designs/phase47-e2/wealth-universe-tax-flow-overlay.{html,png}`
 * (project `1859462351962811110`).
 */

'use client';

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
  Search,
  Settings2,
  ChevronLeft,
  PanelRight,
  TreePine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { layoutWealthExplorer } from '@/lib/data/wealthExplorerLayout';
import {
  NODE_ACCENT,
  RIBBON_COLOR,
  type WealthNode,
  type WealthNodeType,
  type WealthRelationship,
} from '@/lib/data/wealthExplorerTypes';
import { useWealthExplorerData } from '@/lib/hooks/useWealthExplorerData';
import EntityDetailPanel from './EntityDetailPanel';
import { roleCompleteness } from '@/lib/entity-graph/roleTemplates';

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

const FILTER_CHIPS: { id: 'all' | 'people' | 'entities' | 'smsf' | 'companies'; label: string; types: WealthNodeType[] | 'all' }[] = [
  { id: 'all', label: 'All', types: 'all' },
  { id: 'people', label: 'People', types: ['individual'] },
  { id: 'entities', label: 'Trusts', types: ['trust'] },
  { id: 'smsf', label: 'SMSF', types: ['smsf', 'smsf-trustee-company'] },
  { id: 'companies', label: 'Companies', types: ['holding-company', 'trustee-company', 'other-company'] },
];

/**
 * Apple-Dock fan effect — when a tile is hovered, neighbours within
 * `radiusPct` get a smooth magnification falloff. Returns a scale
 * multiplier for each (non-hovered) tile.
 */
function fanScale(hoveredPos: { x: number; y: number }, tilePos: { x: number; y: number }, radiusPct: number): number {
  const dx = tilePos.x - hoveredPos.x;
  const dy = tilePos.y - hoveredPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= radiusPct) return 1;
  // Cosine falloff: full boost at dist=0, taper to 1.0 at dist=radius
  const t = 1 - dist / radiusPct;
  return 1 + 0.2 * t * t;
}

function DustMoteLayer() {
  const motes = Array.from({ length: 36 }, (_, i) => {
    const seed = (i + 1) * 9301;
    const x = (seed % 100);
    const y = ((seed * 7) % 100);
    const size = 1 + ((seed * 3) % 3);
    const opacity = 0.04 + ((seed * 11) % 7) * 0.01;
    const delay = (i * 0.7) % 8;
    const isEmerald = i % 5 === 0;
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

interface TileProps {
  node: WealthNode;
  glyph: LucideIcon;
  accent: string;
  /** Composite scale applied to the rest size — combines hover (1.6), fan (1.0-1.2), search dim (0.7). */
  scaleMultiplier: number;
  /** 1.0 in default state, lower when search/filter dims the tile. */
  visibilityOpacity: number;
  isHovered: boolean;
  isSelected: boolean;
  /** Satellite entrance stagger (Phase WX.4) — only set for asset tiles. */
  entranceDelayMs?: number;
  /**
   * Phase 47 E2 — when true (Money Flow lens active), entity tiles show a
   * per-entity tax-position pip from `node.taxStatus`. Off in the
   * structure lens so the canvas stays calm there.
   */
  taxOverlay?: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}

function WealthNodeTile({
  node,
  glyph: Glyph,
  accent,
  scaleMultiplier,
  visibilityOpacity,
  isHovered,
  isSelected,
  entranceDelayMs,
  taxOverlay,
  onHover,
  onLeave,
  onClick,
}: TileProps) {
  const isAnchor = !!node.isAnchor;
  const isFocal = !!node.isFocal || isSelected;
  const renderedSize = node.size * scaleMultiplier;

  // Phase 47 E2 — per-entity tax pip (Money Flow lens only, entity tiles
  // only). Emerald = computed with no caveats; amber = N items pending or
  // assumed (matches the canvas's existing reform-amber language). The
  // `title` carries the plain-English explanation; the detail panel/page
  // remains the place to read the full per-entity position.
  const taxPip =
    taxOverlay && node.taxStatus && (node.tier === 'entity' || isAnchor) ? (
      node.taxStatus.computed ? (
        <span
          className="absolute -left-1 -top-1 z-10 flex h-[16px] w-[16px] items-center justify-center rounded-full text-[9px] font-semibold text-[#062b1f]"
          style={{ background: '#34D399', boxShadow: '0 0 8px rgba(52,211,153,0.4)' }}
          title="Tax position computed for this entity — no caveats"
        >
          ✓
        </span>
      ) : (
        <span
          className="absolute -left-1 -top-1 z-10 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums text-[#3a2a05]"
          style={{ background: '#FBBF24', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }}
          title={`${node.taxStatus.caveatCount} item${node.taxStatus.caveatCount === 1 ? '' : 's'} pending or assumed — open this entity to review`}
        >
          {node.taxStatus.caveatCount}
        </span>
      )
    ) : null;

  const accentRgb = hexToRgb(accent);
  const innerGlow = accentRgb
    ? `inset 0 0 ${isHovered ? 32 : 18}px rgba(${accentRgb}, ${isHovered ? 0.4 : 0.2})`
    : 'none';
  const outerGlow = accentRgb
    ? `0 0 ${isHovered ? 48 : 28}px rgba(${accentRgb}, ${isHovered ? 0.4 : 0.15})`
    : '';
  const dropShadow = '0 8px 24px rgba(0, 0, 0, 0.45)';

  const anchorRings = isAnchor ? (
    <>
      <span className="pointer-events-none absolute rounded-full" style={{ inset: -16, border: '1.5px solid rgba(52, 211, 153, 0.45)', animation: 'wealth-anchor-pulse 2.4s ease-out infinite' }} />
      <span className="pointer-events-none absolute rounded-full" style={{ inset: -32, border: '1px solid rgba(52, 211, 153, 0.25)', animation: 'wealth-anchor-pulse 2.4s ease-out 0.6s infinite' }} />
    </>
  ) : null;

  const focalRing = isFocal && !isHovered ? (
    <span className="pointer-events-none absolute rounded-full" style={{ inset: -6, border: '1.5px solid rgba(52, 211, 153, 0.7)', boxShadow: '0 0 20px rgba(52, 211, 153, 0.25)' }} />
  ) : null;

  const isDashed = node.type === 'trustee-company' || node.type === 'smsf-trustee-company';
  const border = isHovered
    ? `1.5px solid ${accent}`
    : isDashed
      ? '1.5px dashed rgba(255, 255, 255, 0.18)'
      : '1px solid rgba(255, 255, 255, 0.12)';

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isHovered ? 30 : isAnchor ? 20 : 10,
        opacity: visibilityOpacity,
        transition: 'opacity 0.3s ease, z-index 0s',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <div
        className="relative"
        style={{
          width: renderedSize,
          height: renderedSize,
          transition: 'width 0.32s cubic-bezier(0.16, 1, 0.3, 1), height 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          // Phase WX.4 — satellites pop in with a stagger when a
          // constellation unfolds. `wealth-satellite-pop` is defined in
          // CanvasShell with a prefers-reduced-motion fallback.
          animation:
            node.tier === 'asset'
              ? `wealth-satellite-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${entranceDelayMs ?? 0}ms both`
              : undefined,
        }}
      >
        {anchorRings}
        {focalRing}
        <div
          className="relative flex h-full w-full flex-col items-center justify-center text-white"
          style={{
            borderRadius: '30%',
            background: 'rgba(19, 26, 46, 0.92)',
            backdropFilter: 'blur(16px)',
            border,
            boxShadow: `${innerGlow}, ${outerGlow}, ${dropShadow}`,
            transition: 'box-shadow 0.32s ease, border-color 0.32s ease',
          }}
        >
          <Glyph
            size={Math.max(18, renderedSize * 0.32)}
            color={accent}
            strokeWidth={1.5}
          />
          {isHovered && (
            <span className="absolute right-2 top-2 rounded-full p-1" style={{ background: 'rgba(0, 0, 0, 0.35)' }}>
              <Search size={10} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
            </span>
          )}
        </div>
        {/* Phase WX.4 — Level 1 count badge: how many holdings fold
            into this tile. Hidden once the constellation unfolds. */}
        {node.assetSummary && !node.isExpanded && (
          <span
            className="absolute -bottom-1 -right-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums text-white/90"
            style={{
              background: 'rgba(13, 18, 36, 0.95)',
              border: `1px solid ${accent}66`,
              boxShadow: `0 0 8px ${accent}33`,
            }}
          >
            {node.assetSummary.count}
          </span>
        )}
        {taxPip}
        <div
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 text-center"
          style={{ width: Math.max(120, renderedSize * 1.4) }}
        >
          {isAnchor && (
            <div
              className="mb-0.5 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em]"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#6EE7B7',
                border: '1px solid rgba(52, 211, 153, 0.35)',
              }}
            >
              ★ YOU
            </div>
          )}
          <div className="truncate text-[11px] font-medium text-white/90 tabular-nums">
            {node.shortName ?? node.name}
          </div>
          {node.value && (
            <div className="truncate text-[10px] font-semibold tabular-nums" style={{ color: accent }}>
              {node.value}
            </div>
          )}
          {!node.value && node.subtitle && (
            <div className="truncate text-[9px] tracking-wide text-white/40">
              {node.subtitle.split(' · ')[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Phase 2 — true if this ribbon is a Money Flow (distribution or dividend). */
function isFlowRibbon(r: WealthRelationship): boolean {
  return r.type === 'flow-distribution' || r.type === 'flow-dividend';
}

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

interface RibbonProps {
  rel: WealthRelationship;
  nodes: Record<string, WealthNode>;
  isActive: boolean;
  isDimmed: boolean;
}

function RelationshipRibbon({ rel, nodes, isActive, isDimmed }: RibbonProps) {
  const fromNode = nodes[rel.from];
  const toNode = nodes[rel.to];
  if (!fromNode || !toNode) return null;

  const isFlow = isFlowRibbon(rel);
  const hasReformNotice = !!rel.reformNotice;

  const stroke = RIBBON_COLOR[rel.type];
  // Flow ribbons read stronger at rest so the canvas reads as
  // "money in motion" when the flow lens is active.
  const opacity = isActive
    ? 0.9
    : isDimmed
      ? 0.06
      : isFlow
        ? 0.55
        : 0.22;
  const strokeWidth = isActive ? 2 : isFlow ? 1.6 : 1.2;
  const glowStrength = isActive ? 6 : isFlow ? 4 : 2;
  const path = buildRibbonPath(fromNode.position.x, fromNode.position.y, toNode.position.x, toNode.position.y);
  const filterId = `glow-${rel.id}`;
  // Midpoint for the flow-amount label.
  const midX = (fromNode.position.x + toNode.position.x) / 2;
  const midY = (fromNode.position.y + toNode.position.y) / 2 - 1.5;

  return (
    <g style={{ opacity, transition: 'opacity 0.4s ease' }}>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={glowStrength} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={
          rel.type === 'controls'
            ? '0.6 0.8'
            // Flow ribbons get a marching-ants dash when not dimmed —
            // signals movement even when not the hovered ribbon.
            : isFlow && !isDimmed
              ? '1.4 0.8'
              : undefined
        }
        filter={isActive || (isFlow && !isDimmed) ? `url(#${filterId})` : undefined}
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
      {isActive && (
        <>
          <circle r="0.5" fill={stroke}>
            <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="0.4" fill={stroke} opacity="0.7">
            <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
      {/* Flow amount label — only when the flow lens is showing (i.e.
          the ribbon is not dimmed). Reform-pending flows get a small
          dot to flag "this number has a caveat — open the ribbon". */}
      {isFlow && !isDimmed && rel.label && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={midX - 4.2}
            y={midY - 1.4}
            width="8.4"
            height="2.4"
            rx="1.2"
            fill="rgba(13, 18, 36, 0.92)"
            stroke={stroke}
            strokeWidth="0.12"
            opacity="0.95"
          />
          <text
            x={midX}
            y={midY + 0.4}
            textAnchor="middle"
            fontSize="1.2"
            fontWeight="600"
            fill="#D1FAE5"
            style={{ fontFamily: 'inherit' }}
          >
            {rel.label}
          </text>
          {hasReformNotice && (
            <circle
              cx={midX + 3.6}
              cy={midY - 0.4}
              r="0.45"
              fill="#FBBF24"
              opacity="0.95"
            >
              <title>{rel.reformNotice}</title>
            </circle>
          )}
        </g>
      )}
    </g>
  );
}

/** Floating preview anchored to a node by % coords. */
function EntityPreviewPopover({
  node,
  completeness,
}: {
  node: WealthNode;
  /** Phase 47 F2a — "Structure file 2/3" line, null when not applicable. */
  completeness?: string | null;
}) {
  const accent = NODE_ACCENT[node.type];
  const Glyph = NODE_GLYPH[node.type];
  // Anchor to the right if there's room, otherwise to the left.
  const anchorRight = node.position.x < 65;
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: `calc(${node.position.x}% + ${anchorRight ? node.size * 0.6 : -node.size * 0.6 - 280}px)`,
        top: `calc(${node.position.y}% - 100px)`,
        width: 280,
      }}
    >
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(26, 34, 68, 0.94)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px ${accent}26`,
        }}
      >
        <div className="mb-3 flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
            }}
          >
            <Glyph size={18} color={accent} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-white">{node.shortName ?? node.name}</div>
            {node.subtitle && (
              <div className="text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: accent }}>
                {node.subtitle}
              </div>
            )}
          </div>
        </div>
        {node.value && (
          <div className="text-[16px] font-semibold tabular-nums text-white">{node.value}</div>
        )}
        {completeness && (
          <div className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] tabular-nums text-white/70" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {completeness}
          </div>
        )}
        <div className="mt-2 text-[10px] font-medium text-white/55">
          Tap to open full file →
        </div>
      </div>
    </div>
  );
}

export default function WealthUniverseCanvas() {
  const { layout: baseLayout, snapshot, loading, error, refetch } = useWealthExplorerData();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phase WX.4 — semantic zoom. Which entity (or `group-<id>`) has its
  // asset constellation unfolded. Selecting an entity expands it;
  // clearing the selection folds everything back to Level 1.
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  // Phase WX.5 — microscopic camera zoom between layers. `cameraOrigin`
  // is the tapped bubble's canvas-% position: the outgoing layer
  // magnifies toward it and blurs out of focus (racking to a deeper
  // focal plane); the incoming layer sharpens in. Direction flips on
  // the way back out.
  const [cameraOrigin, setCameraOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [cameraDirection, setCameraDirection] = useState<'in' | 'out'>('in');
  const prefersReducedMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<typeof FILTER_CHIPS[number]['id']>('all');
  // Phase 1.1 — beneficial-ownership lens toggle. Only renders when the
  // user has at least one BeneficialOwnershipOverride; otherwise the
  // 'legal' default is a no-op.
  const [lensMode, setLensMode] = useState<'legal' | 'beneficial'>('legal');
  // Phase 2 — primary lens toggle. 'structure' shows ownership ribbons
  // (default — what Phase 1 + 1.1 ship); 'money-flow' dims structural
  // ribbons and surfaces DistributionAllocation + DividendPayment flows
  // as animated emerald ribbons. §12.14 reform-awareness is surfaced via
  // a per-flow `reformNotice` (read from the service) — never silently
  // computed in the canvas.
  const [flowMode, setFlowMode] = useState<'structure' | 'money-flow'>('structure');

  // Phase WX.4 — recompute the layout with the current expansion. The
  // layout function is pure and cheap (tens of nodes); recomputing on
  // selection keeps the hook's default (collapsed) layout untouched for
  // other consumers like the dashboard widget.
  const layout = useMemo(
    () =>
      snapshot
        ? layoutWealthExplorer(snapshot, { expandedEntityIds: expandedIds })
        : baseLayout,
    [snapshot, expandedIds, baseLayout],
  );

  const nodes = useMemo(() => layout?.nodes ?? [], [layout]);
  const relationships = useMemo(() => layout?.relationships ?? [], [layout]);
  // Phase 47 E2 — tally per-entity tax-position pips for the Money-Flow
  // lens legend (computed vs caveat). Entity/anchor tiles only.
  const taxOverlayCounts = useMemo(() => {
    let computed = 0;
    let caveat = 0;
    for (const n of nodes) {
      if ((n.tier === 'entity' || n.isAnchor) && n.taxStatus) {
        if (n.taxStatus.computed) computed += 1;
        else caveat += 1;
      }
    }
    return { computed, caveat, total: computed + caveat };
  }, [nodes]);
  // Phase 2 enhancement — FY-slider state. Default to the most recent
  // FY with data (from the service). User can scrub through historical
  // FYs in money-flow mode. `null` until the layout loads.
  const [selectedFy, setSelectedFy] = useState<string | null>(null);
  const moneyFlowFy = layout?.moneyFlowFy ?? null;
  const moneyFlowFyOptions = useMemo(() => layout?.moneyFlowFyOptions ?? [], [layout]);
  useEffect(() => {
    if (selectedFy === null && moneyFlowFy) setSelectedFy(moneyFlowFy);
  }, [moneyFlowFy, selectedFy]);

  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, n])),
    [nodes],
  );

  const hoveredNode = hoveredId ? nodesById[hoveredId] : null;
  const selectedNode = selectedId ? nodesById[selectedId] : null;

  // Phase 47 F2a — "Structure file 2/3" on the hover popover. Entity
  // tiles only; derived from the same role templates as the Entity
  // File (invitation framing, never a shame score).
  const hoveredCompleteness = useMemo(() => {
    if (!hoveredNode || !snapshot) return null;
    if (hoveredNode.tier !== 'entity' && hoveredNode.tier !== 'individual') return null;
    const entity = snapshot.entities.find(e => e.id === hoveredNode.id);
    if (!entity) return null;
    const inbound = new Set(
      snapshot.relationships
        .filter(r => r.toEntityId === hoveredNode.id && r.effectiveTo == null && r.type !== 'PARENT_OF')
        .map(r => r.type as import('@prisma/client').EntityRelationshipType),
    );
    const c = roleCompleteness(entity.type, inbound);
    if (c.total === 0) return null;
    return `Structure file ${c.filled}/${c.total}`;
  }, [hoveredNode, snapshot]);

  // Phase WX.4 — selection drives the semantic zoom.
  function clearSelection() {
    setCameraDirection('out');
    setSelectedId(null);
    setExpandedIds([]);
  }
  // Closing the entity file (the right-hand detail panel) must NOT fold
  // the focused scene back to Level 1 (Reza 2026-06-18: "when I close the
  // window it takes me back to layer 1"). Clear ONLY the panel selection;
  // keep `expandedIds` so you stay inside the layer you opened — the
  // breadcrumb "‹ Universe" (rendered whenever `expandedIds.length > 0`)
  // remains the way back out, and tapping the centred bubble zooms out.
  // When nothing is expanded (a non-expandable tile at Level 1), this just
  // closes the panel and you're already at Level 1.
  function closeDetailPanel() {
    setSelectedId(null);
  }
  function handleNodeClick(node: WealthNode) {
    if (node.tier === 'asset') {
      // Selecting a satellite keeps its constellation open.
      setSelectedId(node.id);
      if (node.parentNodeId) setExpandedIds([node.parentNodeId]);
      return;
    }
    if (selectedId === node.id || expandedIds[0] === node.id) {
      // Clicking the bubble you're inside zooms back out to the universe.
      clearSelection();
      return;
    }
    setSelectedId(node.id);
    // WX.5.3 — expandability is the layout's call (`isExpandable`), not
    // "has assets": in cluster mode tapping the entity opens the card
    // over the universe instead of the removed all-holdings layer.
    if (node.isExpandable) {
      setCameraOrigin({ x: node.position.x, y: node.position.y });
      setCameraDirection('in');
      setExpandedIds([node.id]);
    } else {
      setExpandedIds([]);
    }
  }

  // Deep-link focus (Reza 2026-06-10): /dashboard/entities?focus=<node>
  // opens with that bubble's constellation already unfolded — the
  // dashboard widget's bubbles carry the param so the tap reads as
  // "zoom in", not "start over". Applied once per mount.
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
    const node = nodes.find(n => n.id === focus);
    if (!node) return;
    setSelectedId(focus);
    if (node.tier !== 'asset' && node.isExpandable) setExpandedIds([focus]);
  }, [searchParams, nodes]);

  // Stagger for the satellite pop-in when a constellation unfolds.
  const satelliteDelayById = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const n of nodes) {
      if (n.tier === 'asset') m.set(n.id, (i++ % 10) * 40);
    }
    return m;
  }, [nodes]);

  // Derive which types are visible based on filter.
  const visibleTypes = useMemo<Set<WealthNodeType> | null>(() => {
    const chip = FILTER_CHIPS.find(c => c.id === activeFilter);
    if (!chip || chip.types === 'all') return null;
    return new Set(chip.types);
  }, [activeFilter]);

  // Derive which nodes match the search query.
  const matchedNodeIds = useMemo<Set<string> | null>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id));
  }, [nodes, searchQuery]);

  // Phase 3 — Level 2 ecosystem zoom. When a tile is selected, compute
  // the set of node ids directly connected to it (via any ribbon —
  // structural or flow). Tiles in this set + the focal itself read at
  // full opacity; the rest dim. Pure additive opacity factor — does
  // not re-run the layout.
  const connectedToSelectedIds = useMemo<Set<string> | null>(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const r of relationships) {
      if (r.from === selectedId) set.add(r.to);
      if (r.to === selectedId) set.add(r.from);
    }
    return set;
  }, [selectedId, relationships]);

  function nodeOpacity(node: WealthNode): number {
    let opacity = 1;
    if (visibleTypes && !visibleTypes.has(node.type)) opacity *= 0.18;
    if (matchedNodeIds && !matchedNodeIds.has(node.id)) opacity *= 0.35;
    // Phase 3 Level 2 — non-connected tiles recede when a focal entity
    // is selected. The focal tile + its direct neighbours stay
    // visible; the rest fade to 0.22 so the ecosystem reads.
    if (connectedToSelectedIds && !connectedToSelectedIds.has(node.id)) {
      opacity *= 0.22;
    }
    return opacity;
  }

  function isRibbonActive(r: WealthRelationship): boolean {
    if (!hoveredId) return false;
    return r.from === hoveredId || r.to === hoveredId;
  }
  // Phase 1.1 — true when ANY beneficial-override ribbon exists in the
  // graph, which is when the lens toggle should render.
  const hasBeneficialOverride = useMemo(
    () => relationships.some(r => r.id.startsWith('boo-')),
    [relationships],
  );

  // Phase 2 — true when at least one Money Flow ribbon exists. The
  // primary Structure / Money Flow toggle only renders when there's
  // something to switch to (behaviour-psychology lens — no
  // anticipated-disappointment toggle that opens to an empty state).
  const flowRibbons = useMemo(
    () => relationships.filter(isFlowRibbon),
    [relationships],
  );
  const hasFlows = flowRibbons.length > 0;

  // Phase 2 — §12.14 surface: aggregated count of pending-Royal-Assent
  // flows so the canvas can show a "X pending Royal Assent" badge.
  // Filtered to the currently-selected FY so the count tracks what
  // the user can actually see on the canvas (FW-1 per-FY discipline).
  const pendingReformFlowCount = useMemo(
    () =>
      flowRibbons.filter(
        r => !!r.reformNotice && (!selectedFy || r.financialYear === selectedFy),
      ).length,
    [flowRibbons, selectedFy],
  );

  // Phase 1.1 — given a ribbon, is it dimmed by the current lens?
  // Lens has no effect when no overrides exist (toggle is hidden too).
  function isLensDimmed(r: WealthRelationship): boolean {
    if (!hasBeneficialOverride) return false;
    if (lensMode === 'beneficial') {
      // Beneficial lens — dim the legal HOLDS chain so the violet
      // beneficial-owner ribbons read as primary.
      return r.type === 'holds';
    }
    // Legal lens (default) — dim the BeneficialOwnershipOverride
    // ribbons so the standard ownership chain reads as primary.
    return r.id.startsWith('boo-');
  }

  function isRibbonDimmed(r: WealthRelationship): boolean {
    // Phase 2 — flow-mode precedence: structural ribbons recede, flow
    // ribbons take centre stage. In structure mode (default) flow
    // ribbons recede instead.
    if (flowMode === 'money-flow') {
      if (!isFlowRibbon(r)) return true;
      // Phase 2 enhancement — FY-slider scope: dim flows that don't
      // belong to the selected FY so the user reads one year at a
      // time.
      if (selectedFy && r.financialYear && r.financialYear !== selectedFy) return true;
    } else {
      if (isFlowRibbon(r)) return true;
    }
    // Lens-dim takes precedence over hover/selection (the user explicitly
    // chose to read one chain over the other).
    if (isLensDimmed(r)) return true;
    if (selectedId) {
      return r.from !== selectedId && r.to !== selectedId;
    }
    if (!hoveredId) return false;
    return r.from !== hoveredId && r.to !== hoveredId;
  }

  // Apple Dock fan effect: compute scale for each tile relative to hovered.
  function scaleFor(node: WealthNode): number {
    if (!hoveredNode) return 1;
    if (node.id === hoveredId) return 1.6;
    return fanScale(hoveredNode.position, node.position, 14); // radius ~14% of canvas
  }

  // Render states
  if (loading) {
    return (
      <CanvasShell>
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[12px] text-white/50">
            <Sparkles size={14} className="animate-pulse" />
            <span>Loading your wealth universe…</span>
          </div>
        </div>
      </CanvasShell>
    );
  }

  if (error) {
    return (
      <CanvasShell>
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div className="max-w-md rounded-2xl p-6 text-center" style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
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
      </CanvasShell>
    );
  }

  if (layout?.isEmpty || nodes.length === 0) {
    return (
      <CanvasShell>
        <div className="absolute inset-0 z-30 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}
            >
              <TreePine size={28} color="#A78BFA" strokeWidth={1.5} />
            </div>
            <div className="mt-4 text-[16px] font-semibold text-white">Your wealth universe is just you so far</div>
            <p className="mt-2 text-[12px] leading-relaxed text-white/55">
              Add a family trust, an SMSF, or a Pty Ltd and your structure will appear here — every property, loan, and investment mapped to the right entity.
            </p>
          </div>
        </div>
      </CanvasShell>
    );
  }

  return (
    <CanvasShell>
      <DustMoteLayer />

      {/* Top chrome — search + filter chips */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 z-40 flex items-center gap-3 px-6 pt-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{
              background: 'rgba(19, 26, 46, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 0 16px rgba(52, 211, 153, 0.2)',
            }}
          >
            M
          </div>
          <div>
            <div className="text-[14px] font-semibold leading-tight text-white">Wealth Explorer</div>
            <div className="text-[10px] leading-tight text-white/45">
              {nodes.length} {nodes.length === 1 ? 'entity' : 'entities'} in your universe
            </div>
          </div>
        </div>

        <div className="ml-4 flex-1 max-w-[440px]">
          <div
            className="flex h-9 items-center gap-2 rounded-full px-3.5"
            style={{
              background: 'rgba(19, 26, 46, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Search size={14} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search any entity, asset, person…"
              className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/45 focus:outline-none"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {FILTER_CHIPS.map(chip => {
            const count = chip.types === 'all'
              ? nodes.length
              : nodes.filter(n => (chip.types as WealthNodeType[]).includes(n.type)).length;
            const active = chip.id === activeFilter;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium transition"
                style={{
                  background: active ? 'rgba(52, 211, 153, 0.12)' : 'rgba(19, 26, 46, 0.7)',
                  border: active
                    ? '1px solid rgba(52, 211, 153, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: active ? '#6EE7B7' : 'rgba(255, 255, 255, 0.65)',
                }}
              >
                <span>{chip.label}</span>
                <span className="rounded-full px-1 text-[9px] tabular-nums" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Phase 2 — Structure / Money Flow primary lens toggle. Only
            renders when there's at least one CONFIRMED money flow this
            FY (avoids an empty-toggle anticipated-disappointment per
            behaviour-psychology lens). */}
        {hasFlows && (
          <div
            className="flex h-7 items-center overflow-hidden rounded-full"
            style={{
              background: 'rgba(19, 26, 46, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setFlowMode('structure')}
              className="h-7 rounded-full px-2.5 text-[10px] font-medium transition"
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
              className="h-7 rounded-full px-2.5 text-[10px] font-medium transition"
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
        )}

        {/* Phase 1.1 — Legal / Beneficial lens toggle. Renders only when
            the user has at least one BeneficialOwnershipOverride AND the
            primary lens is in 'structure' mode (the override emphasis is
            about ownership reading; in money-flow mode the structural
            ribbons are dimmed anyway). */}
        {hasBeneficialOverride && flowMode === 'structure' && (
          <div
            className="flex h-7 items-center overflow-hidden rounded-full"
            style={{
              background: 'rgba(19, 26, 46, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setLensMode('legal')}
              className="h-7 rounded-full px-2.5 text-[10px] font-medium transition"
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
              className="h-7 rounded-full px-2.5 text-[10px] font-medium transition"
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
        )}

        {/* Phase 2 — §12.14 surface. When the Money Flow lens is active
            and at least one flow is POST_REFORM_PENDING, a small amber
            pill surfaces "N pending Royal Assent" with the canonical
            notice in a tooltip. NEVER replaced by a computed number —
            this is the FW-2 honesty surface. */}
        {/* Phase 47 E2 — tax-position pip legend. Decodes the emerald/amber
            pips on entity tiles. Status only — the per-entity tax page is
            where the full position (and any tax figures) live. */}
        {flowMode === 'money-flow' && taxOverlayCounts.total > 0 && (
          <div
            className="flex h-7 items-center gap-2 rounded-full px-2.5 text-[10px] font-medium"
            style={{
              background: 'rgba(19, 26, 46, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255,255,255,0.7)',
            }}
            title="Per-entity tax-position status for the current financial year. Emerald = computed with no caveats. Amber = items pending or assumed — open the entity to review. Monitrax never shows a guessed tax figure here."
          >
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#34D399' }} />
              {taxOverlayCounts.computed} computed
            </span>
            {taxOverlayCounts.caveat > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FBBF24' }} />
                {taxOverlayCounts.caveat} to review
              </span>
            )}
          </div>
        )}

        {flowMode === 'money-flow' && pendingReformFlowCount > 0 && (
          <div
            className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium"
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#FCD34D',
            }}
            title="One or more distributions would be subject to the 30% minimum tax on discretionary-trust taxable income (Phase 41E Measure 3) once the Bill receives Royal Assent. Amounts shown are gross — Monitrax never speculatively applies post-reform math."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            {pendingReformFlowCount} pending Royal Assent
          </div>
        )}

        <button
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            background: 'rgba(19, 26, 46, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          aria-label="Settings"
          type="button"
        >
          <Settings2 size={14} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
        </button>
      </div>

      {/* Phase 2 enhancement — FY-slider strip. Ghost-glass strip with
          a tick mark per FY that has CONFIRMED data. Renders only when
          the Money Flow lens is active. Each tick is tappable; the
          selected FY drives ribbon-dim + the pending-Royal-Assent
          count (so the §12.14 surface tracks the FY the user is
          actually reading). Sits where the Level breadcrumb would —
          they're alternatives, not overlapping concerns. */}
      {flowMode === 'money-flow' && moneyFlowFyOptions.length > 0 && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2">
          <div
            className="flex h-9 items-center gap-1 rounded-full px-2"
            style={{
              background: 'rgba(13, 18, 36, 0.72)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span className="pl-1 pr-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/40">
              FY
            </span>
            {moneyFlowFyOptions.map(fy => {
              const active = fy === selectedFy;
              return (
                <button
                  key={fy}
                  type="button"
                  onClick={() => setSelectedFy(fy)}
                  className="flex h-7 items-center rounded-full px-2.5 text-[10px] font-medium tabular-nums transition"
                  style={
                    active
                      ? {
                          background: 'rgba(52, 211, 153, 0.16)',
                          border: '1px solid rgba(52, 211, 153, 0.45)',
                          color: '#A7F3D0',
                        }
                      : {
                          color: 'rgba(255, 255, 255, 0.55)',
                          border: '1px solid transparent',
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

      {/* Level breadcrumb — hidden in money-flow mode (the FY-slider
          above sits at the same position). Phase 3 — when a tile is
          selected the breadcrumb advances from "Level 1 · Universe" to
          "Level 2 · {entity name}" with a back chevron (tap = back to
          Level 1). Level 3 (the detail panel) layers on top. */}
      {flowMode === 'structure' && (
      <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(19, 26, 46, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {(selectedNode || expandedIds.length > 0) ? (
            (() => {
              // WX.5.1 — the ownership trail: the layer's OWNER is always
              // visible so asset ownership is trackable at every depth.
              const sceneParent = nodes.find(n => n.tier !== 'asset' && n.isExpanded);
              const trailNode = sceneParent ?? selectedNode!;
              const trail =
                trailNode.tier === 'cluster' && trailNode.subtitle
                  ? `${trailNode.subtitle} › ${trailNode.shortName}`
                  : trailNode.tier === 'group'
                    ? `${trailNode.shortName} · ${trailNode.subtitle ?? ''}`
                    : trailNode.shortName ?? trailNode.name;
              return (
                <>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/55 hover:text-white/90"
                    aria-label="Back to universe"
                  >
                    <ChevronLeft size={11} strokeWidth={1.5} />
                    Universe
                  </button>
                  <span className="h-1 w-1 rounded-full bg-white/15" />
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/90"
                    style={{ color: NODE_ACCENT[trailNode.type] }}
                  >
                    {trail}
                  </span>
                </>
              );
            })()
          ) : (
            <>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/80">
                Level 1 · Universe
              </span>
              <span className="h-1 w-1 rounded-full bg-white/15" />
              <span className="h-1 w-1 rounded-full bg-white/15" />
            </>
          )}
        </div>
      </div>
      )}

      {/* Phase WX.5 — the layer field. Each scene (universe / inside a
          bubble) is one keyed container; AnimatePresence cross-fades
          them with the microscopic camera zoom. Zooming IN: the old
          layer magnifies toward the tapped bubble and blurs out of
          focus; the new layer sharpens in. Zooming OUT: reversed. */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={expandedIds[0] ?? 'universe'}
          className="absolute inset-0"
          style={{ transformOrigin: `${cameraOrigin.x}% ${cameraOrigin.y}%` }}
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : cameraDirection === 'in'
                ? { opacity: 0, scale: 0.5, filter: 'blur(4px)' }
                : { opacity: 0, scale: 2.4, filter: 'blur(4px)' }
          }
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : cameraDirection === 'in'
                ? { opacity: 0, scale: 2.4, filter: 'blur(4px)' }
                : { opacity: 0, scale: 0.5, filter: 'blur(4px)' }
          }
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Ribbons */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {relationships.map(r => (
              <RelationshipRibbon
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
            <WealthNodeTile
              key={node.id}
              node={node}
              glyph={NODE_GLYPH[node.type]}
              accent={NODE_ACCENT[node.type]}
              scaleMultiplier={scaleFor(node)}
              visibilityOpacity={nodeOpacity(node)}
              isHovered={hoveredId === node.id}
              isSelected={selectedId === node.id}
              entranceDelayMs={satelliteDelayById.get(node.id)}
              taxOverlay={flowMode === 'money-flow'}
              onHover={() => setHoveredId(node.id)}
              onLeave={() => setHoveredId(prev => (prev === node.id ? null : prev))}
              onClick={() => handleNodeClick(node)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Live preview popover follows the hovered tile */}
      {hoveredNode && !selectedNode && (
        <EntityPreviewPopover
          node={hoveredNode}
          completeness={hoveredCompleteness}
        />
      )}

      {/* Detail panel tab — peek */}
      {!selectedNode && (
        <div className="absolute right-0 top-1/2 z-30 -translate-y-1/2">
          <div
            className="flex h-20 w-7 items-center justify-center rounded-l-2xl"
            style={{
              background: 'rgba(19, 26, 46, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRight: 'none',
              backdropFilter: 'blur(12px)',
            }}
          >
            <PanelRight size={14} color="rgba(255,255,255,0.55)" strokeWidth={1.5} />
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-30 max-w-xs text-right">
        <div className="text-[10px] leading-relaxed text-white/35">
          {selectedNode
            ? 'Click the entity again to fold its constellation · click a satellite to inspect it'
            : 'Click an entity to open its constellation · search to find anything'}
        </div>
      </div>

      {/* Detail panel — slides in when a tile is selected. Phase 3
          Level 3 — pass assets held by the focal entity for the new
          linked-assets list (already in memory via the wealth-graph
          snapshot; no extra fetch). */}
      <EntityDetailPanel
        // Cluster tiles (Phase WX.4.1) are pure canvas aggregates — they
        // expand in place but have no entity file to open.
        node={selectedNode?.tier === 'cluster' ? null : selectedNode}
        onClose={closeDetailPanel}
        assets={
          selectedNode && selectedNode.tier !== 'cluster' && snapshot
            ? selectedNode.tier === 'group'
              ? // Group bubbles (`group-<id>`) hold via OwnershipGroup
                // rows, not ownerEntityId — resolve through the group.
                (() => {
                  const gid = selectedNode.id.slice('group-'.length);
                  const ownedIds = new Set(
                    snapshot.ownershipGroups
                      .filter(g => g.id === gid)
                      .map(g => g.ownedObjectId),
                  );
                  return snapshot.assets.filter(a => ownedIds.has(a.id));
                })()
              : snapshot.assets.filter(a => a.ownerEntityId === selectedNode.id)
            : []
        }
        // WX.5.4 — asset bubbles render from the in-memory record (no
        // entity file exists for them; fetching one 404s).
        assetRecord={
          selectedNode?.tier === 'asset' && snapshot
            ? snapshot.assets.find(a => a.id === selectedNode.id) ?? null
            : null
        }
        ownerName={
          selectedNode?.tier === 'asset' && snapshot
            ? snapshot.entities.find(
                e =>
                  e.id ===
                  (selectedNode.ownerEntityId ??
                    snapshot.assets.find(a => a.id === selectedNode.id)?.ownerEntityId),
              )?.name ?? null
            : null
        }
      />
    </CanvasShell>
  );
}

// ----- Shell + helpers --------------------------------------------------------

function CanvasShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="wealth-universe-shell relative h-[calc(100vh-220px)] min-h-[640px] w-full overflow-hidden rounded-2xl"
      style={{
        background:
          'radial-gradient(ellipse at 50% 55%, #0A0E1F 0%, #060914 60%, #050810 100%)',
      }}
    >
      <style jsx>{`
        @keyframes wealth-mote-drift {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(8px, -6px); }
          50% { transform: translate(-4px, 10px); }
          75% { transform: translate(-10px, -4px); }
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
          :global(.wealth-universe-shell *) {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

function hexToRgb(hex: string): string | null {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return null;
  const [r, g, b] = m.map(c => parseInt(c, 16));
  return `${r}, ${g}, ${b}`;
}

/** Phase 2 enhancement — render `'2025-26'` as `'FY25-26'` to match the
    canonical FY label used elsewhere in the app (`taxYearConfig.label`). */
function formatFyLabel(fy: string): string {
  const m = fy.match(/^(\d{4})-(\d{2})$/);
  if (!m) return fy;
  return `FY${m[1].slice(-2)}-${m[2]}`;
}
