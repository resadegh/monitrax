/**
 * RENORMALIZE MERCHANTS API
 * Re-processes merchantStandardised for all transactions using updated merchant mappings
 *
 * POST - Trigger re-normalization of all transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { renormaliseMerchant } from '@/lib/bank';

// =============================================================================
// POST - Re-normalize All Merchant Names
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Get all transactions with merchantRaw
      const transactions = await prisma.unifiedTransaction.findMany({
        where: {
          userId,
          merchantRaw: { not: null },
        },
        select: {
          id: true,
          merchantRaw: true,
          merchantStandardised: true,
        },
      });

      let updated = 0;
      let unchanged = 0;

      // Re-normalize each transaction
      for (const tx of transactions) {
        if (!tx.merchantRaw) continue;

        const newStandardised = renormaliseMerchant(tx.merchantRaw);

        // Only update if different
        if (newStandardised !== tx.merchantStandardised) {
          await prisma.unifiedTransaction.update({
            where: { id: tx.id },
            data: { merchantStandardised: newStandardised },
          });
          updated++;
        } else {
          unchanged++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Re-normalized ${updated} transactions, ${unchanged} unchanged`,
        stats: {
          total: transactions.length,
          updated,
          unchanged,
        },
      });
    } catch (error) {
      console.error('Re-normalize error:', error);
      return NextResponse.json(
        { error: 'Failed to re-normalize transactions' },
        { status: 500 }
      );
    }
  });
}
