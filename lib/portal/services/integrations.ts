/**
 * Phase 32: Integrations Service
 *
 * MODULAR: Handles all accounting integration operations.
 * Supports multiple providers (Xero, MYOB, QuickBooks, etc.)
 * This module can be changed independently without affecting other services.
 */

import { portalApi, type ApiResponse, type PaginatedResponse } from './api-client';
import { PORTAL_ROUTES } from '../constants';
import type {
  AccountingProvider,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
} from '@prisma/client';

export interface AccountingIntegration {
  id: string;
  provider: AccountingProvider;
  providerTenantId: string | null;
  providerOrganization: string | null;
  isConnected: boolean;
  lastConnectedAt: string | null;
  connectionError: string | null;
  syncDirection: IntegrationSyncDirection;
  syncEnabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  syncContacts: boolean;
  syncInvoices: boolean;
  syncBankTransactions: boolean;
  syncBankAccounts: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: IntegrationSyncStatus | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  direction: IntegrationSyncDirection;
  status: IntegrationSyncStatus;
  entityType: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  triggeredBy: string | null;
}

export interface EntityMapping {
  id: string;
  monitraxEntityType: string;
  monitraxEntityId: string;
  externalEntityType: string;
  externalEntityId: string;
  lastSyncedAt: string | null;
  hasConflict: boolean;
}

/**
 * Create integrations service for a specific organization
 *
 * MODULAR: Each organization gets its own integrations service instance.
 */
