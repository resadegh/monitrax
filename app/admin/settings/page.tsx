'use client';

/**
 * Phase 33: Admin Settings Page
 *
 * Admin user management and portal settings.
 * Uses real data from /api/admin/admins and /api/admin/audit endpoints.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { StatusBadge, RoleBadge, AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLogin: string | null;
  isInactive90Days: boolean;
  isCurrentlyLocked: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  adminUserId: string;
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  description: string;
  timestamp: string;
  ipAddress: string;
  adminUser?: {
    name: string;
    email: string;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'admins' | 'audit'>('admins');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/admins', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin users');
      }

      const data = await response.json();
      setAdmins(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/audit?limit=50', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setAuditLogs(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    await Promise.all([fetchAdmins(), fetchAuditLogs()]);

    setLoading(false);
  }, [fetchAdmins, fetchAuditLogs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeactivate = async (adminId: string) => {
    if (!confirm('Are you sure you want to deactivate this admin?')) {
      return;
    }

    setActionLoading(adminId);
    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to deactivate admin');
      }

      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (adminId: string) => {
    setActionLoading(adminId);
    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to reactivate admin');
      }

      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate admin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlock = async (adminId: string) => {
    setActionLoading(adminId);
    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ unlockAccount: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to unlock admin');
      }

      await fetchAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock admin');
    } finally {
      setActionLoading(null);
    }
  };

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

      {/* Error State */}
      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={() => { setError(null); fetchData(); }}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading settings...</span>
          </div>
        </div>
      ) : (
        <>
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">{admin.name}</p>
                          {admin.isInactive90Days && (
                            <AdminBadge variant="warning" size="sm">90+ days inactive</AdminBadge>
                          )}
                          {admin.isCurrentlyLocked && (
                            <AdminBadge variant="error" size="sm">Locked</AdminBadge>
                          )}
                        </div>
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
                    key: 'mfa',
                    header: 'MFA',
                    render: (admin) => (
                      <AdminBadge
                        variant={admin.mfaEnabled ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {admin.mfaEnabled ? 'Enabled' : 'Disabled'}
                      </AdminBadge>
                    ),
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
                    render: (admin) =>
                      admin.lastLogin
                        ? new Date(admin.lastLogin).toLocaleString('en-AU')
                        : 'Never',
                  },
                  {
                    key: 'actions',
                    header: '',
                    render: (admin) => (
                      <div className="flex gap-2">
                        {admin.isCurrentlyLocked && (
                          <AdminButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnlock(admin.id)}
                            disabled={actionLoading === admin.id}
                          >
                            {actionLoading === admin.id ? 'Unlocking...' : 'Unlock'}
                          </AdminButton>
                        )}
                        {admin.status === 'active' ? (
                          <AdminButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(admin.id)}
                            disabled={actionLoading === admin.id}
                          >
                            {actionLoading === admin.id ? 'Processing...' : 'Deactivate'}
                          </AdminButton>
                        ) : (
                          <AdminButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivate(admin.id)}
                            disabled={actionLoading === admin.id}
                          >
                            {actionLoading === admin.id ? 'Processing...' : 'Reactivate'}
                          </AdminButton>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={admins}
                keyExtractor={(admin) => admin.id}
                emptyMessage="No admin users found"
              />
            </AdminCard>
          )}

          {activeTab === 'audit' && (
            <AdminCard padding="none">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <SectionHeader
                  title="Admin Audit Log"
                  description="All admin actions are logged for compliance (7-year retention)"
                  action={
                    <AdminButton variant="outline" onClick={() => window.open('/api/admin/audit/export?format=csv', '_blank')}>
                      Export
                    </AdminButton>
                  }
                />
              </div>
              <AdminTable
                columns={[
                  {
                    key: 'timestamp',
                    header: 'Time',
                    sortable: true,
                    render: (log) => new Date(log.timestamp).toLocaleString('en-AU'),
                  },
                  {
                    key: 'admin',
                    header: 'Admin',
                    render: (log) => log.adminUser?.name || 'Unknown',
                  },
                  {
                    key: 'action',
                    header: 'Action',
                    render: (log) => (
                      <span className="font-mono text-sm">{log.action}</span>
                    ),
                  },
                  {
                    key: 'category',
                    header: 'Category',
                    render: (log) => (
                      <AdminBadge variant="neutral" size="sm">
                        {log.category}
                      </AdminBadge>
                    ),
                  },
                  {
                    key: 'description',
                    header: 'Description',
                    render: (log) => (
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs block">
                        {log.description}
                      </span>
                    ),
                  },
                  {
                    key: 'ipAddress',
                    header: 'IP',
                    render: (log) => (
                      <span className="font-mono text-xs">{log.ipAddress}</span>
                    ),
                  },
                ]}
                data={auditLogs}
                keyExtractor={(log) => log.id}
                emptyMessage="No audit logs found"
              />
            </AdminCard>
          )}
        </>
      )}
    </AdminFeatureGate>
  );
}
