/**
 * Phase 41h.1 — AI Policy Gateway.
 *
 * **Single entry point for every Gemini (or future Claude / OpenAI)
 * call in the app.** No code outside `lib/ai/tax-advisor/` should
 * call a provider SDK directly. Reviewers reject any PR that does.
 *
 * Pipeline (per call):
 *   1. Generate trace ID + start clock
 *   2. Build the Monitrax system prompt (persona + tool catalogue)
 *   3. Construct the tool session (empty)
 *   4. Hand off to the provider with an `executeTool` callback
 *      that records every tool call into the session
 *   5. Provider returns raw structured output
 *   6. Zod-validate the shape (catches malformed responses)
 *   7. HR-1/HR-2/D-2 validate against the session (catches fabrications)
 *   8. Assemble citations + UNCOMPUTED + AFSL boundary
 *   9. Audit-log the outcome
 *  10. Return a typed `GatewayResponse`
 *
 * **Failure modes** — the gateway never throws to the caller. Every
 * failure produces a structured `GatewayResponse` with `status` set
 * appropriately. Callers render based on status:
 *   - `OK` → render the answer
 *   - `BLOCKED_VALIDATION` → render a fallback "I couldn't produce a
 *     reliable answer; please rephrase or Ask a Pro" surface
 *   - `BLOCKED_RECOMMENDATION` → automatic Tier 2 routing (Ask-a-Pro)
 *   - `PROVIDER_ERROR` → "AI is temporarily unavailable" + log
 *   - `SCHEMA_INVALID` → same fallback as BLOCKED_VALIDATION
 */

import { ZodError } from 'zod';

import {
  collectSessionCitations,
  collectSessionUncomputed,
  type IdentifiedCitation,
  type ToolSession,
  type ToolResult,
} from './types';
import {
  parseRawAIResponse,
  type RawAIResponse,
} from './policy/responseSchema';
import {
  validateAIResponse,
  type ValidationIssue,
  type ValidationOutcome,
} from './policy/validators';
import { buildSystemPrompt } from './policy/systemPrompt';
import {
  ConsoleAuditSink,
  type AuditEntry,
  type AuditSink,
  type AuditOutcome,
} from './audit/auditLogger';
import {
  renderBoundaryFootnote,
  type BoundaryFootnote,
} from '@/lib/tax-engine/boundaries';
import type { UncomputedFlag } from '@/lib/tax-engine/types';
import type { AIProvider } from './providers/types';
import { ProviderError } from './providers/types';
import { taxAdvisorToolRegistry } from './registry';

// ---------- Public types ----------

export type GatewayStatus =
  | 'OK'
  | 'BLOCKED_VALIDATION'
  | 'BLOCKED_RECOMMENDATION'
  | 'PROVIDER_ERROR'
  | 'SCHEMA_INVALID';

export interface GatewayAskInput {
  userId: string;
  question: string;
  /**
   * Optional FY label for the boundary footer; defaults to
   * "current FY" if omitted.
   */
  fyLabel?: string;
  /**
   * Subset of the tool registry to expose for this call. Defaults
   * to the full registry. Use to scope tools (e.g. profession-aware
   * surfaces in 41h.3).
   */
  allowedTools?: string[];
}

