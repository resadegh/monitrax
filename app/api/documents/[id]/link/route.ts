/**
 * Phase 26: Document Link API
 *
 * POST /api/documents/[id]/link
 * Links a document to an entity (expense, income, loan, property, etc.)
 *
 * DELETE /api/documents/[id]/link
 * Removes a link between a document and an entity
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { LinkedEntityType } from '@/lib/documents/types';

interface LinkRequest {
  entityType: string;
  entityId: string;
}

type RouteContext = { params: Promise<{ id: string }> };

// ============================================================================
// POST /api/documents/[id]/link
// ============================================================================

export const POST = withPermission<RouteContext>('report.export', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id: documentId } = await context!.params;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body: LinkRequest = await request.json();
    const { entityType, entityId } = body;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    // Validate entity type - use enum values from LinkedEntityType
    const validEntityTypes = Object.values(LinkedEntityType);

    if (!validEntityTypes.includes(entityType as LinkedEntityType)) {
      return NextResponse.json(
        { success: false, error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if link already exists
    const existingLink = await prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType: entityType as LinkedEntityType,
        entityId,
      },
    });

    if (existingLink) {
      return NextResponse.json({
        success: true,
        link: existingLink,
        message: 'Link already exists',
      });
    }

    // Create the link
    const link = await prisma.documentLink.create({
      data: {
        documentId,
        entityType: entityType as LinkedEntityType,
        entityId,
      },
    });

    return NextResponse.json({
      success: true,
      link,
    });
  } catch (error) {
    console.error('[API] Document link error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link document',
      },
      { status: 500 }
    );
  }
});

// ============================================================================
// DELETE /api/documents/[id]/link
// ============================================================================

export const DELETE = withPermission<RouteContext>('report.export', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id: documentId } = await context!.params;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body: LinkRequest = await request.json();
    const { entityType, entityId } = body;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    // Delete the link
    const deleteResult = await prisma.documentLink.deleteMany({
      where: {
        documentId,
        entityType: entityType as LinkedEntityType,
        entityId,
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Link removed',
    });
  } catch (error) {
    console.error('[API] Document unlink error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlink document',
      },
      { status: 500 }
    );
  }
});
