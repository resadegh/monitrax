/**
 * UNIFIED TRANSACTION BY ID API
 * Phase 13 - Transactional Intelligence
 *
 * GET    - Get single transaction
 * PATCH  - Update transaction (category correction, tags, etc.)
 * DELETE - Delete transaction
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.5.2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// =============================================================================
// GET - Single Transaction
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const userId = authReq.user!.userId;

      const transaction = await prisma.unifiedTransaction.findUnique({
        where: { id },
        include: { account: true },
      });

      if (!transaction) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (transaction.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Get transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transaction' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// PATCH - Update Transaction (Category Correction, Tags)
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const userId = authReq.user!.userId;
      const body = await request.json();

      // Verify ownership
      const existing = await prisma.unifiedTransaction.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      // Category correction
      if (body.categoryLevel1 !== undefined) {
        updateData.categoryLevel1 = body.categoryLevel1;
        updateData.userCorrectedCategory = true;
        updateData.confidenceScore = 1.0;

        // Create merchant mapping for learning
        if (existing.merchantStandardised) {
          await prisma.merchantMapping.upsert({
            where: {
              userId_merchantRaw: {
                userId,
                merchantRaw: existing.merchantStandardised.toLowerCase(),
              },
            },
            update: {
              categoryLevel1: body.categoryLevel1,
              categoryLevel2: body.categoryLevel2 || null,
              subcategory: body.subcategory || null,
              confidence: 1.0,
              source: 'USER',
              usageCount: { increment: 1 },
            },
            create: {
              userId,
              merchantRaw: existing.merchantStandardised.toLowerCase(),
              merchantStandardised: existing.merchantStandardised,
              categoryLevel1: body.categoryLevel1,
              categoryLevel2: body.categoryLevel2 || null,
              subcategory: body.subcategory || null,
              confidence: 1.0,
              source: 'USER',
              usageCount: 1,
            },
          });
        }
      }

      if (body.categoryLevel2 !== undefined) {
        updateData.categoryLevel2 = body.categoryLevel2;
      }

      if (body.subcategory !== undefined) {
        updateData.subcategory = body.subcategory;
      }

      // Tags
      if (body.tags !== undefined) {
        updateData.tags = body.tags;
      }

      // Entity linking
      if (body.propertyId !== undefined) {
        updateData.propertyId = body.propertyId || null;
      }
      if (body.loanId !== undefined) {
        updateData.loanId = body.loanId || null;
      }
      if (body.incomeId !== undefined) {
        updateData.incomeId = body.incomeId || null;
      }
      if (body.expenseId !== undefined) {
        updateData.expenseId = body.expenseId || null;
      }

      // Recurring override
      if (body.isRecurring !== undefined) {
        updateData.isRecurring = body.isRecurring;
      }

      const transaction = await prisma.unifiedTransaction.update({
        where: { id },
        data: updateData,
        include: { account: true },
      });

      return NextResponse.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Update transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// DELETE - Delete Transaction
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const userId = authReq.user!.userId;

      // Verify ownership
      const existing = await prisma.unifiedTransaction.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (existing.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      await prisma.unifiedTransaction.delete({ where: { id } });

      return NextResponse.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
      console.error('Delete transaction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }
  });
}
