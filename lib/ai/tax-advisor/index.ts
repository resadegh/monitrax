/**
 * Phase 41h.0 — AI Tax Advisor public surface.
 *
 * Importing this module bootstraps the registry with the canonical
 * 41h.0 tools. The Gemini dispatcher (41h.2) imports from here.
 *
 * **Hard rules embedded structurally** (per Reza brief 2026-05-05):
 *   - HR-1: Numbers come from the app, never the AI. Enforced by
 *     `NumericField` contract — every number the AI may emit must
 *     come from a tool result.
 *   - HR-2: Claims come from AU law, never AI memory. Enforced by
 *     `IdentifiedCitation` contract — every citation the AI may
 *     reference must come from a tool result's `citations` array.
 *   - D-2: AFSL/TPB/NCCP boundary. Enforced by `ToolKind` discriminant
 *     being a closed set of `FACT_LOOKUP | SCENARIO_RUN`. There is
 *     no `RECOMMENDATION` kind — the registry literally cannot
 *     contain a recommendation tool.
 */

import { taxAdvisorToolRegistry, assertToolKind } from './registry';
import { getContributionCapHeadroomTool } from './tools/getContributionCapHeadroom';
import { getLandTaxPositionTool } from './tools/getLandTaxPosition';
import { getEntityTaxPositionTool } from './tools/getEntityTaxPosition';
import { getCgtExposureTool } from './tools/getCgtExposure';
import { getDiv7aRiskTool } from './tools/getDiv7aRisk';
import { getInHouseAssetRatioTool } from './tools/getInHouseAssetRatio';
import { runContributionScenarioTool } from './tools/runContributionScenario';
import { runCgtScenarioTool } from './tools/runCgtScenario';
import { runLandTaxScenarioTool } from './tools/runLandTaxScenario';
import { runDiv7aRefinanceScenarioTool } from './tools/runDiv7aRefinanceScenario';
import { getTrustDeedRulesTool } from './tools/getTrustDeedRules';

import type { TaxAdvisorTool } from './types';

/**
 * Canonical tools registered at module load. Adding a tool requires
 * editing this list (and CLAUDE.md §13 / Phase 41 §5.2 reviewers).
 *
 * Phase 41h.0 shipped 3 (FACT_LOOKUP × 3).
 * Phase 41h.5 expands to 7 (FACT_LOOKUP × 6 + SCENARIO_RUN × 1).
 * Phase 41h.6 expands to 10 (FACT_LOOKUP × 6 + SCENARIO_RUN × 4).
 * Phase 41f.4-extension expands to 11 (FACT_LOOKUP × 7 + SCENARIO_RUN × 4)
 *   — adds `getTrustDeedRules` so the advisor can narrate trust-deed
 *   structure for trust entities with a CONFIRMED deed on file.
 */
const CANONICAL_TOOLS: ReadonlyArray<TaxAdvisorTool<any>> = [
  getContributionCapHeadroomTool,
  getLandTaxPositionTool,
  getEntityTaxPositionTool,
  // 41h.5 additions:
  getCgtExposureTool,
  getDiv7aRiskTool,
  getInHouseAssetRatioTool,
  runContributionScenarioTool,
  // 41h.6 additions (SCENARIO_RUN expansion):
  runCgtScenarioTool,
  runLandTaxScenarioTool,
  runDiv7aRefinanceScenarioTool,
  // 41f.4-extension addition:
  getTrustDeedRulesTool,
];

/**
 * Bootstrap the registry. Idempotent — safe to call multiple times
 * during hot-reload (registry throws on duplicate registration).
 *
 * Exposed for tests that need to register manually after a clear.
 */
export function bootstrapTaxAdvisorRegistry(): void {
  for (const tool of CANONICAL_TOOLS) {
    assertToolKind(tool);
    if (!taxAdvisorToolRegistry.get(tool.name)) {
      taxAdvisorToolRegistry.register(tool);
    }
  }
}

// Auto-bootstrap on import.
bootstrapTaxAdvisorRegistry();

export { taxAdvisorToolRegistry };
export {
  getContributionCapHeadroomTool,
  getLandTaxPositionTool,
  getEntityTaxPositionTool,
  getCgtExposureTool,
  getDiv7aRiskTool,
  getInHouseAssetRatioTool,
  runContributionScenarioTool,
  runCgtScenarioTool,
  runLandTaxScenarioTool,
  runDiv7aRefinanceScenarioTool,
  getTrustDeedRulesTool,
};
export * from './types';

// Phase 41h.1 — AI Policy Gateway exports
export { createTaxAdvisorGateway } from './gateway';
export type {
  TaxAdvisorGateway,
  GatewayResponse,
  GatewayAskInput,
  GatewayOptions,
  GatewayStatus,
} from './gateway';
export type { AIProvider, ProviderInvokeRequest, ProviderInvokeResponse } from './providers/types';
export { ProviderError } from './providers/types';
export { MockProvider } from './providers/mockProvider';
export { ConsoleAuditSink, InMemoryAuditSink } from './audit/auditLogger';
export type { AuditEntry, AuditSink, AuditOutcome } from './audit/auditLogger';
export { ProductionAuditSink } from './audit/productionAuditSink';
export { GeminiProvider, toolToFunctionDeclaration } from './providers/geminiProvider';
export type { GeminiProviderOptions } from './providers/geminiProvider';
export { buildSystemPrompt, BASE_PROMPT } from './policy/systemPrompt';
export { parseRawAIResponse, RawAIResponseSchema } from './policy/responseSchema';
export type { RawAIResponse, AnswerSegment } from './policy/responseSchema';
export { validateAIResponse } from './policy/validators';
export type { ValidationIssue, ValidationOutcome } from './policy/validators';
