/**
 * Enhanced API Security Middleware
 * Phase 10: Comprehensive security layer with audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, type AuthContext } from '@/lib/auth/context';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { logSecurity, logCRUD, type AuditLogEntry } from '@/lib/security/auditLog';
import { isMFARequired } from '@/lib/security/mfa';
import { validateTrackedSession, checkSessionSecurity } from '@/lib/session';
import { errors, formatErrorResponse } from '@/lib/utils/errors';
import { log } from '@/lib/utils/logger';

// ============================================
// TYPES
// ============================================

export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContext,
  params?: T
) => Promise<Response>;

export interface SecurityOptions {
  // Permission requirements
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // If true, requires all permissions; otherwise requires any

  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };

  // MFA requirements
  requireMFA?: boolean;

  // Session validation
  validateSession?: boolean;

  // Audit logging
  auditAction?: AuditLogEntry['action'];
  entityType?: string;
  logSuccess?: boolean;
  logFailure?: boolean;

  // IP restrictions
  allowedIps?: string[];
  blockedIps?: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract client IP address from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Extract user agent from request
 */
function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Check IP restrictions
 */
function checkIpRestrictions(
  ipAddress: string,
  allowedIps?: string[],
  blockedIps?: string[]
): { allowed: boolean; reason?: string } {
  if (blockedIps && blockedIps.includes(ipAddress)) {
    return { allowed: false, reason: 'IP address blocked' };
  }

  if (allowedIps && !allowedIps.includes(ipAddress)) {
    return { allowed: false, reason: 'IP address not in allowlist' };
  }

  return { allowed: true };
}

// ============================================
// SECURITY MIDDLEWARE
// ============================================

/**
 * Comprehensive security middleware with all Phase 10 features
 */
export function withSecurity<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options: SecurityOptions = {}
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    try {
      // 1. IP Restrictions
      if (options.allowedIps || options.blockedIps) {
        const ipCheck = checkIpRestrictions(ipAddress, options.allowedIps, options.blockedIps);

        if (!ipCheck.allowed) {
          await logSecurity({
            action: 'FORBIDDEN_ACCESS',
            ipAddress,
            userAgent,
            metadata: { reason: ipCheck.reason },
          });

          return formatErrorResponse(errors.forbidden(ipCheck.reason));
        }
      }

      // 2. Rate Limiting
      if (options.rateLimit) {
        // Use predefined 'api' config which has 100 req/min
        // For custom limits, consider adding to RATE_LIMITS in rateLimit.ts
        const rateLimitResult = checkRateLimit(ipAddress, 'api');

        if (!rateLimitResult.success) {
          await logSecurity({
            action: 'RATE_LIMIT_HIT',
            ipAddress,
            userAgent,
            metadata: {
              endpoint: request.nextUrl.pathname,
              limit: options.rateLimit.maxRequests,
              window: options.rateLimit.windowMs,
            },
          });

          return new NextResponse(
            JSON.stringify({
              error: 'Too many requests',
              retryAfter: rateLimitResult.retryAfter,
            }),
            {
              status: 429,
              headers: {
                'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
                'X-RateLimit-Limit': options.rateLimit.maxRequests.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              },
            }
          );
        }
      }

      // 3. Authentication
      const auth = await getAuthContext(request);

      if (!auth) {
        await logSecurity({
          action: 'UNAUTHORIZED_ACCESS',
          ipAddress,
          userAgent,
          metadata: { endpoint: request.nextUrl.pathname },
        });

        return formatErrorResponse(errors.unauthorized());
      }

      // 4. Session Validation
      if (options.validateSession) {
        const sessionId = (request.headers.get('x-session-id') || '') as string;

        if (sessionId) {
          const session = await validateTrackedSession(sessionId, ipAddress);

          if (!session) {
            await logSecurity({
              userId: auth.userId,
              action: 'UNAUTHORIZED_ACCESS',
              ipAddress,
              userAgent,
              metadata: { reason: 'invalid_session' },
            });

            return formatErrorResponse(errors.unauthorized('Invalid or expired session'));
          }

          // Check for suspicious session activity
          const securityCheck = await checkSessionSecurity(sessionId, ipAddress);

          if (securityCheck.isSuspicious) {
            await logSecurity({
              userId: auth.userId,
              action: 'FORBIDDEN_ACCESS',
              ipAddress,
              userAgent,
              metadata: {
                reason: 'suspicious_session',
                securityReasons: securityCheck.reasons,
              },
            });

            return formatErrorResponse(
              errors.forbidden('Suspicious session activity detected')
            );
          }
        }
      }

      // 5. MFA Verification
      if (options.requireMFA) {
        const mfaRequired = await isMFARequired(auth.userId);

        if (mfaRequired) {
          const mfaVerified = request.headers.get('x-mfa-verified') === 'true';

          if (!mfaVerified) {
            await logSecurity({
              userId: auth.userId,
              action: 'FORBIDDEN_ACCESS',
              ipAddress,
              userAgent,
              metadata: { reason: 'mfa_required' },
            });

            return new NextResponse(
              JSON.stringify({
                error: 'MFA verification required',
                code: 'MFA_REQUIRED',
              }),
              { status: 403 }
            );
          }
        }
      }

      // 6. Permission Checks
      if (options.permission) {
        if (!hasPermission(auth.role, options.permission)) {
          await logSecurity({
            userId: auth.userId,
            action: 'FORBIDDEN_ACCESS',
            ipAddress,
            userAgent,
            metadata: {
              permission: options.permission,
              role: auth.role,
              endpoint: request.nextUrl.pathname,
            },
          });

          return formatErrorResponse(
            errors.forbidden(`Permission '${options.permission}' required`)
          );
        }
      }

      if (options.permissions) {
        const hasRequiredPermissions = options.requireAll
          ? options.permissions.every((p) => hasPermission(auth.role, p))
          : options.permissions.some((p) => hasPermission(auth.role, p));

        if (!hasRequiredPermissions) {
          await logSecurity({
            userId: auth.userId,
            action: 'FORBIDDEN_ACCESS',
            ipAddress,
            userAgent,
            metadata: {
              permissions: options.permissions,
              requireAll: options.requireAll,
              role: auth.role,
              endpoint: request.nextUrl.pathname,
            },
          });

          return formatErrorResponse(
            errors.forbidden(
              `Permissions required: ${options.permissions.join(options.requireAll ? ', ' : ' or ')}`
            )
          );
        }
      }

      // 7. Execute Handler
      const response = await handler(request, auth, params);

      // 8. Success Audit Logging
      if (options.logSuccess && response.ok) {
        const entityId = params && typeof params === 'object' ? (params as { id?: string }).id : undefined;

        await logCRUD({
          userId: auth.userId,
          organizationId: auth.tenantId,
          action: options.auditAction || 'READ',
          entityType: options.entityType || 'Unknown',
          entityId: entityId || 'unknown',
          status: 'SUCCESS',
          ipAddress,
          userAgent,
        });
      }

      return response;
    } catch (error) {
      // 9. Failure Audit Logging
      if (options.logFailure) {
        await logSecurity({
          action: options.auditAction || 'UNAUTHORIZED_ACCESS',
          ipAddress,
          userAgent,
          metadata: {
            error: (error as Error).message,
            endpoint: request.nextUrl.pathname,
          },
        });
      }

      log.error('API security middleware error', error as Error);
      return formatErrorResponse(errors.internal());
    }
  };
}

