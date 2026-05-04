'use client';

/**
 * MoneyFlowSankey — Phase 41d
 *
 * Time-bounded Sankey of where the user's money actually goes.
 * Three columns:
 *
 *   Income sources         Legal entities                Outflows
 *   ───────────────       ───────────────              ───────────────
 *   Salary               PERSONAL_NAME                Tax
 *   Rental               OPERATING (Pty Ltd)          Essential expenses
 *   Investment           HOLDING (Trust)              Discretionary
 *   Other                SUPERANNUATION (SMSF)        Loan repayments
 *                        INVESTMENT (Unit Trust)      Surplus
 *
 * Powered by recharts `<Sankey>` (already in deps; zero new dependencies)
 * and the `getMoneyFlow()` service. The component is purely
 * presentational — all aggregation happens server-side, the page
 * passes the result in.
 *
 * Visual: warm ivory canvas, role-coloured entity nodes (matches the
 * Phase 41c entity tree palette so the two visualisations feel like
 * one cohesive surface), tooltip on hover with formatted AUD.
 *
 * Mobile (<md): Sankey charts get cramped on narrow screens. We render
 * the same recharts component but constrain the height a little more
 * and let recharts handle the responsive width — the overall tree
 * width is bounded by the page container.
 *
 * Accessibility: `prefers-reduced-motion` collapses the entrance fade.
 * The tooltip + node labels render normally; recharts handles the
 * keyboard focus ring on its own.
 */

import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { ROLE_PALETTE, type Entity } from './types';
import type {
  MoneyFlowResult,
  MoneyFlowSourceLabel,
  MoneyFlowOutflowLabel,
  MoneyFlowEntity,
} from '@/lib/services/moneyFlowService';

// =============================================================================
// COLOUR SCHEME
// =============================================================================
//
// Income sources tinted on the cool side (teal/sky/cyan) so they read as
// "incoming"; outflows tinted on the warm side (rose/amber) so they
// read as "leaving"; entity nodes use the role palette already shipped
// with the 41c tree so the two surfaces share visual language.

const SOURCE_COLOURS: Record<MoneyFlowSourceLabel, string> = {
  Salary: '#0ea5e9',     // sky-500
  Rental: '#14b8a6',     // teal-500
  Investment: '#06b6d4', // cyan-500
  Other: '#64748b',      // slate-500
};

const OUTFLOW_COLOURS: Record<MoneyFlowOutflowLabel, string> = {
  Tax: '#ef4444',                  // red-500 — leaks first
  'Essential expenses': '#f97316', // orange-500 — fixed costs
  Discretionary: '#f59e0b',        // amber-500 — choice
  'Loan repayments': '#a855f7',    // purple-500 — debt service
  Surplus: '#10b981',              // emerald-500 — what's left (positive)
};

// Map a LegalEntityRole to a hex colour drawn from the same family the
// Phase 41c tree uses so the two visualisations feel cohesive.
const ROLE_HEX: Record<Entity['role'], string> = {
  PERSONAL: '#d97706',         // amber-600
  HOLDING: '#4f46e5',          // indigo-600
  OPERATING: '#059669',        // emerald-600
  SUPERANNUATION: '#7c3aed',   // violet-600
  INVESTMENT: '#c026d3',       // fuchsia-600
};

// =============================================================================
// DATA TRANSFORM (service shape → recharts shape)
// =============================================================================

interface SankeyNode {
  name: string;
  /** Stable id used to build links; not consumed by recharts directly. */
  __id: string;
  /** Hex fill colour for the node block. */
  __fill: string;
  /** Whether this is an income / entity / outflow node — drives label position. */
  __category: 'income' | 'entity' | 'outflow';
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

function buildRechartsData(flow: MoneyFlowResult): {
  nodes: SankeyNode[];
  links: SankeyLink[];
} {
  const nodes: SankeyNode[] = [];
  const idToIndex = new Map<string, number>();

  function pushNode(node: SankeyNode) {
    idToIndex.set(node.__id, nodes.length);
    nodes.push(node);
  }

  // Column 1 — income sources
  for (const src of flow.incomeSources) {
    pushNode({
      __id: `src:${src.label}`,
      name: src.label,
      __fill: SOURCE_COLOURS[src.label],
      __category: 'income',
    });
  }

  // Column 2 — entities (in the same role-ordered sequence as the tree)
  const roleOrder: Entity['role'][] = [
    'PERSONAL',
    'OPERATING',
    'HOLDING',
    'INVESTMENT',
    'SUPERANNUATION',
  ];
  const sortedEntities = [...flow.entities].sort((a, b) => {
    const ra = roleOrder.indexOf(a.role);
    const rb = roleOrder.indexOf(b.role);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  for (const ent of sortedEntities) {
    pushNode({
      __id: `ent:${ent.id}`,
      name: ent.name,
      __fill: ROLE_HEX[ent.role],
      __category: 'entity',
    });
  }

  // Column 3 — outflows
  for (const out of flow.outflows) {
    pushNode({
      __id: `out:${out.label}`,
      name: out.label,
      __fill: OUTFLOW_COLOURS[out.label],
      __category: 'outflow',
    });
  }

  // Build links from edges, dropping any that point at a missing node
  // (defensive — the service shouldn't emit those, but a malformed
  // response shouldn't crash the page).
  const links: SankeyLink[] = [];
  for (const edge of flow.edges) {
    const sIdx = idToIndex.get(edge.source);
    const tIdx = idToIndex.get(edge.target);
    if (sIdx === undefined || tIdx === undefined) continue;
    if (edge.amount <= 0) continue;
    links.push({ source: sIdx, target: tIdx, value: edge.amount });
  }

  return { nodes, links };
}

// =============================================================================
// CUSTOM NODE RENDERER
// =============================================================================
//
// Recharts' default node uses a generic rectangle + label. We render a
// tinted Rectangle with the node's own fill colour + a label outside
// the column so the columns feel structured.

interface RechartsNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: SankeyNode & { value: number };
  containerWidth?: number;
}

function MoneyFlowNode(props: RechartsNodeProps) {
  const { x, y, width, height, payload, containerWidth = 720 } = props;
  const isIncome = payload.__category === 'income';
  const isOutflow = payload.__category === 'outflow';
  const isLeftEdge = x < 8;
  const isRightEdge = x + width > containerWidth - 8;
  const labelX = isLeftEdge ? x + width + 6 : isRightEdge ? x - 6 : x + width + 6;
  const labelAnchor: 'start' | 'end' = isRightEdge ? 'end' : 'start';

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 1)}
        fill={payload.__fill}
        fillOpacity={isIncome || isOutflow ? 0.9 : 0.95}
        stroke={payload.__fill}
        strokeOpacity={0.4}
        rx={3}
        ry={3}
      />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={labelAnchor}
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={600}
        className="fill-slate-700 dark:fill-slate-200"
      >
        {payload.name}
      </text>
      {payload.value > 0 && (
        <text
          x={labelX}
          y={y + height / 2 + 13}
          textAnchor={labelAnchor}
          dominantBaseline="middle"
          fontSize={10}
          className="fill-slate-500 dark:fill-slate-400"
        >
          {formatCurrency(payload.value, { abbreviate: true })}
        </text>
      )}
    </Layer>
  );
}

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { value?: number; source?: SankeyNode; target?: SankeyNode; name?: string } }>;
}

function MoneyFlowTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  // Recharts Sankey passes both nodes (with `name`) and links (with
  // source+target) into the tooltip payload. Distinguish by shape.
  if (item.source && item.target) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {item.source.name} → {item.target.name}
        </div>
        <div className="text-slate-600 dark:text-slate-300">
          {formatCurrency(item.value ?? 0, { abbreviate: false })} per year
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
      <div className="text-slate-600 dark:text-slate-300">
        {formatCurrency(item.value ?? 0, { abbreviate: false })} per year
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface MoneyFlowSankeyProps {
  flow: MoneyFlowResult;
}

export function MoneyFlowSankey({ flow }: MoneyFlowSankeyProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const { nodes, links } = useMemo(() => buildRechartsData(flow), [flow]);

  // Roll-up summary for the legend — total income + a few headline
  // outflow shares.
  const headline = useMemo(() => {
    const income = flow.totalIncome;
    const tax = flow.entities.reduce((s, e) => s + e.outflows.Tax, 0);
    const essential = flow.entities.reduce(
      (s, e: MoneyFlowEntity) => s + e.outflows['Essential expenses'],
      0,
    );
    const discretionary = flow.entities.reduce(
      (s, e) => s + e.outflows.Discretionary,
      0,
    );
    const loans = flow.entities.reduce((s, e) => s + e.outflows['Loan repayments'], 0);
    const surplus = flow.entities.reduce((s, e) => s + e.outflows.Surplus, 0);
    return { income, tax, essential, discretionary, loans, surplus };
  }, [flow]);

  if (flow.isEmpty || nodes.length === 0 || links.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-8 text-center dark:border-slate-700/50 dark:bg-slate-900/70">
        <div className="mx-auto max-w-md space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Not enough data to draw your money flow yet.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add at least one income source and one expense, and we&rsquo;ll map
            where every dollar goes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {/* Headline summary chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3 text-xs ring-1 ring-slate-900/[0.04] backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/60">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
          <TrendingUp className="h-3 w-3" />
          {formatCurrency(headline.income, { abbreviate: true })} income / year
        </div>
        {headline.tax > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-200">
            Tax {formatCurrency(headline.tax, { abbreviate: true })}
          </span>
        )}
        {headline.essential > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200">
            Essentials {formatCurrency(headline.essential, { abbreviate: true })}
          </span>
        )}
        {headline.discretionary > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            Discretionary {formatCurrency(headline.discretionary, { abbreviate: true })}
          </span>
        )}
        {headline.loans > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">
            Loans {formatCurrency(headline.loans, { abbreviate: true })}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
            headline.surplus > 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
          }`}
        >
          {headline.surplus > 0 ? 'Surplus' : 'Deficit'} {' '}
          {formatCurrency(Math.abs(headline.surplus), { abbreviate: true })}
        </span>
      </div>

      {/* Sankey canvas */}
      <div
        className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/80 via-white/60 to-amber-50/30 p-3 shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-950/70 sm:p-6"
        // Hint that this is a primary visualisation surface
        aria-label="Money flow Sankey — income sources to entities to outflows"
      >
        <ResponsiveContainer width="100%" height={Math.max(420, nodes.length * 32)}>
          <Sankey
            data={{ nodes, links }}
            nodePadding={20}
            nodeWidth={12}
            iterations={32}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node={(props: any) => <MoneyFlowNode {...(props as RechartsNodeProps)} />}
            link={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
            margin={{ top: 12, right: 140, bottom: 12, left: 16 }}
          >
            <Tooltip content={<MoneyFlowTooltip />} />
          </Sankey>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 px-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> Income
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-600" /> Entity
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Tax
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> Essentials
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Discretionary
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" /> Loans
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Surplus
          </span>
        </div>
      </div>

      {/* Honest caveat — v1 tax allocation is proportional, not Div 6/6E-correct */}
      <p className="px-2 text-center text-[10px] italic text-slate-500 dark:text-slate-400">
        Annual reference period. Tax allocated proportionally across entities;
        exact Div 6/6E trust distribution math lands with Phase 41e.
      </p>
    </motion.div>
  );
}
