/**
 * Practice surface — shared types.
 *
 * `TrailStage` mirrors the consumer-side TRAIL framework
 * (docs/blueprint/TRAIL_FRAMEWORK.md). Shared with the consumer dashboard via
 * future cross-import (`lib/cfo/trailStage.ts`) — kept local here for the
 * lighthouse demo so the Practice surface compiles standalone. Reconcile
 * when the alert engine reads real snapshot deltas (PR3+).
 */
export type TrailStage = 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE';

export const TRAIL_STAGE_LABEL: Record<TrailStage, string> = {
  TRACK: 'Track',
  REDUCE: 'Reduce',
  ANCHOR: 'Anchor',
  INVEST: 'Invest',
  LIVE: 'Live',
};

export const TRAIL_STAGE_ORDER: TrailStage[] = ['TRACK', 'REDUCE', 'ANCHOR', 'INVEST', 'LIVE'];
