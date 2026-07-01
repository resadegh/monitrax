/**
 * Phase 54.2d — re-categorise EXISTING uncategorised transactions.
 *
 * POST /api/unified-transactions/recategorise   body: { useAI?: boolean }
 *
 * User-triggered backfill: re-runs the current DETERMINISTIC categoriser + the
 * P1/P2 merchant-noise denoiser over the user's existing uncategorised rows, so
 * the engine improvements apply to data already in the ledger — not just new
 * imports. Deterministic pass is cost-free (no paid LLM).
 *
 * When `useAI: true` (Phase 54.2g, opt-in), a COST-BOUNDED Gemini tail proposes a
 * category for the merchants the deterministic layers still miss — one call per
 * DISTINCT merchant, capped per run, written as an unconfirmed SUGGESTION (never
 * auto-filed, §54.2). NEVER overwrites a category the user set (§12.11). Thin
 * wrapper (§12.3): all logic lives in the canonical service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { recategoriseUncategorised } from '@/lib/bank/recategoriseExisting';

export const POST = withPermission('transaction.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { useAI?: boolean };
    const result = await recategoriseUncategorised(auth.userId, { useAI: body.useAI === true });
    return NextResponse.json({
      success: true,
      data: result,
      error: null,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[recategorise] backfill failed:', err);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'RECATEGORISE_FAILED', message: 'Could not re-scan transactions.', details: null },
      },
      { status: 500 }
    );
  }
});
