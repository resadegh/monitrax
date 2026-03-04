/**
 * HOUSEHOLD MEMBERS API
 * GET /api/household-members - Get all members for user's household
 * POST /api/household-members - Add a new household member
 *
 * Phase 29: Household Member Management
 * Auto-generates categories when members are created
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { z } from 'zod';
import { HouseholdRelationship } from '@prisma/client';
import {
  generateMemberCategories,
  previewMemberCategories,
} from '@/lib/services/householdCategoryService';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  relationship: z.nativeEnum(HouseholdRelationship),
  dateOfBirth: z.string().datetime().optional().nullable(),
  isIncomeEarner: z.boolean().default(false),
});

// =============================================================================
// GET - Retrieve all household members
// =============================================================================

export const GET = withPermission('settings.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Get the user's household profile
      const profile = await prisma.householdProfile.findUnique({
        where: { userId },
        include: {
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
        data: profile.members,
        _meta: {
          hasProfile: true,
          householdProfileId: profile.id,
          count: profile.members.length
        }
      });
    } catch (error) {
      console.error('[API] Get household members error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve household members',
        },
        { status: 500 }
      );
    }
});

// =============================================================================
// POST - Create a new household member
// =============================================================================

export const POST = withPermission('settings.write', async (request, auth) => {
    try {
      const userId = auth.userId;
      const body = await request.json();

      // Validate input
      const parseResult = CreateMemberSchema.safeParse(body);
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

      const { name, relationship, dateOfBirth, isIncomeEarner } = parseResult.data;

      // Get or create household profile
      let profile = await prisma.householdProfile.findUnique({
        where: { userId }
      });

      if (!profile) {
        // Create household profile if it doesn't exist
        profile = await prisma.householdProfile.create({
          data: {
            userId,
            adultsCount: 0,
            childrenCount: 0,
            petsCount: 0,
            carsCount: 0,
          }
        });
      }

      // Get current member count for sort order
      const memberCount = await prisma.householdMember.count({
        where: { householdProfileId: profile.id }
      });

      // Create the member
      const member = await prisma.householdMember.create({
        data: {
          householdProfileId: profile.id,
          name,
          relationship,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          isIncomeEarner,
          sortOrder: memberCount,
        },
        include: {
          linkedCategories: true
        }
      });

      // Auto-generate categories for this member
      await generateMemberCategories(
        userId,
        member.id,
        name,
        relationship,
        isIncomeEarner
      );

      // Update the household profile counts
      await updateHouseholdCounts(profile.id);

      // Fetch member with generated categories
      const memberWithCategories = await prisma.householdMember.findUnique({
        where: { id: member.id },
        include: {
          linkedCategories: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      });

      console.log(`[API] Household member created: ${name} (${relationship}) for user ${userId}`);

      return NextResponse.json(
        {
          success: true,
          data: memberWithCategories,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[API] Create household member error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create household member',
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
