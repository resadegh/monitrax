/**
 * Phase 26: Document Link API
 *
 * POST /api/documents/[id]/link
 * Links a document to an entity (expense, income, loan, property, etc.)
 *
 * DELETE /api/documents/[id]/link
 * Removes a link between a document and an entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface LinkRequest {
  entityType: string;
  entityId: string;
}

// ============================================================================
// POST /api/documents/[id]/link
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
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

    // Validate entity type
    const validEntityTypes = [
      'PROPERTY',
      'LOAN',
      'EXPENSE',
      'INCOME',
      'INVESTMENT_ACCOUNT',
      'INVESTMENT_HOLDING',
      'ASSET',
    ];

    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { success: false, error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if link already exists
    const existingLink = await prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType,
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
        entityType,
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
}

// ============================================================================
// DELETE /api/documents/[id]/link
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;

    // Verify document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
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
        entityType,
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
}
