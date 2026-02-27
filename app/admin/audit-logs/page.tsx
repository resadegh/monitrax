'use client';

/**
 * Admin Audit Logs Page (Canonical)
 *
 * Unified view of all audit activity — admin actions and user actions.
 * This is the SINGLE source of truth for audit log viewing in the admin portal.
 *
 * Replaces:
 *  - /dashboard/admin/audit-logs (LEGACY — marked for deletion)
 *  - /admin/settings?tab=audit (mock data — removed)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { StatusBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditSource = 'all' | 'admin' | 'user';

interface AuditLogEntry {
  id: string;
  source: 'admin' | 'user';
  action: string;
  status: string;
  category: string | null;
  description: string | null;
  actor: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  timestamp: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [source, setSource] = useState<AuditSource>('all');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [entityType, setEntityType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        source,
      });
      if (action) params.set('action', action);
      if (status) params.set('status', status);
      if (entityType) params.set('entityType', entityType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load audit logs');

      const json = await res.json();
      setLogs(json.data ?? []);
      setPagination(json.pagination ?? null);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, source, action, status, entityType, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Export CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ source });
      if (action) params.set('action', action);
      if (status) params.set('status', status);
      if (entityType) params.set('entityType', entityType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/audit/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to export');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSource('all');
    setAction('');
    setStatus('');
    setEntityType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Audit Logs"
        description="Unified view of all system and admin audit activity"
        action={
          <AdminButton variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </AdminButton>
        }
      />

      {/* Source tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          {(['all', 'admin', 'user'] as AuditSource[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSource(s); setPage(1); }}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                source === s
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? 'All Logs' : s === 'admin' ? 'Admin Actions' : 'User Activity'}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <AdminCard className="mb-6">
        <AdminCardHeader title="Filters" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="EXPORT">Export</option>
              <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
              <option value="FORBIDDEN_ACCESS">Forbidden Access</option>
              <option value="USER_SUSPENDED">User Suspended</option>
              <option value="USER_TIER_CHANGED">Tier Changed</option>
              <option value="FLAG_UPDATED">Flag Updated</option>
            </select>
          </div>

          {source !== 'admin' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Entity Type</label>
            <input
              type="text"
              placeholder="e.g. Property, User"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <AdminButton onClick={() => { setPage(1); fetchLogs(); }}>Apply Filters</AdminButton>
          <AdminButton variant="outline" onClick={resetFilters}>Reset</AdminButton>
        </div>
      </AdminCard>

      {/* Results summary */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {pagination ? `Showing ${logs.length} of ${pagination.total} records (page ${pagination.page})` : 'Loading...'}
      </p>

      {/* Table */}
      <AdminCard padding="none">
        <AdminTable
          columns={[
            {
              key: 'timestamp',
              header: 'Timestamp',
              sortable: true,
              render: (log: AuditLogEntry) => (
                <span className="font-mono text-xs">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              render: (log: AuditLogEntry) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  log.source === 'admin'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {log.source}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              render: (log: AuditLogEntry) => (
                <span className="font-mono text-sm">{log.action}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (log: AuditLogEntry) => (
                <StatusBadge
                  status={
                    log.status === 'SUCCESS' ? 'active'
                      : log.status === 'FAILURE' ? 'inactive'
                      : 'suspended'
                  }
                  size="sm"
                />
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (log: AuditLogEntry) => (
                <div className="text-xs">
                  <div className="font-medium truncate max-w-[140px]">
                    {log.actor ? (log.actor.length > 20 ? log.actor.substring(0, 8) + '...' : log.actor) : 'System'}
                  </div>
                  {log.actorEmail && (
                    <div className="text-gray-400 truncate max-w-[140px]">{log.actorEmail}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'entity',
              header: 'Entity',
              render: (log: AuditLogEntry) => (
                log.entityType ? (
                  <div className="text-xs">
                    <div className="font-medium">{log.entityType}</div>
                    {log.entityId && (
                      <div className="text-gray-400 font-mono">{log.entityId.substring(0, 8)}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )
              ),
            },
            {
              key: 'ipAddress',
              header: 'IP',
              render: (log: AuditLogEntry) => (
                <span className="font-mono text-xs">{log.ipAddress || '—'}</span>
              ),
            },
          ]}
          data={loading ? [] : logs}
          keyExtractor={(log: AuditLogEntry) => log.id}
          emptyMessage={loading ? 'Loading audit logs...' : 'No audit logs found'}
        />
      </AdminCard>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </AdminButton>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasMore || loading}
          >
            Next
          </AdminButton>
        </div>
      )}
    </AdminFeatureGate>
  );
}
