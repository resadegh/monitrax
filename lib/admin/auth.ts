/**
 * Phase 33: Admin Portal Authentication
 *
 * Authentication utilities for the Admin Portal.
 * Handles admin session management, verification, and security.
 */

import { prisma } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';
import type { AdminRole } from '@prisma/client';
import { isAdminPortalAccessible, isAdminFeatureEnabled } from './featureFlags';
import { SECURITY_CONSTANTS, ADMIN_ERROR_CODES } from './constants';
import type { AdminUser, AdminSession, AdminApiError } from './types';
import { verifyGCPIdToken } from '@/lib/auth/gcpTokenVerifier';
import { log } from '@/lib/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface AdminAuthContext {
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
  ipAddress: string;
  /**
   * True when the admin authenticated successfully but has not yet enrolled MFA.
   * Privileged roles (SUPER_ADMIN, BILLING_ADMIN) MUST enroll MFA before
   * accessing any admin routes. When this flag is true:
   * - Client should redirect to /admin/mfa-setup
   * - Admin API routes should reject requests with MFA_SETUP_REQUIRED
   * - Only the MFA setup endpoints are accessible
   */
  mfaSetupRequired?: boolean;
}

export interface AdminAuthResult {
  success: boolean;
  context?: AdminAuthContext;
  error?: AdminApiError;
}

// Session with token - only returned when creating a new session
export interface AdminSessionWithToken extends AdminSession {
  token: string;
}

export interface AdminSessionResult {
  success: boolean;
  session?: AdminSessionWithToken;
  error?: AdminApiError;
}

// =============================================================================
// TOKEN UTILITIES
// =============================================================================

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a session token and its hash
 */
export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = generateToken();
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

// =============================================================================
// PASSWORD UTILITIES
// =============================================================================

/**
 * Hash a password using bcrypt-compatible method
 * Note: In production, use bcrypt or argon2
 */
