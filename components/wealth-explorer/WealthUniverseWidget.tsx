/**
 * WealthUniverseWidget — Phase 5 dashboard widget.
 *
 * Compact dark-glass preview of the Wealth Universe canvas, sized to
 * fit in the dashboard's diagnostic-card row alongside Debt Quality /
 * Entity Cashflow. A deliberate premium-moment break from the
 * Restrained Editorial light-mode dashboard — matches the full
 * `/dashboard/entities` surface so tap-through feels continuous.
 *
 * Source of truth: Stitch screen `c84ff8ac53b74f04a8d07e5b61b53848`
 * Artefact: `.stitch/designs/wealth-universe-dashboard-widget-v1.{html,png}`
 *
 * Shares the canonical data layer with the full canvas
 * (`useWealthExplorerData()` → `/api/wealth-graph`). Renders the same
 * spatial layout positions but at half scale, with no chrome (no
 * filter chips, no search, no detail panel) — tap-through to the
 * full surface for those.
 */

'use client';

import Link from 'next/link';
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
  ArrowUpRight,
  TreePine,
  type LucideIcon,
} from 'lucide-react';
import {
  NODE_ACCENT,
  RIBBON_COLOR,
  type WealthNode,
  type WealthNodeType,
  type WealthRelationship,
} from '@/lib/data/wealthExplorerTypes';
import { useWealthExplorerData } from '@/lib/hooks/useWealthExplorerData';

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

// Half the desktop tile scale — widget canvas is ~520x220.
const WIDGET_SIZE_SCALE = 0.42;

