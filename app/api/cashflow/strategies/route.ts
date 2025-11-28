/**
 * CASHFLOW STRATEGIES API
 * Phase 14 - GET/PATCH /api/cashflow/strategies
 *
 * Returns and manages cashflow optimisation strategies.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/cashflow/strategies
 *
 * Query params:
 * - type: filter by strategy type
 * - status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED'
 * - limit: number of strategies to return (default: 20)
 *
 * Returns cashflow strategies from database
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      // Build where clause
      const where: any = { userId };

      if (type) {
        where.type = type;
      }
      if (status) {
        where.status = status;
      } else {
        // Default to showing pending strategies
        where.status = 'PENDING';
      }

      // Fetch strategies
      const strategies = await prisma.cashflowStrategy.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      // Get counts by type
      const typeCounts = await prisma.cashflowStrategy.groupBy({
        by: ['type'],
        where: { userId, status: 'PENDING' },
        _count: { type: true },
      });

      // Calculate total potential benefit
      const totalBenefit = strategies.reduce(
        (sum: number, s: any) => sum + Number(s.projectedBenefit),
        0
      );

      return NextResponse.json({
        success: true,
        data: {
          strategies: strategies.map((s: any) => ({
            id: s.id,
            type: s.type,
            priority: s.priority,
            title: s.title,
            summary: s.summary,
            detail: s.detail,
            confidence: s.confidence,
            projectedBenefit: s.projectedBenefit,
            recommendedSteps: s.recommendedSteps,
            impactAnalysis: s.impactAnalysis,
            affectedAccountIds: s.affectedAccountIds,
            affectedLoanIds: s.affectedLoanIds,
            status: s.status,
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
          })),
          summary: {
            total: strategies.length,
            totalPotentialBenefit: totalBenefit,
            byType: Object.fromEntries(
              typeCounts.map((t: any) => [t.type, t._count.type])
            ),
          },
        },
      });
    } catch (error) {
      console.error('Cashflow strategies API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch cashflow strategies',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/cashflow/strategies
 *
 * Body:
 * {
 *   strategyId: string,
 *   action: 'accept' | 'dismiss',
 *   dismissReason?: string
 * }
 *
 * Update strategy status
 */
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();
      const { strategyId, action, dismissReason } = body;

      if (!strategyId || !action) {
        return NextResponse.json(
          {
            success: false,
            error: 'strategyId and action are required',
          },
          { status: 400 }
        );
      }

      // Verify ownership
      const strategy = await prisma.cashflowStrategy.findFirst({
        where: { id: strategyId, userId },
      });

      if (!strategy) {
        return NextResponse.json(
          {
            success: false,
            error: 'Strategy not found',
          },
          { status: 404 }
        );
      }

      // Update based on action
      const updateData: any = {};
      switch (action) {
        case 'accept':
          updateData.status = 'ACCEPTED';
          updateData.acceptedAt = new Date();
          break;
        case 'dismiss':
          updateData.status = 'DISMISSED';
          updateData.dismissedAt = new Date();
          if (dismissReason) {
            updateData.dismissReason = dismissReason;
          }
          break;
        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid action. Must be: accept or dismiss',
            },
            { status: 400 }
          );
      }

      const updated = await prisma.cashflowStrategy.update({
        where: { id: strategyId },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          acceptedAt: updated.acceptedAt,
          dismissedAt: updated.dismissedAt,
        },
      });
    } catch (error) {
      console.error('Update cashflow strategy error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update strategy',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
