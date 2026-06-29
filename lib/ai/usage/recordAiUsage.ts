/**
 * Neobrain AI-usage telemetry writer (Phase 54 — instrumentation).
 *
 * One canonical, fire-and-forget recorder for every Gemini completion call.
 * Writes a single `AiUsageEvent` row (counts + estimated cost + surface +
 * model) so the admin AI-usage panel can aggregate "where does AI spend go?"
 * — the measurable baseline for the model-tiering cost/quality decision.
 *
 * Design rules:
 * - **Never blocks, never throws.** Mirrors the `createAuditLog()` pattern
 *   (CLAUDE.md §12.10): the write is fire-and-forget with a swallowed catch,
 *   so a telemetry hiccup can never degrade an AI response.
 * - **No CDR data, no PII.** Only token counts, the model id, the surface
 *   label, an optional userId, and the already-computed USD cost are stored —
 *   never prompt or response content (CLAUDE.md §13.3).
 * - **SSOT for cost.** The caller passes the cost it already computed from
 *   `getModelPricing()` (lib/ai/google/modelConfig.ts); this module does NOT
 *   re-derive pricing (§12.2.1 — one cost formula).
 */

import { prisma } from '@/lib/db';

/** Canonical surface labels — keep stable so aggregation buckets don't fragment. */
export type AiUsageSurface =
  | 'categorisation'
  | 'cfo-advisor'
  | 'debt-analysis'
  | 'financial-advisor'
  | 'cashflow-summary'
  | 'tax-advisor'
  | 'unknown';

export interface AiUsageRecord {
  surface: AiUsageSurface | string;
  /** The model the call actually used (post-fallback). */
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD cost the caller already computed (token counts × getModelPricing). */
  estimatedCostUsd: number;
  /** Owning user when in a user context; omit for system calls. */
  userId?: string | null;
  /** False when the call ultimately failed (all fallbacks exhausted). */
  success?: boolean;
}

/**
 * Record one AI-usage event. Fire-and-forget — call WITHOUT `await` from the
 * AI hot path; the returned promise resolves to `void` and never rejects.
 */
export function recordAiUsage(record: AiUsageRecord): void {
  // Defensive: coerce to finite non-negative integers/number so a malformed
  // usage payload can never throw at the DB layer.
  const safeInt = (n: number | undefined): number =>
    Number.isFinite(n) && (n as number) > 0 ? Math.round(n as number) : 0;
  const safeCost = Number.isFinite(record.estimatedCostUsd) && record.estimatedCostUsd > 0
    ? record.estimatedCostUsd
    : 0;

  void prisma.aiUsageEvent
    .create({
      data: {
        surface: record.surface || 'unknown',
        model: record.model || 'unknown',
        userId: record.userId ?? null,
        promptTokens: safeInt(record.promptTokens),
        completionTokens: safeInt(record.completionTokens),
        totalTokens: safeInt(record.totalTokens),
        estimatedCostUsd: safeCost,
        success: record.success ?? true,
      },
    })
    .catch(() => {
      // Telemetry is best-effort. Never let it surface to the user or the
      // AI call. (Matches the audit-log fire-and-forget contract.)
    });
}