export default function WealthUniverseWidget() {
  const { layout, loading, error } = useWealthExplorerData();

  // Silent-fail on error / hide when not yet loaded.
  // Dashboard widgets shouldn't break the page on data issues.
  if (error) return null;

  if (loading) {
    return <WidgetShell loading />;
  }

  // Empty-state — encourage adding structure if there isn't any yet.
  if (!layout || layout.isEmpty || layout.nodes.length === 0) {
    return (
      <WidgetShell>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(167, 139, 250, 0.12)', border: '1px solid rgba(167, 139, 250, 0.3)' }}
          >
            <TreePine size={20} color="#A78BFA" strokeWidth={1.5} />
          </div>
          <div className="text-[13px] font-semibold text-white">Your wealth universe is just you so far</div>
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/55">
            Add a trust, SMSF, or company to map your full structure.
          </p>
          <Link
            href="/dashboard/entities"
            className="mt-3 text-[11px] font-medium text-emerald-300 hover:underline"
          >
            Open Wealth Universe →
          </Link>
        </div>
      </WidgetShell>
    );
  }

  const { nodes, relationships } = layout;
  const nodesById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const totalHeld = nodes
    .filter(n => n.value)
    .reduce((sum, n) => sum + parseValueToNumber(n.value!), 0);

  return (
    <Link href="/dashboard/entities" className="group block">
      <WidgetShell>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/45">
                MY STRUCTURE
              </div>
              <div className="mt-0.5 text-[14px] font-semibold leading-tight text-white">
                Wealth Universe
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-1 text-[10px] font-medium text-white/75 tabular-nums"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {nodes.length} nodes
              </span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full transition group-hover:bg-emerald-400/15"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <ArrowUpRight size={13} color="rgba(255,255,255,0.8)" strokeWidth={1.8} />
              </span>
            </div>
          </div>

          {/* Mini canvas */}
          <div className="relative flex-1">
            {/* SVG ribbons */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {relationships.map(r => (
                <Ribbon key={r.id} rel={r} nodes={nodesById} />
              ))}
            </svg>
            {/* Tiles */}
            {nodes.map(node => (
              <WidgetTile
                key={node.id}
                node={node}
                glyph={NODE_GLYPH[node.type]}
                accent={NODE_ACCENT[node.type]}
              />
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
          >
            <div className="text-[10px] text-white/65 tabular-nums">
              {totalHeld > 0
                ? `${formatTotal(totalHeld)} held across your structure`
                : `${nodes.length} ${nodes.length === 1 ? 'entity' : 'entities'} mapped`}
            </div>
            <span className="text-[10px] font-medium text-emerald-300 group-hover:underline">
              Open Wealth Universe →
            </span>
          </div>
        </div>
      </WidgetShell>
    </Link>
  );
}

// ============================================================================
// Shell — dark glass card surface
// ============================================================================

function WidgetShell({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <div
      className="relative h-[340px] w-full overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0A0E1F 0%, #060914 60%, #050810 100%)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 16px 40px rgba(11, 18, 32, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      <style jsx>{`
        @keyframes widget-anchor-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
      {/* Dust motes — fewer than full canvas for restraint */}
      <DustMoteLayer />
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="text-[11px] text-white/50">Loading your structure…</div>
        </div>
      )}
      {children}
    </div>
  );
}

function DustMoteLayer() {
  // 10 deterministic motes — keep it subtle inside the small widget.
  const motes = Array.from({ length: 10 }, (_, i) => {
    const seed = (i + 1) * 9301;
    return {
      x: seed % 100,
      y: (seed * 7) % 100,
      size: 1 + ((seed * 3) % 3),
      opacity: 0.03 + ((seed * 11) % 5) * 0.01,
    };
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
            width: m.size,
            height: m.size,
            background: i % 3 === 0 ? '#34D399' : '#FFFFFF',
            opacity: m.opacity,
            filter: `blur(${m.size > 2 ? 1 : 0.5}px)`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Tile (compact for widget)
// ============================================================================

function WidgetTile({
  node,
  glyph: Glyph,
  accent,
}: {
  node: WealthNode;
  glyph: LucideIcon;
  accent: string;
}) {
  const isAnchor = !!node.isAnchor;
  const isFocal = !!node.isFocal;
  const size = Math.max(20, node.size * WIDGET_SIZE_SCALE);

  const accentRgb = hexToRgb(accent);
  const innerGlow = accentRgb ? `inset 0 0 8px rgba(${accentRgb}, 0.22)` : 'none';
  const outerGlow = accentRgb ? `0 0 10px rgba(${accentRgb}, 0.12)` : '';

  const anchorRing = isAnchor ? (
    <span
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: -5,
        border: '1px solid rgba(52, 211, 153, 0.55)',
        animation: 'widget-anchor-pulse 2.4s ease-out infinite',
      }}
    />
  ) : null;

  const focalRing = isFocal && !isAnchor ? (
    <span
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: -3,
        border: '1px solid rgba(52, 211, 153, 0.6)',
        boxShadow: '0 0 8px rgba(52, 211, 153, 0.2)',
      }}
    />
  ) : null;

  const isDashed = node.type === 'trustee-company' || node.type === 'smsf-trustee-company';

  return (
    <div
      className="absolute"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isAnchor ? 20 : 10,
      }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {anchorRing}
        {focalRing}
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            borderRadius: '30%',
            background: 'rgba(19, 26, 46, 0.94)',
            border: isDashed ? '1px dashed rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.12)',
            boxShadow: `${innerGlow}, ${outerGlow}`,
          }}
        >
          <Glyph size={Math.max(10, size * 0.42)} color={accent} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon (compact, no particle stream — restraint for widget)
// ============================================================================

function Ribbon({
  rel,
  nodes,
}: {
  rel: WealthRelationship;
  nodes: Record<string, WealthNode>;
}) {
  const fromNode = nodes[rel.from];
  const toNode = nodes[rel.to];
  if (!fromNode || !toNode) return null;
  const stroke = RIBBON_COLOR[rel.type];
  const path = buildRibbonPath(
    fromNode.position.x,
    fromNode.position.y,
    toNode.position.x,
    toNode.position.y,
  );
  return (
    <path
      d={path}
      fill="none"
      stroke={stroke}
      strokeWidth={0.6}
      strokeLinecap="round"
      style={{ opacity: 0.32 }}
    />
  );
}

function buildRibbonPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bow = Math.min(dist * 0.16, 6);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const midX = (fromX + toX) / 2 + perpX * bow;
  const midY = (fromY + toY) / 2 + perpY * bow;
  return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
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

/**
 * Crude parse — node.value is a formatted string like "$850K" or "$1.4M".
 * We turn it back into a number for the total. Good enough for the widget;
 * if we ever need precise totals here we'd pull raw values from the snapshot.
 */
function parseValueToNumber(formatted: string): number {
  const cleaned = formatted.replace(/[^0-9.KM]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (cleaned.includes('M')) return num * 1_000_000;
  if (cleaned.includes('K')) return num * 1_000;
  return num;
}

function formatTotal(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toFixed(0)}`;
}
