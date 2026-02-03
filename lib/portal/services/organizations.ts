/**
 * Phase 32: Organization Service
 *
 * MODULAR: Handles all organization-related API operations.
 * This module can be changed independently without affecting other services.
 */

import { portalApi, type ApiResponse, type PaginatedResponse } from './api-client';
import { PORTAL_ROUTES } from '../constants';
import type {
  PortalOrganization,
  OrganizationPortalSettings,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from '../types';

const BASE_PATH = `${PORTAL_ROUTES.API_BASE}/organizations`;

/**
 * Organization Service
 *
 * All organization management operations.
 * Each method is independent and can be used individually.
 */
export const organizationService = {
  /**
   * List all organizations the current user belongs to
   */
  list: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResponse<PortalOrganization>>> => {
    return portalApi.get(BASE_PATH, params);
  },

  /**
   * Get a single organization by ID
   */
  get: async (orgId: string): Promise<ApiResponse<PortalOrganization>> => {
    return portalApi.get(`${BASE_PATH}/${orgId}`);
  },

  /**
   * Create a new organization
   */
  create: async (data: CreateOrganizationInput): Promise<ApiResponse<PortalOrganization>> => {
    return portalApi.post(BASE_PATH, data);
  },

  /**
   * Update an organization
   */
  update: async (
    orgId: string,
    data: UpdateOrganizationInput
  ): Promise<ApiResponse<PortalOrganization>> => {
    return portalApi.patch(`${BASE_PATH}/${orgId}`, data);
  },

  /**
   * Delete an organization
   */
  delete: async (orgId: string): Promise<ApiResponse<{ success: boolean }>> => {
    return portalApi.delete(`${BASE_PATH}/${orgId}`);
  },

  /**
   * Get organization portal settings
   */
  getSettings: async (orgId: string): Promise<ApiResponse<OrganizationPortalSettings>> => {
    return portalApi.get(`${BASE_PATH}/${orgId}/settings`);
  },

  /**
   * Update organization portal settings
   */
  updateSettings: async (
    orgId: string,
    data: Partial<OrganizationPortalSettings>
  ): Promise<ApiResponse<OrganizationPortalSettings>> => {
    return portalApi.patch(`${BASE_PATH}/${orgId}/settings`, data);
  },

  /**
   * Get organization branding
   */
  getBranding: async (orgId: string): Promise<ApiResponse<{
    brandName: string | null;
    brandLogoUrl: string | null;
    brandPrimaryColor: string | null;
    brandSecondaryColor: string | null;
  }>> => {
    return portalApi.get(`${BASE_PATH}/${orgId}/branding`);
  },

  /**
   * Update organization branding
   */
  updateBranding: async (
    orgId: string,
    data: {
      brandName?: string;
      brandLogoUrl?: string;
      brandPrimaryColor?: string;
      brandSecondaryColor?: string;
    }
  ): Promise<ApiResponse<OrganizationPortalSettings>> => {
    return portalApi.patch(`${BASE_PATH}/${orgId}/branding`, data);
  },

  /**
   * Get organization statistics
   */
  getStats: async (orgId: string): Promise<ApiResponse<{
    totalClients: number;
    activeClients: number;
    pendingConsent: number;
    totalStaff: number;
    pendingTasks: number;
    lastSyncAt: string | null;
  }>> => {
    return portalApi.get(`${BASE_PATH}/${orgId}/stats`);
  },
};

export default organizationService;
