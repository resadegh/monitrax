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

export { PortalPageHero } from './PortalPageHero';

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

// Phase 14.6 (2026-05-08) — Mobile-first navigation primitives.
// See docs/architecture/06_UI_UX_FOUNDATION.md §12 for the canonical
// mobile + iPad navigation standard.
export { MobileTabBar } from './MobileTabBar';
export { SectionTabsRow } from './SectionTabsRow';
export { MoreSheet } from './MoreSheet';
