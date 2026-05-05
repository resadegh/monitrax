/**
 * Phase 41g — shared adviser-client access verifier.
 *
 * Lifted from the inline check in `/api/portal/clients/[id]/snapshot/route.ts`
 * so the snapshot, entities, and money-flow endpoints all share the
 * canonical consent + membership + role + assignment guard. Reviewers
 * reject any new portal endpoint that exposes client data without
 * routing through this helper.
 *
 * Layered checks (rejection at any layer returns a structured error):
 *   1. OrganizationClient row exists
 *   2. Client status === 'ACTIVE' AND consentStatus === 'GRANTED'
 *   3. Caller has an active OrganizationMember seat on the same org
 *   4. Caller's role permits viewing client data (PermissionGuards)
 *   5. If caller is PORTAL_ADVISOR, they're assigned to this client
 *      (PORTAL_OWNER / PORTAL_ADMIN see the whole book)
 *
 * Returns the canonical access scopes from the DB row (NOT from the
 * caller-provided input) per CLAUDE.md §0 architect lens — scope
 * filter source-of-truth lives in the database, never in client-side
 * URL params or headers.
 */

import { prisma } from '@/lib/db';
import { PermissionGuards } from '@/lib/portal/permissions';
import type { DataAccessScope, PortalUserRole } from '@prisma/client';

const ROLE_MAPPING: Record<string, PortalUserRole> = {
  OWNER: 'PORTAL_OWNER',
  ADMIN: 'PORTAL_ADMIN',
  CONTRIBUTOR: 'PORTAL_ADVISOR',
  VIEWER: 'PORTAL_VIEWER',
};

export interface AdviserAccessResult {
  ok: true;
  orgClient: {
    id: string;
    organizationId: string;
    userId: string;
    accessScopes: DataAccessScope[];
    assignedToMemberId: string | null;
  };
  membership: {
    id: string;
    role: PortalUserRole;
  };
}

export interface AdviserAccessError {
  ok: false;
  status: number;
  code:
    | 'NOT_FOUND'
    | 'CONSENT_NOT_GRANTED'
    | 'NOT_A_MEMBER'
    | 'INSUFFICIENT_ROLE'
    | 'CLIENT_NOT_ASSIGNED';
  message: string;
}

/**
 * Verify the calling user can act on a given OrganizationClient.
 * `organizationClientId` is the row id, NOT the underlying User id.
 */
export async function verifyAdviserClientAccess(
  callerUserId: string,
  organizationClientId: string,
): Promise<AdviserAccessResult | AdviserAccessError> {
  const orgClient = await prisma.organizationClient.findUnique({
    where: { id: organizationClientId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      status: true,
      consentStatus: true,
      accessScopes: true,
      assignedToMemberId: true,
    },
  });

  if (!orgClient) {
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Client link not found',
    };
  }

  if (orgClient.status !== 'ACTIVE' || orgClient.consentStatus !== 'GRANTED') {
    return {
      ok: false,
      status: 403,
      code: 'CONSENT_NOT_GRANTED',
      message:
        'This client has not granted active consent. Send a consent request before viewing their data.',
    };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: callerUserId,
      organizationId: orgClient.organizationId,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (!membership) {
    return {
      ok: false,
      status: 403,
      code: 'NOT_A_MEMBER',
      message: 'You are not a member of this organisation',
    };
  }

  const portalRole = ROLE_MAPPING[membership.role] ?? 'PORTAL_VIEWER';

  if (!PermissionGuards.canViewClientData(portalRole)) {
    return {
      ok: false,
      status: 403,
      code: 'INSUFFICIENT_ROLE',
      message: 'Your role does not permit viewing client data',
    };
  }

  if (
    portalRole === 'PORTAL_ADVISOR' &&
    orgClient.assignedToMemberId !== membership.id
  ) {
    return {
      ok: false,
      status: 403,
      code: 'CLIENT_NOT_ASSIGNED',
      message: 'You are not assigned to this client',
    };
  }

  return {
    ok: true,
    orgClient: {
      id: orgClient.id,
      organizationId: orgClient.organizationId,
      userId: orgClient.userId,
      accessScopes: orgClient.accessScopes,
      assignedToMemberId: orgClient.assignedToMemberId,
    },
    membership: {
      id: membership.id,
      role: portalRole,
    },
  };
}
