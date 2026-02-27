'use client';

/**
 * Phase 33: Admin Settings Page
 *
 * Admin user management only.
 * Audit logs have been moved to the dedicated /admin/audit-logs page.
 */

import React from 'react';
import Link from 'next/link';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { StatusBadge, RoleBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

// Mock data — to be replaced with API calls when admin user CRUD endpoints are built
const mockAdmins = [
  { id: '1', name: 'Super Admin', email: 'super@monitrax.com', role: 'SUPER_ADMIN', status: 'active', lastLogin: '2026-01-19 14:32' },
  { id: '2', name: 'Billing Admin', email: 'billing@monitrax.com', role: 'BILLING_ADMIN', status: 'active', lastLogin: '2026-01-18 09:15' },
  { id: '3', name: 'Support Agent', email: 'support@monitrax.com', role: 'SUPPORT_ADMIN', status: 'active', lastLogin: '2026-01-19 11:45' },
  { id: '4', name: 'Analytics Viewer', email: 'analytics@monitrax.com', role: 'VIEWER', status: 'active', lastLogin: '2026-01-17 16:20' },
  { id: '5', name: 'Former Admin', email: 'former@monitrax.com', role: 'VIEWER', status: 'inactive', lastLogin: '2025-12-01 10:00' },
];

export default function SettingsPage() {
  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Settings"
        description="Admin user management"
        action={
          <Link href={ADMIN_ROUTES.AUDIT_LOGS}>
            <AdminButton variant="outline">View Audit Logs</AdminButton>
          </Link>
        }
      />

      <AdminCard padding="none">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <SectionHeader
            title="Admin Users"
            description="Manage admin portal access"
            action={
              <AdminButton
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Add Admin
              </AdminButton>
            }
          />
        </div>
        <AdminTable
          columns={[
            {
              key: 'name',
              header: 'Admin',
              render: (admin) => (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{admin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{admin.email}</p>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Role',
              render: (admin) => <RoleBadge role={admin.role} size="sm" />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (admin) => (
                <StatusBadge
                  status={admin.status as 'active' | 'inactive'}
                  size="sm"
                />
              ),
            },
            {
              key: 'lastLogin',
              header: 'Last Login',
            },
            {
              key: 'actions',
              header: '',
              render: (admin) => (
                <div className="flex gap-2">
                  <AdminButton variant="outline" size="sm">
                    Edit
                  </AdminButton>
                  {admin.status === 'active' && (
                    <AdminButton variant="ghost" size="sm">
                      Deactivate
                    </AdminButton>
                  )}
                </div>
              ),
            },
          ]}
          data={mockAdmins}
          keyExtractor={(admin) => admin.id}
        />
      </AdminCard>
    </AdminFeatureGate>
  );
}
