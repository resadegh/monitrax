/**
 * Audit Logging Service
 * Phase 10: Comprehensive, immutable audit logging for security and compliance
 */

import { prisma } from '@/lib/db';
import type { AuditAction, AuditStatus } from '@prisma/client';
import { log } from '@/lib/utils/logger';

// ============================================
// TYPES
// ============================================

export interface AuditLogEntry {
  userId?: string;
  organizationId?: string;
  action: AuditAction;
  status?: AuditStatus;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  userId?: string;
  organizationId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: AuditAction;
  status: AuditStatus;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}

// ============================================
// AUDIT LOGGING FUNCTIONS
// ============================================

/**
 * Create an audit log entry
 * This is the primary function for logging all security-relevant actions
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        organizationId: entry.organizationId,
        action: entry.action,
        status: entry.status ?? 'SUCCESS',
        entityType: entry.entityType,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata ?? {},
      },
    });
  } catch (error) {
    // Log audit failures but don't throw - audit logging should never break app flow
    log.error('Failed to create audit log', error as Error);
  }
}

/**
 * Log a successful action
 */
export async function logSuccess(entry: Omit<AuditLogEntry, 'status'>): Promise<void> {
  await createAuditLog({ ...entry, status: 'SUCCESS' });
}

/**
 * Log a failed action
 */
export async function logFailure(entry: Omit<AuditLogEntry, 'status'>): Promise<void> {
  await createAuditLog({ ...entry, status: 'FAILURE' });
}

/**
 * Log a blocked action
 */
export async function logBlocked(entry: Omit<AuditLogEntry, 'status'>): Promise<void> {
  await createAuditLog({ ...entry, status: 'BLOCKED' });
}

// ============================================
// SPECIALIZED AUDIT LOGGING FUNCTIONS
// ============================================

/**
 * Log authentication events
 */
export async function logAuth(params: {
  userId?: string;
  action: 'LOGIN' | 'LOGOUT' | 'MFA_CHALLENGE' | 'MFA_SUCCESS' | 'MFA_FAILURE' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET';
  status?: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    action: params.action,
    status: params.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

/**
 * Log CRUD operations on entities
 */
export async function logCRUD(params: {
  userId: string;
  organizationId?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  status?: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    organizationId: params.organizationId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    status: params.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

/**
 * Log export operations
 */
export async function logExport(params: {
  userId: string;
  organizationId?: string;
  entityType: string;
  recordCount?: number;
  format?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    organizationId: params.organizationId,
    action: 'EXPORT',
    entityType: params.entityType,
    status: 'SUCCESS',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      recordCount: params.recordCount,
      format: params.format,
    },
  });
}

/**
 * Log administrative actions
 */
export async function logAdmin(params: {
  userId: string;
  organizationId?: string;
  action: 'ROLE_CHANGE' | 'ORG_MEMBER_ADD' | 'ORG_MEMBER_REMOVE' | 'ORG_SETTINGS_UPDATE' | 'SESSION_REVOKE';
  targetUserId?: string;
  status?: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    organizationId: params.organizationId,
    action: params.action,
    entityType: 'User',
    entityId: params.targetUserId,
    status: params.status,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

/**
 * Log security events
 */
export async function logSecurity(params: {
  userId?: string;
  organizationId?: string;
  action: 'RATE_LIMIT_HIT' | 'UNAUTHORIZED_ACCESS' | 'FORBIDDEN_ACCESS';
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    userId: params.userId,
    organizationId: params.organizationId,
    action: params.action,
    status: 'BLOCKED',
    entityType: params.entityType,
    entityId: params.entityId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

// ============================================
// AUDIT LOG QUERYING
// ============================================

/**
 * Query audit logs with filters and pagination
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  logs: AuditLogResult[];
  total: number;
  hasMore: boolean;
}> {
  const where = {
    ...(query.userId && { userId: query.userId }),
    ...(query.organizationId && { organizationId: query.organizationId }),
    ...(query.action && { action: query.action }),
    ...(query.status && { status: query.status }),
    ...(query.entityType && { entityType: query.entityType }),
    ...(query.entityId && { entityId: query.entityId }),
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate && { gte: query.startDate }),
            ...(query.endDate && { lte: query.endDate }),
          },
        }
      : {}),
  };

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs as AuditLogResult[],
    total,
    hasMore: offset + logs.length < total,
  };
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{
  logs: AuditLogResult[];
  total: number;
  hasMore: boolean;
}> {
  return queryAuditLogs({ userId, limit, offset });
}

/**
 * Get audit logs for a specific organization
 */
export async function getOrganizationAuditLogs(
  organizationId: string,
  limit = 50,
  offset = 0
): Promise<{
  logs: AuditLogResult[];
  total: number;
  hasMore: boolean;
}> {
  return queryAuditLogs({ organizationId, limit, offset });
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: string,
  limit = 50,
  offset = 0
): Promise<{
  logs: AuditLogResult[];
  total: number;
  hasMore: boolean;
}> {
  return queryAuditLogs({ entityType, entityId, limit, offset });
}

/**
 * Get recent security events
 */
export async function getRecentSecurityEvents(
  limit = 100,
  organizationId?: string
): Promise<AuditLogResult[]> {
  const securityActions: AuditAction[] = [
    'RATE_LIMIT_HIT',
    'UNAUTHORIZED_ACCESS',
    'FORBIDDEN_ACCESS',
    'MFA_FAILURE',
  ];

  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: securityActions },
      ...(organizationId && { organizationId }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs as AuditLogResult[];
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(params: {
  userId?: string;
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalLogs: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  actionBreakdown: Record<string, number>;
}> {
  const where = {
    ...(params.userId && { userId: params.userId }),
    ...(params.organizationId && { organizationId: params.organizationId }),
    ...(params.startDate || params.endDate
      ? {
          createdAt: {
            ...(params.startDate && { gte: params.startDate }),
            ...(params.endDate && { lte: params.endDate }),
          },
        }
      : {}),
  };

  const [total, statusCounts, actionCounts] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
    }),
  ]);

  const statusMap = statusCounts.reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {} as Record<string, number>
  );

  const actionBreakdown = actionCounts.reduce(
    (acc, item) => {
      acc[item.action] = item._count.action;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalLogs: total,
    successCount: statusMap['SUCCESS'] ?? 0,
    failureCount: statusMap['FAILURE'] ?? 0,
    blockedCount: statusMap['BLOCKED'] ?? 0,
    actionBreakdown,
  };
}

// ============================================
// EXPORT HELPERS
// ============================================

/**
 * Export audit logs to CSV format
 */
export function formatAuditLogsAsCSV(logs: AuditLogResult[]): string {
  const headers = [
    'Timestamp',
    'User ID',
    'Organization ID',
    'Action',
    'Status',
    'Entity Type',
    'Entity ID',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.userId ?? '',
    log.organizationId ?? '',
    log.action,
    log.status,
    log.entityType ?? '',
    log.entityId ?? '',
    log.ipAddress ?? '',
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}
