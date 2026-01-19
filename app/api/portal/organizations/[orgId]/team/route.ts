/**
 * Phase 32: Team Management API
 *
 * GET /api/portal/organizations/[orgId]/team - List team members
 * POST /api/portal/organizations/[orgId]/team - Invite new member
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isPortalAccessible, isPortalFeatureEnabled } from '@/lib/portal/featureFlags';
import { PermissionGuards } from '@/lib/portal/permissions';
import { PORTAL_ERROR_CODES, PLAN_LIMITS, INVITATION_CONSTANTS } from '@/lib/portal/constants';
import type { PortalUserRole, OrganizationPlan } from '@prisma/client';

// Type for member with user data from the query
interface MemberWithUser {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; email: string; name: string | null };
}

// Type for mapped member returned in the response
interface MappedMember {
  id: string;
  userId: string;
  role: string;
  invitedBy: null;
  invitedAt: string;
  joinedAt: string;
  isActive: boolean;
  user: { id: string; email: string; name: string | null };
  stats: { assignedClients: number; pendingTasks: number; notesCreated: number };
}

// Placeholder for auth - to be replaced with actual auth
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  return null;
}

async function getMemberContext(userId: string, orgId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId: orgId,
      isActive: true,
    },
    include: {
      organization: true,
    },
  });

  if (!membership) return null;

  const roleMapping: Record<string, PortalUserRole> = {
    OWNER: 'PORTAL_OWNER',
    ADMIN: 'PORTAL_ADMIN',
    CONTRIBUTOR: 'PORTAL_ADVISOR',
    VIEWER: 'PORTAL_VIEWER',
  };

  return {
    membership,
    portalRole: roleMapping[membership.role] || ('PORTAL_VIEWER' as PortalUserRole),
  };
}

/**
 * GET /api/portal/organizations/[orgId]/team
 * List all team members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const context = await getMemberContext(userId, orgId);

    if (!context) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    if (!PermissionGuards.canReadTeam(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const role = searchParams.get('role') as PortalUserRole | null;
    const isActive = searchParams.get('isActive');

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: orgId,
    };

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get total count
    const total = await prisma.organizationMember.count({ where });

    // Get members with user details
    const members = await prisma.organizationMember.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Map to portal roles and add stats
    const mappedMembers = await Promise.all(
      members.map(async (member: MemberWithUser) => {
        const roleMapping: Record<string, PortalUserRole> = {
          OWNER: 'PORTAL_OWNER',
          ADMIN: 'PORTAL_ADMIN',
          CONTRIBUTOR: 'PORTAL_ADVISOR',
          VIEWER: 'PORTAL_VIEWER',
        };

        // Get member stats
        const [assignedClients, pendingTasks] = await Promise.all([
          prisma.organizationClient.count({
            where: {
              organizationId: orgId,
              assignedToMemberId: member.id,
              status: { not: 'ARCHIVED' },
            },
          }),
          prisma.clientTask.count({
            where: {
              assignedToMemberId: member.id,
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
          }),
        ]);

        return {
          id: member.id,
          userId: member.userId,
          role: roleMapping[member.role] || 'PORTAL_VIEWER',
          invitedBy: null,
          invitedAt: member.createdAt.toISOString(),
          joinedAt: member.createdAt.toISOString(),
          isActive: member.isActive,
          user: member.user,
          stats: {
            assignedClients,
            pendingTasks,
            notesCreated: 0,
          },
        };
      })
    );

    // Filter by role if specified
    const filteredMembers: MappedMember[] = role
      ? mappedMembers.filter((m: MappedMember) => m.role === role)
      : mappedMembers;

    return NextResponse.json({
      items: filteredMembers,
      pagination: {
        page,
        limit,
        total: filteredMembers.length,
        totalPages: Math.ceil(filteredMembers.length / limit),
        hasMore: page * limit < filteredMembers.length,
      },
    });
  } catch (error) {
    console.error('[Portal API] Error fetching team:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/organizations/[orgId]/team
 * Invite a new team member
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible()) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Portal is not enabled' },
      { status: 503 }
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const context = await getMemberContext(userId, orgId);

    if (!context) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.NOT_A_MEMBER, message: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    if (!PermissionGuards.canInviteTeam(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions to invite team members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'PORTAL_ADVISOR', personalMessage } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: PortalUserRole[] = ['PORTAL_ADMIN', 'PORTAL_ADVISOR', 'PORTAL_VIEWER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid role specified' },
        { status: 400 }
      );
    }

    // Check plan limits
    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: orgId },
    });

    const plan = (portalSettings?.plan || 'STARTER') as OrganizationPlan;
    const planLimits = PLAN_LIMITS[plan];

    const currentStaffCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, isActive: true },
    });

    if (planLimits.maxStaff !== -1 && currentStaffCount >= planLimits.maxStaff) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.STAFF_LIMIT_REACHED, message: 'Staff limit reached for your plan' },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          userId: existingUser.id,
          organizationId: orgId,
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: 'MEMBER_EXISTS', message: 'This user is already a member of your organization' },
          { status: 409 }
        );
      }
    }

    // Check for pending invitation
    const pendingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId: orgId,
        email: email.toLowerCase(),
        type: 'STAFF',
        status: 'PENDING',
      },
    });

    if (pendingInvitation) {
      return NextResponse.json(
        { error: 'INVITATION_EXISTS', message: 'An invitation is already pending for this email' },
        { status: 409 }
      );
    }

    // Generate invitation token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        type: 'STAFF',
        email: email.toLowerCase(),
        role,
        status: 'PENDING',
        token,
        tokenExpiresAt: new Date(
          Date.now() + INVITATION_CONSTANTS.TOKEN_VALIDITY_HOURS * 60 * 60 * 1000
        ),
        invitedByMemberId: context.membership.id,
        personalMessage: personalMessage || null,
      },
    });

    // TODO: Send invitation email
    // await sendTeamInvitationEmail(email, invitation, context.membership.organization);

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          tokenExpiresAt: invitation.tokenExpiresAt,
          createdAt: invitation.createdAt,
        },
        message: 'Invitation sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Portal API] Error inviting team member:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
