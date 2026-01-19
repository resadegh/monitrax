/**
 * Phase 32: Portal Clients Page
 *
 * Displays the client list for the current organization.
 * Uses modular ClientList and InviteModal components.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClientList, type ClientFilters } from '@/components/portal/clients';
import { InviteModal, type InviteData } from '@/components/portal/team';
import { createClientsService } from '@/lib/portal/services/clients';
import { useOrganization } from '@/lib/portal';
import type { PortalClient } from '@/lib/portal/types';

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
        // Map API response to PortalClient type
        setClients(response.data.items as unknown as PortalClient[]);
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <p className="text-slate-500 mt-1">
          Manage your client relationships and access their financial data
        </p>
      </div>

      <ClientList
        clients={clients}
        loading={loading}
        pagination={pagination}
        stats={stats}
        onPageChange={handlePageChange}
        onClientClick={handleClientClick}
        onInviteClick={() => setShowInviteModal(true)}
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
