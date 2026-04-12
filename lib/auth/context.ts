/**
 * Authentication Context — GCP Identity Platform
 *
 * Extracts authenticated user context from GCP/Firebase ID tokens.
 * All API routes use this to authenticate requests.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify as a GCP Identity Platform token (Firebase Auth)
 *   3. Look up the local user by GCP UID (via OAuthAccount link)
 *   4. If no local user, auto-sync (create/link) from token claims
 *   5. Return AuthContext with userId, email, role, name, tenantId
 *
 * No Monitrax JWTs are issued or verified. GCP is the sole identity provider.
 */

import { NextRequest } from 'next/server';
import { verifyGCPIdToken } from '@/lib/auth/gcpTokenVerifier';
import { syncGCPUser } from '@/lib/auth/gcpIdentity';
import type { GCPTokenClaims } from '@/lib/auth/gcpIdentity';
import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { UserRole } from './permissions';

// ============================================
// AUTH CONTEXT TYPE
// ============================================

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  tenantId: string; // In single-user mode, tenant = user
  /** MFA second factor method from Firebase token — present when MFA was completed in this session */
  signInSecondFactor?: string;
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Extract authentication context from a GCP Identity Platform token.
 * Returns null if not authenticated.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return null;
    }

    // Verify the GCP/Firebase ID token
    const claims = await verifyGCPIdToken(token);

    if (!claims) {
      return null;
    }

    // Look up the local user by GCP UID
    const user = await findOrSyncUser(claims, request);

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenantId: user.id,
      // Fix: G17 — Propagate MFA second factor claim for session-level MFA verification
      signInSecondFactor: claims.signInSecondFactor,
    };
  } catch (error) {
    log.error('Auth context extraction failed', error as Error);
    return null;
  }
}

/**
 * Get auth context or throw an error.
 * Use this when authentication is required.
 */
export async function requireAuthContext(request: NextRequest): Promise<AuthContext> {
  const context = await getAuthContext(request);

  if (!context) {
    throw new Error('Authentication required');
  }

  return context;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Extract a Bearer token from the Authorization header.
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

interface LocalUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

/**
 * Find the local user by GCP UID, or auto-sync if not found.
 * This ensures that every verified GCP user has a local DB record.
 */
async function findOrSyncUser(
  claims: GCPTokenClaims,
  request: NextRequest
): Promise<LocalUser | null> {
  // Fast path: look up by GCP UID via OAuthAccount link
  const oauthAccount = await prisma.oAuthAccount.findFirst({
    where: {
      provider: 'gcp-identity',
      providerUserId: claims.uid,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      },
    },
  });

  if (oauthAccount) {
    return oauthAccount.user as LocalUser;
  }

  // Slow path: user not yet synced — auto-sync from GCP claims
  log.info('Auto-syncing GCP user on first API call', {
    gcpUid: claims.uid,
    email: claims.email,
  });

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const syncResult = await syncGCPUser({
    claims,
    ipAddress,
    userAgent,
  });

  // Fetch the full user record with role
  const user = await prisma.user.findUnique({
    where: { id: syncResult.userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });

  return user as LocalUser | null;
}
