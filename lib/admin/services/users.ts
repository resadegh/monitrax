/**
 * Phase 33: Admin User Service
 *
 * Service for managing users from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  ManagedUser,
  UserSubscription,
  UserFilters,
  PaginatedResponse,
  UpdateUserSubscriptionRequest,
  UserActivityLog,
  StartImpersonationRequest,
  StartImpersonationResponse,
  AdminApiResponse,
} from '../types';

// =============================================================================
// USER SERVICE
// =============================================================================

export const userService = {
  /**
   * List all users with pagination and filtering
   */
  list(
    params?: UserFilters & { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }
  ): Promise<AdminApiResponse<PaginatedResponse<ManagedUser>>> {
    return adminApi.get(ADMIN_API_ROUTES.USERS, params as Record<string, string | number | boolean | undefined>);
  },

  /**
   * Get a single user by ID
   */
  get(userId: string): Promise<AdminApiResponse<ManagedUser>> {
    return adminApi.get(ADMIN_API_ROUTES.USER(userId));
  },

  /**
   * Update user details
   */
  update(
    userId: string,
    data: Partial<Pick<ManagedUser, 'name' | 'email'>>
  ): Promise<AdminApiResponse<ManagedUser>> {
    return adminApi.patch(ADMIN_API_ROUTES.USER(userId), data);
  },

  /**
   * Get user subscription
   */
  getSubscription(userId: string): Promise<AdminApiResponse<UserSubscription>> {
    return adminApi.get(ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId));
  },

  /**
   * Update user subscription (tier, status)
   */
  updateSubscription(
    userId: string,
    data: UpdateUserSubscriptionRequest
  ): Promise<AdminApiResponse<UserSubscription>> {
    return adminApi.patch(ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId), data);
  },

  /**
   * Suspend a user account
   */
  suspend(userId: string, reason: string): Promise<AdminApiResponse<UserSubscription>> {
    return adminApi.post(`${ADMIN_API_ROUTES.USER(userId)}/suspend`, { reason });
  },

  /**
   * Reactivate a suspended user account
   */
  reactivate(userId: string): Promise<AdminApiResponse<UserSubscription>> {
    return adminApi.post(`${ADMIN_API_ROUTES.USER(userId)}/reactivate`);
  },

  /**
   * Get user activity logs
   */
  getActivity(
    userId: string,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string }
  ): Promise<AdminApiResponse<PaginatedResponse<UserActivityLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.USER_ACTIVITY(userId), params);
  },

  /**
   * Start an impersonation session
   */
  impersonate(
    userId: string,
    data: Omit<StartImpersonationRequest, 'targetUserId'>
  ): Promise<AdminApiResponse<StartImpersonationResponse>> {
    return adminApi.post(ADMIN_API_ROUTES.USER_IMPERSONATE(userId), data);
  },

  /**
   * Get user statistics summary
   */
  getStats(userId: string): Promise<
    AdminApiResponse<{
      accountsCount: number;
      propertiesCount: number;
      loansCount: number;
      documentsCount: number;
      investmentsCount: number;
      totalNetWorth: number;
      lastLoginAt: string | null;
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.USER(userId)}/stats`);
  },

  /**
   * Search users by email or name
   */
  search(query: string, limit?: number): Promise<AdminApiResponse<ManagedUser[]>> {
    return adminApi.get(ADMIN_API_ROUTES.USERS, { search: query, limit: limit || 10 });
  },
};
