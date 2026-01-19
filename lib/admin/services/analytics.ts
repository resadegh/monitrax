/**
 * Phase 33: Admin Analytics Service
 *
 * Service for analytics data from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  GrowthMetrics,
  FeatureUsageMetrics,
  ActiveUserMetrics,
  RetentionCohort,
  AdminApiResponse,
  UserTier,
  OrganizationPlan,
} from '../types';

// =============================================================================
// ANALYTICS SERVICE
// =============================================================================

export const analyticsService = {
  /**
   * Get growth metrics (users and organizations)
   */
  getGrowth(params: {
    metric: 'users' | 'organizations';
    period: 'day' | 'week' | 'month';
    startDate?: Date;
    endDate?: Date;
  }): Promise<
    AdminApiResponse<{
      data: GrowthMetrics[];
      summary: {
        totalGrowth: number;
        growthRate: number;
        averageDaily: number;
      };
    }>
  > {
    return adminApi.get(ADMIN_API_ROUTES.ANALYTICS_GROWTH, {
      ...params,
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
    });
  },

  /**
   * Get feature usage metrics
   */
  getFeatureUsage(params?: {
    period?: 'week' | 'month' | 'quarter';
    tier?: UserTier;
  }): Promise<AdminApiResponse<FeatureUsageMetrics[]>> {
    return adminApi.get(ADMIN_API_ROUTES.ANALYTICS_FEATURE_USAGE, params);
  },

  /**
   * Get active user metrics (DAU/WAU/MAU)
   */
  getActiveUsers(params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<
    AdminApiResponse<{
      current: ActiveUserMetrics;
      history: Array<{
        date: string;
        dau: number;
        wau: number;
        mau: number;
      }>;
    }>
  > {
    return adminApi.get(ADMIN_API_ROUTES.ANALYTICS_ACTIVE_USERS, {
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
    });
  },

  /**
   * Get retention cohort data
   */
  getRetention(params: {
    cohortType: 'week' | 'month';
    periods: number;
  }): Promise<AdminApiResponse<RetentionCohort[]>> {
    return adminApi.get(ADMIN_API_ROUTES.ANALYTICS_RETENTION, params);
  },

  /**
   * Get dashboard summary stats
   */
  getDashboardStats(): Promise<
    AdminApiResponse<{
      totalUsers: number;
      activeUsers: number;
      totalOrganizations: number;
      activeOrganizations: number;
      mrr: number;
      mrrGrowth: number;
      churnRate: number;
      averageSessionDuration: number;
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.ANALYTICS_GROWTH}/summary`);
  },

  /**
   * Get user distribution by tier
   */
  getUserDistribution(): Promise<
    AdminApiResponse<{
      tiers: Array<{
        tier: UserTier;
        count: number;
        percentage: number;
      }>;
      total: number;
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.ANALYTICS_ACTIVE_USERS}/distribution`);
  },

  /**
   * Get organization distribution by plan
   */
  getOrganizationDistribution(): Promise<
    AdminApiResponse<{
      plans: Array<{
        plan: OrganizationPlan;
        count: number;
        percentage: number;
      }>;
      total: number;
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.ANALYTICS_GROWTH}/organization-distribution`);
  },

  /**
   * Get top features by usage
   */
  getTopFeatures(limit?: number): Promise<
    AdminApiResponse<
      Array<{
        feature: string;
        name: string;
        usageCount: number;
        uniqueUsers: number;
        trend: 'up' | 'down' | 'stable';
      }>
    >
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.ANALYTICS_FEATURE_USAGE}/top`, { limit });
  },

  /**
   * Export analytics data
   */
  exportData(params: {
    format: 'csv' | 'json';
    metrics: Array<'growth' | 'retention' | 'features' | 'active_users'>;
    startDate: Date;
    endDate: Date;
  }): Promise<AdminApiResponse<{ downloadUrl: string }>> {
    return adminApi.post(`${ADMIN_API_ROUTES.ANALYTICS_GROWTH}/export`, {
      ...params,
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
    });
  },
};
