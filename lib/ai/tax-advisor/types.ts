/**
 * Phase 41h.0 — AI Tax Advisor tool registry types.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §5
 * (Two-tier surface) + Reza's brief 2026-05-05:
 *
 *   > **HR-1: Numbers come from the app, never the AI.**
 *   > **HR-2: Claims come from AU law, never AI memory.**
 *
 * These are **structural** rules, not editorial. They are enforced
 * at three layers:
 *
 *   1. **Tool layer (this file).** The registry is the only way the
 *      AI obtains numbers and citations. The registry contains NO
 *      `estimate*` / `guess*` / `lookupRule` / `recommend*` tool —
 *      and TypeScript prevents one being added because the
 *      `TaxAdvisorTool.kind` discriminant only allows `FACT_LOOKUP`
 *      or `SCENARIO_RUN`. There is no `RECOMMENDATION` kind.
 *
 *   2. **Schema layer** (Phase 41h.1) — AI response objects are
 *      typed: every numeric field references a tool-result path;
 *      every citation field references a tool-result citation id.
 *
 *   3. **Validator layer** (Phase 41h.1) — post-processor rejects
 *      responses whose numbers / citations don't resolve back to
 *      the tool-result session.
 *
 * **Architecture invariants (reviewers reject any PR that violates):**
 *
 *   - A tool's `execute(input)` returns a `ToolResult` carrying
 *     `numericFields`, `citations`, and `uncomputed` arrays. The AI
 *     can only emit numbers from `numericFields` and only cite
 *     entries in `citations`.
 *   - No tool is allowed to have free-form text output that the AI
 *     can quote as if it were authoritative — text in `narrativeText`
 *     is a hint for the AI to paraphrase, never a quotable claim.
 *   - Tool kinds are a closed set: `FACT_LOOKUP` (read-only fact
 *     about user data) or `SCENARIO_RUN` (read-only "what if"
 *     simulation against the existing calc engines). There is no
 *     `RECOMMENDATION` kind because the AI has no recommendation
 *     surface (recommendations route to Ask-a-Pro per D-2).
 */

import type { AuthorityCitation, UncomputedFlag } from '@/lib/tax-engine/types';

/**
 * The closed set of tool kinds. **Do not add a `RECOMMENDATION`,
 * `ESTIMATE`, or `LOOKUP_RULE` kind — that would breach D-2 and
 * HR-1/HR-2.** Reviewers MUST reject any PR that adds a kind here.
 */
export type ToolKind = 'FACT_LOOKUP' | 'SCENARIO_RUN';

/**
 * A single numeric field returned by a tool. Every number the AI
 * is allowed to emit MUST appear in a tool result's `numericFields`
 * array, addressed by stable `path`. The validator (Phase 41h.1)
 * uses `path` to verify the AI didn't fabricate the number.
 */
export interface NumericField {
  /**
   * Stable path the AI references when emitting this number, e.g.
   * `"contributionCaps.concessional.remaining"` or
   * `"landTax.NSW.totalTax"`. The path is also the lookup key for
   * the post-processor.
   */
  path: string;
  value: number;
  /** ISO-8601 currency code, or `null` for ratios / percentages / counts. */
  unit: 'AUD' | 'PERCENT' | 'RATIO' | 'COUNT' | 'YEARS';
  /**
   * Plain-English label for display next to the number, e.g. "Available
   * concessional cap headroom for FY24-25". Authored at tool-build time
   * (in code, reviewable) — not authored by the AI.
   */
  label: string;
  /** Citation IDs (subset of `ToolResult.citations[].id`) that justify this number. */
  citationIds: string[];
}

/**
 * A citation as returned by a tool. Builds on the existing
 * `AuthorityCitation` shape from `lib/tax-engine/types.ts` but adds
 * a stable `id` so the AI can reference it without quoting the text
 * verbatim.
 */
export interface IdentifiedCitation extends AuthorityCitation {
  /** Stable id within this `ToolResult`, e.g. `"cit-1"`. */
  id: string;
}

/**
 * Result of invoking a tool. The AI is shaped by this — it can ONLY
 * emit numbers from `numericFields` and ONLY cite entries in
 * `citations`. `narrativeText` is a paraphrase hint, never quoted.
 */