// ============================================
// CONVENIENCE WRAPPERS
// ============================================

/**
 * Secure API route with authentication and audit logging
 */
export function secureAPI<T = unknown>(
  handler: AuthenticatedHandler<T>,
  entityType?: string,
  auditAction?: AuditLogEntry['action']
): (request: NextRequest, params?: T) => Promise<Response> {
  return withSecurity(handler, {
    validateSession: true,
    logSuccess: true,
    logFailure: true,
    entityType,
    auditAction,
  });
}

/**
 * Secure API route with permission check
 */
export function secureAPIWithPermission<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  entityType?: string,
  auditAction?: AuditLogEntry['action']
): (request: NextRequest, params?: T) => Promise<Response> {
  return withSecurity(handler, {
    permission,
    validateSession: true,
    logSuccess: true,
    logFailure: true,
    entityType,
    auditAction,
  });
}

/**
 * Secure API route with rate limiting
 */
export function secureAPIWithRateLimit<T = unknown>(
  handler: AuthenticatedHandler<T>,
  maxRequests = 100,
  windowMs = 60000
): (request: NextRequest, params?: T) => Promise<Response> {
  return withSecurity(handler, {
    rateLimit: { maxRequests, windowMs },
    validateSession: true,
    logSuccess: true,
    logFailure: true,
  });
}

/**
 * Secure admin-only API route
 */
export function secureAdminAPI<T = unknown>(
  handler: AuthenticatedHandler<T>,
  auditAction?: AuditLogEntry['action']
): (request: NextRequest, params?: T) => Promise<Response> {
  return withSecurity(handler, {
    permissions: ['user.manage', 'org.update'],
    requireAll: false, // Either user.manage OR org.update
    validateSession: true,
    requireMFA: true,
    logSuccess: true,
    logFailure: true,
    auditAction,
  });
}

/**
 * Secure owner-only API route
 */
export function secureOwnerAPI<T = unknown>(
  handler: AuthenticatedHandler<T>,
  auditAction?: AuditLogEntry['action']
): (request: NextRequest, params?: T) => Promise<Response> {
  return withSecurity(handler, {
    permission: 'org.delete', // Only OWNER has this permission
    validateSession: true,
    requireMFA: true,
    logSuccess: true,
    logFailure: true,
    auditAction,
  });
}
