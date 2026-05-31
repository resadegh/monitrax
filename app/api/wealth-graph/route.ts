/**
 * /api/wealth-graph — GET the user's wealth-graph snapshot for the
 * Wealth Universe canvas.
 *
 * Thin route — all logic lives in `lib/services/wealthGraphService.ts`
 * (CLAUDE.md §6.1, §12.2 SSOT). Auth gated via `withPermission('entity.read')`.
 *
 * Distinct from `/api/master-snapshot` (financial breakdowns) and
 * `/api/portfolio/snapshot` (aggregated counts + GRDCS health). This is
 * the third SSOT — the relational graph SSOT, returning individual
 * entities + individual assets + relationship edges, ready for the
 * canvas layout function to position.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getWealthGraphSnapshot } from '@/lib/services/wealthGraphService';

export const GET = withPermission('entity.read', async (_request, context) => {
  const startedAt = Date.now();
  try {
    const snapshot = await getWealthGraphSnapshot(context.userId);
    return NextResponse.json({
      success: true,
      data: snapshot,
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'WEALTH_GRAPH_FAILED',
          message: 'Failed to load wealth graph',
          details: process.env.NODE_ENV === 'development' ? message : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        },
      },
      { status: 500 },
    );
  }
});
