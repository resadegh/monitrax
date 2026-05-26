/**
 * Public marketing components barrel.
 *
 * Phase 48 PR 3 (2026-05-26): re-grouped to reflect the v4 Deep Cosmos
 * canonical surfaces vs the transitional v1 components still rendering
 * on the landing page until PRs 4-5 replace them.
 *
 * Old `TrailHero` / `TrailProblem` / `TrailBridge` / `TrailTestimonials`
 * have been removed from `app/page.tsx` rendering — they're kept here as
 * exports only because `app/welcome/page.tsx`, `app/trail-method/page.tsx`,
 * and `app/wealth-check/page.tsx` may still consume some of them. Final
 * delete happens in PR 4 after the replacement section primitives ship.
 */

// Phase 48 — canonical Deep Cosmos chrome
export { Header } from './Header';
export { Footer } from './Footer';
export { Hero } from './Hero';

// Phase 48 transitional — still rendering on the landing page until PR 4-5
export { TrailJourney } from './TrailJourney';
export { TrailHowItWorks } from './TrailHowItWorks';
export { TrailCTA } from './TrailCTA';

// Phase 48 transitional — referenced by secondary public pages, scheduled
// for removal once those pages are refreshed under Phase 48.x
export { TrailHero } from './TrailHero';
export { TrailProblem } from './TrailProblem';
export { TrailBridge } from './TrailBridge';
export { TrailTestimonials } from './TrailTestimonials';

// Legacy v0 / pre-redesign components (no current consumers, kept until
// the full Phase 48 sequence completes and an explicit cleanup PR can
// confidently delete them)
export { SocialProof } from './SocialProof';
export { ValuePillars } from './ValuePillars';
export { FeatureGrid } from './FeatureGrid';
export { ForecastSection } from './ForecastSection';
export { Testimonials } from './Testimonials';
export { SecuritySection } from './SecuritySection';
