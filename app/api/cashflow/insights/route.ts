/**
 * CASHFLOW INSIGHTS API
 * Phase 14 - GET /api/cashflow/insights
 *
 * Returns cashflow-specific insights.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/cashflow/insights
 *
 * Query params:
 * - severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' (filter by severity)
 * - category: filter by category
 * - unread: 'true' to show only unread insights
 * - limit: number of insights to return (default: 20)
 *
 * Returns cashflow insights from database
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);
      const severity = searchParams.get('severity');
      const category = searchParams.get('category');
      const unreadOnly = searchParams.get('unread') === 'true';
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      // Build where clause
      const where: any = { userId };

      if (severity) {
        where.severity = severity;
      }
      if (category) {
        where.category = category;
      }
      if (unreadOnly) {
        where.isRead = false;
        where.isDismissed = false;
      }

      // Fetch insights
      const insights = await prisma.cashflowInsight.findMany({
        where,
        orderBy: [
          { severity: 'asc' }, // CRITICAL first
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      // Get counts by severity
      const severityCounts = await prisma.cashflowInsight.groupBy({
        by: ['severity'],
        where: { userId, isDismissed: false },
        _count: { severity: true },
      });

      // Get unread count
      const unreadCount = await prisma.cashflowInsight.count({
        where: { userId, isRead: false, isDismissed: false },
      });

      return NextResponse.json({
        success: true,
        data: {
          insights: insights.map((i) => ({
            id: i.id,
            severity: i.severity,
            category: i.category,
            title: i.title,
            description: i.description,
            recommendedAction: i.recommendedAction,
            impactedAccountIds: i.impactedAccountIds,
            impactedCategories: i.impactedCategories,
            valueEstimate: i.valueEstimate,
            savingsPotential: i.savingsPotential,
            confidenceScore: i.confidenceScore,
            isRead: i.isRead,
            isDismissed: i.isDismissed,
            isActioned: i.isActioned,
            createdAt: i.createdAt,
          })),
          counts: {
            total: insights.length,
            unread: unreadCount,
            bySeverity: Object.fromEntries(
              severityCounts.map((s) => [s.severity, s._count.severity])
            ),
          },
        },
      });
    } catch (error) {
      console.error('Cashflow insights API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch cashflow insights',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/cashflow/insights
 *
 * Body:
 * {
 *   insightId: string,
 *   action: 'read' | 'dismiss' | 'action'
 * }
 *
 * Update insight status
 */
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();
      const { insightId, action } = body;

      if (!insightId || !action) {
        return NextResponse.json(
          {
            success: false,
            error: 'insightId and action are required',
          },
          { status: 400 }
        );
      }

      // Verify ownership
      const insight = await prisma.cashflowInsight.findFirst({
        where: { id: insightId, userId },
      });

      if (!insight) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insight not found',
          },
          { status: 404 }
        );
      }

      // Update based on action
      const updateData: any = {};
      switch (action) {
        case 'read':
          updateData.isRead = true;
          break;
        case 'dismiss':
          updateData.isDismissed = true;
          updateData.dismissedAt = new Date();
          break;
        case 'action':
          updateData.isActioned = true;
          updateData.actionedAt = new Date();
          break;
        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid action. Must be: read, dismiss, or action',
            },
            { status: 400 }
          );
      }

      const updated = await prisma.cashflowInsight.update({
        where: { id: insightId },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          isRead: updated.isRead,
          isDismissed: updated.isDismissed,
          isActioned: updated.isActioned,
        },
      });
    } catch (error) {
      console.error('Update cashflow insight error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update insight',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
