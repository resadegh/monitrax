/**
 * Phase 41f.4 — Typed shapes for trust-deed extracted rules + Zod
 * validation.
 *
 * The Prisma `TrustDeedExtractedRules` model (shipped 41f.1) stores
 * these as JSON columns. This module defines the canonical TypeScript
 * shapes + Zod schemas used at:
 *   - extraction time (validate Gemini's structured output before persist)
 *   - read time (validate before passing to Phase 41e tax engines)
 *   - UI render time (typed shape for the 4-step review flow)
 *
 * Per spec doc §1.1 scope boundary: these shapes describe what we
 * READ from the user's deed. They never describe a deed we generate.
 *
 * Per spec doc §7 4-step flow: every rule carries a `confidence`
 * score from Gemini. Rules with confidence < 0.7 default to
 * UNCOMPUTED — the user must explicitly review them before any tax
 * engine consumes the rule.
 */

import 'server-only';
import { z } from 'zod';

// =============================================================================
// Beneficiary
// =============================================================================

export const BeneficiaryTypeSchema = z.enum([
  'PRIMARY',     // Named primary beneficiary (typically the appointor's family)
  'GENERAL',     // Named in the deed's general beneficiary class
  'DEFAULT',     // Default beneficiary if no resolution made by year-end
  'EXCLUDED',    // Explicitly excluded from distributions
  'CONTINGENT',  // Beneficiary only on a triggering event (death, divorce, etc.)
]);
export type BeneficiaryType = z.infer<typeof BeneficiaryTypeSchema>;

export const BeneficiarySchema = z.object({
  name: z.string().min(1).max(200),
  type: BeneficiaryTypeSchema,
  // 0..1 (percentage entitlement); null when discretionary
  percentageEntitlement: z.number().min(0).max(1).nullable(),
  // Free-text conditions ("only on attaining majority", etc.)
  conditions: z.string().max(500).nullable(),
  // Gemini's confidence for THIS beneficiary specifically (0..1)
  confidence: z.number().min(0).max(1),
  // Original clause reference if available ("Schedule 1, item 3")
  sourceClause: z.string().max(200).nullable(),
});
export type Beneficiary = z.infer<typeof BeneficiarySchema>;

// =============================================================================
// Distribution rule
// =============================================================================

export const DistributionRuleTypeSchema = z.enum([
  'DISCRETIONARY',  // Trustee picks who gets what each year (most common)
  'PROPORTIONATE',  // Each beneficiary gets a fixed share of the income
  'FIXED',          // Specific beneficiaries get specific dollar amounts
  'STREAMED',       // Different income types stream to different beneficiaries
]);
export type DistributionRuleType = z.infer<typeof DistributionRuleTypeSchema>;

export const DistributionRuleSchema = z.object({
  type: DistributionRuleTypeSchema,
  description: z.string().max(500),
  // For PROPORTIONATE / FIXED: which beneficiaries + shares
  allocations: z
    .array(
      z.object({
        beneficiaryName: z.string().min(1).max(200),
        share: z.number().min(0).nullable(), // 0..1 for proportionate; dollars for fixed
      }),
    )
    .nullable(),
  // For STREAMED: which income type streams where
  incomeTypeStreaming: z
    .array(
      z.object({
        incomeType: z.enum(['FRANKED_DIVIDENDS', 'CAPITAL_GAINS', 'INTEREST', 'RENTAL', 'OTHER']),
        beneficiaryName: z.string().min(1).max(200),
      }),
    )
    .nullable(),
  confidence: z.number().min(0).max(1),
  sourceClause: z.string().max(200).nullable(),
});
export type DistributionRule = z.infer<typeof DistributionRuleSchema>;

// =============================================================================
// Trustee power (the appointor / removal / amendment clauses)
// =============================================================================

