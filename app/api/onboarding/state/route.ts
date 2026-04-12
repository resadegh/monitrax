import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

// Profile types - will use Prisma enum after client regeneration
const VALID_PROFILE_TYPES = ['HOMEOWNER', 'INVESTOR', 'MIXED', 'STARTER'] as const;

// Default preferences for new users or when DB fields don't exist
const DEFAULT_PREFERENCES = {
  hasSeenGuidedTour: false,
  tourSkippedAt: null as Date | null,
  tourCompletedAt: null as Date | null,
  dismissedOnboardingBadge: false,
  dismissedWelcomeModal: false,
  preferredCurrency: 'AUD',
  preferredDateFormat: 'DD/MM/YYYY',
  country: 'AU',
  taxYear: null as string | null,
};

/**
 * GET /api/onboarding/state
 * Get onboarding state for the current user
 */
export const GET = withPermission('settings.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Check if user has any data (to determine if they should see onboarding)
      const [propertyCount, accountCount, incomeCount, expenseCount] = await Promise.all([
        prisma.property.count({ where: { userId } }),
        prisma.account.count({ where: { userId } }),
        prisma.income.count({ where: { userId } }),
        prisma.expense.count({ where: { userId } }),
      ]);

      const hasData = propertyCount > 0 || accountCount > 0 || incomeCount > 0 || expenseCount > 0;

      // Try to get user with onboarding fields (may fail if migration not run)
      let onboardingData = {
        onboardingCompleted: false,
        onboardingProfileType: null as string | null,
        onboardingStartedAt: null as Date | null,
        onboardingCompletedAt: null as Date | null,
        onboardingStep: 0,
        userPreference: null as typeof DEFAULT_PREFERENCES | null,
      };

      try {
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
                taxYear: true,
              },
            },
          },
        });

        if (user) {
          onboardingData = {
            onboardingCompleted: user.onboardingCompleted ?? false,
            onboardingProfileType: user.onboardingProfileType ?? null,
            onboardingStartedAt: user.onboardingStartedAt ?? null,
            onboardingCompletedAt: user.onboardingCompletedAt ?? null,
            onboardingStep: user.onboardingStep ?? 0,
            userPreference: user.userPreference ?? null,
          };
        }
      } catch (dbError) {
        // If onboarding fields don't exist yet (migration not run), use defaults
        console.warn('Onboarding fields not available (migration may not be run):', dbError);

        // Check if user exists at all
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!userExists) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          onboardingCompleted: onboardingData.onboardingCompleted,
          onboardingProfileType: onboardingData.onboardingProfileType,
          onboardingStartedAt: onboardingData.onboardingStartedAt,
          onboardingCompletedAt: onboardingData.onboardingCompletedAt,
          currentStep: onboardingData.onboardingStep,
          preferences: onboardingData.userPreference || DEFAULT_PREFERENCES,
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

/**
 * POST /api/onboarding/state
 * Update onboarding state for the current user
 */
export const POST = withPermission('settings.write', async (request, auth) => {
    try {
      const userId = auth.userId;
      const body = await request.json();

      const {
        profileType,
        currentStep,
        startOnboarding,
        // Tour-related updates
        hasSeenGuidedTour,
        tourSkipped,
        tourCompleted,
        resetTour, // New: allows users to restart the tour from settings
        // UI state updates
        dismissOnboardingBadge,
        dismissWelcomeModal,
        // Preference updates
        preferredCurrency,
        preferredDateFormat,
        country,
        taxYear,
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

      // Try to update user onboarding fields (may fail if migration not run)
      if (Object.keys(userUpdate).length > 0) {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: userUpdate,
          });
        } catch (dbError) {
          console.warn('Could not update user onboarding fields (migration may not be run):', dbError);
        }
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
      // Reset tour - clear all tour completion flags
      if (resetTour) {
        prefUpdate.hasSeenGuidedTour = false;
        prefUpdate.tourSkippedAt = null;
        prefUpdate.tourCompletedAt = null;
        prefUpdate.dismissedWelcomeModal = false;
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
      if (typeof taxYear === 'string' && taxYear.length > 0) {
        prefUpdate.taxYear = taxYear;
      }

      // Try to upsert user preference (may fail if migration not run)
      let prefUpdateFailed = false;
      if (Object.keys(prefUpdate).length > 0) {
        try {
          await prisma.userPreference.upsert({
            where: { userId },
            create: {
              userId,
              ...prefUpdate,
            },
            update: prefUpdate,
          });
        } catch (dbError) {
          console.warn('Could not update user preferences (migration may not be run):', dbError);
          prefUpdateFailed = true;
        }
      }

      // Return error if preference update was requested but failed
      if (prefUpdateFailed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not save preferences. Please try again or run database migrations.',
            meta: {
              timestamp: new Date().toISOString(),
            },
          },
          { status: 500 }
        );
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
