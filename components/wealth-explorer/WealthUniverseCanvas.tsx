/**
 * WealthUniverseCanvas — surface-design preview of the Wealth Explorer.
 *
 * Renders the Apple-Dock × Apple-Maps × Minority-Report spatial canvas
 * from the v5 Stitch design:
 *   `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 *   Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 *
 * This is a STATIC visual at v1 — the HOME tile is rendered in its hover
 * state to demonstrate the magnification + ribbon-highlight behaviour, but
 * no interactive hover handlers are wired yet. Interactivity ships once
 * Reza approves the look. See `lib/data/wealthExplorerFixture.ts` for the
 * fixture (Renew Group structure).
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
  Search,
  Plus,
  Minus,
  Maximize2,
  Settings2,
  ChevronRight,
  PanelRight,
  type LucideIcon,
} from 'lucide-react';
import {
  WEALTH_NODES,
  WEALTH_RELATIONSHIPS,
  NODE_ACCENT,
  RIBBON_COLOR,
  type WealthNode,
  type WealthNodeType,
  type WealthRelationship,
} from '@/lib/data/wealthExplorerFixture';

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
};

/** A few dozen dust motes scattered + slowly drifting. Pure CSS animation. */
function DustMoteLayer() {
  // Deterministic positions so SSR + client match. 36 motes.
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
}

