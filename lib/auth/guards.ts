/**
 * Route Permission Guards
 * Higher-order functions for protecting API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthContext, getAuthContext } from './context';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from './permissions';
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

export interface GuardOptions {
  logAccess?: boolean;
}

// ============================================
// AUTHENTICATION GUARD
// ============================================

/**
 * Wrap a handler to require authentication
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return formatErrorResponse(errors.unauthorized());
    }

    if (options?.logAccess) {
      log.info('Authenticated access', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    return handler(request, auth, params);
  };
}

// ============================================
// PERMISSION GUARDS
// ============================================

/**
 * Wrap a handler to require a specific permission
 */
export function withPermission<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasPermission(auth.role, permission)) {
      log.warn('Permission denied', {
        userId: auth.userId,
        permission,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
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

    return handler(request, auth, params);
  };
}

/**
 * Wrap a handler to require all specified permissions
 */
export function withAllPermissions<T = unknown>(
  permissions: Permission[],
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);

    if (!auth) {
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

    return handler(request, auth, params);
  };
}

/**
 * Wrap a handler to require any of the specified permissions
 */
export function withAnyPermission<T = unknown>(
  permissions: Permission[],
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return formatErrorResponse(errors.unauthorized());
    }

    if (!hasAnyPermission(auth.role, permissions)) {
      log.warn('Permissions denied', {
        userId: auth.userId,
        requiredAny: permissions,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
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

    return handler(request, auth, params);
  };
}

// ============================================
// OWNER-ONLY GUARD
// ============================================

/**
 * Wrap a handler to require OWNER role
 */
export function withOwnerOnly<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return formatErrorResponse(errors.unauthorized());
    }

    if (auth.role !== 'OWNER') {
      log.warn('Owner-only access denied', {
        userId: auth.userId,
        role: auth.role,
        path: request.nextUrl.pathname,
      });
      return formatErrorResponse(errors.forbidden('Owner access required'));
    }

    if (options?.logAccess) {
      log.info('Owner access granted', {
        userId: auth.userId,
        path: request.nextUrl.pathname,
        method: request.method,
      });
    }

    return handler(request, auth, params);
  };
}
