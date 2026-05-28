/**
 * Editorial KPI tiles — Variant A "Sparkline" + Variant C "Band /
 * Context" composition primitives. Reza-locked direction 2026-05-28:
 *   - Monthly Cash Flow tile → sparkline variant
 *   - Annual Income / Outgoings / Saving Rate / Portfolio LVR → band variant
 *
 * Net Worth tile is intentionally NOT in this namespace — it remains
 * on the existing component until a separate phase touches it.
 *
 * @see .stitch/designs/kpi-tiles-3-variants.html (the locked Stitch
 *      reference, project 1859462351962811110 screen
 *      2294f8b6a64d4e2db78b10275ce53e4f)
 * @see PR #910 (design exploration with all 3 variants)
 */

export { EditorialKpiCard } from './EditorialKpiCard';
export type {
  EditorialKpiCardProps,
  KpiDeltaTone,
} from './EditorialKpiCard';

export { EditorialKpiSparkline } from './EditorialKpiSparkline';
export type {
  EditorialKpiSparklineProps,
  SparklineTone,
} from './EditorialKpiSparkline';

export { EditorialBandTrack } from './EditorialBandTrack';
export type { EditorialBandTrackProps } from './EditorialBandTrack';

export {
  LVR_ZONES,
  SAVING_RATE_ZONES,
  INCOME_YOY_ZONES,
  OUTGOINGS_YOY_ZONES,
  resolveZone,
  thumbPosition,
} from './zones';
export type { KpiZone, ZoneTone } from './zones';
