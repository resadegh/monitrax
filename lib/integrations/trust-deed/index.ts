/**
 * Phase 41f.4 — Trust-deed parser public surface.
 *
 * Strategic positioning per
 * `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` §1.1:
 *
 *   "Monitrax stores + understands trust deeds; never creates legal
 *    documents."
 *
 * Boundary per spec doc §1.1: storage + understanding ONLY. We never
 * generate, draft, or modify trust deeds. We never issue distribution
 * minutes / resolutions on the user's behalf. We never file with the
 * ATO / ASIC / any regulator.
 *
 * The 4-step confirm-before-apply flow (spec doc §7) is the user-
 * facing contract: upload → AI extract → user reviews each rule →
 * user approves. Phase 41e tax engines consume CONFIRMED rules only.
 */

// Types + Zod schema
export {
  BeneficiaryTypeSchema,
  BeneficiarySchema,
  DistributionRuleTypeSchema,
  DistributionRuleSchema,
  TrusteePowerSchema,
  LoanProvisionSchema,
  UncomputedNoteSchema,
  TrustDeedExtractionSchema,
  CONFIDENCE_THRESHOLD,
  highConfidenceOnly,
  type BeneficiaryType,
  type Beneficiary,
  type DistributionRuleType,
  type DistributionRule,
  type TrusteePower,
  type LoanProvision,
  type UncomputedNote,
  type TrustDeedExtraction,
} from './types';

// PDF text extraction (uses unpdf)
export {
  extractTextFromPdf,
  TrustDeedExtractionError,
  type PdfTextResult,
} from './pdfTextExtractor';

// Gemini structurer
export {
  extractTrustDeedRules,
  GeminiExtractionError,
  type ExtractTrustDeedInput,
  type ExtractTrustDeedResult,
} from './geminiExtractor';

// Service orchestrator
export {
  createExtraction,
  updateExtractedRules,
  confirmExtraction,
  rejectExtraction,
  getLatestExtractionForEntity,
  isAllowedTransition,
  TrustDeedServiceError,
  type CreateExtractionInput,
} from './extractionService';
