/**
 * Shared shell layer exports.
 *
 * Single import surface for any Monitrax page that wants to align with
 * the Phase 39 consumer design language. Used by Org Portal practice
 * surfaces; consumer wealth tiles will migrate to these in a follow-up
 * PR (currently they have their own copies of the same patterns).
 */

export { GlassHero, GlassHeroEyebrow, GlassHeroHeadline, GlassHeroKpiCell } from './GlassHero';
export type { GlassHeroProps, GlassHeroAtmosphere } from './GlassHero';

export { MetricTile, MetricTileHeadline } from './MetricTile';
export type { MetricTileProps, MetricTileTone } from './MetricTile';

export {
  appleEase,
  springSnap,
  tileEnter,
  heroEnter,
  breathingGlow,
  useReducedMotionSafe,
} from './motion';

export {
  ClientsGlyph,
  RequestsGlyph,
  ConversationsGlyph,
  AnalyticsGlyph,
  HealthGlyph,
} from './practiceGlyphs';
