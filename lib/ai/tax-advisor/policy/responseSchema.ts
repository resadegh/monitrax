/**
 * Phase 41h.1 — AI response schema (Zod).
 *
 * Defines the typed shape every AI response must conform to. Numbers
 * are emitted as `NUMBER_REF` segments that reference a `numericFields[].path`
 * from a tool result; citations are emitted as `CITATION_REF` segments
 * that reference a tool-result `citation.id`. Free-text appears as
 * `TEXT` segments — this is where Gemini's general-knowledge paraphrasing
 * lives (HR-2-permitted: paraphrasing is fine; authoring law is not).
 *
 * The runtime validator (`validators.ts`) checks every NUMBER_REF
 * resolves against the `ToolSession`. The Zod schema below catches
 * shape errors; the validator catches HR-1/HR-2 violations.
 */

import { z } from 'zod';

// ---------- Segment schemas ----------

const TextSegmentSchema = z.object({
  type: z.literal('TEXT'),
  /**
   * Plain-English text. The AI may paraphrase / educate / explain
   * here using general knowledge. Numbers and citation references
   * MUST appear in their dedicated segments, not embedded in TEXT.
   * (Embedded numbers are caught by the validator's `bareNumber`
   * scan.)
   */
  text: z.string().min(1),
});

const NumberRefSegmentSchema = z.object({
  type: z.literal('NUMBER_REF'),
  /**
   * `${toolName}#${path}` — the gateway resolves this against the
   * `ToolSession` to get the actual `NumericField`. If the path
   * doesn't exist, the validator rejects the whole response.
   */
  ref: z.string().regex(
    /^[a-zA-Z][\w]*#[a-zA-Z][\w.]*$/,
    'NUMBER_REF must be `<toolName>#<path>` format',
  ),
  /**
   * Optional rendering hint — `currency` (default for AUD), `percent`,
   * `count`, `years`. The renderer uses this to format consistently.
   */
  format: z
    .enum(['currency', 'percent', 'count', 'years', 'ratio'])
    .optional(),
});

const CitationRefSegmentSchema = z.object({
  type: z.literal('CITATION_REF'),
  /**
   * `${toolName}#${citationId}` — resolves to an `IdentifiedCitation`
   * via `findCitationInSession`. Validator rejects if not found.
   */
  ref: z.string().regex(
    /^[a-zA-Z][\w]*#cit-[\w-]+$/,
    'CITATION_REF must be `<toolName>#cit-<id>` format',
  ),
});

const UncomputedNoteSegmentSchema = z.object({
  type: z.literal('UNCOMPUTED_NOTE'),
  /** UC flag id (e.g. "UC-MULTI-STATE-LAND-TAX"). Must exist in session. */
  flagId: z.string().regex(/^UC-/),
});

const SegmentSchema = z.discriminatedUnion('type', [
  TextSegmentSchema,
  NumberRefSegmentSchema,
  CitationRefSegmentSchema,
  UncomputedNoteSegmentSchema,
]);

export type AnswerSegment = z.infer<typeof SegmentSchema>;

// ---------- Tier classification ----------

const TierSchema = z.enum(['TIER_1_FACTS', 'TIER_2_ROUTE_TO_PRO']);

const AskAProRoutingSchema = z.object({
  profession: z.enum(['ADVISER', 'ACCOUNTANT', 'BROKER']),
  /**
   * Why this question routes to a pro — surfaced in the marketplace
   * intake. Plain-English; no fabricated facts.
   */
  reason: z.string().min(1).max(500),
});

// ---------- Full response shape ----------

export const RawAIResponseSchema = z.object({
  /**
   * Tier 1: AI returns facts (numbers + citations + paraphrase).
   * Tier 2: AI defers to a registered professional via Ask-a-Pro.
   */
  tier: TierSchema,
  /**
   * Ordered list of segments composing the answer. The renderer
   * concatenates these in order, formatting NUMBER_REF / CITATION_REF
   * inline.
   */
  segments: z.array(SegmentSchema).min(1).max(50),
  /**
   * If `tier === 'TIER_2_ROUTE_TO_PRO'`, the Ask-a-Pro routing.
   * Required when tier is TIER_2; ignored otherwise.
   */
  askAProRouting: AskAProRoutingSchema.optional(),
});

export type RawAIResponse = z.infer<typeof RawAIResponseSchema>;

/**
 * Convenience: parse + cast unknown provider output. Throws on
 * shape errors; the validator (next file) catches HR-1/HR-2 issues.
 */
export function parseRawAIResponse(input: unknown): RawAIResponse {
  return RawAIResponseSchema.parse(input);
}
