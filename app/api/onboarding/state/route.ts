import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// Profile types - will use Prisma enum after client regeneration
const VALID_PROFILE_TYPES = ['HOMEOWNER', 'INVESTOR', 'MIXED', 'STARTER'] as const;

/**
 * GET /api/onboarding/state
 * Get onboarding state for the current user
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Get user with onboarding fields
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          onboardingCompleted: true,
          onboardingProfileType: true,
          onboardingStartedAt: true,
          onboardingCompletedAt: true,
          onboardingStep: true,
          userPreference: {
            select: {
              hasSeenGuidedTour: true,
              tourSkippedAt: true,
              tourCompletedAt: true,
              dismissedOnboardingBadge: true,
              dismissedWelcomeModal: true,
              preferredCurrency: true,
              preferredDateFormat: true,
              country: true,
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if user has any data (to determine if they should see onboarding)
      const [propertyCount, accountCount, incomeCount, expenseCount] = await Promise.all([
        prisma.property.count({ where: { userId } }),
        prisma.account.count({ where: { userId } }),
        prisma.income.count({ where: { userId } }),
        prisma.expense.count({ where: { userId } }),
      ]);

      const hasData = propertyCount > 0 || accountCount > 0 || incomeCount > 0 || expenseCount > 0;

      return NextResponse.json({
        success: true,
        data: {
          onboardingCompleted: user.onboardingCompleted,
          onboardingProfileType: user.onboardingProfileType,
          onboardingStartedAt: user.onboardingStartedAt,
          onboardingCompletedAt: user.onboardingCompletedAt,
          currentStep: user.onboardingStep,
          preferences: user.userPreference || {
            hasSeenGuidedTour: false,
            tourSkippedAt: null,
            tourCompletedAt: null,
            dismissedOnboardingBadge: false,
            dismissedWelcomeModal: false,
            preferredCurrency: 'AUD',
            preferredDateFormat: 'DD/MM/YYYY',
            country: 'AU',
          },
          hasExistingData: hasData,
          dataSummary: {
            properties: propertyCount,
            accounts: accountCount,
            income: incomeCount,
            expenses: expenseCount,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Get onboarding state error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/onboarding/state
 * Update onboarding state for the current user
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();

      const {
        profileType,
        currentStep,
        startOnboarding,
        // Tour-related updates
        hasSeenGuidedTour,
        tourSkipped,
        tourCompleted,
        // UI state updates
        dismissOnboardingBadge,
        dismissWelcomeModal,
        // Preference updates
        preferredCurrency,
        preferredDateFormat,
        country,
      } = body;

      // Build user update data
      const userUpdate: Record<string, unknown> = {};

      if (profileType && VALID_PROFILE_TYPES.includes(profileType)) {
        userUpdate.onboardingProfileType = profileType;
      }

      if (typeof currentStep === 'number' && currentStep >= 0 && currentStep <= 7) {
        userUpdate.onboardingStep = currentStep;
      }

      if (startOnboarding) {
        userUpdate.onboardingStartedAt = new Date();
      }

      // Update user if there are changes
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: userUpdate,
        });
      }

      // Build preference update data
      const prefUpdate: Record<string, unknown> = {};

      if (typeof hasSeenGuidedTour === 'boolean') {
        prefUpdate.hasSeenGuidedTour = hasSeenGuidedTour;
      }
      if (tourSkipped) {
        prefUpdate.tourSkippedAt = new Date();
      }
      if (tourCompleted) {
        prefUpdate.tourCompletedAt = new Date();
        prefUpdate.hasSeenGuidedTour = true;
      }
      if (typeof dismissOnboardingBadge === 'boolean') {
        prefUpdate.dismissedOnboardingBadge = dismissOnboardingBadge;
      }
      if (typeof dismissWelcomeModal === 'boolean') {
        prefUpdate.dismissedWelcomeModal = dismissWelcomeModal;
      }
      if (preferredCurrency) {
        prefUpdate.preferredCurrency = preferredCurrency;
      }
      if (preferredDateFormat) {
        prefUpdate.preferredDateFormat = preferredDateFormat;
      }
      if (country) {
        prefUpdate.country = country;
      }

      // Upsert user preference if there are changes
      if (Object.keys(prefUpdate).length > 0) {
        await prisma.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            ...prefUpdate,
          },
          update: prefUpdate,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Onboarding state updated',
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Update onboarding state error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
