/**
 * Audit Logging System
 * Track security-relevant events for compliance and debugging
 */

import { log } from '@/lib/utils/logger';
import { createAuditLog } from '@/lib/security/auditLog';

// ============================================
// TYPES
// ============================================

export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'TOKEN_REFRESH'
  | 'PASSWORD_CHANGE'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'BULK_CREATE'
  | 'BULK_UPDATE'
  | 'BULK_DELETE'
  | 'EXPORT'
  | 'IMPORT'
  | 'PERMISSION_DENIED'
  | 'SETTINGS_CHANGE'
  | 'USER_INVITE'
  | 'USER_ROLE_CHANGE';

export interface AuditEvent {
  type: AuditEventType;
  principalId: string;
  principalEmail?: string;
  tenantId: string;
  targetEntity?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  reason?: string;
}

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log an audit event
 * Currently logs to console; can be extended to persist to database
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    // Log to structured logger
    log.info('Audit event', {
      audit: true,
      timestamp,
      type: event.type,
      principalId: event.principalId,
      principalEmail: event.principalEmail,
      tenantId: event.tenantId,
      targetEntity: event.targetEntity,
      targetId: event.targetId,
      outcome: event.outcome || 'SUCCESS',
      reason: event.reason,
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: event.metadata,
    });

    // Persist to AuditLog table via the DB-backed audit service (Phase 34)
    await createAuditLog({
      userId: event.principalId !== 'unknown' ? event.principalId : undefined,
      action: event.type,
      status: event.outcome === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
      entityType: event.targetEntity,
      entityId: event.targetId,
      ipAddress: event.ip,
      userAgent: event.userAgent,
      metadata: {
        ...event.metadata,
        ...(event.principalEmail && { principalEmail: event.principalEmail }),
        ...(event.reason && { reason: event.reason }),
        ...(event.tenantId && { tenantId: event.tenantId }),
      },
    });
  } catch (error) {
    // Don't let audit logging failures affect the main flow
    log.error('Failed to log audit event', error as Error, { event });
  }
}

// ============================================
// REQUEST METADATA EXTRACTION
// ============================================

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMeta(request: Request): RequestMeta {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Log a successful login
 */
export function logLogin(
  principalId: string,
  principalEmail: string,
  request: Request
): Promise<void> {
  const meta = extractRequestMeta(request);
  return logAuditEvent({
    type: 'LOGIN',
    principalId,
    principalEmail,
    tenantId: principalId,
    outcome: 'SUCCESS',
    ...meta,
  });
}

/**
 * Log a failed login attempt
 */
export function logLoginFailed(email: string, reason: string, request: Request): Promise<void> {
  const meta = extractRequestMeta(request);
  return logAuditEvent({
    type: 'LOGIN_FAILED',
    principalId: 'unknown',
    principalEmail: email,
    tenantId: 'unknown',
    outcome: 'FAILURE',
    reason,
    ...meta,
  });
}

/**
 * Log entity creation
 */
export function logCreate(
  principalId: string,
  tenantId: string,
  entity: string,
  entityId: string,
  request?: Request
): Promise<void> {
  const meta = request ? extractRequestMeta(request) : {};
  return logAuditEvent({
    type: 'CREATE',
    principalId,
    tenantId,
    targetEntity: entity,
    targetId: entityId,
    outcome: 'SUCCESS',
    ...meta,
  });
}

/**
 * Log entity update
 */
export function logUpdate(
  principalId: string,
  tenantId: string,
  entity: string,
  entityId: string,
  changes?: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const meta = request ? extractRequestMeta(request) : {};
  return logAuditEvent({
    type: 'UPDATE',
    principalId,
    tenantId,
    targetEntity: entity,
    targetId: entityId,
    metadata: changes ? { changes } : undefined,
    outcome: 'SUCCESS',
    ...meta,
  });
}

/**
 * Log entity deletion
 */
export function logDelete(
  principalId: string,
  tenantId: string,
  entity: string,
  entityId: string,
  request?: Request
): Promise<void> {
  const meta = request ? extractRequestMeta(request) : {};
  return logAuditEvent({
    type: 'DELETE',
    principalId,
    tenantId,
    targetEntity: entity,
    targetId: entityId,
    outcome: 'SUCCESS',
    ...meta,
  });
}

/**
 * Log permission denied event
 */
export function logPermissionDenied(
  principalId: string,
  tenantId: string,
  permission: string,
  resource?: string,
  request?: Request
): Promise<void> {
  const meta = request ? extractRequestMeta(request) : {};
  return logAuditEvent({
    type: 'PERMISSION_DENIED',
    principalId,
    tenantId,
    targetEntity: resource,
    metadata: { permission },
    outcome: 'FAILURE',
    reason: `Missing permission: ${permission}`,
    ...meta,
  });
}

/**
 * Log data export
 */
export function logExport(
  principalId: string,
  tenantId: string,
  exportType: string,
  recordCount: number,
  request?: Request
): Promise<void> {
  const meta = request ? extractRequestMeta(request) : {};
  return logAuditEvent({
    type: 'EXPORT',
    principalId,
    tenantId,
    metadata: { exportType, recordCount },
    outcome: 'SUCCESS',
    ...meta,
  });
}
