/**
 * Basiq Connect API
 * Creates a Basiq user and returns a consent URL for bank connection
 *
 * POST /api/basiq/connect
 * Returns: { consentUrl: string, basiqUserId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/db';
import { getOrCreateBasiqUser, createConsentLink } from '@/lib/basiq';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, basiqUserId: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 }
        );
      }

      let basiqUserId = user.basiqUserId;

      // Create Basiq user if not exists
      if (!basiqUserId) {
        const basiqUser = await getOrCreateBasiqUser(user.email);
        basiqUserId = basiqUser.id;

        // Save Basiq user ID to database
        await prisma.user.update({
          where: { id: userId },
          data: { basiqUserId },
        });
      }

      // Generate consent link for bank connection
      const consentUrl = await createConsentLink(basiqUserId);

      return NextResponse.json({
        success: true,
        data: {
          consentUrl,
          basiqUserId,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error creating Basiq connection:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create bank connection',
          },
        },
        { status: 500 }
      );
    }
  });
}
