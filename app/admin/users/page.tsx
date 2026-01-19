'use client';

/**
 * Phase 33: Users List Page
 *
 * List and manage all personal users.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { Select } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

// Mock data
const mockUsers = [
  { id: '1', name: 'John Smith', email: 'john@example.com', tier: 'PRO', status: 'active', lastLogin: '2026-01-19', mrr: 19.99, createdAt: '2025-03-15' },
  { id: '2', name: 'Sarah Connor', email: 'sarah@example.com', tier: 'BASIC', status: 'active', lastLogin: '2026-01-18', mrr: 9.99, createdAt: '2025-05-22' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', tier: 'FREE', status: 'active', lastLogin: '2026-01-17', mrr: 0, createdAt: '2025-08-10' },
  { id: '4', name: 'Emily Davis', email: 'emily@example.com', tier: 'PREMIUM', status: 'active', lastLogin: '2026-01-19', mrr: 39.99, createdAt: '2024-11-03' },
  { id: '5', name: 'Alex Brown', email: 'alex@example.com', tier: 'PRO', status: 'suspended', lastLogin: '2026-01-10', mrr: 19.99, createdAt: '2025-01-28' },
  { id: '6', name: 'Lisa White', email: 'lisa@example.com', tier: 'BASIC', status: 'active', lastLogin: '2026-01-15', mrr: 9.99, createdAt: '2025-07-14' },
];

export default function UsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = mockUsers.filter((user) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!user.name.toLowerCase().includes(searchLower) && !user.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (tierFilter && user.tier !== tierFilter) return false;
    if (statusFilter && user.status !== statusFilter) return false;
    return true;
  });

  return (
    <AdminFeatureGate feature="userManagement">
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

      {/* Users Table */}
      <AdminCard padding="none">
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
              render: (user) => (user.mrr > 0 ? `$${user.mrr}` : '-'),
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
          data={filteredUsers}
          keyExtractor={(user) => user.id}
          onRowClick={(user) => router.push(ADMIN_ROUTES.USER_DETAIL(user.id))}
          emptyMessage="No users found"
        />
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredUsers.length / 10)}
          onPageChange={setCurrentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={10}
        />
      </AdminCard>
    </AdminFeatureGate>
  );
}
