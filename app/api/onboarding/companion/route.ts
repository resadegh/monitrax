/**
 * POST /api/onboarding/companion — Phase 12 Track G (G.0)
 *
 * The onboarding companion. Given the current step + a minimal,
 * de-identified COUNTS-ONLY snapshot of what the user has entered, it
 * returns a short, warm, advice-free reflection (see
 * `lib/ai/onboarding-agent/companionGateway.ts`).
 *
 * The endpoint:
 *   1. Authenticates + checks `settings.write` (same gate as the
 *      onboarding extraction route — `/api/onboarding/chat/extract`).
 *   2. Validates the body — `step` and a small flat counts/flags
 *      `snapshot`. Non-number/boolean values are rejected: this enforces
 *      the "no names, no CDR values" contract server-side (Track G §5).
 *   3. Calls the companion gateway.
 *   4. Audits the call with SANITISED metadata — snapshot KEY NAMES
 *      only, never values (CDR §13.3).
 *
 * Rate limit: a shared "onboarding AI calls" budget — the daily cap
 * counts the `ONBOARDING_AGENT_EXTRACTION` audit action, which both the
 * extraction route and this route write. Track G G.0 deliberately does
 * not add a dedicated `AuditAction` (that would need a schema migration);
 * the reflection is a non-state-changing read and the shared cap protects
 * spend. A dedicated action can be added when Track G's full build lands.
 *
 * The companion is never a dependency: every failure here is non-fatal —
 * the client keeps the scripted step intro and the form works untouched.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import {
  generateCompanionReflection,
  isCompanionAvailable,
  type CompanionSnapshot,
} from '@/lib/ai/onboarding-agent/companionGateway';

const DAILY_CAP_PER_USER = 200;
const MAX_SNAPSHOT_KEYS = 12;

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
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        },
      },
      { status },
    );

  try {
    if (!isCompanionAvailable()) {
      return envelope(503, {
        success: false,
        data: null,
        error: {
          code: 'COMPANION_NOT_CONFIGURED',
          message: 'The companion is unavailable right now — your setup is unaffected.',
          details: null,
        },
      });
    }

    // Daily cap — shared "onboarding AI calls" budget with the extraction
    // route. The (userId, createdAt) index makes this count fast.
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
          message: 'Daily AI limit reached — your setup is unaffected.',
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

    const { step, snapshot } = body as { step?: unknown; snapshot?: unknown };

    if (step !== 'household') {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'step must be one of: household',
          details: null,
        },
      });
    }

    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'snapshot must be an object',
          details: null,
        },
      });
    }

    // Enforce the counts/flags-only contract: every value must be a
    // number or boolean. A string would imply PII (a name) leaked into
    // the snapshot — reject it rather than forward it to the LLM.
    const entries = Object.entries(snapshot as Record<string, unknown>);
    if (entries.length === 0 || entries.length > MAX_SNAPSHOT_KEYS) {
      return envelope(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `snapshot must have 1-${MAX_SNAPSHOT_KEYS} keys`,
          details: null,
        },
      });
    }
    const cleanSnapshot: CompanionSnapshot = {};
    for (const [key, value] of entries) {
      if (typeof value !== 'number' && typeof value !== 'boolean') {
        return envelope(400, {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'snapshot values must be numbers or booleans (counts/flags only)',
            details: null,
          },
        });
      }
      cleanSnapshot[key] = value;
    }

    const result = await generateCompanionReflection({
      step: 'household',
      snapshot: cleanSnapshot,
    });

    if (!result.ok) {
      void createAuditLog({
        userId,
        action: 'ONBOARDING_AGENT_EXTRACTION',
        status: 'FAILURE',
        metadata: sanitizeCdrMetadata({
          kind: 'companion_reflection',
          step,
          reason: result.reason,
        }),
      });
      const statusForReason: Record<typeof result.reason, number> = {
        ANTHROPIC_NOT_CONFIGURED: 503,
        PROVIDER_ERROR: 502,
        EMPTY: 502,
      };
      return envelope(statusForReason[result.reason], {
        success: false,
        data: null,
        error: {
          code: result.reason,
          message: 'The companion is taking a break — your setup is unaffected.',
          details: null,
        },
      });
    }

    // Success — audit with snapshot KEY NAMES only, never values
    // (CDR §13.3). The snapshot is already counts-only, but auditing
    // keys not values keeps the discipline uniform.
    void createAuditLog({
      userId,
      action: 'ONBOARDING_AGENT_EXTRACTION',
      status: 'SUCCESS',
      metadata: sanitizeCdrMetadata({
        kind: 'companion_reflection',
        step,
        snapshotKeys: Object.keys(cleanSnapshot),
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      }),
    });

    return envelope(200, {
      success: true,
      data: { message: result.message },
      error: null,
    });
  } catch (error) {
    console.error('POST /api/onboarding/companion failed:', error);
    return envelope(500, {
      success: false,
      data: null,
      error: {
        code: 'ONBOARDING_COMPANION_FAILED',
        message: 'Could not generate a reflection',
        details: null,
      },
    });
  }
});
