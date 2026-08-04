/**
 * Phase 40 — POST /api/cfo/advice
 *
 * Returns the user's current AI Financial Advice document. Behaviour:
 *
 *   • If a non-expired document exists for this user, return it as-is.
 *     Stability is the contract: minor data drift does NOT trigger
 *     regeneration. The document includes `isStale: true` if the
 *     underlying snapshot has shifted materially since generation,
 *     which the UI can use to show a "refresh advice" prompt.
 *
 *   • If no document exists (or one is stale AND `forceRegenerate=true`),
 *     a fresh advice doc is generated via Gemini Pro and persisted with
 *     a 24h TTL.
 *
 * Auth: requires `report.read` permission (matches the existing /api/cfo).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { generateOrFetchAdvice } from '@/lib/cfo';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

async function handle(request: NextRequest, auth: { userId: string }) {
  // Covers the direct POST export below; GET carries its own guard.
  const gateBlocked = await moduleApiGuard('MODULE_CFO');
  if (gateBlocked) return gateBlocked;
  let forceRegenerate = false;
  try {
    const body = await request.json().catch(() => ({}));
    forceRegenerate = !!body?.forceRegenerate;
  } catch {
    // empty body is fine
  }

  try {
    const doc = await generateOrFetchAdvice({
      userId: auth.userId,
      forceRegenerate,
    });

    // Audit-log the generation event. CDR-safe metadata only — no balances,
    // no transaction text, no payee names. Per CLAUDE.md §13.3.
    createAuditLog({
      userId: auth.userId,
      action: 'AI_ADVICE_GENERATED',
      entityType: 'AIAdviceDocument',
      entityId: doc.id,
      metadata: sanitizeCdrMetadata({
        trailStage: doc.trailStage,
        recommendationCount: doc.recommendations.length,
        isFallback: doc.isFallback,
        isStale: doc.isStale,
        forceRegenerate,
        model: doc.meta.model,
        tokensUsed: doc.meta.tokensUsed,
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error('[/api/cfo/advice] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADVICE_GENERATION_FAILED',
          message: 'Could not generate financial advice right now. Please try again shortly.',
        },
      },
      { status: 500 }
    );
  }
}

export const POST = withPermission('report.read', handle);
// GET form is convenient — same semantics, no body, never force-regenerate.
export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO');
    if (gateBlocked) return gateBlocked;
  // Re-use the same handler; the body parser will gracefully fall back to
  // forceRegenerate=false on an empty body.
  return handle(request, auth);
});
