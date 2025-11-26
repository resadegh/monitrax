/**
 * INDIVIDUAL RECOMMENDATION API
 * GET /api/strategy/:id - Get recommendation details
 * PATCH /api/strategy/:id - Update recommendation (accept/dismiss)
 * DELETE /api/strategy/:id - Delete recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// GET single recommendation with full details
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const recommendation = await prisma.strategyRecommendation.findFirst({
        where: {
          id: params.id,
          userId,
        },
      });

      if (!recommendation) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: recommendation,
      });

    } catch (error) {
      console.error('[API] Error fetching recommendation:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch recommendation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// PATCH recommendation (accept/dismiss)
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Parse body
      const body = await request.json();
      const { status, notes } = body;

      // Validate status
      if (!['ACCEPTED', 'DISMISSED'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be ACCEPTED or DISMISSED' },
          { status: 400 }
        );
      }

      // Update recommendation
      const updateData: any = { status };

      if (status === 'ACCEPTED') {
        updateData.acceptedAt = new Date();
      } else if (status === 'DISMISSED') {
        updateData.dismissedAt = new Date();
        if (notes) {
          updateData.dismissReason = notes;
        }
      }

      const recommendation = await prisma.strategyRecommendation.updateMany({
        where: {
          id: params.id,
          userId,
        },
        data: updateData,
      });

      if (recommendation.count === 0) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      // Fetch updated recommendation
      const updated = await prisma.strategyRecommendation.findUnique({
        where: { id: params.id },
      });

      return NextResponse.json({
        success: true,
        data: updated,
      });

    } catch (error) {
      console.error('[API] Error updating recommendation:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update recommendation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// DELETE recommendation
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Delete recommendation
      const deleted = await prisma.strategyRecommendation.deleteMany({
        where: {
          id: params.id,
          userId,
        },
      });

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: 'Recommendation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Recommendation deleted',
      });

    } catch (error) {
      console.error('[API] Error deleting recommendation:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete recommendation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
