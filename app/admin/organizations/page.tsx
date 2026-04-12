'use client';

/**
 * Phase 33: Organizations List Page
 *
 * List and manage all organizations.
 * Uses real data from /api/admin/organizations endpoint.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES, PAGINATION_DEFAULTS } from '@/lib/admin/constants';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  clientCount: number;
  license: {
    tier: string;
    status: string;
    clientLimit: number;
    staffLimit: number;
  } | null;
}

interface ApiResponse {
  data: OrganizationData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: { code: string; message: string };
}

// MRR calculation based on tier (per ADMIN_PORTAL_COMPLETION_PLAN.md)
const TIER_MRR: Record<string, number> = {
  STARTER: 49,
  PROFESSIONAL: 149,
  BUSINESS: 349,
  ENTERPRISE: 999,
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGINATION_DEFAULTS.LIMIT.toString(),
      });

      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/organizations?${params.toString()}`, {
        
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch organizations');
      }

      const data: ApiResponse = await response.json();
      setOrganizations(data.data);
      setTotalItems(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, tierFilter, statusFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tierFilter, statusFilter]);

  // Transform data for table display
  const displayOrgs = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.license?.tier || 'STARTER',
    status: org.license?.status || 'active',
    clients: org.clientCount,
    staff: org.memberCount,
    mrr: TIER_MRR[org.license?.tier || 'STARTER'] || 0,
    createdAt: new Date(org.createdAt).toLocaleDateString('en-AU'),
  }));

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Organizations"
        description="Manage organization accounts and licenses"
        searchPlaceholder="Search organizations..."
        searchValue={search}
        onSearch={setSearch}
        action={
          <AdminButton
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Organization
          </AdminButton>
        }
      />

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <Select
          options={[
            { value: '', label: 'All Plans' },
            { value: 'STARTER', label: 'Starter' },
            { value: 'PROFESSIONAL', label: 'Professional' },
            { value: 'BUSINESS', label: 'Business' },
            { value: 'ENTERPRISE', label: 'Enterprise' },
          ]}
          value={tierFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTierFilter(e.target.value)}
          className="w-40"
        />
        <Select
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Error State */}
      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchOrganizations}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Organizations Table */}
      <AdminCard padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading organizations...</span>
            </div>
          </div>
        ) : (
          <>
            <AdminTable
              columns={[
                {
                  key: 'name',
                  header: 'Organization',
                  render: (org) => (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">/{org.slug}</p>
                    </div>
                  ),
                  sortable: true,
                },
                {
                  key: 'plan',
                  header: 'Plan',
                  render: (org) => <TierBadge tier={org.plan} size="sm" />,
                  sortable: true,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (org) => <StatusBadge status={org.status as 'active' | 'suspended'} size="sm" />,
                },
                {
                  key: 'clients',
                  header: 'Clients',
                  render: (org) => org.clients.toString(),
                  sortable: true,
                },
                {
                  key: 'staff',
                  header: 'Staff',
                  render: (org) => org.staff.toString(),
                  sortable: true,
                },
                {
                  key: 'mrr',
                  header: 'MRR',
                  render: (org) => `$${org.mrr}`,
                  sortable: true,
                },
                {
                  key: 'createdAt',
                  header: 'Created',
                  sortable: true,
                },
              ]}
              data={displayOrgs}
              keyExtractor={(org) => org.id}
              onRowClick={(org) => router.push(ADMIN_ROUTES.ORGANIZATION_DETAIL(org.id))}
              emptyMessage="No organizations found"
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={PAGINATION_DEFAULTS.LIMIT}
            />
          </>
        )}
      </AdminCard>
    </AdminFeatureGate>
  );
}
