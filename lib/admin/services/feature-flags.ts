/**
 * Phase 33: Admin Feature Flags Service
 *
 * Service for managing feature flags from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  GlobalFeatureFlag,
  FeatureFlagOverride,
  CreateFeatureFlagRequest,
  UpdateFeatureFlagRequest,
  CreateOverrideRequest,
  AdminApiResponse,
} from '../types';

// =============================================================================
// FEATURE FLAGS SERVICE
// =============================================================================

export const featureFlagsService = {
  /**
   * List all global feature flags
   */
  list(): Promise<AdminApiResponse<GlobalFeatureFlag[]>> {
    return adminApi.get(ADMIN_API_ROUTES.FEATURE_FLAGS);
  },

  /**
   * Get a single feature flag by key
   */
  get(flagKey: string): Promise<
    AdminApiResponse<
      GlobalFeatureFlag & {
        overrides: FeatureFlagOverride[];
      }
    >
  > {
    return adminApi.get(ADMIN_API_ROUTES.FEATURE_FLAG(flagKey));
  },

  /**
   * Create a new feature flag
   */
  create(data: CreateFeatureFlagRequest): Promise<AdminApiResponse<GlobalFeatureFlag>> {
    return adminApi.post(ADMIN_API_ROUTES.FEATURE_FLAGS, data);
  },

  /**
   * Update a feature flag
   */
  update(flagKey: string, data: UpdateFeatureFlagRequest): Promise<AdminApiResponse<GlobalFeatureFlag>> {
    return adminApi.patch(ADMIN_API_ROUTES.FEATURE_FLAG(flagKey), data);
  },

  /**
   * Delete a feature flag
   */
  delete(flagKey: string): Promise<AdminApiResponse<{ success: boolean }>> {
    return adminApi.delete(ADMIN_API_ROUTES.FEATURE_FLAG(flagKey));
  },

  /**
   * Toggle a feature flag on/off
   */
  toggle(flagKey: string): Promise<AdminApiResponse<GlobalFeatureFlag>> {
    return adminApi.post(`${ADMIN_API_ROUTES.FEATURE_FLAG(flagKey)}/toggle`);
  },

  /**
   * Get overrides for a target (user or organization)
   */
  getOverrides(params: {
    targetType?: 'USER' | 'ORGANIZATION';
    targetId?: string;
    flagKey?: string;
  }): Promise<AdminApiResponse<FeatureFlagOverride[]>> {
    return adminApi.get(ADMIN_API_ROUTES.FEATURE_FLAG_OVERRIDES, params);
  },

  /**
   * Create an override for a user or organization
   */
  createOverride(data: CreateOverrideRequest): Promise<AdminApiResponse<FeatureFlagOverride>> {
    return adminApi.post(ADMIN_API_ROUTES.FEATURE_FLAG_OVERRIDES, data);
  },

  /**
   * Delete an override
   */
  deleteOverride(overrideId: string): Promise<AdminApiResponse<{ success: boolean }>> {
    return adminApi.delete(ADMIN_API_ROUTES.FEATURE_FLAG_OVERRIDE(overrideId));
  },

  /**
   * Get effective flags for a specific user
   */
  getEffectiveFlagsForUser(userId: string): Promise<
    AdminApiResponse<
      Array<{
        flagKey: string;
        enabled: boolean;
        source: 'global' | 'tier' | 'override' | 'percentage';
      }>
    >
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.FEATURE_FLAGS}/effective/user/${userId}`);
  },

  /**
   * Get effective flags for a specific organization
   */
  getEffectiveFlagsForOrganization(orgId: string): Promise<
    AdminApiResponse<
      Array<{
        flagKey: string;
        enabled: boolean;
        source: 'global' | 'plan' | 'override' | 'percentage';
      }>
    >
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.FEATURE_FLAGS}/effective/organization/${orgId}`);
  },

  /**
   * Get audit history for a flag
   */
  getHistory(
    flagKey: string,
    params?: { page?: number; limit?: number }
  ): Promise<
    AdminApiResponse<{
      data: Array<{
        id: string;
        action: string;
        changes: Record<string, unknown>;
        adminId: string;
        adminName: string;
        timestamp: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.FEATURE_FLAG(flagKey)}/history`, params);
  },

  /**
   * Bulk update multiple flags
   */
  bulkUpdate(
    updates: Array<{ flagKey: string; enabled: boolean }>
  ): Promise<AdminApiResponse<GlobalFeatureFlag[]>> {
    return adminApi.post(`${ADMIN_API_ROUTES.FEATURE_FLAGS}/bulk`, { updates });
  },
};
