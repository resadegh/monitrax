/**
 * Route Permission Guards
 * Higher-order functions for protecting API routes
 *
 * CDR Compliance (Phase 34):
 *   Every authenticated API request is logged to the AuditLog table.
 *   Metadata is sanitized to exclude CDR-protected financial data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthContext, getAuthContext } from './context';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from './permissions';
import { errors, formatErrorResponse } from '@/lib/utils/errors';
import { log } from '@/lib/utils/logger';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { prisma } from '@/lib/db';
import { hasActiveCDRConsent } from '@/lib/services/cdrDataLifecycle';

// ============================================
// TYPES
// ============================================

export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContext,
  params?: T
) => Promise<Response>;

export interface GuardOptions {
  logAccess?: boolean;
}

// ============================================
// CDR AUDIT LOGGING (fire-and-forget)
// ============================================

/**
 * Derive a human-readable entity type from an API path.
 * e.g. /api/expenses/123 → "Expense", /api/accounts → "Account"
 */
function deriveEntityType(pathname: string): string | undefined {
  const segments = pathname.replace(/^\/api\//, '').split('/');
  const resource = segments[0];
  if (!resource) return undefined;

  const ENTITY_MAP: Record<string, string> = {
    expenses: 'Expense',
    income: 'Income',
    accounts: 'Account',
    loans: 'Loan',
    properties: 'Property',
    assets: 'Asset',
    investments: 'Investment',
    transactions: 'Transaction',
    'unified-transactions': 'Transaction',
    categories: 'Category',
    documents: 'Document',
    tax: 'Tax',
    auth: 'Auth',
    admin: 'Admin',
    basiq: 'Basiq',
    budget: 'Budget',
    health: 'Health',
    reports: 'Report',
  };

  return ENTITY_MAP[resource] || undefined;
}

/**
 * Log an API request to the audit trail (fire-and-forget).
 * CDR: metadata is sanitized to exclude financial data.
 */
function logApiRequest(
  userId: string | undefined,
  request: NextRequest,
  httpStatus: number,
  durationMs: number,
): void {
  const method = request.method;
  const endpoint = request.nextUrl.pathname;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  createAuditLog({
    userId,
    action: 'API_REQUEST',
    status: httpStatus >= 200 && httpStatus < 400 ? 'SUCCESS' : 'FAILURE',
    entityType: deriveEntityType(endpoint),
    ipAddress,
    userAgent,
    metadata: sanitizeCdrMetadata({
      method,
      endpoint,
      httpStatus,
      durationMs,
    }),
  }).catch(() => {}); // never throw — audit logging must not break the app
}

// ============================================
// AUTHENTICATION GUARD
// ============================================

/**
 * Wrap a handler to require authentication.
 * CDR: logs every request to audit trail (fire-and-forget).
 * @deprecated Prefer withPermission() for new routes — RBAC enforcement required (CLAUDE.md §12.5)
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (options?.logAccess) {
      log.info('Authenticated access', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

// ============================================
// PERMISSION GUARDS
// ============================================

/**
 * Wrap a handler to require a specific permission.
 * CDR: logs every request to audit trail (fire-and-forget).
 */
export function withPermission<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params: T) => Promise<Response> {
  return async (request: NextRequest, params: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasPermission(auth.role, permission)) {
      log.warn('Permission denied', {
        userId: auth.userId,
        permission,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(errors.forbidden(`Permission '${permission}' required`));
    }

    if (options?.logAccess) {
      log.info('Authorized access', {
        userId: auth.userId,
        permission,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

/**
 * Wrap a handler to require all specified permissions.
 * CDR: logs every request to audit trail (fire-and-forget).
 */
export function withAllPermissions<T = unknown>(
  permissions: Permission[],
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasAllPermissions(auth.role, permissions)) {
      const missing = permissions.filter((p) => !hasPermission(auth.role, p));
      log.warn('Permissions denied', {
        userId: auth.userId,
        required: permissions,
        missing,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(errors.forbidden(`Missing permissions: ${missing.join(', ')}`));
    }

    if (options?.logAccess) {
      log.info('Authorized access (all permissions)', {
        userId: auth.userId,
        permissions,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

/**
 * Wrap a handler to require any of the specified permissions.
 * CDR: logs every request to audit trail (fire-and-forget).
 */
export function withAnyPermission<T = unknown>(
  permissions: Permission[],
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasAnyPermission(auth.role, permissions)) {
      log.warn('Permissions denied', {
        userId: auth.userId,
        requiredAny: permissions,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden(`One of these permissions required: ${permissions.join(', ')}`)
      );
    }

    if (options?.logAccess) {
      log.info('Authorized access (any permission)', {
        userId: auth.userId,
        permissions,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

// ============================================
// OWNER-ONLY GUARD
// ============================================

/**
 * Wrap a handler to require OWNER role.
 * CDR: logs every request to audit trail (fire-and-forget).
 */
export function withOwnerOnly<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (auth.role !== 'OWNER') {
      log.warn('Owner-only access denied', {
        userId: auth.userId,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(errors.forbidden('Owner access required'));
    }

    if (options?.logAccess) {
      log.info('Owner access granted', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

// ============================================
// MFA ENFORCEMENT GUARD (Phase 34.4 — CDR §1.3)
// ============================================

/**
 * Wrap a handler to require both a permission AND MFA enrollment.
 *
 * MFA enforcement logic:
 *   - If the user's organization enforces MFA (user.mfaEnforcedByOrg === true)
 *     and the user has NOT enrolled in MFA (user.mfaEnabled === false),
 *     the request is rejected with 403.
 *   - If MFA is not enforced by the org, the request proceeds normally.
 *   - Firebase handles the actual MFA challenge/verification (GCP-First — no custom MFA logic).
 *
 * CDR: logs every request to audit trail (fire-and-forget).
 * Basiq §1.3 — MFA must be enforced, not just available.
 */
export function withMFARequired<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params: T) => Promise<Response> {
  return async (request: NextRequest, params: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasPermission(auth.role, permission)) {
      log.warn('Permission denied', {
        userId: auth.userId,
        permission,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(errors.forbidden(`Permission '${permission}' required`));
    }

    // MFA enforcement check: query user's MFA status from database
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { mfaEnabled: true, mfaEnforcedByOrg: true },
    });

    if (user?.mfaEnforcedByOrg && !user?.mfaEnabled) {
      log.warn('MFA required but not enabled', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden('MFA is required by your organization to access this resource')
      );
    }

    // Fix: G17 — Verify Firebase sign_in_second_factor token claim.
    // Checks that MFA was actually completed in this session, not just enrolled.
    // Firebase sets firebase.sign_in_second_factor when MFA challenge was passed.
    if (user?.mfaEnabled && !auth.signInSecondFactor) {
      log.warn('MFA enrolled but session lacks second factor verification', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden('MFA verification required for this resource. Please re-authenticate with MFA.')
      );
    }

    if (options?.logAccess) {
      log.info('MFA-protected access granted', {
        userId: auth.userId,
        permission,
        mfaEnabled: user?.mfaEnabled ?? false,
        secondFactor: auth.signInSecondFactor ?? 'none',
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}

// ============================================
// CDR CONSENT VERIFICATION GUARD (Phase 35 — CDR §5.5, §5.6)
// ============================================

/**
 * Wrap a handler to require permission, MFA enrollment, AND active CDR consent.
 *
 * Consent verification logic:
 *   - Checks user has active Basiq connections OR active org client consent
 *   - If no active consent found, returns 403 with consent-required message
 *   - Combines permission check + MFA check + consent check
 *
 * CDR: logs every request to audit trail (fire-and-forget).
 * Basiq §5.5, §5.6 — CDR data only accessible with active consent.
 * CLAUDE.md §13.2 — No consent = no data access.
 */
export function withActiveConsent<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params: T) => Promise<Response> {
  return async (request: NextRequest, params: T) => {
    const start = Date.now();
    const auth = await getAuthContext(request);

    if (!auth) {
      logApiRequest(undefined, request, 401, Date.now() - start);
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasPermission(auth.role, permission)) {
      log.warn('Permission denied', {
        userId: auth.userId,
        permission,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(errors.forbidden(`Permission '${permission}' required`));
    }

    // MFA enforcement check
    const mfaUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { mfaEnabled: true, mfaEnforcedByOrg: true },
    });

    if (mfaUser?.mfaEnforcedByOrg && !mfaUser?.mfaEnabled) {
      log.warn('MFA required but not enabled', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden('MFA is required by your organization to access this resource')
      );
    }

    // Fix: G17 — Verify Firebase sign_in_second_factor for CDR consent guard too
    if (mfaUser?.mfaEnabled && !auth.signInSecondFactor) {
      log.warn('MFA enrolled but session lacks second factor verification (consent guard)', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden('MFA verification required for CDR data access. Please re-authenticate with MFA.')
      );
    }

    // CDR consent verification (CLAUDE.md §13.2)
    const consentActive = await hasActiveCDRConsent(auth.userId);
    if (!consentActive) {
      log.warn('CDR consent not active', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
      });
      logApiRequest(auth.userId, request, 403, Date.now() - start);
      return formatErrorResponse(
        errors.forbidden('Active CDR consent is required to access this data. Please connect a bank account or renew your consent.')
      );
    }

    if (options?.logAccess) {
      log.info('CDR consent-verified access granted', {
        userId: auth.userId,
        permission,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    const response = await handler(request, auth, params);
    logApiRequest(auth.userId, request, response.status, Date.now() - start);
    return response;
  };
}