function WealthNodeTile({ node, glyph: Glyph, accent }: TileProps) {
  const isHovered = !!node.isHovered;
  const isAnchor = !!node.isAnchor;
  const isFocal = !!node.isFocal;
  const scale = isHovered ? 1.6 : 1;
  const renderedSize = node.size * scale;

  const accentRgb = hexToRgb(accent);
  const innerGlow = accentRgb
    ? `inset 0 0 ${isHovered ? 32 : 18}px rgba(${accentRgb}, ${isHovered ? 0.35 : 0.2})`
    : 'none';
  const outerGlow = accentRgb
    ? `0 0 ${isHovered ? 48 : 28}px rgba(${accentRgb}, ${isHovered ? 0.35 : 0.15})`
    : '';
  const dropShadow = '0 8px 24px rgba(0, 0, 0, 0.45)';

  // Anchor pulsing rings
  const anchorRings = isAnchor ? (
    <>
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -16,
          border: '1.5px solid rgba(52, 211, 153, 0.45)',
          animation: 'wealth-anchor-pulse 2.4s ease-out infinite',
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -32,
          border: '1px solid rgba(52, 211, 153, 0.25)',
          animation: 'wealth-anchor-pulse 2.4s ease-out 0.6s infinite',
        }}
      />
    </>
  ) : null;

  // Focal entity ring (currently-featured but not hovered)
  const focalRing = isFocal && !isHovered ? (
    <span
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: -6,
        border: '1.5px solid rgba(52, 211, 153, 0.7)',
        boxShadow: '0 0 20px rgba(52, 211, 153, 0.25)',
      }}
    />
  ) : null;

  const isDashed = node.type === 'trustee-company' || node.type === 'smsf-trustee-company';
  const hoveredBorder = isHovered
    ? `1.5px solid ${accent}`
    : isDashed
      ? `1.5px dashed rgba(255, 255, 255, 0.18)`
      : `1px solid rgba(255, 255, 255, 0.12)`;

  return (
    <div
      className="absolute"
      style={{
        left: `${node.position.x}%`,
        top: `${node.position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isHovered ? 30 : isAnchor ? 20 : 10,
        transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="relative" style={{ width: renderedSize, height: renderedSize }}>
        {anchorRings}
        {focalRing}
        <div
          className="relative h-full w-full flex flex-col items-center justify-center text-white"
          style={{
            borderRadius: '30%',
            background: 'rgba(19, 26, 46, 0.92)',
            backdropFilter: 'blur(16px)',
            border: hoveredBorder,
            boxShadow: `${innerGlow}, ${outerGlow}, ${dropShadow}`,
          }}
        >
          <Glyph
            size={Math.max(18, renderedSize * 0.32)}
            color={accent}
            strokeWidth={1.5}
          />
          {/* Hover-state magnifier corner indicator */}
          {isHovered && (
            <span
              className="absolute right-2 top-2 rounded-full p-1"
              style={{ background: 'rgba(0, 0, 0, 0.35)' }}
            >
              <Search size={10} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
            </span>
          )}
        </div>

        {/* Label beneath the tile */}
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

/**
 * Soft-curved Bezier between two % coordinates, rendered as an SVG path.
 * We compute control points to bow the curve gently outward — feels organic,
 * not orthogonal-engineering.
 */
function buildRibbonPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  // Bow perpendicular to the line — magnitude relative to distance
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bow = Math.min(dist * 0.18, 8);
  // Perpendicular direction (rotate 90° anticlockwise + normalise)
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const midX = (fromX + toX) / 2 + perpX * bow;
  const midY = (fromY + toY) / 2 + perpY * bow;
  return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
}

interface RibbonProps {
  rel: WealthRelationship;
  nodes: Record<string, WealthNode>;
  isDimmed: boolean;
}

function RelationshipRibbon({ rel, nodes, isDimmed }: RibbonProps) {
  const fromNode = nodes[rel.from];
  const toNode = nodes[rel.to];
  if (!fromNode || !toNode) return null;

  const stroke = RIBBON_COLOR[rel.type];
  const isActive = !!rel.active;
  const opacity = isActive ? 0.85 : isDimmed ? 0.08 : 0.22;
  const strokeWidth = isActive ? 2 : 1.2;
  const glowStrength = isActive ? 6 : 2;

  const path = buildRibbonPath(
    fromNode.position.x,
    fromNode.position.y,
    toNode.position.x,
    toNode.position.y,
  );

  const filterId = `glow-${rel.id}`;

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
        strokeDasharray={rel.type === 'controls' ? '0.6 0.8' : undefined}
        filter={isActive ? `url(#${filterId})` : undefined}
      />
      {/* Particle stream on active ribbons */}
      {isActive && (
        <>
          <circle r="0.5" fill={stroke}>
            <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="0.4" fill={stroke} opacity="0.7">
            <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="0.3" fill={stroke} opacity="0.5">
            <animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
    </g>
  );
}

/** EntityPreviewPopover — static, anchored to HOME for the v1 demo. */
function HomePreviewPopover() {
  const home = WEALTH_NODES.find(n => n.id === 'home')!;
  // Anchor to the right of the HOME tile.
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: `calc(${home.position.x}% + 70px)`,
        top: `calc(${home.position.y}% - 110px)`,
        width: 280,
      }}
    >
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(26, 34, 68, 0.94)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(56, 189, 248, 0.15)',
        }}
      >
        <div className="mb-3 flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <Home size={18} color="#38BDF8" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-white">HOME</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-sky-300/80">
              Investment Property
            </div>
          </div>
        </div>
        <div className="mb-3 text-[12px] text-white/60">903 Boree Valley Rd, Laguna NSW</div>

        <div className="mb-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-white/40">
              Current Value
            </div>
            <div className="flex items-baseline gap-1.5">
              <div className="text-[16px] font-semibold tabular-nums text-white">$850K</div>
              <div
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium tabular-nums"
                style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  color: '#6EE7B7',
                }}
              >
                +24.1%
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-white/40">
              Equity
            </div>
            <div className="text-[16px] font-semibold tabular-nums text-white">$850K</div>
            <div className="text-[9px] text-emerald-300/70">LVR 0%</div>
          </div>
        </div>

        <div className="mb-2 text-[9px] uppercase tracking-[0.14em] text-white/40">Owned By</div>
        <div
          className="mb-3 flex items-center gap-2 rounded-lg p-2"
          style={{ background: 'rgba(129, 140, 248, 0.08)', border: '1px solid rgba(129, 140, 248, 0.18)' }}
        >
          <Umbrella size={14} color="#A78BFA" strokeWidth={1.5} />
          <div className="flex-1 truncate text-[11px] font-medium text-white/90">
            Renew Investment Family Trust
          </div>
          <ChevronRight size={12} color="rgba(255,255,255,0.4)" />
        </div>

        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-white/40">
          Key Relationship
        </div>
        <div className="text-[11px] leading-relaxed text-white/70">
          Held by trust → beneficiaries are ★ YOU, Newsha, Holding Co
        </div>

        <div className="mt-3 text-[10px] font-medium text-sky-300/80">
          Tap to open full file →
        </div>
      </div>
    </div>
  );
}

