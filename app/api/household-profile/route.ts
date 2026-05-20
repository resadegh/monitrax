/**
 * HOUSEHOLD PROFILE API
 * GET /api/household-profile - Get user's household profile with members and pets
 * POST /api/household-profile - Create or update household profile
 *
 * Phase 28: Realistic Budget Integration
 * Phase 29: Household Member and Pet Management
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  validateHouseholdProfile,
  isProfileComplete,
  HouseholdProfileInput,
} from '@/lib/budget-analysis/types';

// =============================================================================
// GET - Retrieve household profile with members and pets
// =============================================================================

export const GET = withPermission('settings.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      const profile = await prisma.householdProfile.findUnique({
        where: { userId },
        include: {
          // Phase 29: Include named household members with their categories
          members: {
            orderBy: [
              { sortOrder: 'asc' },
              { createdAt: 'asc' }
            ],
            include: {
              linkedCategories: {
                where: { isActive: true },
                orderBy: { name: 'asc' }
              }
            }
          },
          // Phase 29: Include named pets with their categories
          pets: {
            orderBy: [
              { sortOrder: 'asc' },
              { createdAt: 'asc' }
            ],
            include: {
              linkedCategories: {
                where: { isActive: true },
                orderBy: { name: 'asc' }
              }
            }
          }
        }
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

      // Phase 29: Check if existing user needs to migrate (has counts but no named members)
      const needsMigration = (profile.adultsCount > 0 && profile.members.length === 0) ||
                            (profile.petsCount > 0 && profile.pets.length === 0);

      return NextResponse.json({
        success: true,
        data: profile,
        _meta: {
          needsMigration,
          memberCount: profile.members.length,
          petCount: profile.pets.length,
          totalCategories: profile.members.reduce((sum, m) => sum + m.linkedCategories.length, 0) +
                          profile.pets.reduce((sum, p) => sum + p.linkedCategories.length, 0)
        }
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

// =============================================================================
// POST - Create or update household profile
// =============================================================================

export const POST = withPermission('settings.write', async (request, auth) => {
    try {
      const userId = auth.userId;
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

      const wasCreated = profile.createdAt.getTime() === profile.updatedAt.getTime();
      console.log(`[API] Household profile ${wasCreated ? 'created' : 'updated'} for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). This route is
      // the household domain's SSOT write boundary — used by the dashboard
      // AND, since Phase 12 Track F.1, by the onboarding wizard. CDR rule
      // §13.3: no financial/CDR data in metadata — only counts + flags.
      void createAuditLog({
        userId,
        action: wasCreated ? 'HOUSEHOLD_PROFILE_CREATED' : 'HOUSEHOLD_PROFILE_UPDATED',
        status: 'SUCCESS',
        entityType: 'HouseholdProfile',
        entityId: profile.id,
        metadata: {
          adultsCount: profile.adultsCount,
          childrenCount: profile.childrenCount,
          petsCount: profile.petsCount,
          carsCount: profile.carsCount,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: profile,
        },
        { status: wasCreated ? 201 : 200 }
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
