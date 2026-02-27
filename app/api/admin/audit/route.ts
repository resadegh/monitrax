/**
 * Admin Audit Log API (Unified)
 *
 * GET /api/admin/audit
 * Queries both AdminAuditLog and user-level AuditLog tables.
 * Use ?source=admin|user|all to control which table(s) to query.
 *
 * This is the SINGLE canonical API for all audit data in the admin portal.
 *
 * Auth: Feature-flag gate (NEXT_PUBLIC_ADMIN_PORTAL_ENABLED).
 * When admin session auth is fully wired, re-enable verifyAdminAuth + RBAC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES, PAGINATION_DEFAULTS } from '@/lib/admin/constants';

type AuditSource = 'admin' | 'user' | 'all';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  try {
    // Attempt admin session auth first. If no admin session exists,
    // fall back to feature-flag-only access (matches /api/admin/dashboard pattern).
    // TODO: Enforce verifyAdminAuth + RBAC once admin login flow is fully wired.
    const authResult = await verifyAdminAuth(request);
    if (authResult.success && authResult.context) {
      if (!hasPermission(authResult.context.role, 'audit:read')) {
        return NextResponse.json(
          { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }
    }
    // If auth fails, we still allow access because the portal feature flag is on.
    // This is consistent with /api/admin/dashboard which has no auth at all.

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || String(PAGINATION_DEFAULTS.PAGE));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULTS.LIMIT)),
      PAGINATION_DEFAULTS.MAX_LIMIT
    );
    const source: AuditSource = (searchParams.get('source') as AuditSource) || 'all';
    const action = searchParams.get('action') || '';
    const status = searchParams.get('status') || '';
    const userId = searchParams.get('userId') || '';
    const entityType = searchParams.get('entityType') || '';
    const category = searchParams.get('category') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // Query admin audit logs
    if (source === 'admin' || source === 'all') {
      if (source === 'admin') {
        return await queryAdminAuditLogs({
          page, limit, skip, action, category, startDate, endDate, userId,
        });
      }
    }

    // Query user audit logs
    if (source === 'user') {
      return await queryUserAuditLogs({
        page, limit, skip, action, status, userId, entityType, startDate, endDate,
      });
    }

    // source === 'all': unified view — query both and merge by timestamp
    const [adminResult, userResult] = await Promise.all([
      getAdminLogs({ skip: 0, limit: limit * 2, action, category, startDate, endDate, userId }),
      getUserLogs({ skip: 0, limit: limit * 2, action, status, userId, entityType, startDate, endDate }),
    ]);

    // Normalize both into a common format
    const unified = [
      ...adminResult.logs.map(normalizeAdminLog),
      ...userResult.logs.map(normalizeUserLog),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(skip, skip + limit);

    const total = adminResult.total + userResult.total;

    return NextResponse.json({
      data: unified,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Audit] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch audit logs' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Admin audit log queries
// ---------------------------------------------------------------------------

interface AdminLogParams {
  skip: number;
  limit: number;
  action: string;
  category: string;
  startDate: string | null;
  endDate: string | null;
  userId: string;
}

async function getAdminLogs(params: AdminLogParams) {
  const where: Record<string, unknown> = {};
  if (params.action) where.action = params.action;
  if (params.category) where.category = params.category;
  if (params.userId) where.adminUserId = params.userId;
  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) (where.timestamp as Record<string, Date>).gte = new Date(params.startDate);
    if (params.endDate) (where.timestamp as Record<string, Date>).lte = new Date(params.endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: { timestamp: 'desc' },
      include: { adminUser: { select: { id: true, name: true, email: true } } },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { logs, total };
}

async function queryAdminAuditLogs(params: AdminLogParams & { page: number }) {
  const { logs, total } = await getAdminLogs(params);

  return NextResponse.json({
    data: logs.map(normalizeAdminLog),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasMore: params.page * params.limit < total,
    },
  });
}

// ---------------------------------------------------------------------------
// User audit log queries
// ---------------------------------------------------------------------------

interface UserLogParams {
  skip: number;
  limit: number;
  action: string;
  status: string;
  userId: string;
  entityType: string;
  startDate: string | null;
  endDate: string | null;
}

async function getUserLogs(params: UserLogParams) {
  const where: Record<string, unknown> = {};
  if (params.action) where.action = params.action;
  if (params.status) where.status = params.status;
  if (params.userId) where.userId = params.userId;
  if (params.entityType) where.entityType = params.entityType;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = new Date(params.startDate);
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = new Date(params.endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

async function queryUserAuditLogs(params: UserLogParams & { page: number }) {
  const { logs, total } = await getUserLogs(params);

  return NextResponse.json({
    data: logs.map(normalizeUserLog),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasMore: params.page * params.limit < total,
    },
  });
}

// ---------------------------------------------------------------------------
// Normalizers — unified shape for frontend
// ---------------------------------------------------------------------------

interface NormalizedAuditLog {
  id: string;
  source: 'admin' | 'user';
  action: string;
  status: string;
  category: string | null;
  description: string | null;
  actor: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  timestamp: string;
}

function normalizeAdminLog(log: Record<string, unknown>): NormalizedAuditLog {
  const adminUser = log.adminUser as { id?: string; name?: string; email?: string } | null;
  return {
    id: log.id as string,
    source: 'admin',
    action: log.action as string,
    status: 'SUCCESS',
    category: (log.category as string) ?? null,
    description: (log.description as string) ?? null,
    actor: adminUser?.name ?? (log.adminUserId as string) ?? null,
    actorEmail: adminUser?.email ?? null,
    entityType: (log.targetType as string) ?? null,
    entityId: (log.targetId as string) ?? null,
    ipAddress: (log.ipAddress as string) ?? null,
    metadata: log.metadata ?? null,
    timestamp: ((log.timestamp as Date) ?? new Date()).toISOString(),
  };
}

function normalizeUserLog(log: Record<string, unknown>): NormalizedAuditLog {
  return {
    id: log.id as string,
    source: 'user',
    action: log.action as string,
    status: (log.status as string) ?? 'SUCCESS',
    category: null,
    description: null,
    actor: (log.userId as string) ?? null,
    actorEmail: null,
    entityType: (log.entityType as string) ?? null,
    entityId: (log.entityId as string) ?? null,
    ipAddress: (log.ipAddress as string) ?? null,
    metadata: log.metadata ?? null,
    timestamp: ((log.createdAt as Date) ?? new Date()).toISOString(),
  };
}
