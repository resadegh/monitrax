/**
 * Phase 41h.3 — AI advisor presentational components public surface.
 *
 * The components here are provider-agnostic — they render the
 * gateway's `GatewayResponse` regardless of which provider
 * (`GeminiProvider`, `MockProvider`, future) produced it.
 */

export { TaxAdvisorAnswer } from './TaxAdvisorAnswer';
export { TaxAdvisorBoundaryFooter } from './TaxAdvisorBoundaryFooter';
export { TaxAdvisorUncomputedFlag } from './TaxAdvisorUncomputedFlag';
export { TaxAdvisorAskForm } from './TaxAdvisorAskForm';
