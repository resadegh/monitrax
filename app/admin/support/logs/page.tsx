'use client';

/**
 * Phase 33: Access Logs Page
 *
 * View user and admin access logs across the platform.
 * Supports filtering by action type, user, and date range.
 *
 * GCP Note: Consider migrating to Cloud Logging for better
 * retention, search, and real-time streaming capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { PAGINATION_DEFAULTS } from '@/lib/admin/constants';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    email: string;
    name: string | null;
  };
}

export default function LogsPage() {
  const searchParams = useSearchParams();
  const logType = searchParams.get('type') || 'access';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGINATION_DEFAULTS.LIMIT.toString(),
      });

      if (actionFilter) params.set('action', actionFilter);
      if (statusFilter) params.set('status', statusFilter);

      // For error logs, filter by FAILURE status
      if (logType === 'errors') {
        params.set('status', 'FAILURE');
      }

      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.data || []);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, actionFilter, statusFilter, logType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILURE':
        return 'error';
      case 'PENDING':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getActionVariant = (action: string) => {
    if (action.includes('DELETE') || action.includes('REVOKE')) return 'error';
    if (action.includes('CREATE') || action.includes('SUCCESS')) return 'success';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'warning';
    return 'info';
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title={logType === 'errors' ? 'Error Logs' : 'Access Logs'}
        description={
          logType === 'errors'
            ? 'Track and diagnose application errors and exceptions'
            : 'View user and admin access logs across the platform'
        }
        action={
          <AdminButton
            variant="outline"
            onClick={() => window.open('/api/admin/audit/export?format=csv', '_blank')}
          >
            Export
          </AdminButton>
        }
      />

      {/* Filters */}
      <AdminCard className="mb-6">
        <AdminCardHeader
          title="Filters"
          description="Filter logs by action type and status"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Action Type"
            options={[
              { value: '', label: 'All Actions' },
              { value: 'LOGIN', label: 'Login Events' },
              { value: 'CREATE', label: 'Create Events' },
              { value: 'UPDATE', label: 'Update Events' },
              { value: 'DELETE', label: 'Delete Events' },
              { value: 'VIEW', label: 'View Events' },
            ]}
            value={actionFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
          <Select
            label="Status"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'SUCCESS', label: 'Success' },
              { value: 'FAILURE', label: 'Failure' },
            ]}
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            disabled={logType === 'errors'}
          />
          <div className="flex items-end">
            <AdminButton variant="outline" onClick={() => { setActionFilter(''); setStatusFilter(''); setCurrentPage(1); }}>
              Clear Filters
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Error State */}
      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchLogs}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Logs Table */}
      <AdminCard padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading logs...</span>
            </div>
          </div>
        ) : (
          <>
            <AdminTable
              columns={[
                {
                  key: 'createdAt',
                  header: 'Time',
                  sortable: true,
                  render: (log) => (
                    <span className="text-sm">
                      {new Date(log.createdAt).toLocaleString('en-AU')}
                    </span>
                  ),
                },
                {
                  key: 'user',
                  header: 'User',
                  render: (log) => (
                    <div>
                      <p className="text-sm font-medium">
                        {log.user?.name || log.user?.email || 'Anonymous'}
                      </p>
                      {log.user?.email && log.user?.name && (
                        <p className="text-xs text-gray-500">{log.user.email}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'action',
                  header: 'Action',
                  render: (log) => (
                    <AdminBadge variant={getActionVariant(log.action)} size="sm">
                      {log.action}
                    </AdminBadge>
                  ),
                },
                {
                  key: 'entityType',
                  header: 'Entity',
                  render: (log) => (
                    log.entityType ? (
                      <span className="text-sm">
                        {log.entityType}
                        {log.entityId && <span className="text-xs text-gray-500 ml-1">#{log.entityId.substring(0, 8)}</span>}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (log) => (
                    <AdminBadge variant={getStatusVariant(log.status)} size="sm">
                      {log.status}
                    </AdminBadge>
                  ),
                },
                {
                  key: 'ipAddress',
                  header: 'IP',
                  render: (log) => (
                    <span className="font-mono text-xs">{log.ipAddress || '-'}</span>
                  ),
                },
              ]}
              data={logs}
              keyExtractor={(log) => log.id}
              emptyMessage={logType === 'errors' ? 'No error logs found' : 'No access logs found'}
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

      {/* GCP Info */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>GCP Migration Note:</strong> Consider enabling Cloud Logging for better log retention,
          real-time streaming, and advanced search capabilities. Logs are currently stored in the database
          with 7-year retention for CDR compliance.
        </p>
      </div>
    </AdminFeatureGate>
  );
}
