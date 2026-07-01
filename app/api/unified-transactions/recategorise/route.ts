/**
 * Phase 54.2d — re-categorise EXISTING uncategorised transactions.
 *
 * POST /api/unified-transactions/recategorise
 *
 * User-triggered backfill: re-runs the current DETERMINISTIC categoriser + the
 * P1/P2 merchant-noise denoiser over the user's existing uncategorised rows, so
 * the engine improvements apply to data already in the ledger — not just new
 * imports. Cost-free (no paid LLM), and NEVER overwrites a category the user set
 * (§12.11). Thin wrapper (§12.3): all logic lives in the canonical service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { recategoriseUncategorised } from '@/lib/bank/recategoriseExisting';

export const POST = withPermission('transaction.write', async (_request: NextRequest, auth) => {
  try {
    const result = await recategoriseUncategorised(auth.userId);
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
