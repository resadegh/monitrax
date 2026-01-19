/**
 * Phase 33: Admin Organization Service
 *
 * Service for managing organizations from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  ManagedOrganization,
  OrganizationLicense,
  OrganizationFilters,
  PaginatedResponse,
  UpdateOrganizationLicenseRequest,
  OrganizationActivityLog,
  AdminApiResponse,
} from '../types';

// =============================================================================
// ORGANIZATION SERVICE
// =============================================================================

export const organizationService = {
  /**
   * List all organizations with pagination and filtering
   */
  list(
    params?: OrganizationFilters & { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }
  ): Promise<AdminApiResponse<PaginatedResponse<ManagedOrganization>>> {
    return adminApi.get(ADMIN_API_ROUTES.ORGANIZATIONS, params as Record<string, string | number | boolean | undefined>);
  },

  /**
   * Get a single organization by ID
   */
  get(orgId: string): Promise<AdminApiResponse<ManagedOrganization>> {
    return adminApi.get(ADMIN_API_ROUTES.ORGANIZATION(orgId));
  },

  /**
   * Update organization details
   */
  update(
    orgId: string,
    data: Partial<Pick<ManagedOrganization, 'name' | 'description'>>
  ): Promise<AdminApiResponse<ManagedOrganization>> {
    return adminApi.patch(ADMIN_API_ROUTES.ORGANIZATION(orgId), data);
  },

  /**
   * Get organization license
   */
  getLicense(orgId: string): Promise<AdminApiResponse<OrganizationLicense>> {
    return adminApi.get(ADMIN_API_ROUTES.ORGANIZATION_LICENSE(orgId));
  },

  /**
   * Update organization license (tier, limits, status)
   */
  updateLicense(
    orgId: string,
    data: UpdateOrganizationLicenseRequest
  ): Promise<AdminApiResponse<OrganizationLicense>> {
    return adminApi.patch(ADMIN_API_ROUTES.ORGANIZATION_LICENSE(orgId), data);
  },

  /**
   * Suspend an organization
   */
  suspend(orgId: string, reason: string): Promise<AdminApiResponse<OrganizationLicense>> {
    return adminApi.post(`${ADMIN_API_ROUTES.ORGANIZATION(orgId)}/suspend`, { reason });
  },

  /**
   * Reactivate a suspended organization
   */
  reactivate(orgId: string): Promise<AdminApiResponse<OrganizationLicense>> {
    return adminApi.post(`${ADMIN_API_ROUTES.ORGANIZATION(orgId)}/reactivate`);
  },

  /**
   * Get organization activity logs
   */
  getActivity(
    orgId: string,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string }
  ): Promise<AdminApiResponse<PaginatedResponse<OrganizationActivityLog>>> {
    return adminApi.get(ADMIN_API_ROUTES.ORGANIZATION_ACTIVITY(orgId), params);
  },

  /**
   * Get organization usage statistics
   */
  getUsage(orgId: string): Promise<
    AdminApiResponse<{
      clientCount: number;
      staffCount: number;
      clientLimit: number;
      staffLimit: number;
      storageUsed: number;
      apiCallsThisMonth: number;
    }>
  > {
    return adminApi.get(ADMIN_API_ROUTES.ORGANIZATION_USAGE(orgId));
  },
};
