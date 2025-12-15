/**
 * HOUSEHOLD PROFILE API
 * GET /api/household-profile - Get user's household profile
 * POST /api/household-profile - Create or update household profile
 *
 * Phase 28: Realistic Budget Integration
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import {
  validateHouseholdProfile,
  isProfileComplete,
  HouseholdProfileInput,
} from '@/lib/budget-analysis/types';

// =============================================================================
// GET - Retrieve household profile
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      const profile = await prisma.householdProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return NextResponse.json(
          {
            success: false,
            error: 'No household profile found',
            message: 'Please complete your household profile to enable budget analysis.',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('[API] Get household profile error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve household profile',
        },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Create or update household profile
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();

      // Extract and validate input
      const input: Partial<HouseholdProfileInput> = {
        adultsCount: body.adultsCount,
        childrenCount: body.childrenCount,
        childrenAges: body.childrenAges || [],
        petsCount: body.petsCount,
        petTypes: body.petTypes || [],
        carsCount: body.carsCount,
        lifestylePreference: body.lifestylePreference,
        diningOutFrequency: body.diningOutFrequency,
        hobbiesWithCosts: body.hobbiesWithCosts || null,
      };

      // Validate input
      const validation = validateHouseholdProfile(input);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validation.errors.map(msg => ({ message: msg })),
          },
          { status: 400 }
        );
      }

      // Check if profile is complete
      const complete = isProfileComplete(input);

      // Upsert profile (create if not exists, update if exists)
      const profile = await prisma.householdProfile.upsert({
        where: { userId },
        create: {
          userId,
          adultsCount: input.adultsCount!,
          childrenCount: input.childrenCount!,
          childrenAges: input.childrenAges || [],
          petsCount: input.petsCount!,
          petTypes: input.petTypes || [],
          carsCount: input.carsCount!,
          lifestylePreference: input.lifestylePreference!,
          diningOutFrequency: input.diningOutFrequency!,
          hobbiesWithCosts: input.hobbiesWithCosts,
          isComplete: complete,
        },
        update: {
          adultsCount: input.adultsCount,
          childrenCount: input.childrenCount,
          childrenAges: input.childrenAges,
          petsCount: input.petsCount,
          petTypes: input.petTypes,
          carsCount: input.carsCount,
          lifestylePreference: input.lifestylePreference,
          diningOutFrequency: input.diningOutFrequency,
          hobbiesWithCosts: input.hobbiesWithCosts,
          isComplete: complete,
        },
      });

      console.log(`[API] Household profile ${profile.id ? 'updated' : 'created'} for user ${userId}`);

      return NextResponse.json(
        {
          success: true,
          data: profile,
        },
        { status: profile.createdAt.getTime() === profile.updatedAt.getTime() ? 201 : 200 }
      );
    } catch (error) {
      console.error('[API] Save household profile error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save household profile',
        },
        { status: 500 }
      );
    }
  });
}
