/**
 * POST /api/onboarding/chat/extract — Phase 12 §E.1 + §E.5
 *
 * The chat surface calls this endpoint with the user's free-text
 * reply + the current topic + the subset of staged state for that
 * topic. The endpoint:
 *   1. Authenticates + checks `settings.write` permission (same gate
 *      as the form-wizard's `/api/onboarding/estimates/*` routes).
 *   2. Validates the request body (topic, message length, transcript
 *      shape).
 *   3. Calls the onboarding-agent gateway (`lib/ai/onboarding-agent/gateway.ts`).
 *   4. Audits the extraction with SANITISED metadata — field NAMES
 *      only, never values (CDR §13.3).
 *   5. Returns the structured `WizardStateDelta` in the standard
 *      `{ success, data, error, meta }` envelope.
 *
 * Rate limit:
 *   200 extractions / user / day, enforced via existing audit-log
 *   count over a 24h window. Phase 12 §E.5 specifies this cap.
 *
 * Failure modes:
 *   - 400 — validation (body malformed, topic unsupported, message
 *     too long).
 *   - 429 — daily cap exceeded.
 *   - 503 — Anthropic not configured (env key absent — chat surface
 *     should detect this client-side and hide the chat toggle, but
 *     this is the server-side fallback).
 *   - 502 — provider error from Anthropic.
 *   - 422 — LLM returned a tool call but the input failed schema
 *     validation. Treated as "no extraction" — chat client should
 *     ask the user to rephrase.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import {
  extractWizardStepDelta,
  isOnboardingAgentAvailable,
  type ExtractRequest,
} from '@/lib/ai/onboarding-agent/gateway';

const MAX_USER_MESSAGE_LEN = 1000;
const MAX_TRANSCRIPT_TURNS = 4;
const DAILY_CAP_PER_USER = 200;

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
  const userId = auth.userId;

  const envelope = (
    status: number,
    body: { success: boolean; data: unknown; error: unknown },
  ) =>
    NextResponse.json(
      {
        ...body,
        meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
      },
      { status },
    );

  try {
    if (!isOnboardingAgentAvailable()) {
      return envelope(503, {
        success: false,
        data: null,
        error: {
          code: 'AGENT_NOT_CONFIGURED',
          message: 'Chat-mode is temporarily unavailable. Try the form instead.',
          details: null,
        },
      });
    }

    // Daily cap — count successful extractions in the last 24h. Reads
    // the user's audit trail; the table is already indexed by
    // (userId, createdAt) so this is fast.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todaysCount = await prisma.auditLog.count({
      where: {
        userId,
        action: 'ONBOARDING_AGENT_EXTRACTION',
        createdAt: { gte: since },
      },
    });
    if (todaysCount >= DAILY_CAP_PER_USER) {
      return envelope(429, {
        success: false,
        data: null,
        error: {
          code: 'DAILY_CAP_EXCEEDED',
          message: 'Daily chat limit reached. Try the form instead.',
          details: null,
        },
      });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') {
      return envelope(400, {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Body must be JSON', details: null },
      });
    }

    const {
      topic,
      userMessage,
      currentStateSubset,
      recentTranscript,
    } = body as Partial<ExtractRequest>;

    if (topic !== 'household') {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'topic must be "household" (v1 supports household only)',
          details: null,
        },
      });
    }

    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userMessage required',
          details: null,
        },
      });
    }

    if (userMessage.length > MAX_USER_MESSAGE_LEN) {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `userMessage exceeds ${MAX_USER_MESSAGE_LEN} chars`,
          details: null,
        },
      });
    }

    const transcript = Array.isArray(recentTranscript)
      ? recentTranscript.slice(-MAX_TRANSCRIPT_TURNS).filter(
          (t): t is { role: 'agent' | 'user'; text: string } =>
            t !== null &&
            typeof t === 'object' &&
            (t as { role?: unknown }).role !== undefined &&
            ((t as { role: string }).role === 'agent' ||
              (t as { role: string }).role === 'user') &&
            typeof (t as { text?: unknown }).text === 'string',
        )
      : [];

    const subset =
      currentStateSubset && typeof currentStateSubset === 'object'
        ? currentStateSubset
        : {};

    const result = await extractWizardStepDelta({
      topic: 'household',
      userMessage: userMessage.trim(),
      currentStateSubset: subset,
      recentTranscript: transcript,
    });

    if (!result.ok) {
      // Audit the failure with sanitised reason — never the message
      // body, never the user's input verbatim.
      void createAuditLog({
        userId,
        action: 'ONBOARDING_AGENT_EXTRACTION',
        status: 'FAILURE',
        metadata: sanitizeCdrMetadata({
          topic: 'household',
          reason: result.reason,
        }),
      });
      const statusForReason: Record<typeof result.reason, number> = {
        ANTHROPIC_NOT_CONFIGURED: 503,
        NO_TOOL_USE: 422,
        SCHEMA_VIOLATION: 422,
        PROVIDER_ERROR: 502,
        INVALID_TOPIC: 400,
      };
      return envelope(statusForReason[result.reason], {
        success: false,
        data: null,
        error: {
          code: result.reason,
          message:
            result.reason === 'SCHEMA_VIOLATION' || result.reason === 'NO_TOOL_USE'
              ? 'Could not understand the answer. Please rephrase.'
              : 'Chat-mode hit an issue. Try again or switch to the form.',
          details: null,
        },
      });
    }

    // Success — audit with FIELD NAMES only (per Phase 12 §E.5 +
    // CLAUDE.md §13.3). Never values.
    const deltaFieldNames = Object.keys(result.delta.fields);
    void createAuditLog({
      userId,
      action: 'ONBOARDING_AGENT_EXTRACTION',
      status: 'SUCCESS',
      metadata: sanitizeCdrMetadata({
        topic: result.delta.topic,
        deltaFieldNames,
        unresolvedCount: result.delta.unresolved.length,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      }),
    });

    return envelope(200, {
      success: true,
      data: { delta: result.delta },
      error: null,
    });
  } catch (error) {
    console.error('POST /api/onboarding/chat/extract failed:', error);
    return envelope(500, {
      success: false,
      data: null,
      error: {
        code: 'ONBOARDING_CHAT_EXTRACT_FAILED',
        message: 'Could not process chat message',
        details: null,
      },
    });
  }
});
