/**
 * HOUSEHOLD MEMBER API - Individual Operations
 * GET /api/household-members/[id] - Get a specific member
 * PUT /api/household-members/[id] - Update a member
 * DELETE /api/household-members/[id] - Delete a member (orphans categories)
 *
 * Phase 29: Household Member Management
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { createAuditLog } from '@/lib/security/auditLog';
import { z } from 'zod';
import { HouseholdRelationship } from '@prisma/client';
import {
  updateMemberCategoryNames,
  orphanMemberCategories,
  regenerateMemberCategories,
} from '@/lib/services/householdCategoryService';

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UpdateMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  relationship: z.nativeEnum(HouseholdRelationship).optional(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  isIncomeEarner: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// =============================================================================
// GET - Retrieve a specific member
// =============================================================================

export const GET = withPermission<RouteContext>('settings.read', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;

      // Get member with ownership verification
      const member = await prisma.householdMember.findFirst({
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

      if (!member) {
        return NextResponse.json(
          {
            success: false,
            error: 'Member not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: member,
      });
    } catch (error) {
      console.error('[API] Get household member error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve household member',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// PUT - Update a member
// =============================================================================

export const PUT = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;
      const body = await request.json();

      // Validate input
      const parseResult = UpdateMemberSchema.safeParse(body);
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

      // Get existing member with ownership verification
      const existingMember = await prisma.householdMember.findFirst({
        where: {
          id,
          householdProfile: { userId }
        },
        include: {
          householdProfile: true
        }
      });

      if (!existingMember) {
        return NextResponse.json(
          {
            success: false,
            error: 'Member not found',
          },
          { status: 404 }
        );
      }

      const updateData = parseResult.data;

      // Update member
      const member = await prisma.householdMember.update({
        where: { id },
        data: {
          name: updateData.name,
          relationship: updateData.relationship,
          dateOfBirth: updateData.dateOfBirth !== undefined
            ? (updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : null)
            : undefined,
          isIncomeEarner: updateData.isIncomeEarner,
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
      if (updateData.name && updateData.name !== existingMember.name) {
        await updateMemberCategoryNames(id, existingMember.name, updateData.name);
      }

      // If isIncomeEarner changed to true, regenerate categories to add income-related ones
      if (updateData.isIncomeEarner === true && !existingMember.isIncomeEarner) {
        await regenerateMemberCategories(
          userId,
          id,
          member.name,
          member.relationship,
          true
        );
      }

      // Update household counts
      await updateHouseholdCounts(existingMember.householdProfileId);

      // Refetch with updated categories
      const updatedMember = await prisma.householdMember.findUnique({
        where: { id },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      console.log(`[API] Household member updated: ${member.name} for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). Guarded above
      // by `findFirst({ id, householdProfile: { userId } })` — only the
      // user's own row can reach this point. No CDR data in metadata.
      void createAuditLog({
        userId,
        action: 'HOUSEHOLD_MEMBER_UPDATED',
        status: 'SUCCESS',
        entityType: 'HouseholdMember',
        entityId: id,
        metadata: { relationship: member.relationship, isIncomeEarner: member.isIncomeEarner },
      });

      return NextResponse.json({
        success: true,
        data: updatedMember,
      });
    } catch (error) {
      console.error('[API] Update household member error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update household member',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// DELETE - Delete a member (orphans categories instead of deleting them)
// =============================================================================

export const DELETE = withPermission<RouteContext>('settings.write', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id } = await context!.params;

      // Get member with ownership verification
      const member = await prisma.householdMember.findFirst({
        where: {
          id,
          householdProfile: { userId }
        },
        include: {
          householdProfile: true
        }
      });

      if (!member) {
        return NextResponse.json(
          {
            success: false,
            error: 'Member not found',
          },
          { status: 404 }
        );
      }

      // Orphan linked categories (don't delete them)
      await orphanMemberCategories(id);

      // Delete the member
      await prisma.householdMember.delete({
        where: { id }
      });

      // Update household counts
      await updateHouseholdCounts(member.householdProfileId);

      console.log(`[API] Household member deleted: ${member.name} for user ${userId}`);

      // Audit every state-changing write (CLAUDE.md §12.5). Hard-delete —
      // guarded above by `findFirst({ id, householdProfile: { userId } })`.
      void createAuditLog({
        userId,
        action: 'HOUSEHOLD_MEMBER_DELETED',
        status: 'SUCCESS',
        entityType: 'HouseholdMember',
        entityId: id,
        metadata: { relationship: member.relationship },
      });

      return NextResponse.json({
        success: true,
        message: `Member "${member.name}" deleted. Associated categories have been preserved.`,
      });
    } catch (error) {
      console.error('[API] Delete household member error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete household member',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// HELPER: Update household counts from members
// =============================================================================

async function updateHouseholdCounts(profileId: string): Promise<void> {
  const members = await prisma.householdMember.findMany({
    where: { householdProfileId: profileId }
  });

  // Count adults (non-children)
  const adultsCount = members.filter(m =>
    m.relationship !== 'CHILD'
  ).length;

  // Count children
  const childrenCount = members.filter(m =>
    m.relationship === 'CHILD'
  ).length;

  // Get children ages
  const childrenAges = members
    .filter(m => m.relationship === 'CHILD' && m.dateOfBirth)
    .map(m => {
      const age = Math.floor(
        (Date.now() - m.dateOfBirth!.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      );
      return Math.max(0, Math.min(18, age));
    });

  await prisma.householdProfile.update({
    where: { id: profileId },
    data: {
      adultsCount: Math.max(1, adultsCount),
      childrenCount,
      childrenAges,
    }
  });
}
