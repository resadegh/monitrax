/**
 * POST /api/onboarding/chat/topic-confirmed — Phase 12 §E.5.
 *
 * Fires when the user taps "Looks right" on a per-topic recap card
 * in chat-mode. Writes a single `ONBOARDING_AGENT_TOPIC_CONFIRMED`
 * audit row with the topic name + sanitised field-name list.
 *
 * No DB writes beyond the audit log — the staged WizardData is
 * persisted via the existing `/api/onboarding/state` saveDraft path
 * (which the chat orchestrator calls just before this endpoint).
 *
 * Audit metadata carries field NAMES only, never values
 * (CDR §13.3 + Phase 12 §E.5).
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

const SUPPORTED_TOPICS = new Set(['household', 'properties', 'debts', 'accounts', 'super', 'assets']);

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
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
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') {
      return envelope(400, {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Body must be JSON', details: null },
      });
    }

    const { topic, deltaFieldNames } = body as {
      topic?: unknown;
      deltaFieldNames?: unknown;
    };

    if (typeof topic !== 'string' || !SUPPORTED_TOPICS.has(topic)) {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'topic must be one of: household, properties, debts, accounts, super, assets',
          details: null,
        },
      });
    }

    const fieldNames = Array.isArray(deltaFieldNames)
      ? (deltaFieldNames as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 30)
      : [];

    void createAuditLog({
      userId: auth.userId,
      action: 'ONBOARDING_AGENT_TOPIC_CONFIRMED',
      status: 'SUCCESS',
      metadata: sanitizeCdrMetadata({
        topic,
        deltaFieldNames: fieldNames,
      }),
    });

    return envelope(200, {
      success: true,
      data: { ok: true },
      error: null,
    });
  } catch (error) {
    console.error('POST /api/onboarding/chat/topic-confirmed failed:', error);
    return envelope(500, {
      success: false,
      data: null,
      error: {
        code: 'ONBOARDING_CHAT_CONFIRM_FAILED',
        message: 'Could not confirm topic',
        details: null,
      },
    });
  }
});
