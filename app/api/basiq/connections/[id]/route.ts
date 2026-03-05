/**
 * Basiq Connection API
 * Get or delete a specific bank connection
 *
 * GET /api/basiq/connections/[id]
 * DELETE /api/basiq/connections/[id]
 */

import { NextResponse } from 'next/server';
import { withMFARequired } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { deleteConnection as deleteBasiqConnection } from '@/lib/basiq';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withMFARequired<RouteContext>('account.read', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id } = await context!.params;

    const connection = await prisma.basiqConnection.findFirst({
      where: { id, userId },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currentBalance: true,
            basiqLastSynced: true,
            accountNumber: true,
            bsb: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Connection not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: connection,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch connection',
        },
      },
      { status: 500 }
    );
  }
});

export const DELETE = withMFARequired<RouteContext>('account.delete', async (request, auth, context) => {
  try {
    const userId = auth.userId;
    const { id } = await context!.params;

    // Get connection and user
    const connection = await prisma.basiqConnection.findFirst({
      where: { id, userId },
    });

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Connection not found' },
        },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { basiqUserId: true },
    });

    // Try to delete from Basiq API
    if (user?.basiqUserId) {
      try {
        await deleteBasiqConnection(user.basiqUserId, connection.basiqConnectionId);
      } catch (basiqError) {
        console.warn('Failed to delete connection from Basiq:', basiqError);
        // Continue with local deletion
      }
    }

    // Update status to disabled (keep accounts but mark connection as removed)
    await prisma.basiqConnection.update({
      where: { id },
      data: { status: 'DISABLED' },
    });

    // Optionally: Remove Basiq reference from linked accounts
    await prisma.account.updateMany({
      where: { basiqConnectionId: id },
      data: {
        basiqConnectionId: null,
        basiqAccountId: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Connection removed successfully' },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete connection',
        },
      },
      { status: 500 }
    );
  }
});
