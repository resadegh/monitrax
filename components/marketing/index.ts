/**
 * Public marketing components barrel.
 *
 * Phase 48 PR 5 (2026-05-26): landing page now fully Deep Cosmos canonical.
 * FAQ + FinalCTA ship in this PR, replacing the last v1 `TrailCTA`. All
 * v1 Trail* components are now deleted. After this PR the landing page
 * is composed entirely of dark Deep Cosmos primitives.
 *
 * Pricing is NOT exported here — deferred to Phase 6 per
 * IMPLEMENTATION_PLAN.md §0e Monetisation workstream.
 */

// Phase 48 — canonical Deep Cosmos surfaces (full landing page)
export { Header } from './Header';
export { Footer } from './Footer';
export { Hero } from './Hero';
export { ProofStrip } from './ProofStrip';
export { OnePicture } from './OnePicture';
export { FiveCapabilities } from './FiveCapabilities';
export { HowItWorks } from './HowItWorks';
export { FAQ } from './FAQ';
export { FinalCTA } from './FinalCTA';

// Legacy v0 / pre-redesign components (no current consumers, kept until
// the full Phase 48 sequence completes and an explicit cleanup PR can
// confidently delete them).
export { SocialProof } from './SocialProof';
export { ValuePillars } from './ValuePillars';
export { FeatureGrid } from './FeatureGrid';
export { ForecastSection } from './ForecastSection';
export { Testimonials } from './Testimonials';
export { SecuritySection } from './SecuritySection';
