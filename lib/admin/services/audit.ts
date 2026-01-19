/**
 * Phase 33: Admin Audit Service
 *
 * Service for audit log operations from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  AdminAuditLog,
  AuditLogFilters,
  PaginatedResponse,
  AdminApiResponse,
} from '../types';

// =============================================================================
// AUDIT SERVICE
// =============================================================================

export const auditService = {
  /**
   * List audit logs with pagination and filtering
   */
  list(
    params?: AuditLogFilters & { page?: number; limit?: number }
  ): Promise<AdminApiResponse<PaginatedResponse<AdminAuditLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.AUDIT_LOGS, {
      ...params,
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
    } as Record<string, string | number | boolean | undefined>);
  },

  /**
   * Get a single audit log entry
   */
  get(logId: string): Promise<AdminApiResponse<AdminAuditLog>> {
    return adminApi.get(`${ADMIN_API_ROUTES.AUDIT_LOGS}/${logId}`);
  },

  /**
   * Get audit logs for a specific admin
   */
  getByAdmin(
    adminId: string,
    params?: { page?: number; limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<AdminApiResponse<PaginatedResponse<AdminAuditLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.AUDIT_LOGS, {
      adminId,
      page: params?.page,
      limit: params?.limit,
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
    });
  },

  /**
   * Get audit logs for a specific target entity
   */
  getByTarget(
    targetType: string,
    targetId: string,
    params?: { page?: number; limit?: number }
  ): Promise<AdminApiResponse<PaginatedResponse<AdminAuditLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.AUDIT_LOGS, {
      targetType,
      targetId,
      ...params,
    });
  },

  /**
   * Get audit log summary/statistics
   */
  getSummary(params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<
    AdminApiResponse<{
      totalLogs: number;
      byCategory: Array<{ category: string; count: number }>;
      byAction: Array<{ action: string; count: number }>;
      byAdmin: Array<{ adminId: string; adminName: string; count: number }>;
      recentActivity: AdminAuditLog[];
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.AUDIT_LOGS}/summary`, {
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
    });
  },

  /**
   * Export audit logs
   */
  export(params: {
    format: 'csv' | 'json';
    startDate: Date;
    endDate: Date;
    filters?: AuditLogFilters;
  }): Promise<AdminApiResponse<{ downloadUrl: string }>> {
    return adminApi.post(ADMIN_API_ROUTES.AUDIT_EXPORT, {
      format: params.format,
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      ...params.filters,
    });
  },

  /**
   * Get recent admin activity for dashboard
   */
  getRecentActivity(limit?: number): Promise<AdminApiResponse<AdminAuditLog[]>> {
    return adminApi.get(ADMIN_API_ROUTES.AUDIT_LOGS, {
      limit: limit || 10,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  },

  /**
   * Search audit logs
   */
  search(
    query: string,
    params?: { page?: number; limit?: number }
  ): Promise<AdminApiResponse<PaginatedResponse<AdminAuditLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.AUDIT_LOGS, {
      search: query,
      ...params,
    });
  },
};
