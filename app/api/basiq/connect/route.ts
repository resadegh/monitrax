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

      // Get mobile number from request body
      const body = await request.json().catch(() => ({}));
      const { mobile } = body;

      // Validate mobile number format (Australian format)
      if (!mobile) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Mobile number is required for bank connection. Please provide your Australian mobile number.'
            }
          },
          { status: 400 }
        );
      }

      // Basic Australian mobile validation (+61 or 04)
      const mobileClean = mobile.replace(/\s/g, '');
      if (!mobileClean.match(/^(\+61|0)[4-5]\d{8}$/)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Please provide a valid Australian mobile number (e.g., 0412345678 or +61412345678)'
            }
          },
          { status: 400 }
        );
      }

      // Format mobile to international format for Basiq
      const formattedMobile = mobileClean.startsWith('+61')
        ? mobileClean
        : '+61' + mobileClean.substring(1);

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

      // Create or update Basiq user with mobile number
      if (!basiqUserId) {
        const basiqUser = await getOrCreateBasiqUser(user.email, formattedMobile);
        basiqUserId = basiqUser.id;

        // Save Basiq user ID to database
        await prisma.user.update({
          where: { id: userId },
          data: { basiqUserId },
        });
      } else {
        // Update existing Basiq user with mobile if they don't have one
        const { updateBasiqUser } = await import('@/lib/basiq');
        await updateBasiqUser(basiqUserId, { mobile: formattedMobile });
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
