/**
 * Phase 32: Client Management API
 *
 * GET /api/portal/organizations/[orgId]/clients - List clients
 * POST /api/portal/organizations/[orgId]/clients - Invite a new client
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { isPortalAccessible, isPortalFeatureEnabled } from '@/lib/portal/featureFlags';
import { PermissionGuards } from '@/lib/portal/permissions';
import { PORTAL_ERROR_CODES, PLAN_LIMITS, INVITATION_CONSTANTS } from '@/lib/portal/constants';
import type { PortalUserRole, ClientStatus, ConsentStatus, OrganizationPlan } from '@prisma/client';

// Type for base client from query
interface BaseClient {
  id: string;
  organizationId: string;
  userId: string;
  status: ClientStatus;
  consentStatus: ConsentStatus;
  accessScopes: string[];
  consentGrantedAt: Date | null;
  consentExpiresAt: Date | null;
  consentRevokedAt: Date | null;
  assignedToMemberId: string | null;
  clientReference: string | null;
  externalId: string | null;
  tags: string[];
  onboardedAt: Date | null;
  lastAccessedAt: Date | null;
  archivedAt: Date | null;
  archivedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Type for enriched client with user data
interface EnrichedClient extends BaseClient {
  user: { id: string; email: string; name: string | null; createdAt: Date } | null;
  assignedTo: { id: string; user: { id: string; email: string; name: string | null } } | null;
  notesCount: number;
  tasksCount: number;
  pendingTasksCount: number;
}

// Get current user ID from auth token
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    return payload?.userId || null;
  } catch {
    return null;
  }
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
 * GET /api/portal/organizations/[orgId]/clients
 * List all clients for the organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible() || !isPortalFeatureEnabled('clientManagement')) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Client management is not enabled' },
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

    if (!PermissionGuards.canReadClients(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') as ClientStatus | null;
    const consentStatus = searchParams.get('consentStatus') as ConsentStatus | null;
    const assignedTo = searchParams.get('assignedTo');
    const search = searchParams.get('search');

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: orgId,
    };

    if (status) {
      where.status = status;
    } else {
      // Exclude archived by default
      where.status = { not: 'ARCHIVED' };
    }

    if (consentStatus) {
      where.consentStatus = consentStatus;
    }

    if (assignedTo) {
      where.assignedToMemberId = assignedTo;
    }

    // For PORTAL_ADVISOR, only show assigned clients
    if (context.portalRole === 'PORTAL_ADVISOR') {
      where.assignedToMemberId = context.membership.id;
    }

    // Get total count
    const total = await prisma.organizationClient.count({ where });

    // Get clients with pagination
    const clients = await prisma.organizationClient.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with user data and counts
    const enrichedClients: EnrichedClient[] = await Promise.all(
      clients.map(async (client: BaseClient): Promise<EnrichedClient> => {
        const [user, notesCount, tasksCount, pendingTasksCount] = await Promise.all([
          prisma.user.findUnique({
            where: { id: client.userId },
            select: { id: true, email: true, name: true, createdAt: true },
          }),
          prisma.clientNote.count({ where: { organizationClientId: client.id } }),
          prisma.clientTask.count({ where: { organizationClientId: client.id } }),
          prisma.clientTask.count({
            where: {
              organizationClientId: client.id,
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
          }),
        ]);

        // Get assigned staff info
        let assignedTo = null;
        if (client.assignedToMemberId) {
          const assignedMember = await prisma.organizationMember.findUnique({
            where: { id: client.assignedToMemberId },
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          });
          if (assignedMember) {
            assignedTo = {
              id: assignedMember.id,
              user: assignedMember.user,
            };
          }
        }

        return {
          ...client,
          user,
          assignedTo,
          notesCount,
          tasksCount,
          pendingTasksCount,
        };
      })
    );

    // Apply search filter after enrichment (search by user name/email)
    let filteredClients: EnrichedClient[] = enrichedClients;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredClients = enrichedClients.filter(
        (client: EnrichedClient) =>
          client.user?.name?.toLowerCase().includes(searchLower) ||
          client.user?.email?.toLowerCase().includes(searchLower) ||
          client.clientReference?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      clients: filteredClients,
      pagination: {
        page,
        limit,
        total: search ? filteredClients.length : total,
        totalPages: Math.ceil((search ? filteredClients.length : total) / limit),
        hasMore: page * limit < (search ? filteredClients.length : total),
      },
    });
  } catch (error) {
    console.error('[Portal API] Error fetching clients:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/organizations/[orgId]/clients
 * Invite a new client to the organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!isPortalAccessible() || !isPortalFeatureEnabled('clientManagement')) {
    return NextResponse.json(
      { error: PORTAL_ERROR_CODES.PORTAL_NOT_ENABLED, message: 'Client management is not enabled' },
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

    if (!PermissionGuards.canInviteClients(context.portalRole)) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.INSUFFICIENT_ROLE, message: 'Insufficient permissions to invite clients' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, requestedScopes = [], personalMessage } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Check plan limits
    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: orgId },
    });

    const plan = (portalSettings?.plan || 'STARTER') as OrganizationPlan;
    const planLimits = PLAN_LIMITS[plan];

    const currentClientCount = await prisma.organizationClient.count({
      where: { organizationId: orgId, status: { not: 'ARCHIVED' } },
    });

    if (planLimits.maxClients !== -1 && currentClientCount >= planLimits.maxClients) {
      return NextResponse.json(
        { error: PORTAL_ERROR_CODES.CLIENT_LIMIT_REACHED, message: 'Client limit reached for your plan' },
        { status: 403 }
      );
    }

    // Check if user already exists in system
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Check if already a client
    if (existingUser) {
      const existingClient = await prisma.organizationClient.findFirst({
        where: {
          organizationId: orgId,
          userId: existingUser.id,
          status: { not: 'ARCHIVED' },
        },
      });

      if (existingClient) {
        return NextResponse.json(
          { error: 'CLIENT_EXISTS', message: 'This user is already a client of your organization' },
          { status: 409 }
        );
      }
    }

    // Check for pending invitation
    const pendingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId: orgId,
        email: email.toLowerCase(),
        type: 'CLIENT',
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
        type: 'CLIENT',
        email: email.toLowerCase(),
        role: 'PORTAL_VIEWER', // Clients don't get a portal role
        status: 'PENDING',
        requestedScopes,
        token,
        tokenExpiresAt: new Date(
          Date.now() + INVITATION_CONSTANTS.TOKEN_VALIDITY_HOURS * 60 * 60 * 1000
        ),
        invitedByMemberId: context.membership.id,
        personalMessage: personalMessage || null,
      },
    });

    // TODO: Send invitation email
    // await sendClientInvitationEmail(email, invitation, context.membership.organization);

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          requestedScopes: invitation.requestedScopes,
          tokenExpiresAt: invitation.tokenExpiresAt,
          createdAt: invitation.createdAt,
        },
        message: 'Invitation sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Portal API] Error inviting client:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to invite client' },
      { status: 500 }
    );
  }
}
