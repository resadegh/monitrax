/**
 * Public marketing components barrel.
 *
 * Phase 48 PR 4 (2026-05-26): old v1 Trail* components deleted now that
 * their dark Deep Cosmos replacements ship in `app/page.tsx`. Only
 * `TrailCTA` remains pending PR 5's Pricing + FAQ + Final CTA family.
 */

// Phase 48 — canonical Deep Cosmos surfaces
export { Header } from './Header';
export { Footer } from './Footer';
export { Hero } from './Hero';
export { ProofStrip } from './ProofStrip';
export { OnePicture } from './OnePicture';
export { FiveCapabilities } from './FiveCapabilities';
export { HowItWorks } from './HowItWorks';

// Phase 48 transitional — kept until PR 5 replaces with the new
// Pricing + FAQ + Final CTA section family.
export { TrailCTA } from './TrailCTA';

// Legacy v0 / pre-redesign components (no current consumers, kept until
// the full Phase 48 sequence completes and an explicit cleanup PR can
// confidently delete them).
export { SocialProof } from './SocialProof';
export { ValuePillars } from './ValuePillars';
export { FeatureGrid } from './FeatureGrid';
export { ForecastSection } from './ForecastSection';
export { Testimonials } from './Testimonials';
export { SecuritySection } from './SecuritySection';
