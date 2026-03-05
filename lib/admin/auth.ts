/**
 * Phase 33: Admin Portal Authentication
 *
 * Authentication utilities for the Admin Portal.
 * Handles admin session management, verification, and security.
 */

import { prisma } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { AdminRole } from '@prisma/client';
import { isAdminPortalAccessible, isAdminFeatureEnabled } from './featureFlags';
import { SECURITY_CONSTANTS, ADMIN_ERROR_CODES } from './constants';
import type { AdminUser, AdminSession, AdminApiError } from './types';

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
 * Hash a password using bcrypt (Phase 34 — CDR compliance)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against its hash.
 * Supports both bcrypt ($2a$/$2b$ prefix) and legacy SHA256 (salt:hash) formats
 * for backward compatibility during migration.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Bcrypt hashes start with $2a$ or $2b$
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy SHA256 format: salt:hash
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
