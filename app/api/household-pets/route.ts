/**
 * HOUSEHOLD PETS API
 * GET /api/household-pets - Get all pets for user's household
 * POST /api/household-pets - Add a new household pet
 *
 * Phase 29: Household Pet Management
 * Auto-generates expense categories when pets are created
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { z } from 'zod';
import { HouseholdPetType } from '@prisma/client';
import {
  generatePetCategories,
  previewPetCategories,
} from '@/lib/services/householdCategoryService';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreatePetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: z.nativeEnum(HouseholdPetType),
  breed: z.string().max(100).optional().nullable(),
});

// =============================================================================
// GET - Retrieve all household pets
// =============================================================================

export const GET = withPermission('settings.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Get the user's household profile
      const profile = await prisma.householdProfile.findUnique({
        where: { userId },
        include: {
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
        return NextResponse.json({
          success: true,
          data: [],
          _meta: { hasProfile: false }
        });
      }

      return NextResponse.json({
        success: true,
        data: profile.pets,
        _meta: {
          hasProfile: true,
          householdProfileId: profile.id,
          count: profile.pets.length
        }
      });
    } catch (error) {
      console.error('[API] Get household pets error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve household pets',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// POST - Create a new household pet
// =============================================================================

export const POST = withPermission('settings.write', async (request, auth) => {
    try {
      const userId = auth.userId;
      const body = await request.json();

      // Validate input
      const parseResult = CreatePetSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: parseResult.error.errors,
          },
          { status: 400 }
        );
      }

      const { name, type, breed } = parseResult.data;

      // Get or create household profile
      let profile = await prisma.householdProfile.findUnique({
        where: { userId }
      });

      if (!profile) {
        // Create household profile if it doesn't exist
        profile = await prisma.householdProfile.create({
          data: {
            userId,
            adultsCount: 1,
            childrenCount: 0,
            petsCount: 0,
            carsCount: 0,
          }
        });
      }

      // Get current pet count for sort order
      const petCount = await prisma.householdPet.count({
        where: { householdProfileId: profile.id }
      });

      // Create the pet
      const pet = await prisma.householdPet.create({
        data: {
          householdProfileId: profile.id,
          name,
          type,
          breed: breed || null,
          sortOrder: petCount,
        },
        include: {
          linkedCategories: true
        }
      });

      // Auto-generate categories for this pet
      await generatePetCategories(
        userId,
        pet.id,
        name,
        type
      );

      // Update the household profile counts
      await updateHouseholdPetCounts(profile.id);

      // Fetch pet with generated categories
      const petWithCategories = await prisma.householdPet.findUnique({
        where: { id: pet.id },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      console.log(`[API] Household pet created: ${name} (${type}) for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). SSOT write
      // boundary for the household domain (dashboard + Phase 12 Track F.1
      // onboarding wizard). No CDR/financial data in metadata (§13.3).
      void createAuditLog({
        userId,
        action: 'HOUSEHOLD_PET_CREATED',
        status: 'SUCCESS',
        entityType: 'HouseholdPet',
        entityId: pet.id,
        metadata: { type },
      });

      return NextResponse.json(
        {
          success: true,
          data: petWithCategories,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[API] Create household pet error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create household pet',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// HELPER: Update household pet counts
// =============================================================================

async function updateHouseholdPetCounts(profileId: string): Promise<void> {
  const pets = await prisma.householdPet.findMany({
    where: { householdProfileId: profileId }
  });

  // Count pets by type for budget AI
  const petTypes = pets.map(p => p.type.toLowerCase());

  await prisma.householdProfile.update({
    where: { id: profileId },
    data: {
      petsCount: pets.length,
      petTypes,
    }
  });
}
