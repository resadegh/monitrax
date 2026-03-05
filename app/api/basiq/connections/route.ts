/**
 * Basiq Connections API
 * List all bank connections for the user
 *
 * GET /api/basiq/connections
 * Returns: { connections: BasiqConnection[] }
 */

import { NextResponse } from 'next/server';
import { withMFARequired } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getConnections } from '@/lib/basiq';

export const GET = withMFARequired('account.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Get user's Basiq user ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { basiqUserId: true },
    });

    if (!user?.basiqUserId) {
      // Return empty array if user hasn't connected any banks
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get connections from local database
    const localConnections = await prisma.basiqConnection.findMany({
      where: { userId },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currentBalance: true,
            basiqLastSynced: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Try to sync with Basiq API (non-blocking)
    try {
      const basiqConnections = await getConnections(user.basiqUserId);

      // Update local database with Basiq connection statuses
      for (const conn of basiqConnections) {
        const existing = localConnections.find(
          (lc: typeof localConnections[number]) => lc.basiqConnectionId === conn.id
        );

        if (existing) {
          // Update existing connection status
          await prisma.basiqConnection.update({
            where: { id: existing.id },
            data: {
              status: conn.status === 'active' ? 'ACTIVE' :
                      conn.status === 'pending' ? 'PENDING' :
                      conn.status === 'reconnect' ? 'RECONNECT' : 'ERROR',
              lastSyncedAt: new Date(),
            },
          });
        } else {
          // Create new connection record
          await prisma.basiqConnection.create({
            data: {
              userId,
              basiqConnectionId: conn.id,
              institutionId: conn.institution.id,
              institutionName: conn.institution.name,
              institutionLogo: conn.institution.logo?.links?.square,
              status: conn.status === 'active' ? 'ACTIVE' : 'PENDING',
            },
          });
        }
      }
    } catch (syncError) {
      console.warn('Failed to sync with Basiq API:', syncError);
      // Continue with local data
    }

    // Re-fetch updated connections
    const connections = await prisma.basiqConnection.findMany({
      where: { userId },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            currentBalance: true,
            basiqLastSynced: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: connections,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching Basiq connections:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch connections',
        },
      },
      { status: 500 }
    );
  }
});
