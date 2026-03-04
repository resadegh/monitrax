import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

/**
 * POST /api/onboarding/complete
 * Mark onboarding as complete for the current user
 */
export const POST = withPermission('settings.write', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Update user to mark onboarding as complete
      await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 7, // Final step
        },
      });

      // Also update user preference to dismiss the welcome modal
      await prisma.userPreference.upsert({
        where: { userId },
        create: {
          userId,
          dismissedWelcomeModal: true,
        },
        update: {
          dismissedWelcomeModal: true,
        },
      });

      // Get updated user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          onboardingCompleted: true,
          onboardingCompletedAt: true,
          onboardingProfileType: true,
          onboardingStep: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding completed successfully',
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
});
