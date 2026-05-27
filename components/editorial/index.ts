/**
 * Editorial primitives barrel — the Restrained Editorial component
 * vocabulary for the internal `/dashboard/*` surfaces. Workstream 0·StD.
 *
 * Composition order, simplest → richest:
 *   1. Eyebrow                — uppercase 12px/500 0.18em label
 *   2. DataValue              — tabular-nums semibold navy currency
 *   3. DeltaChip              — emerald (positive) / amber (negative) pill
 *   4. EditorialCard          — canonical white card surface
 *   5. MetricTile             — eyebrow + data-xl + helper + sparkline
 *   6. PairedMetricCard       — two metrics side-by-side with vertical divider
 *   7. EditorialMoneyStoryHero — Earned · Kept · Free today three-line hero
 *
 * Tokens live in `app/globals.css` `editorial-*` block + `tailwind.config.ts`.
 * Design source of truth: `docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md`.
 * Stitch reference: project 1859462351962811110 — screens
 *   `f723372ebbd83b197770129eff849a2` (content stack) +
 *   `2543c8240b944c8fa6b6e89d20ac8e77` (app shell).
 *
 * Scope (CLAUDE.md §18.2): INTERNAL `/dashboard/*` only. Public-website
 * surfaces use the cosmos-* namespace; this and that don't mix.
 */

export { Eyebrow } from './Eyebrow';
export type { EyebrowProps } from './Eyebrow';

export { DataValue } from './DataValue';
export type { DataValueProps } from './DataValue';

export { DeltaChip } from './DeltaChip';
export type { DeltaChipProps, DeltaTone } from './DeltaChip';

export { EditorialCard } from './EditorialCard';
export type { EditorialCardProps } from './EditorialCard';

export { MetricTile } from './MetricTile';
export type { MetricTileProps } from './MetricTile';

export { PairedMetricCard } from './PairedMetricCard';
export type { PairedMetricCardProps, PairedMetric } from './PairedMetricCard';

export { EditorialMoneyStoryHero } from './EditorialMoneyStoryHero';
export type { EditorialMoneyStoryHeroProps } from './EditorialMoneyStoryHero';

// Shell primitives (Phase R2 — 2026-05-27). Desktop sidebar + topbar +
// mobile bottom nav + the AppShell wrapper. See shell/index.ts.
export {
  EditorialNavRow,
  EditorialSidebar,
  EditorialTopBar,
  EditorialBottomNav,
  EditorialAppShell,
} from './shell';
export type {
  EditorialNavRowProps,
  EditorialSidebarProps,
  EditorialTopBarProps,
  EditorialBottomNavProps,
  EditorialAppShellProps,
} from './shell';
