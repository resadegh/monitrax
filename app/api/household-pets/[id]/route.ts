/**
 * HOUSEHOLD PET API - Individual Operations
 * GET /api/household-pets/[id] - Get a specific pet
 * PUT /api/household-pets/[id] - Update a pet
 * DELETE /api/household-pets/[id] - Delete a pet (orphans categories)
 *
 * Phase 29: Household Pet Management
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { z } from 'zod';
import { HouseholdPetType } from '@prisma/client';
import {
  updatePetCategoryNames,
  orphanPetCategories,
} from '@/lib/services/householdCategoryService';

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdatePetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  type: z.nativeEnum(HouseholdPetType).optional(),
  breed: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// =============================================================================
// GET - Retrieve a specific pet
// =============================================================================

export const GET = withPermission<RouteContext>('settings.read', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;

      // Get pet with ownership verification
      const pet = await prisma.householdPet.findFirst({
        where: {
          id,
          householdProfile: { userId }
        },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      if (!pet) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pet not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: pet,
      });
    } catch (error) {
      console.error('[API] Get household pet error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve household pet',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// PUT - Update a pet
// =============================================================================

export const PUT = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;
      const body = await request.json();

      // Validate input
      const parseResult = UpdatePetSchema.safeParse(body);
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

      // Get existing pet with ownership verification
      const existingPet = await prisma.householdPet.findFirst({
        where: {
          id,
          householdProfile: { userId }
        },
        include: {
          householdProfile: true
        }
      });

      if (!existingPet) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pet not found',
          },
          { status: 404 }
        );
      }

      const updateData = parseResult.data;

      // Update pet
      const pet = await prisma.householdPet.update({
        where: { id },
        data: {
          name: updateData.name,
          type: updateData.type,
          breed: updateData.breed !== undefined ? updateData.breed : undefined,
          sortOrder: updateData.sortOrder,
        },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      // If name changed, update category names
      if (updateData.name && updateData.name !== existingPet.name) {
        await updatePetCategoryNames(id, existingPet.name, updateData.name);
      }

      // Update household counts
      await updateHouseholdPetCounts(existingPet.householdProfileId);

      // Refetch with updated categories
      const updatedPet = await prisma.householdPet.findUnique({
        where: { id },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      console.log(`[API] Household pet updated: ${pet.name} for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). Guarded above
      // by `findFirst({ id, householdProfile: { userId } })` — only the
      // user's own row can reach this point. No CDR data in metadata.
      void createAuditLog({
        userId,
        action: 'HOUSEHOLD_PET_UPDATED',
        status: 'SUCCESS',
        entityType: 'HouseholdPet',
        entityId: id,
        metadata: { type: pet.type },
      });

      return NextResponse.json({
        success: true,
        data: updatedPet,
      });
    } catch (error) {
      console.error('[API] Update household pet error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update household pet',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// DELETE - Delete a pet (orphans categories instead of deleting them)
// =============================================================================

export const DELETE = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;

      // Get pet with ownership verification
      const pet = await prisma.householdPet.findFirst({
        where: {
          id,
          householdProfile: { userId }
        },
        include: {
          householdProfile: true
        }
      });

      if (!pet) {
        return NextResponse.json(
          {
            success: false,
            error: 'Pet not found',
          },
          { status: 404 }
        );
      }

      // Orphan linked categories (don't delete them)
      await orphanPetCategories(id);

      // Delete the pet
      await prisma.householdPet.delete({
        where: { id }
      });

      // Update household counts
      await updateHouseholdPetCounts(pet.householdProfileId);

      console.log(`[API] Household pet deleted: ${pet.name} for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). Hard-delete —
      // guarded above by `findFirst({ id, householdProfile: { userId } })`.
      void createAuditLog({
        userId,
        action: 'HOUSEHOLD_PET_DELETED',
        status: 'SUCCESS',
        entityType: 'HouseholdPet',
        entityId: id,
        metadata: { type: pet.type },
      });

      return NextResponse.json({
        success: true,
        message: `Pet "${pet.name}" deleted. Associated categories have been preserved.`,
      });
    } catch (error) {
      console.error('[API] Delete household pet error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete household pet',
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
