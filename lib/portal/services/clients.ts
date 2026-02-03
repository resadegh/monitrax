/**
 * Phase 32: Client Service
 *
 * MODULAR: Handles all client-related API operations.
 * This module can be changed independently without affecting other services.
 */

import { portalApi, type ApiResponse, type PaginatedResponse } from './api-client';
import { PORTAL_ROUTES } from '../constants';
import type {
  PortalClient,
  ClientNote,
  ClientTask,
  CreateClientInviteInput,
  UpdateClientInput,
  CreateNoteInput,
  CreateTaskInput,
  UpdateTaskInput,
  ClientAccessLog,
} from '../types';
import type { ClientStatus, ConsentStatus, DataAccessScope } from '@prisma/client';

/**
 * Create clients service for a specific organization
 *
 * MODULAR: Each organization gets its own client service instance.
 * This pattern allows for easy testing and isolation.
 */
export function createClientsService(orgId: string) {
  const BASE_PATH = `${PORTAL_ROUTES.API_BASE}/organizations/${orgId}/clients`;

  return {
    // =========================================================================
    // CLIENT OPERATIONS
    // =========================================================================

    /**
     * List all clients with filtering and pagination
     */
    list: async (params?: {
      page?: number;
      limit?: number;
      status?: ClientStatus;
      consentStatus?: ConsentStatus;
      assignedTo?: string;
      search?: string;
      tags?: string[];
    }): Promise<ApiResponse<PaginatedResponse<PortalClient>>> => {
      return portalApi.get(BASE_PATH, {
        ...params,
        tags: params?.tags?.join(','),
      });
    },

    /**
     * Get a single client by ID
     */
    get: async (clientId: string): Promise<ApiResponse<PortalClient>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}`);
    },

    /**
     * Invite a new client
     */
    invite: async (data: CreateClientInviteInput): Promise<ApiResponse<{
      invitation: {
        id: string;
        email: string;
        status: string;
        tokenExpiresAt: string;
      };
      message: string;
    }>> => {
      return portalApi.post(BASE_PATH, data);
    },

    /**
     * Update a client (tags, assignment, reference)
     */
    update: async (
      clientId: string,
      data: UpdateClientInput
    ): Promise<ApiResponse<PortalClient>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}`, data);
    },

    /**
     * Archive a client
     */
    archive: async (
      clientId: string,
      reason?: string
    ): Promise<ApiResponse<PortalClient>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/archive`, { reason });
    },

    /**
     * Restore an archived client
     */
    restore: async (clientId: string): Promise<ApiResponse<PortalClient>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/restore`, {});
    },

    /**
     * Remove a client completely
     */
    remove: async (clientId: string): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.delete(`${BASE_PATH}/${clientId}`);
    },

    /**
     * Assign a client to a staff member
     */
    assign: async (
      clientId: string,
      memberId: string | null
    ): Promise<ApiResponse<PortalClient>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/assign`, { memberId });
    },

    /**
     * Resend invitation to a client
     */
    resendInvitation: async (clientId: string): Promise<ApiResponse<{
      success: boolean;
      message: string;
    }>> => {
      return portalApi.post(`${BASE_PATH}/${clientId}/resend-invitation`, {});
    },

    // =========================================================================
    // CLIENT DATA ACCESS (Read-only views of client's Monitrax data)
    // =========================================================================

    /**
     * Get client's financial summary
     */
    getFinancialSummary: async (clientId: string): Promise<ApiResponse<{
      netWorth: number;
      totalAssets: number;
      totalLiabilities: number;
      monthlyIncome: number;
      monthlyExpenses: number;
      cashflow: number;
      lastUpdated: string;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/summary`);
    },

    /**
     * Get client's accounts
     */
    getAccounts: async (clientId: string): Promise<ApiResponse<{
      accounts: Array<{
        id: string;
        name: string;
        type: string;
        balance: number;
        institution: string | null;
      }>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/accounts`);
    },

    /**
     * Get client's properties
     */
    getProperties: async (clientId: string): Promise<ApiResponse<{
      properties: Array<{
        id: string;
        name: string;
        type: string;
        currentValue: number;
        address: string | null;
      }>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/properties`);
    },

    /**
     * Get client's loans
     */
    getLoans: async (clientId: string): Promise<ApiResponse<{
      loans: Array<{
        id: string;
        name: string;
        type: string;
        principal: number;
        interestRate: number;
        monthlyRepayment: number;
      }>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/loans`);
    },

    /**
     * Get client's investments
     */
    getInvestments: async (clientId: string): Promise<ApiResponse<{
      accounts: Array<{
        id: string;
        name: string;
        type: string;
        totalValue: number;
        holdings: Array<{
          ticker: string;
          name: string;
          units: number;
          currentValue: number;
        }>;
      }>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/investments`);
    },

    /**
     * Get client's tax position
     */
    getTaxPosition: async (
      clientId: string,
      financialYear?: string
    ): Promise<ApiResponse<{
      financialYear: string;
      taxableIncome: number;
      estimatedTax: number;
      deductions: number;
      superContributions: number;
    }>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/data/tax`, { financialYear });
    },

    // =========================================================================
    // NOTES OPERATIONS
    // =========================================================================

    /**
     * List notes for a client
     */
    listNotes: async (
      clientId: string,
      params?: { page?: number; limit?: number }
    ): Promise<ApiResponse<PaginatedResponse<ClientNote>>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/notes`, params);
    },

    /**
     * Create a note
     */
    createNote: async (
      clientId: string,
      data: CreateNoteInput
    ): Promise<ApiResponse<ClientNote>> => {
      return portalApi.post(`${BASE_PATH}/${clientId}/notes`, data);
    },

    /**
     * Update a note
     */
    updateNote: async (
      clientId: string,
      noteId: string,
      data: Partial<CreateNoteInput>
    ): Promise<ApiResponse<ClientNote>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/notes/${noteId}`, data);
    },

    /**
     * Delete a note
     */
    deleteNote: async (
      clientId: string,
      noteId: string
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.delete(`${BASE_PATH}/${clientId}/notes/${noteId}`);
    },

    /**
     * Pin/unpin a note
     */
    toggleNotePin: async (
      clientId: string,
      noteId: string,
      isPinned: boolean
    ): Promise<ApiResponse<ClientNote>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/notes/${noteId}/pin`, { isPinned });
    },

    // =========================================================================
    // TASKS OPERATIONS
    // =========================================================================

    /**
     * List tasks for a client
     */
    listTasks: async (
      clientId: string,
      params?: {
        page?: number;
        limit?: number;
        status?: string;
        assignedTo?: string;
      }
    ): Promise<ApiResponse<PaginatedResponse<ClientTask>>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/tasks`, params);
    },

    /**
     * Create a task
     */
    createTask: async (
      clientId: string,
      data: CreateTaskInput
    ): Promise<ApiResponse<ClientTask>> => {
      return portalApi.post(`${BASE_PATH}/${clientId}/tasks`, data);
    },

    /**
     * Update a task
     */
    updateTask: async (
      clientId: string,
      taskId: string,
      data: UpdateTaskInput
    ): Promise<ApiResponse<ClientTask>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/tasks/${taskId}`, data);
    },

    /**
     * Delete a task
     */
    deleteTask: async (
      clientId: string,
      taskId: string
    ): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.delete(`${BASE_PATH}/${clientId}/tasks/${taskId}`);
    },

    /**
     * Complete a task
     */
    completeTask: async (
      clientId: string,
      taskId: string
    ): Promise<ApiResponse<ClientTask>> => {
      return portalApi.patch(`${BASE_PATH}/${clientId}/tasks/${taskId}/complete`, {});
    },

    // =========================================================================
    // ACCESS LOGS
    // =========================================================================

    /**
     * Get access logs for a client
     */
    getAccessLogs: async (
      clientId: string,
      params?: {
        page?: number;
        limit?: number;
        action?: string;
        memberId?: string;
        from?: string;
        to?: string;
      }
    ): Promise<ApiResponse<PaginatedResponse<ClientAccessLog>>> => {
      return portalApi.get(`${BASE_PATH}/${clientId}/access-logs`, params);
    },
  };
}

/**
 * Default clients service factory
 * Use this in React components with the current organization context
 */
export const clientsService = {
  forOrganization: createClientsService,
};

export default clientsService;
