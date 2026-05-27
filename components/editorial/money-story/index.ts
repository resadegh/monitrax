/**
 * Money Story v2 — "Freedom Horizon" hero tile primitives.
 *
 * Locked direction: Variant B "The Ribbon" from Reza 2026-05-27
 * (Stitch source 888f0c4fa9944222b5cf44e1ed7fcfd4, PR #907).
 *
 * Composition primitives:
 *   - MoneyStoryHeroV2   — the full tile (header + hero + ribbon + KPIs)
 *   - FreedomRibbonChart — Recharts stacked-area ribbon (Spent base +
 *                         Kept emerald band on top)
 *   - TimePeriodPill     — 1M/3M/6M/1Y/ALL segmented control with
 *                         layout-animated active pill
 *   - BreathingDot       — 8px emerald pulse for the hero
 *
 * Coexistence: V2 lives alongside the cosmos `MoneyStoryHero` and the
 * editorial three-row `EditorialMoneyStoryHero`. Dashboard consumer is
 * NOT yet swapped — preview at `/dashboard/labs/money-story`.
 */

export { MoneyStoryHeroV2 } from './MoneyStoryHeroV2';
export type { MoneyStoryHeroV2Props } from './MoneyStoryHeroV2';

export { FreedomRibbonChart } from './FreedomRibbonChart';
export type { RibbonPoint, FreedomRibbonChartProps } from './FreedomRibbonChart';

export { TimePeriodPill, TIME_PERIODS } from './TimePeriodPill';
export type { TimePeriod, TimePeriodPillProps } from './TimePeriodPill';

export { BreathingDot } from './BreathingDot';
export type { BreathingDotProps } from './BreathingDot';
