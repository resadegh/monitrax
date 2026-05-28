/**
 * KPI zones — canonical financial-planning bands for the Restrained
 * Editorial KPI tiles (Variant C — Band / Context aesthetic).
 *
 * Each zone has a `from` / `to` percentage (0-100 along the band), a
 * status `label` (the chip word shown at the top-right of the tile),
 * and a `tone` (slate / sky / emerald / amber / indigo — never red).
 *
 * Sources for the band breaks:
 *   - LVR: conventional AU mortgage industry bands. <30% Conservative,
 *     30-60% Healthy (typical owner-occupier), 60-80% Watch (typical
 *     investor or recent purchase), >80% Aggressive (high gearing /
 *     LMI territory).
 *   - Saving rate: AU household median ≈ 24% (RBA / ABS national-
 *     accounts proxy). <15% Below median, 15-25% Median band,
 *     >25% Above average.
 *   - Cashflow margin: per-month net cashflow expressed as % of income.
 *     <0% Bleeding (amber, NOT red — calm tone), 0-5% Tight (slate),
 *     >5% Surplus (emerald).
 *   - Income / Outgoings YoY change: <0% Declining (slate for income,
 *     emerald for outgoings — declining outgoings is good!), 0-5%
 *     Stable, >5% Rising fast (emerald for income, amber for outgoings).
 *
 * @see docs/architecture/06_UI_UX_FOUNDATION.md §16.x for the editorial
 *      design system that drives the tone palette.
 */

export type ZoneTone = 'slate' | 'sky' | 'emerald' | 'amber' | 'indigo';

export interface KpiZone {
  /** Lower bound of the zone as a % along the band (0-100). */
  from: number;
  /** Upper bound (exclusive on inner edges, inclusive at the band's far end). */
  to: number;
  /** Status word shown when the user's value falls in this zone. */
  label: string;
  /** Visual tone — drives both the band segment colour AND the chip pill. */
  tone: ZoneTone;
}

/**
 * Portfolio LVR (loan-to-value ratio).
 * Band domain: 0-100% LVR. Higher = more geared.
 */
export const LVR_ZONES: KpiZone[] = [
  { from: 0, to: 30, label: 'Conservative', tone: 'slate' },
  { from: 30, to: 60, label: 'Healthy', tone: 'emerald' },
  { from: 60, to: 80, label: 'Watch', tone: 'sky' },
  { from: 80, to: 100, label: 'Aggressive', tone: 'amber' },
];

/**
 * Personal saving rate (% of gross income kept).
 * Band domain: 0-50%. AU household median ~24% (RBA / ABS).
 */
export const SAVING_RATE_ZONES: KpiZone[] = [
  { from: 0, to: 15, label: 'Below median', tone: 'amber' },
  { from: 15, to: 25, label: 'Median band', tone: 'slate' },
  { from: 25, to: 50, label: 'Above average', tone: 'emerald' },
];

/**
 * Income year-on-year change (% growth).
 * Band domain: -10% to +20%. Negative = decline (calm slate, never
 * amber — income decline is a fact to surface, not alarm).
 */
export const INCOME_YOY_ZONES: KpiZone[] = [
  { from: -10, to: 0, label: 'Declining', tone: 'slate' },
  { from: 0, to: 5, label: 'Stable', tone: 'slate' },
  { from: 5, to: 20, label: 'Growing', tone: 'emerald' },
];

/**
 * Outgoings year-on-year change (% growth).
 * Band domain: -10% to +20%. Note the asymmetry vs income: rising
 * outgoings IS the caution tone (amber), declining outgoings IS the
 * positive tone (emerald). Lifestyle-creep awareness without shaming.
 */
export const OUTGOINGS_YOY_ZONES: KpiZone[] = [
  { from: -10, to: 0, label: 'Down', tone: 'emerald' },
  { from: 0, to: 5, label: 'Stable', tone: 'slate' },
  { from: 5, to: 20, label: 'Rising', tone: 'amber' },
];

/**
 * Resolve which zone a given value falls into. Returns the first
 * matching zone, or the last zone if value is above the band's top.
 * Returns `null` if value is below the band's bottom.
 */
export function resolveZone(value: number, zones: KpiZone[]): KpiZone | null {
  if (zones.length === 0) return null;
  if (value < zones[0].from) return null;
  for (const z of zones) {
    if (value >= z.from && value < z.to) return z;
  }
  // Above the last zone's upper bound — clamp to the last zone.
  const last = zones[zones.length - 1];
  return value >= last.to ? last : null;
}

/**
 * Map a raw value into a 0-100 thumb position along a zone band. The
 * band spans `zones[0].from` to `zones[zones.length-1].to`; values
 * outside that range clamp to the edges.
 */
export function thumbPosition(value: number, zones: KpiZone[]): number {
  if (zones.length === 0) return 0;
  const min = zones[0].from;
  const max = zones[zones.length - 1].to;
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}