export interface ToolResult {
  /** Tool that produced this result (matches `TaxAdvisorTool.name`). */
  toolName: string;
  /** ISO-8601 timestamp the tool executed at. */
  computedAt: string;
  /**
   * Every number the AI may emit. The AI's response schema
   * (Phase 41h.1) enforces that numeric fields in its output
   * correspond to entries here.
   */
  numericFields: NumericField[];
  /** Authority citations attached to the underlying calc result. */
  citations: IdentifiedCitation[];
  /** UNCOMPUTED flags from the underlying calc — surfaced verbatim. */
  uncomputed: UncomputedFlag[];
  /**
   * Plain-English summary the AI MAY paraphrase but NOT quote
   * verbatim as authority. Any number embedded here must also
   * appear in `numericFields`. Any citation referenced must use the
   * `[cit:<id>]` token so the validator can resolve it.
   */
  narrativeText: string;
  /**
   * Raw underlying calc-engine result (typed by the tool definition).
   * The AI does NOT see this directly — it's available to the
   * dispatcher for response assembly + audit logging.
   */
  raw: unknown;
}

/**
 * A tool definition. Tools are pure functions: they accept a typed
 * input, call into the canonical Phase 41e/20 calc engines, and
 * return a `ToolResult`. They MUST NOT call external APIs, emit
 * recommendations, or invent numbers.
 */
export interface TaxAdvisorTool<TInput = unknown> {
  /** Stable identifier, e.g. `"getEntityTaxPosition"`. */
  name: string;
  /** Closed-set discriminant — see `ToolKind` JSDoc. */
  kind: ToolKind;
  /**
   * One-sentence description for the AI's tool-selection prompt.
   * MUST describe what facts the tool returns, NEVER imply it gives
   * advice or recommendations.
   */
  description: string;
  /**
   * JSON-schema-shaped contract for the tool's input. Used by the
   * AI's tool-selection layer (Phase 41h.2) and by the dispatcher
   * for runtime validation.
   */
  inputSchema: ToolInputSchema;
  /**
   * Pure function that executes the tool. MUST be deterministic —
   * same input → same output (relative to the underlying calc
   * engines' state, which is a function of the user's stored data).
   */
  execute: (input: TInput) => Promise<ToolResult> | ToolResult;
}

/**
 * Minimal JSON-schema subset for tool input contracts. Mirrors the
 * subset Gemini's function-calling API understands.
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
      description: string;
      enum?: readonly string[];
      items?:
        | ToolInputSchema
        | { type: 'string' | 'number' | 'boolean' }
        | { type: 'object' };
    }
  >;
  required: readonly string[];
}

/**
 * Per-question session state. The dispatcher maintains one of these
 * per AI question + accumulates every `ToolResult` so the validator
 * can resolve `numericFields` paths and `citation_ids` referenced in
 * the AI's response.
 */
export interface ToolSession {
  sessionId: string;
  startedAt: string;
  /** Every tool invocation in chronological order. */
  invocations: Array<{
    toolName: string;
    input: unknown;
    result: ToolResult;
  }>;
}

/**
 * Look up a numeric value across an entire session. Returns the
 * matching `NumericField` if any tool result in the session contains
 * it; otherwise `undefined`. Used by the response validator.
 */
export function findNumericFieldInSession(
  session: ToolSession,
  path: string,
): NumericField | undefined {
  for (const inv of session.invocations) {
    const found = inv.result.numericFields.find((n) => n.path === path);
    if (found) return found;
  }
  return undefined;
}

/**
 * Look up a citation across an entire session by composite id
 * `<toolName>#<id>` (because `id` is stable per-tool but two tools
 * may emit `cit-1`).
 */
export function findCitationInSession(
  session: ToolSession,
  compositeId: string,
): IdentifiedCitation | undefined {
  const [toolName, id] = compositeId.split('#');
  for (const inv of session.invocations) {
    if (inv.result.toolName !== toolName) continue;
    const found = inv.result.citations.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Convenience: get every citation across the session, suitable for
 * rendering in the boundary footer at the end of an AI response.
 */
export function collectSessionCitations(session: ToolSession): IdentifiedCitation[] {
  const seen = new Set<string>();
  const out: IdentifiedCitation[] = [];
  for (const inv of session.invocations) {
    for (const c of inv.result.citations) {
      const key = `${c.kind}|${c.reference}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Convenience: get every UNCOMPUTED flag across the session.
 */
export function collectSessionUncomputed(session: ToolSession): UncomputedFlag[] {
  const seen = new Set<string>();
  const out: UncomputedFlag[] = [];
  for (const inv of session.invocations) {
    for (const u of inv.result.uncomputed) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        out.push(u);
      }
    }
  }
  return out;
}
