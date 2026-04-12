/**
 * Audit Logging Service
 * Phase 10: Comprehensive, immutable audit logging for security and compliance
 * Phase M.2: Dual-write to GCP Cloud Logging for 365-day CDR retention
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';

// GCP Cloud Logging integration (Phase M.2.1)
// Lazy-initialized to avoid import errors when credentials aren't configured
let cloudLoggingClient: InstanceType<typeof import('@google-cloud/logging').Logging> | null = null;
let cloudLoggingInitFailed = false;

/**
 * Get or initialize the Cloud Logging client.
 * Returns null if Cloud Logging is not configured (development environments).
 * Uses the shared GCP credentials helper so all services share one service account.
 */
function getCloudLogging() {
  if (cloudLoggingInitFailed) return null;
  if (cloudLoggingClient) return cloudLoggingClient;

  try {
    // Dynamic import to avoid build failures when credentials aren't available
    const { Logging } = require('@google-cloud/logging');
    // Lazy import of credentials helper to avoid circular deps
    const { getGCPClientOptions } = require('@/lib/gcp/credentials');
    const options = getGCPClientOptions();
    if (!options) {
      cloudLoggingInitFailed = true;
      return null;
    }
    cloudLoggingClient = new Logging(options);
    return cloudLoggingClient;
  } catch {
    cloudLoggingInitFailed = true;
    return null;
  }
}

/**
 * Write an audit log entry to GCP Cloud Logging (fire-and-forget).
 * This runs alongside the PostgreSQL write for CDR 365-day retention compliance.
 */
function writeToCloudLogging(entry: AuditLogEntry): void {
  try {
    const logging = getCloudLogging();
    if (!logging) return;

    const gcpLog = logging.log('monitrax-audit');
    const metadata = {
      resource: { type: 'global' },
      severity: entry.status === 'BLOCKED' ? 'WARNING' : entry.status === 'FAILURE' ? 'ERROR' : 'INFO',
      labels: {
        app: 'monitrax',
        environment: process.env.NODE_ENV || 'development',
        action: entry.action,
        entityType: entry.entityType || 'unknown',
      },
    };

    const logEntry = gcpLog.entry(metadata, {
      userId: entry.userId || null,
      organizationId: entry.organizationId || null,
      action: entry.action,
      status: entry.status || 'SUCCESS',
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      ipAddress: entry.ipAddress || null,
      // Note: metadata is already sanitized by caller via sanitizeCdrMetadata()
      metadata: entry.metadata || {},
      timestamp: new Date().toISOString(),
    });

    // Fire-and-forget — never block the app for logging
    gcpLog.write(logEntry).catch(() => {});
  } catch {
    // Cloud Logging failures must never break app flow
  }
}

// Define types locally to avoid Prisma client generation issues
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type AuditAction = string;
type AuditStatus = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

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
    // Primary: Write to PostgreSQL (app-level queries and admin UI)
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        organizationId: entry.organizationId,
        action: entry.action as any,
        status: (entry.status ?? 'SUCCESS') as any,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata ? (entry.metadata as any) : undefined,
      },
    });

    // Phase M.2.1: Dual-write to GCP Cloud Logging (365-day CDR retention)
    writeToCloudLogging(entry);
  } catch (error) {
    // Log audit failures but don't throw - audit logging should never break app flow
    log.error('Failed to create audit log', error as Error);
    // Still attempt Cloud Logging even if PostgreSQL fails
    writeToCloudLogging(entry);
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
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'EMAIL_VERIFIED' | 'OAUTH_LOGIN' | 'MFA_CHALLENGE' | 'MFA_SUCCESS' | 'MFA_FAILURE' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET' | 'PASSKEY_REGISTER' | 'PASSKEY_UPDATE' | 'PASSKEY_DELETE';
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
  action: 'ROLE_CHANGE' | 'ORG_MEMBER_ADD' | 'ORG_MEMBER_REMOVE' | 'ORG_SETTINGS_UPDATE' | 'SESSION_REVOKE' | 'ACCOUNT_LOCK' | 'ACCOUNT_UNLOCK';
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
  action: 'RATE_LIMIT_HIT' | 'UNAUTHORIZED_ACCESS' | 'FORBIDDEN_ACCESS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_UNLOCKED';
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
    ...(query.action && { action: query.action as any }),
    ...(query.status && { status: query.status as any }),
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
  const securityActions = [
    'RATE_LIMIT_HIT',
    'UNAUTHORIZED_ACCESS',
    'FORBIDDEN_ACCESS',
    'MFA_FAILURE',
  ];

  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: securityActions as any },
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
    (acc: Record<string, number>, item: { status: string; _count: { status: number } }) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {} as Record<string, number>
  );

  const actionBreakdown = actionCounts.reduce(
    (acc: Record<string, number>, item: { action: string; _count: { action: number } }) => {
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
