/**
 * RENORMALIZE MERCHANTS API
 * Re-processes merchantStandardised for all transactions using updated merchant mappings
 *
 * POST - Trigger re-normalization of all transactions
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { renameAllMerchants } from '@/lib/bank/recategoriseExisting';

// =============================================================================
// POST - Re-normalize All Merchant Names
// =============================================================================
// Thin wrapper (§12.3): the cosmetic all-rows name tidy-up lives in the one
// canonical service (`renameAllMerchants`) shared with the "Re-scan existing"
// backfill — no parallel loop (§12.2.1).

export const POST = withPermission('transaction.write', async (_request, auth) => {
    try {
      const updated = await renameAllMerchants(auth.userId);
      return NextResponse.json({
        success: true,
        message: `Re-normalized ${updated} transactions`,
        stats: { updated },
      });
    } catch (error) {
      console.error('Re-normalize error:', error);
      return NextResponse.json(
        { error: 'Failed to re-normalize transactions' },
        { status: 500 }
      );
    }
});
