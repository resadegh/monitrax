/**
 * GCP Identity Platform - Core Service
 *
 * Phase 1 of Firebase-to-GCP Identity Platform migration.
 * Provides server-side user sync, token-based authentication bridge,
 * and user provisioning for GCP Identity Platform.
 *
 * This module runs alongside the existing JWT auth system.
 * No existing auth flows are modified.
 *
 * @see docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { logAuth } from '@/lib/security/auditLog';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';

/**
 * Check if GCP Identity Platform is configured
 */
export function isGCPIdentityConfigured(): boolean {
  return Boolean(GCP_PROJECT_ID);
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Decoded GCP Identity Platform token claims
 * Produced by gcpTokenVerifier after verifying the Firebase/GCP ID token
 */
export interface GCPTokenClaims {
  /** GCP Identity Platform user UID */
  uid: string;
  /** User email from the identity provider */
  email: string;
  /** Whether the email has been verified by the provider */
  emailVerified: boolean;
  /** Display name from the identity provider */
  displayName?: string;
  /** Phone number from the identity provider */
  phoneNumber?: string;
  /** Photo URL from the identity provider */
  photoURL?: string;
  /** Sign-in provider (e.g., 'google.com', 'password', 'phone') */
  signInProvider?: string;
  /** Token issued-at timestamp (seconds) */
  iat: number;
  /** Token expiry timestamp (seconds) */
  exp: number;
  /** Token audience (GCP project ID) */
  aud: string;
  /** Token issuer */
  iss: string;
}

/**
 * Result of syncing a GCP Identity user to the local database
 */
export interface GCPUserSyncResult {
  /** The local Monitrax user ID */
  userId: string;
  /** The GCP Identity Platform UID */
  gcpUid: string;
  /** Whether a new local user was created */
  isNewUser: boolean;
  /** The user's email */
  email: string;
  /** The user's display name */
  name: string;
}

/**
 * Input for syncing a GCP user to the local database
 */
export interface GCPUserSyncInput {
  /** Verified token claims from GCP Identity Platform */
  claims: GCPTokenClaims;
  /** Client IP address for audit logging */
  ipAddress?: string;
  /** Client user agent for audit logging */
  userAgent?: string;
}

// =============================================================================
// USER SYNC - Bridge GCP Identity to Local Database
// =============================================================================

/**
 * Sync a GCP Identity Platform user to the local Monitrax database.
 *
 * This is the core bridge function:
 * 1. Looks up the user by email in the local database
 * 2. If found, updates the OAuth account link and returns a Monitrax JWT
 * 3. If not found, creates a new local user and OAuth account link
 *
 * The OAuthAccount model stores the GCP UID as the provider mapping,
 * allowing future lookups by GCP UID.
 */
export async function syncGCPUser(input: GCPUserSyncInput): Promise<GCPUserSyncResult> {
  const { claims, ipAddress, userAgent } = input;
  const { uid, email, emailVerified, displayName, signInProvider } = claims;

  if (!email) {
    throw new GCPIdentityError('GCP token missing email claim', 'MISSING_EMAIL');
  }

  const provider = 'gcp-identity';
  let isNewUser = false;

  log.info('GCP Identity user sync started', {
    gcpUid: uid,
    email,
    signInProvider,
  });

  // Check if an OAuth account link already exists for this GCP UID
  const existingOAuth = await prisma.oAuthAccount.findFirst({
    where: {
      provider,
      providerUserId: uid,
    },
    include: { user: true },
  });

  if (existingOAuth) {
    // User already linked — update last login
    await prisma.user.update({
      where: { id: existingOAuth.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress || null,
      },
    });

    // CDR: Log GCP-authenticated login event
    logAuth({
      userId: existingOAuth.userId,
      action: 'OAUTH_LOGIN',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { provider: 'gcp-identity', gcpUid: uid, signInProvider },
    }).catch(() => {}); // fire-and-forget — never block auth flow

    log.info('GCP Identity user sync completed (existing link)', {
      userId: existingOAuth.userId,
      gcpUid: uid,
    });

    return {
      userId: existingOAuth.userId,
      gcpUid: uid,
      isNewUser: false,
      email: existingOAuth.user.email,
      name: existingOAuth.user.name,
    };
  }

  // Check if a local user with this email exists (link accounts)
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Create OAuth account link for the existing user.
    // Use upsert to handle concurrent sync attempts gracefully —
    // multiple parallel API calls may all try to create this link at once.
    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: uid,
        },
      },
      update: { email },
      create: {
        userId: existingUser.id,
        provider,
        providerUserId: uid,
        email,
      },
    });

    // Update email verification status if verified by GCP
    if (emailVerified && !existingUser.emailVerified) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress || null,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress || null,
        },
      });
    }

    // CDR: Log first GCP-authenticated login for existing user
    logAuth({
      userId: existingUser.id,
      action: 'OAUTH_LOGIN',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { provider: 'gcp-identity', gcpUid: uid, signInProvider, firstLink: true },
    }).catch(() => {});

    log.info('GCP Identity user sync completed (linked existing user)', {
      userId: existingUser.id,
      gcpUid: uid,
    });

    return {
      userId: existingUser.id,
      gcpUid: uid,
      isNewUser: false,
      email: existingUser.email,
      name: existingUser.name,
    };
  }

  // Create a new local user with OAuth link.
  // Wrap in try/catch to handle race conditions — another concurrent request
  // may have already created this user + OAuthAccount between our checks.
  isNewUser = true;
  const name = displayName || email.split('@')[0];

  try {
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: null, // Passwordless - authenticated via GCP Identity
        emailVerified: emailVerified,
        emailVerifiedAt: emailVerified ? new Date() : null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress || null,
        oauthAccounts: {
          create: {
            provider,
            providerUserId: uid,
            email,
          },
        },
      },
    });

    // CDR: Log GCP-authenticated registration (new user created via GCP)
    logAuth({
      userId: newUser.id,
      action: 'REGISTER',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { provider: 'gcp-identity', gcpUid: uid, signInProvider, isNewUser: true },
    }).catch(() => {});

    log.info('GCP Identity user sync completed (new user created)', {
      userId: newUser.id,
      gcpUid: uid,
      isNewUser: true,
    });

    return {
      userId: newUser.id,
      gcpUid: uid,
      isNewUser: true,
      email: newUser.email,
      name: newUser.name,
    };
  } catch (createError: unknown) {
    // Race condition: another request already created this user/OAuthAccount.
    // Retry the lookup — the record should now exist.
    const retryOAuth = await prisma.oAuthAccount.findFirst({
      where: { provider, providerUserId: uid },
      include: { user: true },
    });

    if (retryOAuth) {
      log.info('GCP Identity user sync completed (concurrent create resolved)', {
        userId: retryOAuth.userId,
        gcpUid: uid,
      });

      return {
        userId: retryOAuth.userId,
        gcpUid: uid,
        isNewUser: false,
        email: retryOAuth.user.email,
        name: retryOAuth.user.name,
      };
    }

    // Also check by email — user may exist but OAuthAccount wasn't linked yet
    const retryUser = await prisma.user.findUnique({ where: { email } });
    if (retryUser) {
      await prisma.oAuthAccount.upsert({
        where: { provider_providerUserId: { provider, providerUserId: uid } },
        update: { email },
        create: { userId: retryUser.id, provider, providerUserId: uid, email },
      });

      return {
        userId: retryUser.id,
        gcpUid: uid,
        isNewUser: false,
        email: retryUser.email,
        name: retryUser.name,
      };
    }

    // If we still can't resolve, rethrow
    throw createError;
  }
}

// =============================================================================
// LOOKUP UTILITIES
// =============================================================================

/**
 * Find a local Monitrax user by their GCP Identity Platform UID.
 * Returns null if no linked user exists.
 */
export async function findUserByGCPUid(gcpUid: string) {
  const oauthAccount = await prisma.oAuthAccount.findFirst({
    where: {
      provider: 'gcp-identity',
      providerUserId: gcpUid,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      },
    },
  });

  return oauthAccount?.user || null;
}

/**
 * Unlink a GCP Identity Platform account from a local user.
 * Used during account management or cleanup.
 */
export async function unlinkGCPAccount(userId: string, gcpUid: string): Promise<boolean> {
  const result = await prisma.oAuthAccount.deleteMany({
    where: {
      userId,
      provider: 'gcp-identity',
      providerUserId: gcpUid,
    },
  });

  if (result.count > 0) {
    log.info('GCP Identity account unlinked', { userId, gcpUid });
    return true;
  }

  return false;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class GCPIdentityError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'GCPIdentityError';
    this.code = code;
  }
}
