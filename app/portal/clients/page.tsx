/**
 * Phase 32: Portal Clients Page
 *
 * Displays the client list for the current organization.
 * Uses modular ClientList and InviteModal components.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClientList, type ClientFilters } from '@/components/portal/clients';
import { InviteModal, type InviteData } from '@/components/portal/team';
import { createClientsService } from '@/lib/portal/services/clients';
import type { PortalClient } from '@/lib/portal/types';

// TODO: Get from auth context
const MOCK_ORG_ID = 'demo-org-id';

export default function ClientsPage() {
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

  const clientsApi = createClientsService(MOCK_ORG_ID);

  const loadClients = useCallback(async (filters?: ClientFilters, page = 1) => {
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
  }, []);

  useEffect(() => {
    // In production, this would call the API
    // For now, set demo data
    setClients([]);
    setLoading(false);
    setStats({
      total: 0,
      active: 0,
      pending: 0,
      invited: 0,
    });
  }, []);

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
