'use client';

/**
 * Phase 33: Admin Settings Page
 *
 * Admin user management and portal settings.
 */

import React, { useState } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { StatusBadge, RoleBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// Mock data
const mockAdmins = [
  { id: '1', name: 'Super Admin', email: 'super@monitrax.com', role: 'SUPER_ADMIN', status: 'active', lastLogin: '2026-01-19 14:32' },
  { id: '2', name: 'Billing Admin', email: 'billing@monitrax.com', role: 'BILLING_ADMIN', status: 'active', lastLogin: '2026-01-18 09:15' },
  { id: '3', name: 'Support Agent', email: 'support@monitrax.com', role: 'SUPPORT_ADMIN', status: 'active', lastLogin: '2026-01-19 11:45' },
  { id: '4', name: 'Analytics Viewer', email: 'analytics@monitrax.com', role: 'VIEWER', status: 'active', lastLogin: '2026-01-17 16:20' },
  { id: '5', name: 'Former Admin', email: 'former@monitrax.com', role: 'VIEWER', status: 'inactive', lastLogin: '2025-12-01 10:00' },
];

const mockAuditLogs = [
  { id: '1', admin: 'Super Admin', action: 'USER_SUSPENDED', target: 'john@example.com', time: '2026-01-19 14:32' },
  { id: '2', admin: 'Billing Admin', action: 'LICENSE_UPDATED', target: 'Acme Corp', time: '2026-01-19 11:15' },
  { id: '3', admin: 'Support Agent', action: 'USER_IMPERSONATED', target: 'sarah@example.com', time: '2026-01-18 16:45' },
  { id: '4', admin: 'Super Admin', action: 'FLAG_UPDATED', target: 'DARK_MODE', time: '2026-01-18 10:20' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'admins' | 'audit'>('admins');

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Settings"
        description="Admin user management and audit logs"
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('admins')}
            className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'admins'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Admin Users
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Log
          </button>
        </nav>
      </div>

      {activeTab === 'admins' && (
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
      )}

      {activeTab === 'audit' && (
        <AdminCard padding="none">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <SectionHeader
              title="Audit Log"
              description="All admin actions are logged for compliance"
              action={
                <AdminButton variant="outline">
                  Export
                </AdminButton>
              }
            />
          </div>
          <AdminTable
            columns={[
              { key: 'time', header: 'Time', sortable: true },
              { key: 'admin', header: 'Admin' },
              {
                key: 'action',
                header: 'Action',
                render: (log) => (
                  <span className="font-mono text-sm">{log.action}</span>
                ),
              },
              { key: 'target', header: 'Target' },
            ]}
            data={mockAuditLogs}
            keyExtractor={(log) => log.id}
          />
        </AdminCard>
      )}
    </AdminFeatureGate>
  );
}