export default function WealthUniverseCanvas() {
  const nodesById: Record<string, WealthNode> = Object.fromEntries(
    WEALTH_NODES.map(n => [n.id, n]),
  );
  const hoveredId = WEALTH_NODES.find(n => n.isHovered)?.id;

  // Adjacent tiles to the hovered one get the Apple-Dock fan boost.
  // For v1 (HOME hovered), fan effect handled in WealthNodeTile via isHovered
  // and surrounding ribbon dimming.
  const isRibbonDimmed = (r: WealthRelationship) =>
    !!hoveredId && r.from !== hoveredId && r.to !== hoveredId && !r.active;

  return (
    <div
      className="relative h-[calc(100vh-220px)] min-h-[640px] w-full overflow-hidden rounded-2xl"
      style={{
        background:
          'radial-gradient(ellipse at 50% 55%, #0A0E1F 0%, #060914 60%, #050810 100%)',
      }}
    >
      {/* Keyframes for the canvas-local animations */}
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
      `}</style>

      <DustMoteLayer />

      {/* Top floating chrome — search + filter chips + settings */}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 z-40 flex items-center gap-3 px-6 pt-4">
        {/* Section title cluster */}
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
            <div className="text-[14px] font-semibold leading-tight text-white">
              Wealth Explorer
            </div>
            <div className="text-[10px] leading-tight text-white/45">
              Reza &amp; Newsha&rsquo;s wealth universe
            </div>
          </div>
        </div>

        {/* Search pill */}
        <div className="ml-4 flex-1 max-w-[440px]">
          <div
            className="flex h-9 items-center gap-2 rounded-full px-3.5"
            style={{
              background: 'rgba(19, 26, 46, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Search size={14} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <span className="text-[12px] text-white/45">
              Search any entity, asset, person, document…
            </span>
          </div>
        </div>

        {/* Filter chips */}
        <div className="ml-auto flex items-center gap-1.5">
          <FilterChip label="All" count={14} active />
          <FilterChip label="People" count={2} />
          <FilterChip label="Entities" count={5} />
          <FilterChip label="Properties" count={1} />
          <FilterChip label="Investments" count={2} />
          <FilterChip label="Accounts" count={1} />
          <FilterChip label="Other" count={3} />
        </div>

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

      {/* Level indicator — top-centre */}
      <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(19, 26, 46, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/80">
            Level 1 · Universe
          </span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span className="h-1 w-1 rounded-full bg-white/15" />
        </div>
      </div>

      {/* SVG ribbon layer */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {WEALTH_RELATIONSHIPS.map(rel => (
          <RelationshipRibbon
            key={rel.id}
            rel={rel}
            nodes={nodesById}
            isDimmed={isRibbonDimmed(rel)}
          />
        ))}
      </svg>

      {/* Tile layer */}
      {WEALTH_NODES.map(node => (
        <WealthNodeTile
          key={node.id}
          node={node}
          glyph={NODE_GLYPH[node.type]}
          accent={NODE_ACCENT[node.type]}
        />
      ))}

      {/* Hover popover — static demo on HOME */}
      <HomePreviewPopover />

      {/* Zoom controls — bottom-left */}
      <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-2">
        <ZoomButton icon={Plus} label="Zoom in" />
        <ZoomButton icon={Minus} label="Zoom out" />
        <ZoomButton icon={Maximize2} label="Fit to view" />
        <div className="mt-1 text-center text-[9px] tracking-wide text-white/40">
          100% · Universe
        </div>
      </div>

      {/* Detail panel tab — right edge collapsed */}
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

      {/* Hint text — bottom-right */}
      <div className="pointer-events-none absolute bottom-6 right-6 z-30 max-w-xs text-right">
        <div className="text-[10px] leading-relaxed text-white/35">
          Hover a tile to preview · click to zoom in · search to find any node
        </div>
      </div>
    </div>
  );
}

// ----- Small inline subcomponents (lifted up once Reza approves the look) ----

function FilterChip({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div
      className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium"
      style={{
        background: active ? 'rgba(52, 211, 153, 0.12)' : 'rgba(19, 26, 46, 0.7)',
        border: active
          ? '1px solid rgba(52, 211, 153, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        color: active ? '#6EE7B7' : 'rgba(255, 255, 255, 0.65)',
      }}
    >
      <span>{label}</span>
      <span
        className="rounded-full px-1 text-[9px] tabular-nums"
        style={{ background: 'rgba(0, 0, 0, 0.25)' }}
      >
        {count}
      </span>
    </div>
  );
}

function ZoomButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{
        background: 'rgba(19, 26, 46, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Icon size={14} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
    </button>
  );
}

// ----- helpers ---------------------------------------------------------------

function hexToRgb(hex: string): string | null {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return null;
  const [r, g, b] = m.map(c => parseInt(c, 16));
  return `${r}, ${g}, ${b}`;
}
