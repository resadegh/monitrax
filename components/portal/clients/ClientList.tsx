/**
 * Phase 32: Client List Component
 *
 * MODULAR: Displays a list of clients with filtering and actions.
 * Can be used standalone or composed with other components.
 */

'use client';

import { useState, useCallback } from 'react';
import { PortalCard, EmptyState, StatsCard } from '../ui/PortalCard';
import { PortalTable, Pagination, type TableColumn } from '../ui/PortalTable';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { SearchInput, Select } from '../ui/PortalForm';
import { ClientStatusBadge, ConsentBadge } from './ClientBadges';
import type { PortalClient } from '@/lib/portal/types';
import type { ClientStatus, ConsentStatus } from '@prisma/client';

interface ClientListProps {
  clients: PortalClient[];
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onClientClick?: (client: PortalClient) => void;
  onInviteClick?: () => void;
  onFilterChange?: (filters: ClientFilters) => void;
  stats?: {
    total: number;
    active: number;
    pending: number;
    invited: number;
  };
}

export interface ClientFilters {
  search: string;
  status: ClientStatus | '';
  consentStatus: ConsentStatus | '';
  assignedTo: string;
}

export function ClientList({
  clients,
  loading = false,
  pagination,
  onPageChange,
  onClientClick,
  onInviteClick,
  onFilterChange,
  stats,
}: ClientListProps) {
  const [filters, setFilters] = useState<ClientFilters>({
    search: '',
    status: '',
    consentStatus: '',
    assignedTo: '',
  });

  const handleFilterChange = useCallback(
    (key: keyof ClientFilters, value: string) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const columns: TableColumn<PortalClient>[] = [
    {
      key: 'user',
      header: 'Client',
      sortable: true,
      render: (client) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
            {client.user?.name?.charAt(0) || client.user?.email?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{client.user?.name || 'Unknown'}</p>
            <p className="text-xs text-slate-500">{client.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'clientReference',
      header: 'Reference',
      render: (client) => (
        <span className="text-sm text-slate-600">
          {client.clientReference || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (client) => <ClientStatusBadge status={client.status} />,
    },
    {
      key: 'consentStatus',
      header: 'Consent',
      render: (client) => <ConsentBadge status={client.consentStatus} />,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (client) => (
        <span className="text-sm text-slate-600">
          {client.assignedTo?.user?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'pendingTasks',
      header: 'Tasks',
      align: 'center',
      render: (client) => (
        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
          (client.pendingTasksCount || 0) > 0
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-500'
        }`}>
          {client.pendingTasksCount || 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: (client) => (
        <PortalButton
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClientClick?.(client);
          }}
        >
          View
        </PortalButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Clients"
            value={stats.total}
            loading={loading}
          />
          <StatsCard
            title="Active"
            value={stats.active}
            subtitle="Consent granted"
            loading={loading}
          />
          <StatsCard
            title="Pending Consent"
            value={stats.pending}
            loading={loading}
          />
          <StatsCard
            title="Invited"
            value={stats.invited}
            subtitle="Awaiting response"
            loading={loading}
          />
        </div>
      )}

      {/* Filters and Actions */}
      <PortalCard>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <SearchInput
                placeholder="Search clients..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onClear={() => handleFilterChange('search', '')}
              />
            </div>
            <div className="flex gap-2">
              <Select
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'INVITED', label: 'Invited' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'All Consent' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'GRANTED', label: 'Granted' },
                  { value: 'REVOKED', label: 'Revoked' },
                  { value: 'EXPIRED', label: 'Expired' },
                ]}
                value={filters.consentStatus}
                onChange={(e) => handleFilterChange('consentStatus', e.target.value)}
              />
            </div>
          </div>
          <ButtonGroup>
            {onInviteClick && (
              <PortalButton onClick={onInviteClick}>
                <PlusIcon />
                <span className="ml-2">Invite Client</span>
              </PortalButton>
            )}
          </ButtonGroup>
        </div>

        {/* Table */}
        {clients.length === 0 && !loading ? (
          <EmptyState
            icon={<ClientsIcon />}
            title="No clients yet"
            description="Invite your first client to start managing their financial data."
            action={
              onInviteClick && (
                <PortalButton onClick={onInviteClick}>
                  Invite Your First Client
                </PortalButton>
              )
            }
          />
        ) : (
          <PortalTable
            columns={columns}
            data={clients}
            keyExtractor={(client) => client.id}
            loading={loading}
            onRowClick={onClientClick}
            sortable
            defaultSortKey="user"
          />
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            onPageChange={onPageChange || (() => {})}
          />
        )}
      </PortalCard>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default ClientList;
