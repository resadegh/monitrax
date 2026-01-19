/**
 * Phase 32: Team Service
 *
 * MODULAR: Handles all team/staff-related API operations.
 * This module can be changed independently without affecting other services.
 */

import { portalApi, type ApiResponse, type PaginatedResponse } from './api-client';
import { PORTAL_ROUTES } from '../constants';
import type { PortalUserRole } from '@prisma/client';

export interface TeamMember {
  id: string;
  userId: string;
  role: PortalUserRole;
  invitedBy: string | null;
  invitedAt: string;
  joinedAt: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    name: string;
  };
  stats?: {
    assignedClients: number;
    pendingTasks: number;
    notesCreated: number;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: PortalUserRole;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  invitedBy: {
    id: string;
    name: string;
  };
  tokenExpiresAt: string;
  createdAt: string;
}

/**
 * Create team service for a specific organization
 *
 * MODULAR: Each organization gets its own team service instance.
 */
export function createTeamService(orgId: string) {
  const BASE_PATH = `${PORTAL_ROUTES.API_BASE}/organizations/${orgId}/team`;

  return {
    // =========================================================================
    // TEAM MEMBERS
    // =========================================================================

    /**
     * List all team members
     */
    list: async (params?: {
      page?: number;
      limit?: number;
      role?: PortalUserRole;
      isActive?: boolean;
    }): Promise<ApiResponse<PaginatedResponse<TeamMember>>> => {
      return portalApi.get(`${BASE_PATH}/members`, params);
    },

    /**
     * Get a single team member
     */
    get: async (memberId: string): Promise<ApiResponse<TeamMember>> => {
      return portalApi.get(`${BASE_PATH}/members/${memberId}`);
    },

    /**
     * Update a team member's role
     */
    updateRole: async (
      memberId: string,
      role: PortalUserRole
    ): Promise<ApiResponse<TeamMember>> => {
      return portalApi.patch(`${BASE_PATH}/members/${memberId}`, { role });
    },

    /**
     * Deactivate a team member (soft remove)
     */
    deactivate: async (memberId: string): Promise<ApiResponse<TeamMember>> => {
      return portalApi.patch(`${BASE_PATH}/members/${memberId}/deactivate`, {});
    },

    /**
     * Reactivate a team member
     */
    reactivate: async (memberId: string): Promise<ApiResponse<TeamMember>> => {
      return portalApi.patch(`${BASE_PATH}/members/${memberId}/reactivate`, {});
    },

    /**
     * Remove a team member completely
     */
    remove: async (memberId: string): Promise<ApiResponse<{ success: boolean }>> => {
      return portalApi.delete(`${BASE_PATH}/members/${memberId}`);
    },

    /**
     * Get team member's assigned clients
     */
    getAssignedClients: async (
      memberId: string,
      params?: { page?: number; limit?: number }
    ): Promise<ApiResponse<PaginatedResponse<{
      id: string;
      clientReference: string | null;
      user: { id: string; email: string; name: string };
      status: string;
    }>>> => {
      return portalApi.get(`${BASE_PATH}/members/${memberId}/clients`, params);
    },

    // =========================================================================
    // INVITATIONS
    // =========================================================================

    /**
     * List pending invitations
     */
    listInvitations: async (params?: {
      page?: number;
      limit?: number;
      status?: string;
    }): Promise<ApiResponse<PaginatedResponse<TeamInvitation>>> => {
      return portalApi.get(`${BASE_PATH}/invitations`, params);
    },

    /**
     * Send a new invitation
     */
    invite: async (data: {
      email: string;
      role: PortalUserRole;
      personalMessage?: string;
    }): Promise<ApiResponse<{
      invitation: TeamInvitation;
      message: string;
    }>> => {
      return portalApi.post(`${BASE_PATH}/invitations`, data);
    },

    /**
     * Cancel a pending invitation
     */
    cancelInvitation: async (invitationId: string): Promise<ApiResponse<{
      success: boolean;
    }>> => {
      return portalApi.delete(`${BASE_PATH}/invitations/${invitationId}`);
    },

    /**
     * Resend an invitation
     */
    resendInvitation: async (invitationId: string): Promise<ApiResponse<{
      success: boolean;
      message: string;
    }>> => {
      return portalApi.post(`${BASE_PATH}/invitations/${invitationId}/resend`, {});
    },

    // =========================================================================
    // TEAM STATS
    // =========================================================================

    /**
     * Get team overview stats
     */
    getStats: async (): Promise<ApiResponse<{
      totalMembers: number;
      activeMembers: number;
      pendingInvitations: number;
      roleDistribution: Record<PortalUserRole, number>;
    }>> => {
      return portalApi.get(`${BASE_PATH}/stats`);
    },
  };
}

/**
 * Default team service factory
 */
export const teamService = {
  forOrganization: createTeamService,
};

export default teamService;