export const TrusteePowerSchema = z.object({
  appointor: z.string().max(200).nullable(),
  removalRights: z.string().max(500).nullable(),
  amendmentClause: z.string().max(500).nullable(),
  vestingPower: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
});
export type TrusteePower = z.infer<typeof TrusteePowerSchema>;

// =============================================================================
// Loan provisions (sub-trust UPE clauses for Div 7A)
// =============================================================================

export const LoanProvisionSchema = z.object({
  type: z.enum(['SUB_TRUST_UPE', 'PERMITTED_LOAN', 'PROHIBITED_LOAN']),
  description: z.string().max(500),
  termYears: z.number().min(0).max(99).nullable(),
  interestBenchmark: z.string().max(200).nullable(),
  confidence: z.number().min(0).max(1),
  sourceClause: z.string().max(200).nullable(),
});
export type LoanProvision = z.infer<typeof LoanProvisionSchema>;

// =============================================================================
// UNCOMPUTED note — clauses Gemini flagged as uncertain
// =============================================================================

export const UncomputedNoteSchema = z.object({
  /** Stable id — used as React key + as the audit reference. */
  id: z.string().min(1),
  /** Plain-English summary of the clause + why we couldn't structure it. */
  rationale: z.string().min(1).max(1000),
  /** Verbatim deed text Gemini was looking at. */
  sourceText: z.string().max(2000),
  sourceClause: z.string().max(200).nullable(),
});
export type UncomputedNote = z.infer<typeof UncomputedNoteSchema>;

// =============================================================================
// Top-level extraction shape
// =============================================================================

/**
 * The shape Gemini returns + the shape we persist to
 * `TrustDeedExtractedRules` JSON columns.
 *
 * Field-by-field maps to the Prisma model:
 *   beneficiaries → TrustDeedExtractedRules.beneficiaries
 *   distributionRules → TrustDeedExtractedRules.distributionRules
 *   vestingDate → TrustDeedExtractedRules.vestingDate
 *   trusteePower → TrustDeedExtractedRules.trusteePower
 *   loanProvisions → TrustDeedExtractedRules.loanProvisions
 *   uncomputedNotes → TrustDeedExtractedRules.uncomputedNotes
 */
export const TrustDeedExtractionSchema = z.object({
  beneficiaries: z.array(BeneficiarySchema).max(50),
  distributionRules: z.array(DistributionRuleSchema).max(20),
  vestingDate: z.string().nullable(),
  trusteePower: TrusteePowerSchema.nullable(),
  loanProvisions: z.array(LoanProvisionSchema).max(20).nullable(),
  uncomputedNotes: z.array(UncomputedNoteSchema).max(50),
  /**
   * Top-level confidence — Gemini's overall self-assessment of the
   * extraction quality. Independently below per-rule `confidence`
   * fields. Used by the UI to show a "this deed extracted cleanly"
   * vs "review carefully" header banner.
   */
  overallConfidence: z.number().min(0).max(1),
});
export type TrustDeedExtraction = z.infer<typeof TrustDeedExtractionSchema>;

/**
 * Confidence threshold below which a rule defaults to UNCOMPUTED.
 * Per spec doc §6.2: "rules below 0.7 confidence default to UNCOMPUTED".
 */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Helper — given a TrustDeedExtraction, return only the high-confidence
 * beneficiaries + distributionRules. Used by Phase 41e.4 / 41e.5
 * consumers that should NEVER read a low-confidence rule.
 */
export function highConfidenceOnly(
  extraction: TrustDeedExtraction,
): TrustDeedExtraction {
  return {
    ...extraction,
    beneficiaries: extraction.beneficiaries.filter(
      (b) => b.confidence >= CONFIDENCE_THRESHOLD,
    ),
    distributionRules: extraction.distributionRules.filter(
      (r) => r.confidence >= CONFIDENCE_THRESHOLD,
    ),
    loanProvisions:
      extraction.loanProvisions?.filter(
        (l) => l.confidence >= CONFIDENCE_THRESHOLD,
      ) ?? null,
  };
}
