/**
 * Phase 32: Enterprise Portal Authentication
 *
 * Authentication utilities for portal access.
 * This module provides portal-specific auth helpers that work
 * alongside the existing main app authentication.
 */

import { prisma } from '@/lib/db';
import type { PortalUserRole } from '@prisma/client';
import { isPortalAccessible } from './featureFlags';
import { PORTAL_ERROR_CODES } from './constants';

// =============================================================================
// TYPES
// =============================================================================

export interface PortalAuthContext {
  userId: string;
  organizationId: string;
  memberId: string;
  role: PortalUserRole;
  organizationSlug: string;
  organizationName: string;
  portalEnabled: boolean;
}

export interface PortalAuthError {
  code: keyof typeof PORTAL_ERROR_CODES;
  message: string;
}

export type PortalAuthResult =
  | { success: true; context: PortalAuthContext }
  | { success: false; error: PortalAuthError };

// =============================================================================
// AUTHENTICATION FUNCTIONS
// =============================================================================

/**
 * Verify that a user has access to the portal for a specific organization
 */
export async function verifyPortalAccess(
  userId: string,
  organizationId: string
): Promise<PortalAuthResult> {
  // Check if portal is enabled globally
  if (!isPortalAccessible()) {
    return {
      success: false,
      error: {
        code: 'PORTAL_NOT_ENABLED',
        message: 'Enterprise Portal is not enabled',
      },
    };
  }

  // Find the organization
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        where: { userId, isActive: true },
      },
    },
  });

  if (!organization) {
    return {
      success: false,
      error: {
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      },
    };
  }

  // Check if user is a member
  const membership = organization.members[0];
  if (!membership) {
    return {
      success: false,
      error: {
        code: 'NOT_A_MEMBER',
        message: 'You are not a member of this organization',
      },
    };
  }

  // Check if portal is enabled for this organization
  const portalSettings = await prisma.organizationPortalSettings.findUnique({
    where: { organizationId },
  });

  const portalEnabled = portalSettings?.portalEnabled ?? false;

  return {
    success: true,
    context: {
      userId,
      organizationId,
      memberId: membership.id,
      role: membership.role as unknown as PortalUserRole,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      portalEnabled,
    },
  };
}

/**
 * Verify that a user has access to the portal via organization slug
 */
export async function verifyPortalAccessBySlug(
  userId: string,
  organizationSlug: string
): Promise<PortalAuthResult> {
  // Check if portal is enabled globally
  if (!isPortalAccessible()) {
    return {
      success: false,
      error: {
        code: 'PORTAL_NOT_ENABLED',
        message: 'Enterprise Portal is not enabled',
      },
    };
  }

  // Find the organization by slug
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });

  if (!organization) {
    return {
      success: false,
      error: {
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found',
      },
    };
  }

  return verifyPortalAccess(userId, organization.id);
}

/**
 * Get all organizations a user has portal access to
 */
export async function getUserPortalOrganizations(userId: string): Promise<{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: PortalUserRole;
    portalEnabled: boolean;
  }>;
}> {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      organization: true,
    },
  });

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      const portalSettings = await prisma.organizationPortalSettings.findUnique({
        where: { organizationId: membership.organizationId },
      });

      return {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role as unknown as PortalUserRole,
        portalEnabled: portalSettings?.portalEnabled ?? false,
      };
    })
  );

  return { organizations };
}

/**
 * Check if a user is a client of any organization
 * (for showing consent management in their personal dashboard)
 */
export async function getUserClientOrganizations(userId: string): Promise<{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    clientStatus: string;
    consentStatus: string;
    accessScopes: string[];
  }>;
}> {
  const clientRelationships = await prisma.organizationClient.findMany({
    where: {
      userId,
      status: { not: 'ARCHIVED' },
    },
  });

  const organizations = await Promise.all(
    clientRelationships.map(async (client) => {
      const organization = await prisma.organization.findUnique({
        where: { id: client.organizationId },
      });

      return {
        id: client.organizationId,
        name: organization?.name ?? 'Unknown',
        slug: organization?.slug ?? '',
        clientStatus: client.status,
        consentStatus: client.consentStatus,
        accessScopes: client.accessScopes,
      };
    })
  );

  return { organizations };
}

// =============================================================================
// API KEY AUTHENTICATION
// =============================================================================

export interface ApiKeyAuthContext {
  organizationId: string;
  apiKeyId: string;
  scopes: string[];
}

export type ApiKeyAuthResult =
  | { success: true; context: ApiKeyAuthContext }
  | { success: false; error: PortalAuthError };

/**
 * Verify an API key and return its context
 */
export async function verifyApiKey(apiKey: string): Promise<ApiKeyAuthResult> {
  // Check if portal is enabled globally
  if (!isPortalAccessible()) {
    return {
      success: false,
      error: {
        code: 'PORTAL_NOT_ENABLED',
        message: 'Enterprise Portal is not enabled',
      },
    };
  }

  // Hash the key for comparison
  const crypto = await import('crypto');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Find the API key
  const apiKeyRecord = await prisma.organizationApiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKeyRecord) {
    return {
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    };
  }

  // Check if key is active
  if (!apiKeyRecord.isActive) {
    return {
      success: false,
      error: {
        code: 'API_KEY_REVOKED',
        message: 'API key has been revoked',
      },
    };
  }

  // Check if key has expired
  if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
    return {
      success: false,
      error: {
        code: 'API_KEY_EXPIRED',
        message: 'API key has expired',
      },
    };
  }

  // Update usage tracking
  await prisma.organizationApiKey.update({
    where: { id: apiKeyRecord.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });

  return {
    success: true,
    context: {
      organizationId: apiKeyRecord.organizationId,
      apiKeyId: apiKeyRecord.id,
      scopes: apiKeyRecord.scopes,
    },
  };
}

/**
 * Generate a new API key
 */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const crypto = await import('crypto');

  // Generate a random key
  const randomBytes = crypto.randomBytes(32);
  const key = `mtrx_pk_${randomBytes.toString('hex')}`;

  // Hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Prefix for identification
  const prefix = key.substring(0, 16);

  return { key, hash, prefix };
}