export async function hashPassword(password: string): Promise<string> {
  // Using a simple hash for demo - in production use bcrypt
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = createHash('sha256').update(password + salt).digest('hex');
  return hash === verifyHash;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH} characters`);
  }

  if (SECURITY_CONSTANTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (SECURITY_CONSTANTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (SECURITY_CONSTANTS.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (SECURITY_CONSTANTS.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// IP WHITELIST UTILITIES
// =============================================================================

/**
 * Check if an IP address is in the whitelist
 */
export function isIpWhitelisted(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    return true; // No whitelist = allow all
  }

  // Check exact match
  if (whitelist.includes(ip)) {
    return true;
  }

  // Check CIDR ranges (simplified - for production use a proper IP library)
  for (const entry of whitelist) {
    if (entry.includes('/')) {
      // Basic CIDR check - in production use a proper library
      const [network] = entry.split('/');
      if (ip.startsWith(network.split('.').slice(0, 3).join('.'))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get global IP whitelist from environment
 */
export function getGlobalIpWhitelist(): string[] {
  const whitelist = process.env.ADMIN_IP_WHITELIST;
  if (!whitelist) return [];
  return whitelist.split(',').map((ip: string) => ip.trim());
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Create a new admin session
 */
export async function createAdminSession(
  adminId: string,
  ipAddress: string,
  userAgent?: string
): Promise<AdminSessionResult> {
  try {
    const { token, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SECURITY_CONSTANTS.SESSION_DURATION_MS);

    const session = await prisma.adminSession.create({
      data: {
        adminUserId: adminId,
        token,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      success: true,
      session: {
        ...session,
        // Return the plain token (only time it's available)
        token,
      } as AdminSessionWithToken,
    };
  } catch (error) {
    console.error('[Admin Auth] Failed to create session:', error);
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create session',
      },
    };
  }
}

/**
 * Verify an admin session token
 */
export async function verifyAdminSession(token: string): Promise<AdminAuthResult> {
  // Check if portal is accessible
  if (!isAdminPortalAccessible()) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
        message: 'Admin portal is not enabled',
      },
    };
  }

  try {
    const tokenHash = hashToken(token);

    const session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    if (!session) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.SESSION_INVALID,
          message: 'Invalid session token',
        },
      };
    }

    // Check if session is revoked
    if (session.isRevoked) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.SESSION_INVALID,
          message: 'Session has been revoked',
        },
      };
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.SESSION_EXPIRED,
          message: 'Session has expired',
        },
      };
    }

    // Check if admin is active
    if (!session.adminUser.isActive) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.ACCOUNT_INACTIVE,
          message: 'Admin account is inactive',
        },
      };
    }

    // Update last activity
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      success: true,
      context: {
        adminId: session.adminUser.id,
        email: session.adminUser.email,
        name: session.adminUser.name,
        role: session.adminUser.role,
        sessionId: session.id,
        ipAddress: session.ipAddress,
      },
    };
  } catch (error) {
    console.error('[Admin Auth] Session verification failed:', error);
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
        message: 'Session verification failed',
      },
    };
  }
}

/**
 * Revoke an admin session
 */
export async function revokeAdminSession(
  sessionId: string,
  reason?: string
): Promise<{ success: boolean; error?: AdminApiError }> {
  try {
    await prisma.adminSession.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[Admin Auth] Failed to revoke session:', error);
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to revoke session',
      },
    };
  }
}

/**
 * Revoke all sessions for an admin
 */
export async function revokeAllAdminSessions(
  adminId: string,
  reason?: string,
  exceptSessionId?: string
): Promise<{ success: boolean; count: number; error?: AdminApiError }> {
  try {
    const result = await prisma.adminSession.updateMany({
      where: {
        adminUserId: adminId,
        isRevoked: false,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    return { success: true, count: result.count };
  } catch (error) {
    console.error('[Admin Auth] Failed to revoke all sessions:', error);
    return {
      success: false,
      count: 0,
      error: {
        code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to revoke sessions',
      },
    };
  }
}

// =============================================================================
// LOGIN UTILITIES
// =============================================================================

/**
 * Check if an admin account is locked
 */
export async function isAccountLocked(adminId: string): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { lockedUntil: true },
  });

  if (!admin || !admin.lockedUntil) {
    return false;
  }

  return admin.lockedUntil > new Date();
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  adminId: string
): Promise<{ locked: boolean; remainingAttempts: number }> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { failedLoginCount: true },
  });

  if (!admin) {
    return { locked: false, remainingAttempts: SECURITY_CONSTANTS.MAX_LOGIN_ATTEMPTS };
  }

  const newCount = admin.failedLoginCount + 1;
  const shouldLock = newCount >= SECURITY_CONSTANTS.MAX_LOGIN_ATTEMPTS;

  await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      failedLoginCount: newCount,
      ...(shouldLock
        ? { lockedUntil: new Date(Date.now() + SECURITY_CONSTANTS.LOCKOUT_DURATION_MS) }
        : {}),
    },
  });

  return {
    locked: shouldLock,
    remainingAttempts: Math.max(0, SECURITY_CONSTANTS.MAX_LOGIN_ATTEMPTS - newCount),
  };
}

/**
 * Reset failed login count after successful login
 */
export async function resetFailedLoginCount(adminId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
}

// =============================================================================
// ADMIN LOOKUP
// =============================================================================

/**
 * Get admin by email
 */
export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  return admin as AdminUser | null;
}

/**
 * Get admin by ID
 */
export async function getAdminById(id: string): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { id },
  });

  return admin as AdminUser | null;
}

// =============================================================================
// REQUEST HELPERS
// =============================================================================

/**
 * Extract admin session token from request
 */
export function extractAdminToken(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...value] = c.trim().split('=');
        return [key, value.join('=')];
      })
    );
    if (cookies['admin_session']) {
      return cookies['admin_session'];
    }
  }

  return null;
}

/**
 * Extract client IP from request
 */
export function extractClientIp(request: Request): string {
  // Check X-Forwarded-For header (common with proxies)
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get('X-Real-IP');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return '0.0.0.0';
}

/**
 * Extract user agent from request
 */
export function extractUserAgent(request: Request): string | undefined {
  return request.headers.get('User-Agent') || undefined;
}

// =============================================================================
// AUTHENTICATION MIDDLEWARE HELPER
// =============================================================================

/**
 * Verify admin authentication for API routes
 */
export async function verifyAdminAuth(request: Request): Promise<AdminAuthResult> {
  // Check if portal is accessible
  if (!isAdminPortalAccessible()) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
        message: 'Admin portal is not enabled',
      },
    };
  }

  // Extract token
  const token = extractAdminToken(request);
  if (!token) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.SESSION_INVALID,
        message: 'No authentication token provided',
      },
    };
  }

  // Verify session
  const result = await verifyAdminSession(token);
  if (!result.success || !result.context) {
    return result;
  }

  // MFA enforcement for SUPER_ADMIN and BILLING_ADMIN roles (Phase 34.4 — CDR §1.3)
  // These privileged roles have access to sensitive CDR data and admin operations.
  const mfaRequiredRoles: AdminRole[] = ['SUPER_ADMIN', 'BILLING_ADMIN'];
  if (mfaRequiredRoles.includes(result.context.role)) {
    const mfaAdmin = await getAdminById(result.context.adminId);
    if (mfaAdmin && !mfaAdmin.mfaEnabled) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.MFA_REQUIRED,
          message: 'MFA is required for admin accounts with elevated privileges',
        },
      };
    }
  }

  // Check IP whitelist if enabled
  if (isAdminFeatureEnabled('ipWhitelist')) {
    const clientIp = extractClientIp(request);
    const admin = await getAdminById(result.context.adminId);

    if (admin) {
      // Check admin-specific whitelist
      if (admin.ipWhitelist.length > 0 && !isIpWhitelisted(clientIp, admin.ipWhitelist)) {
        return {
          success: false,
          error: {
            code: ADMIN_ERROR_CODES.IP_NOT_WHITELISTED,
            message: 'Access denied from this IP address',
          },
        };
      }

      // Check global whitelist
      const globalWhitelist = getGlobalIpWhitelist();
      if (globalWhitelist.length > 0 && !isIpWhitelisted(clientIp, globalWhitelist)) {
        return {
          success: false,
          error: {
            code: ADMIN_ERROR_CODES.IP_NOT_WHITELISTED,
            message: 'Access denied from this IP address',
          },
        };
      }
    }
  }

  return result;
}

// =============================================================================
// GCP-FIRST ADMIN AUTH (Phase M — Admin Portal GCP Migration)
// =============================================================================

/**
 * Valid admin roles from Firebase custom claims.
 * These are set on admin user accounts via Firebase Admin SDK:
 *   admin.auth().setCustomUserClaims(uid, { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' })
 */
const VALID_ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'VIEWER'];

/**
 * Verify admin authentication using GCP Identity Platform (Firebase Auth).
 *
 * Phase M: GCP-First Admin Portal Migration
 * Replaces the custom AdminUser/AdminSession auth with Firebase ID token
 * verification + custom claims check.
 *
 * Admin users authenticate via Firebase Auth (same as regular users) and have
 * custom claims set on their Firebase account:
 *   { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SUPPORT_ADMIN' | 'VIEWER' }
 *
 * Flow:
 *   1. Check admin portal is accessible (feature flag)
 *   2. Extract Bearer token from Authorization header or admin_session cookie
 *   3. Verify as a GCP Identity Platform token (same verifier as user auth)
 *   4. Check custom claim: monitraxAdmin === true
 *   5. Extract adminRole from custom claims
 *   6. Verify MFA for privileged roles (SUPER_ADMIN, BILLING_ADMIN)
 *   7. Return AdminAuthContext compatible with existing admin route code
 *
 * Returns AdminAuthResult — same interface as verifyAdminAuth() for drop-in replacement.
 */
export async function verifyAdminGCPAuth(request: Request): Promise<AdminAuthResult> {
  // 1. Check if portal is accessible
  if (!isAdminPortalAccessible()) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
        message: 'Admin portal is not enabled',
      },
    };
  }

  // 2. Extract token from Authorization header or admin_session cookie
  const token = extractAdminToken(request);
  if (!token) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.SESSION_INVALID,
        message: 'No authentication token provided',
      },
    };
  }

  // 3. Verify as GCP Identity Platform token
  const claims = await verifyGCPIdToken(token);
  if (!claims) {
    return {
      success: false,
      error: {
        code: ADMIN_ERROR_CODES.SESSION_INVALID,
        message: 'Invalid or expired authentication token',
      },
    };
  }

  // 4. Check custom claim: monitraxAdmin === true
  //    Firebase custom claims appear as top-level keys in the JWT payload.
  //    They are set via Firebase Admin SDK: admin.auth().setCustomUserClaims(uid, { ... })
  //    The verifyGCPIdToken returns the raw JWT payload, so we access the
  //    custom claims from the original token payload.
  //
  //    For now, we also support a fallback: if the user has an AdminUser record
  //    in the database linked by email, they are treated as an admin. This allows
  //    gradual migration from the old system.
  const rawPayload = getRawTokenPayload(token);
  const isMonitorAdmin = rawPayload?.monitraxAdmin === true;
  const claimAdminRole = rawPayload?.adminRole as string | undefined;

  // Fallback: check AdminUser table by email (backward compatibility during migration)
  let adminRole: AdminRole | null = null;
  let adminId: string | null = null;

  if (isMonitorAdmin && claimAdminRole && VALID_ADMIN_ROLES.includes(claimAdminRole as AdminRole)) {
    // Firebase custom claims path (target state)
    adminRole = claimAdminRole as AdminRole;

    // Auto-sync AdminUser record: if a Firebase-custom-claims admin logs in but
    // has no AdminUser row yet, create one automatically. This ensures the admin
    // appears in the /admin/settings → Admin Users list without manual steps.
    // The authoritative source for role is the Firebase custom claim — if the
    // DB record already exists with a different role, we update it to match.
    try {
      const adminUser = await prisma.adminUser.upsert({
        where: { email: claims.email },
        update: {
          // Keep the DB role in sync with the Firebase claim (claim wins)
          role: adminRole,
          // Heuristic: Google Sign-In users are considered MFA-enrolled because
          // Google enforces 2FA at the account level. Email/password users must
          // enroll via /admin/mfa-setup and are updated later.
          mfaEnabled: (rawPayload?.firebase as Record<string, unknown>)?.sign_in_provider === 'google.com' || undefined,
        },
        create: {
          email: claims.email,
          name: claims.displayName || claims.email.split('@')[0] || 'Admin',
          role: adminRole,
          // Placeholder — Firebase Auth handles the real credential.
          // This admin never uses the legacy password path; password is
          // verified via GCP Identity Platform.
          passwordHash: 'gcp-identity-platform',
          isActive: true,
          mfaEnabled: (rawPayload?.firebase as Record<string, unknown>)?.sign_in_provider === 'google.com',
        },
        select: { id: true, isActive: true },
      });

      if (!adminUser.isActive) {
        return {
          success: false,
          error: {
            code: ADMIN_ERROR_CODES.SESSION_INVALID,
            message: 'Admin account is deactivated',
          },
        };
      }
      adminId = adminUser.id;
    } catch (err) {
      // Upsert failed — fall back to lookup-only. Log for investigation.
      log.error('[verifyAdminGCPAuth] AdminUser upsert failed', err as Error);
      const fallbackUser = await prisma.adminUser.findFirst({
        where: { email: claims.email },
        select: { id: true, isActive: true },
      });
      if (fallbackUser && !fallbackUser.isActive) {
        return {
          success: false,
          error: {
            code: ADMIN_ERROR_CODES.SESSION_INVALID,
            message: 'Admin account is deactivated',
          },
        };
      }
      adminId = fallbackUser?.id || claims.uid;
    }
  } else {
    // Fallback: check AdminUser table by email (old system compatibility)
    const adminUser = await prisma.adminUser.findFirst({
      where: { email: claims.email },
      select: { id: true, role: true, isActive: true },
    });

    if (!adminUser) {
      log.warn('Non-admin user attempted admin portal access', {
        email: claims.email,
        gcpUid: claims.uid,
      });
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.SESSION_INVALID,
          message: 'Access denied — admin privileges required',
        },
      };
    }

    if (!adminUser.isActive) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.SESSION_INVALID,
          message: 'Admin account is deactivated',
        },
      };
    }

    adminRole = adminUser.role;
    adminId = adminUser.id;
  }

  // 5. MFA enforcement for privileged admin roles (CDR §1.3)
  //
  // STRICT POLICY: SUPER_ADMIN / BILLING_ADMIN must have MFA enrolled.
  //
  // UX POLICY: Instead of hard-rejecting at login (which creates a chicken-and-egg
  // where admins can't log in to enroll), we authenticate them successfully BUT
  // set `mfaSetupRequired: true` in the context. The admin can access ONLY the
  // MFA setup endpoints until they enroll. All other admin API routes will reject
  // with MFA_SETUP_REQUIRED and the client redirects to /admin/mfa-setup.
  //
  // Google Sign-In users are trusted because Google provides 2FA at the account
  // level; Firebase does not set sign_in_second_factor for federated providers.
  let mfaSetupRequired = false;
  const mfaRequiredRoles: AdminRole[] = ['SUPER_ADMIN', 'BILLING_ADMIN'];
  if (mfaRequiredRoles.includes(adminRole)) {
    const firebaseClaims = rawPayload?.firebase as Record<string, unknown> | undefined;
    const secondFactor = firebaseClaims?.sign_in_second_factor;
    const signInProvider = firebaseClaims?.sign_in_provider as string | undefined;

    const hasSecondFactor = !!secondFactor;
    const isGoogleSignIn = signInProvider === 'google.com';

    if (!hasSecondFactor && !isGoogleSignIn) {
      // Email/password admin without MFA — flag for setup.
      // Do NOT reject — let them through to the setup page.
      mfaSetupRequired = true;
    }
  }

  // 6. IP whitelist (if enabled)
  if (isAdminFeatureEnabled('ipWhitelist')) {
    const clientIp = extractClientIp(request);
    const adminUser = await prisma.adminUser.findFirst({
      where: { email: claims.email },
      select: { ipWhitelist: true },
    });

    // Check admin-specific whitelist
    if (adminUser?.ipWhitelist && adminUser.ipWhitelist.length > 0) {
      if (!isIpWhitelisted(clientIp, adminUser.ipWhitelist)) {
        return {
          success: false,
          error: {
            code: ADMIN_ERROR_CODES.IP_NOT_WHITELISTED,
            message: 'Access denied from this IP address',
          },
        };
      }
    }

    // Check global whitelist
    const globalWhitelist = getGlobalIpWhitelist();
    if (globalWhitelist.length > 0 && !isIpWhitelisted(clientIp, globalWhitelist)) {
      return {
        success: false,
        error: {
          code: ADMIN_ERROR_CODES.IP_NOT_WHITELISTED,
          message: 'Access denied from this IP address',
        },
      };
    }
  }

  const clientIp = extractClientIp(request);

  return {
    success: true,
    context: {
      adminId: adminId!,
      email: claims.email,
      name: claims.displayName || claims.email,
      role: adminRole,
      sessionId: claims.uid, // Use GCP UID as session identifier
      ipAddress: clientIp,
      mfaSetupRequired,
    },
  };
}

/**
 * Admin API route guard: rejects if MFA setup is required but not yet completed.
 * Use this helper in admin routes that should NOT be accessible during MFA setup.
 *
 * Usage:
 *   const authResult = await verifyAdminGCPAuth(request);
 *   if (authResult.context?.mfaSetupRequired) {
 *     return mfaSetupRequiredResponse();
 *   }
 */
export function mfaSetupRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'MFA_SETUP_REQUIRED',
        message: 'MFA enrollment is required before accessing this resource. Please complete MFA setup at /admin/mfa-setup.',
      },
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Decode JWT payload without verification (token is already verified by verifyGCPIdToken).
 * Used to access Firebase custom claims which aren't included in GCPTokenClaims type.
 */
function getRawTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
