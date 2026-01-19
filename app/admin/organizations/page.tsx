'use client';

/**
 * Phase 33: Organizations List Page
 *
 * List and manage all organizations.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

// Mock data
const mockOrganizations = [
  { id: '1', name: 'Acme Accounting', slug: 'acme', plan: 'PROFESSIONAL', status: 'active', clients: 45, staff: 8, mrr: 149, createdAt: '2025-06-15' },
  { id: '2', name: 'Smith Financial', slug: 'smith', plan: 'BUSINESS', status: 'active', clients: 156, staff: 18, mrr: 349, createdAt: '2025-04-22' },
  { id: '3', name: 'ABC Tax Services', slug: 'abc', plan: 'STARTER', status: 'suspended', clients: 8, staff: 2, mrr: 49, createdAt: '2025-09-10' },
  { id: '4', name: 'Premier Advisors', slug: 'premier', plan: 'ENTERPRISE', status: 'active', clients: 312, staff: 42, mrr: 999, createdAt: '2024-11-03' },
  { id: '5', name: 'Quick Books Pro', slug: 'quickbooks', plan: 'PROFESSIONAL', status: 'active', clients: 32, staff: 5, mrr: 149, createdAt: '2025-08-28' },
];

export default function OrganizationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredOrgs = mockOrganizations.filter((org) => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tierFilter && org.plan !== tierFilter) return false;
    if (statusFilter && org.status !== statusFilter) return false;
    return true;
  });

  return (
    <AdminFeatureGate feature="organizationManagement">
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

      {/* Organizations Table */}
      <AdminCard padding="none">
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
          data={filteredOrgs}
          keyExtractor={(org) => org.id}
          onRowClick={(org) => router.push(ADMIN_ROUTES.ORGANIZATION_DETAIL(org.id))}
          emptyMessage="No organizations found"
        />
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredOrgs.length / 10)}
          onPageChange={setCurrentPage}
          totalItems={filteredOrgs.length}
          itemsPerPage={10}
        />
      </AdminCard>
    </AdminFeatureGate>
  );
}
