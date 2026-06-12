'use client';

/**
 * Phase 33: Users List Page
 *
 * List and manage all personal users.
 * Uses real data from /api/admin/users endpoint.
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
import { ADMIN_ROUTES, PAGINATION_DEFAULTS, USER_TIER_LIMITS } from '@/lib/admin/constants';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  accountsCount: number;
  propertiesCount: number;
  loansCount: number;
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd?: string;
  };
}

interface ApiResponse {
  data: UserData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: { code: string; message: string };
}


export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<UserData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
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

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch users');
      }

      const data: ApiResponse = await response.json();
      setUsers(data.data);
      setTotalItems(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, tierFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tierFilter, statusFilter]);

  // Transform data for table display
  const displayUsers = users.map((user) => ({
    id: user.id,
    name: user.name || 'Unnamed User',
    email: user.email,
    tier: user.subscription.tier,
    status: user.subscription.status,
    mrr: USER_TIER_LIMITS[user.subscription.tier as keyof typeof USER_TIER_LIMITS]?.monthlyPrice ?? 0,
    lastLogin: user.lastLoginAt
      ? new Date(user.lastLoginAt).toLocaleDateString('en-AU')
      : '—',
    createdAt: new Date(user.createdAt).toLocaleDateString('en-AU'),
  }));

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Users"
        description="Manage personal user accounts and subscriptions"
        searchPlaceholder="Search users..."
        searchValue={search}
        onSearch={setSearch}
      />

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <Select
          options={[
            { value: '', label: 'All Tiers' },
            { value: 'FREE', label: 'Free' },
            { value: 'BASIC', label: 'Basic' },
            { value: 'PRO', label: 'Pro' },
            { value: 'PREMIUM', label: 'Premium' },
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
            <AdminButton variant="outline" size="sm" onClick={fetchUsers}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Users Table */}
      <AdminCard padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading users...</span>
            </div>
          </div>
        ) : (
          <>
            <AdminTable
              columns={[
                {
                  key: 'name',
                  header: 'User',
                  render: (user) => (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  ),
                  sortable: true,
                },
                {
                  key: 'tier',
                  header: 'Tier',
                  render: (user) => <TierBadge tier={user.tier} size="sm" />,
                  sortable: true,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (user) => (
                    <StatusBadge status={user.status as 'active' | 'suspended'} size="sm" />
                  ),
                },
                {
                  key: 'mrr',
                  header: 'MRR',
                  render: (user) => (user.mrr > 0 ? `$${user.mrr.toFixed(2)}` : '-'),
                  sortable: true,
                },
                {
                  key: 'lastLogin',
                  header: 'Last Login',
                  sortable: true,
                },
                {
                  key: 'createdAt',
                  header: 'Joined',
                  sortable: true,
                },
              ]}
              data={displayUsers}
              keyExtractor={(user) => user.id}
              onRowClick={(user) => router.push(ADMIN_ROUTES.USER_DETAIL(user.id))}
              emptyMessage="No users found"
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
