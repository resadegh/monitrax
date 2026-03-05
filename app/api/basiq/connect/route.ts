/**
 * Basiq Connect API
 * Creates a Basiq user and returns a consent URL for bank connection
 *
 * POST /api/basiq/connect
 * Returns: { consentUrl: string, basiqUserId: string }
 */

import { NextResponse } from 'next/server';
import { withMFARequired } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getOrCreateBasiqUser, createConsentLink } from '@/lib/basiq';

export const POST = withMFARequired('account.write', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Get mobile number from request body (optional if saved in profile)
    const body = await request.json().catch(() => ({}));
    const { mobile: requestMobile } = body;

    // Get user from database with profile mobile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, basiqUserId: true, mobile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Use profile mobile if available, otherwise use request mobile
    const mobile = user.mobile || requestMobile;

    // Validate mobile number is present
    if (!mobile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MOBILE_REQUIRED',
            message: 'Mobile number is required for bank connection. Please add your mobile number in Settings > Profile first.',
          },
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
            message: 'Please provide a valid Australian mobile number (e.g., 0412345678 or +61412345678)',
          },
        },
        { status: 400 }
      );
    }

    // Format mobile to international format for Basiq
    const formattedMobile = mobileClean.startsWith('+61')
      ? mobileClean
      : '+61' + mobileClean.substring(1);

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
      // Try to update existing Basiq user with mobile
      // If user doesn't exist (e.g., API key changed), create a new one
      try {
        const { updateBasiqUser } = await import('@/lib/basiq');
        await updateBasiqUser(basiqUserId, { mobile: formattedMobile });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        // If Basiq user not found (API key changed or user deleted), create new one
        if (errorMessage.includes('resource-not-found') || errorMessage.includes('not found')) {
          console.log('Basiq user not found, creating new user for:', user.email);
          const basiqUser = await getOrCreateBasiqUser(user.email, formattedMobile);
          basiqUserId = basiqUser.id;

          // Update database with new Basiq user ID
          await prisma.user.update({
            where: { id: userId },
            data: { basiqUserId },
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
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
