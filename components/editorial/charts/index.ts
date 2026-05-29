/**
 * Editorial charts barrel — the interactive chart vocabulary for the
 * internal `/dashboard/*` surfaces. Workstream R-Charts-1.
 *
 * Primitives:
 *   1. EditorialChartCard    — shared card shell (eyebrow + headline + slot)
 *   2. EditorialChartTooltip — styled popover wrapper for Recharts tooltips
 *   3. EditorialDonutChart   — asset allocation donut + legend
 *   4. EditorialBarChart     — grouped vertical bars (earned vs spent)
 *   5. EditorialEntityBars   — horizontal diverging bars (per-entity net value)
 *
 * All charts are theme-aware via the editorial-* CSS variables and pure
 * presentational — every financial calculation is done server-side in
 * /api/dashboard/charts (keeps the Phase 41i.6b surface linter clean).
 *
 * Stitch reference: project 1859462351962811110 — screen
 * `dashboard-interactive-charts` (.stitch/designs/).
 * Scope (CLAUDE.md §18.2): INTERNAL `/dashboard/*` only.
 */

export { EditorialChartCard } from './EditorialChartCard';
export type { EditorialChartCardProps } from './EditorialChartCard';

export { EditorialChartTooltip } from './EditorialChartTooltip';
export type { EditorialChartTooltipProps, TooltipRow } from './EditorialChartTooltip';

export { EditorialDonutChart } from './EditorialDonutChart';
export type {
  EditorialDonutChartProps,
  AllocationSlice,
  AllocationKey,
} from './EditorialDonutChart';

export { EditorialBarChart } from './EditorialBarChart';
export type { EditorialBarChartProps, CashflowBar } from './EditorialBarChart';

export { EditorialEntityBars } from './EditorialEntityBars';
export type { EditorialEntityBarsProps, EntityBar } from './EditorialEntityBars';
