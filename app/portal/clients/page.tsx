/**
 * Phase 32: Portal Clients Page
 *
 * Displays the client list for the current organization.
 * Includes role-based access controls for inviting clients.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClientList, type ClientFilters } from '@/components/portal/clients';
import { InviteModal, type InviteData } from '@/components/portal/team';
import { PortalPageHero } from '@/components/shell';
import { createClientsService } from '@/lib/portal/services/clients';
import { useOrganization } from '@/lib/portal';
import type { PortalClient } from '@/lib/portal/types';
import type { PortalUserRole } from '@prisma/client';

// Map organization role to portal role
function mapToPortalRole(role: string): PortalUserRole {
  const roleMap: Record<string, PortalUserRole> = {
    OWNER: 'PORTAL_OWNER',
    ADMIN: 'PORTAL_ADMIN',
    CONTRIBUTOR: 'PORTAL_ADVISOR',
    VIEWER: 'PORTAL_VIEWER',
    PORTAL_OWNER: 'PORTAL_OWNER',
    PORTAL_ADMIN: 'PORTAL_ADMIN',
    PORTAL_ADVISOR: 'PORTAL_ADVISOR',
    PORTAL_VIEWER: 'PORTAL_VIEWER',
  };
  return roleMap[role] || 'PORTAL_VIEWER';
}

export default function ClientsPage() {
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    invited: 0,
  });

  // Get current user's role in the organization
  const currentUserRole = useMemo<PortalUserRole>(() => {
    if (!currentOrg?.role) return 'PORTAL_VIEWER';
    return mapToPortalRole(currentOrg.role);
  }, [currentOrg]);

  // Check if user can invite clients (Owners, Admins, and Advisors can invite)
  const canInviteClients = ['PORTAL_OWNER', 'PORTAL_ADMIN', 'PORTAL_ADVISOR'].includes(currentUserRole);

  // Create clients service with current organization ID
  const clientsApi = useMemo(
    () => (currentOrg ? createClientsService(currentOrg.id) : null),
    [currentOrg]
  );

  const loadClients = useCallback(async (filters?: ClientFilters, page = 1) => {
    if (!clientsApi) return;

    setLoading(true);
    try {
      const response = await clientsApi.list({
        page,
        limit: 20,
        status: filters?.status || undefined,
        consentStatus: filters?.consentStatus || undefined,
        search: filters?.search || undefined,
      });

      if (response.data) {
        // Map API response to PortalClient type - API returns 'clients' not 'items'
        const clientsData = (response.data as { clients?: PortalClient[]; items?: PortalClient[] }).clients
          || (response.data as { clients?: PortalClient[]; items?: PortalClient[] }).items
          || [];
        setClients(clientsData);
        setPagination({
          page: response.data.pagination.page,
          totalPages: response.data.pagination.totalPages,
          total: response.data.pagination.total,
        });
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  }, [clientsApi]);

  useEffect(() => {
    if (!orgLoading && currentOrg && clientsApi) {
      loadClients();
    } else if (!orgLoading && !currentOrg) {
      // No organization selected
      setClients([]);
      setLoading(false);
    }
  }, [orgLoading, currentOrg, clientsApi, loadClients]);

  const handleFilterChange = (filters: ClientFilters) => {
    loadClients(filters, 1);
  };

  const handlePageChange = (page: number) => {
    loadClients(undefined, page);
  };

  const handleClientClick = (client: PortalClient) => {
    // Navigate to client detail
    window.location.href = `/portal/clients/${client.id}`;
  };

  const handleInvite = async (data: InviteData) => {
    if (!clientsApi) {
      throw new Error('No organization selected');
    }

    const response = await clientsApi.invite({
      email: data.email,
      requestedScopes: data.requestedScopes || [],
      personalMessage: data.personalMessage,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Refresh client list
    loadClients();
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading organization...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no organization is selected
  if (!currentOrg) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">No Organization Selected</p>
          <p className="text-amber-600 text-sm mt-1">
            Please select or create an organization to manage clients.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <PortalPageHero
        atmosphere="sky"
        title="Clients"
        subtitle="Manage your client relationships and access their financial data."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Your role</span>
            <RoleBadge role={currentUserRole} />
            {!canInviteClients && (
              <span className="text-[11px] text-slate-500">(View only)</span>
            )}
          </div>
        }
      />

      <ClientList
        clients={clients}
        loading={loading}
        pagination={pagination}
        stats={stats}
        onPageChange={handlePageChange}
        onClientClick={handleClientClick}
        onInviteClick={canInviteClients ? () => setShowInviteModal(true) : undefined}
        onFilterChange={handleFilterChange}
      />

      {showInviteModal && (
        <InviteModal
          type="client"
          onSubmit={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}

// Role Badge Component
function RoleBadge({ role }: { role: PortalUserRole }) {
  const config: Record<PortalUserRole, { label: string; className: string }> = {
    PORTAL_OWNER: { label: 'Owner', className: 'bg-purple-100 text-purple-700' },
    PORTAL_ADMIN: { label: 'Admin', className: 'bg-blue-100 text-blue-700' },
    PORTAL_ADVISOR: { label: 'Advisor', className: 'bg-green-100 text-green-700' },
    PORTAL_VIEWER: { label: 'Viewer', className: 'bg-slate-100 text-slate-600' },
  };

  const { label, className } = config[role] || { label: 'Unknown', className: 'bg-slate-100 text-slate-600' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