export interface GatewayResponse {
  traceId: string;
  status: GatewayStatus;
  /** The validated answer — present only when `status === 'OK'`. */
  answer?: RawAIResponse;
  /**
   * Aggregated citations across every tool call this turn made.
   * Always populated (empty array if no tools ran).
   */
  citations: IdentifiedCitation[];
  /** Aggregated UNCOMPUTED flags across every tool call. */
  uncomputed: UncomputedFlag[];
  /** AFSL/TPB/NCCP boundary footer for renderer use. */
  boundary: BoundaryFootnote;
  /** Validation issues — present when `status` indicates rejection. */
  validationIssues?: ValidationIssue[];
  /** Underlying provider error message (sanitised). */
  providerError?: string;
  /** Per-call observability. */
  durationMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface GatewayOptions {
  provider: AIProvider;
  auditSink?: AuditSink;
  /**
   * Inject a clock for deterministic tests. Defaults to `Date.now`.
   */
  now?: () => number;
  /** Inject an id generator for deterministic tests. */
  generateTraceId?: () => string;
}

// ---------- Gateway implementation ----------

export interface TaxAdvisorGateway {
  ask(input: GatewayAskInput): Promise<GatewayResponse>;
}

/**
 * Create a gateway. Industry-standard pattern: factory returning an
 * object with the public surface, dependencies injected via options.
 * Allows unit-testing without globals.
 */
export function createTaxAdvisorGateway(
  options: GatewayOptions,
): TaxAdvisorGateway {
  const auditSink = options.auditSink ?? new ConsoleAuditSink();
  const now = options.now ?? (() => Date.now());
  const generateTraceId =
    options.generateTraceId ?? (() => `trace_${randomId()}`);

  return {
    async ask(input: GatewayAskInput): Promise<GatewayResponse> {
      const traceId = generateTraceId();
      const startedAt = now();
      const session: ToolSession = {
        sessionId: traceId,
        startedAt: new Date(startedAt).toISOString(),
        invocations: [],
      };

      // Resolve allowed tools.
      const tools = options.allowedToolsResolver
        ? options.allowedToolsResolver(input.allowedTools)
        : resolveTools(input.allowedTools);

      const fyLabel = input.fyLabel ?? 'current FY';

      let outcome: AuditOutcome = 'OK';
      let response: GatewayResponse;

      try {
        const providerResult = await options.provider.invoke({
          systemPrompt: buildSystemPrompt(tools),
          userMessage: input.question,
          tools,
          executeTool: async (toolName, toolInput) => {
            const tool = taxAdvisorToolRegistry.get(toolName);
            if (!tool) {
              throw new ProviderError(
                `Tool "${toolName}" not registered (D-2: tool registry is the closed set of allowed actions).`,
                options.provider.name,
              );
            }
            const result = await tool.execute(toolInput);
            session.invocations.push({
              toolName,
              input: toolInput,
              result,
            });
            return result;
          },
          traceId,
        });

        // Tool invocations recorded in `session` via the callback above.
        // (Provider may also return them in `toolInvocations`; we use the
        // session as source of truth since the callback is the only path
        // executeTool() takes.)

        // 1. Shape validation.
        let parsed: RawAIResponse;
        try {
          parsed = parseRawAIResponse(providerResult.rawAnswer);
        } catch (err) {
          outcome = 'SCHEMA_INVALID';
          response = {
            traceId,
            status: 'SCHEMA_INVALID',
            citations: collectSessionCitations(session),
            uncomputed: collectSessionUncomputed(session),
            boundary: renderBoundaryFootnote({
              citations: collectSessionCitations(session),
              uncomputed: collectSessionUncomputed(session),
              fyLabel,
            }),
            validationIssues: schemaErrorToIssues(err),
            durationMs: now() - startedAt,
            tokenUsage: providerResult.tokenUsage,
          };
          await safeWriteAudit(auditSink, buildAuditEntry(traceId, input.userId, options.provider.name, session, outcome, response, providerResult.tokenUsage));
          return response;
        }

        // 2. HR-1/HR-2/D-2 validation against the session.
        const validation = validateAIResponse(parsed, session);
        if (!validation.ok) {
          outcome = validation.issues.some(
            (i) => i.code === 'D2_RECOMMENDATION_LEAK',
          )
            ? 'BLOCKED_RECOMMENDATION'
            : 'BLOCKED_VALIDATION';

          response = {
            traceId,
            status:
              outcome === 'BLOCKED_RECOMMENDATION'
                ? 'BLOCKED_RECOMMENDATION'
                : 'BLOCKED_VALIDATION',
            citations: collectSessionCitations(session),
            uncomputed: collectSessionUncomputed(session),
            boundary: renderBoundaryFootnote({
              citations: collectSessionCitations(session),
              uncomputed: collectSessionUncomputed(session),
              fyLabel,
            }),
            validationIssues: validation.issues,
            durationMs: now() - startedAt,
            tokenUsage: providerResult.tokenUsage,
          };
          await safeWriteAudit(auditSink, buildAuditEntry(traceId, input.userId, options.provider.name, session, outcome, response, providerResult.tokenUsage));
          return response;
        }

        // 3. OK — assemble final response.
        response = {
          traceId,
          status: 'OK',
          answer: parsed,
          citations: collectSessionCitations(session),
          uncomputed: collectSessionUncomputed(session),
          boundary: renderBoundaryFootnote({
            citations: collectSessionCitations(session),
            uncomputed: collectSessionUncomputed(session),
            fyLabel,
          }),
          durationMs: now() - startedAt,
          tokenUsage: providerResult.tokenUsage,
        };
        await safeWriteAudit(auditSink, buildAuditEntry(traceId, input.userId, options.provider.name, session, 'OK', response, providerResult.tokenUsage));
        return response;
      } catch (err) {
        outcome = 'PROVIDER_ERROR';
        const message =
          err instanceof ProviderError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Unknown provider error';
        response = {
          traceId,
          status: 'PROVIDER_ERROR',
          citations: collectSessionCitations(session),
          uncomputed: collectSessionUncomputed(session),
          boundary: renderBoundaryFootnote({
            citations: collectSessionCitations(session),
            uncomputed: collectSessionUncomputed(session),
            fyLabel,
          }),
          providerError: message,
          durationMs: now() - startedAt,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
        };
        await safeWriteAudit(auditSink, buildAuditEntry(traceId, input.userId, options.provider.name, session, outcome, response, response.tokenUsage));
        return response;
      }
    },
  };
}

// ---------- Helpers ----------

function resolveTools(allowed?: string[]) {
  const all = taxAdvisorToolRegistry.list();
  if (!allowed) return all;
  return all.filter((t) => allowed.includes(t.name));
}

function buildAuditEntry(
  traceId: string,
  userId: string,
  provider: string,
  session: ToolSession,
  outcome: AuditOutcome,
  response: GatewayResponse,
  tokenUsage: ProviderTokenUsage,
): AuditEntry {
  return {
    traceId,
    userId,
    timestamp: new Date().toISOString(),
    provider,
    toolsInvoked: session.invocations.map((i) => i.toolName),
    outcome,
    validationIssueCount: response.validationIssues?.length ?? 0,
    validationIssueCodes:
      response.validationIssues?.map((i) => i.code) ?? [],
    durationMs: response.durationMs,
    tokenUsage,
  };
}

async function safeWriteAudit(sink: AuditSink, entry: AuditEntry): Promise<void> {
  try {
    await sink.write(entry);
  } catch {
    // Audit failure must never crash the response path. Production
    // wiring (Cloud Logging) uses a fire-and-forget pattern.
  }
}

function schemaErrorToIssues(err: unknown): ValidationIssue[] {
  if (err instanceof ZodError) {
    return err.errors.map((e, i) => ({
      code: 'HR1_NUMBER_NOT_IN_SESSION' as const,
      segmentIndex: i,
      detail: `Schema error at ${e.path.join('.')}: ${e.message}`,
    }));
  }
  return [
    {
      code: 'HR1_NUMBER_NOT_IN_SESSION' as const,
      segmentIndex: -1,
      detail: 'Provider returned malformed output',
    },
  ];
}

function randomId(): string {
  // Sufficient entropy for trace IDs; not security-critical.
  return Math.random().toString(36).slice(2, 12);
}

interface ProviderTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

// Allow injection of a custom resolver (used in tests; production
// always relies on the registry).
declare module './gateway' {
  interface GatewayOptions {
    allowedToolsResolver?: (allowed?: string[]) => ReturnType<typeof resolveTools>;
  }
}

export { resolveTools };
export type { ValidationOutcome };