export function createIntegrationsService(orgId: string) {
  const BASE_PATH = `${PORTAL_ROUTES.API_BASE}/organizations/${orgId}/integrations`;

  return {
    // =========================================================================
    // INTEGRATION MANAGEMENT
    // =========================================================================

    /**
     * List all integrations for the organization
     */
    list: async (): Promise<ApiResponse<{
      integrations: AccountingIntegration[];
    }>> => {
      return portalApi.get(BASE_PATH);
    },

    /**
     * Get a specific integration
     */
    get: async (provider: AccountingProvider): Promise<ApiResponse<AccountingIntegration>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}`);
    },

    /**
     * Get OAuth authorization URL for a provider
     */
    getAuthUrl: async (provider: AccountingProvider): Promise<ApiResponse<{
      authUrl: string;
      state: string;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}/auth-url`);
    },

    /**
     * Complete OAuth connection (exchange code for tokens)
     */
    connect: async (
      provider: AccountingProvider,
      data: { code: string; state: string }
    ): Promise<ApiResponse<AccountingIntegration>> => {
      return portalApi.post(`${BASE_PATH}/${provider.toLowerCase()}/connect`, data);
    },

    /**
     * Disconnect an integration
     */
    disconnect: async (provider: AccountingProvider): Promise<ApiResponse<{
      success: boolean;
    }>> => {
      return portalApi.post(`${BASE_PATH}/${provider.toLowerCase()}/disconnect`, {});
    },

    /**
     * Update integration settings
     */
    updateSettings: async (
      provider: AccountingProvider,
      settings: {
        syncEnabled?: boolean;
        autoSyncEnabled?: boolean;
        syncIntervalHours?: number;
        syncContacts?: boolean;
        syncInvoices?: boolean;
        syncBankTransactions?: boolean;
        syncBankAccounts?: boolean;
      }
    ): Promise<ApiResponse<AccountingIntegration>> => {
      return portalApi.patch(`${BASE_PATH}/${provider.toLowerCase()}/settings`, settings);
    },

    // =========================================================================
    // SYNC OPERATIONS
    // =========================================================================

    /**
     * Trigger a manual sync
     */
    sync: async (
      provider: AccountingProvider,
      options?: {
        entityTypes?: string[];
        fullSync?: boolean;
      }
    ): Promise<ApiResponse<{
      syncId: string;
      message: string;
    }>> => {
      return portalApi.post(`${BASE_PATH}/${provider.toLowerCase()}/sync`, options);
    },

    /**
     * Get sync status
     */
    getSyncStatus: async (
      provider: AccountingProvider,
      syncId: string
    ): Promise<ApiResponse<SyncLog>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}/sync/${syncId}`);
    },

    /**
     * List sync logs
     */
    listSyncLogs: async (
      provider: AccountingProvider,
      params?: {
        page?: number;
        limit?: number;
        status?: IntegrationSyncStatus;
        from?: string;
        to?: string;
      }
    ): Promise<ApiResponse<PaginatedResponse<SyncLog>>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}/sync-logs`, params);
    },

    /**
     * Cancel a running sync
     */
    cancelSync: async (
      provider: AccountingProvider,
      syncId: string
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.post(`${BASE_PATH}/${provider.toLowerCase()}/sync/${syncId}/cancel`, {});
    },

    // =========================================================================
    // ENTITY MAPPINGS
    // =========================================================================

    /**
     * List entity mappings
     */
    listMappings: async (
      provider: AccountingProvider,
      params?: {
        page?: number;
        limit?: number;
        entityType?: string;
        hasConflict?: boolean;
      }
    ): Promise<ApiResponse<PaginatedResponse<EntityMapping>>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}/mappings`, params);
    },

    /**
     * Get a specific mapping
     */
    getMapping: async (
      provider: AccountingProvider,
      mappingId: string
    ): Promise<ApiResponse<EntityMapping & {
      monitraxData: Record<string, unknown>;
      externalData: Record<string, unknown>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${provider.toLowerCase()}/mappings/${mappingId}`);
    },

    /**
     * Resolve a conflict
     */
    resolveConflict: async (
      provider: AccountingProvider,
      mappingId: string,
      resolution: 'use_monitrax' | 'use_external' | 'merge'
    ): Promise<ApiResponse<EntityMapping>> => {
      return portalApi.post(
        `${BASE_PATH}/${provider.toLowerCase()}/mappings/${mappingId}/resolve`,
        { resolution }
      );
    },

    /**
     * Delete a mapping (unlink entities)
     */
    deleteMapping: async (
      provider: AccountingProvider,
      mappingId: string
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.delete(`${BASE_PATH}/${provider.toLowerCase()}/mappings/${mappingId}`);
    },

    // =========================================================================
    // PROVIDER-SPECIFIC: XERO
    // =========================================================================

    xero: {
      /**
       * Get available Xero tenants (organizations)
       */
      getTenants: async (): Promise<ApiResponse<{
        tenants: Array<{
          tenantId: string;
          tenantName: string;
          tenantType: string;
        }>;
      }>> => {
        return portalApi.get(`${BASE_PATH}/xero/tenants`);
      },

      /**
       * Select a Xero tenant to use
       */
      selectTenant: async (tenantId: string): Promise<ApiResponse<AccountingIntegration>> => {
        return portalApi.post(`${BASE_PATH}/xero/select-tenant`, { tenantId });
      },

      /**
       * Get Xero contacts (for mapping preview)
       */
      getContacts: async (params?: {
        page?: number;
        limit?: number;
        search?: string;
      }): Promise<ApiResponse<{
        contacts: Array<{
          contactId: string;
          name: string;
          email: string | null;
          isCustomer: boolean;
          isSupplier: boolean;
        }>;
      }>> => {
        return portalApi.get(`${BASE_PATH}/xero/contacts`, params);
      },

      /**
       * Map a Monitrax client to a Xero contact
       */
      mapClient: async (
        clientId: string,
        xeroContactId: string
      ): Promise<ApiResponse<EntityMapping>> => {
        return portalApi.post(`${BASE_PATH}/xero/map-client`, {
          clientId,
          xeroContactId,
        });
      },
    },

    // =========================================================================
    // PROVIDER-SPECIFIC: MYOB (placeholder for future)
    // =========================================================================

    myob: {
      getCompanyFiles: async (): Promise<ApiResponse<{
        companyFiles: Array<{
          id: string;
          name: string;
        }>;
      }>> => {
        return portalApi.get(`${BASE_PATH}/myob/company-files`);
      },

      selectCompanyFile: async (companyFileId: string): Promise<ApiResponse<AccountingIntegration>> => {
        return portalApi.post(`${BASE_PATH}/myob/select-company-file`, { companyFileId });
      },
    },
  };
}

/**
 * Default integrations service factory
 */
export const integrationsService = {
  forOrganization: createIntegrationsService,
};

export default integrationsService;
