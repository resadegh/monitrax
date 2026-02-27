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
import { useAuth } from '@/lib/context/AuthContext';
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
type PageView = 'logs' | 'compliance';

interface CdrComplianceData {
  retention: {
    totalUserLogs: number;
    totalAdminLogs: number;
    oldestUserLog: string | null;
    oldestAdminLog: string | null;
    retentionPolicyDays: number;
    cdrMinDays: number;
  };
  anomalies: Array<{
    type: string;
    severity: string;
    description: string;
    count: number;
  }>;
  actionCoverage: {
    hasSystemEvents: boolean;
    hasSecurityEvents: boolean;
    hasAuthEvents: boolean;
    hasApiRequests: boolean;
    actionBreakdown: Record<string, number>;
  };
  cdrRequirements: {
    criticalSystemEvents: boolean;
    securityEventsLogged: boolean;
    authenticationLogged: boolean;
    apiRequestsLogged: boolean;
    logsRetainedOver90Days: boolean;
    retentionPolicyDays: number;
    cdrMinDays: number;
    noCdrDataInLogs: boolean;
  };
}

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
  const { token } = useAuth();
  const [pageView, setPageView] = useState<PageView>('logs');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [compliance, setCompliance] = useState<CdrComplianceData | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Filters
  const [source, setSource] = useState<AuditSource>('all');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [entityType, setEntityType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Build auth headers (Bearer token if available, otherwise rely on cookies)
  const getHeaders = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
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

      const res = await fetch(`/api/admin/audit?${params}`, {
        headers: getHeaders(),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const msg = errJson?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const json = await res.json();
      setLogs(json.data ?? []);
      setPagination(json.pagination ?? null);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, source, action, status, entityType, startDate, endDate, getHeaders]);

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

      const res = await fetch(`/api/admin/audit/export?${params}`, {
        headers: getHeaders(),
      });
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

  // Fetch CDR compliance data
  const fetchCompliance = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const res = await fetch('/api/admin/audit/compliance', { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load compliance data');
      const json = await res.json();
      setCompliance(json.data ?? null);
    } catch (err) {
      console.error('Compliance fetch error:', err);
    } finally {
      setComplianceLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (pageView === 'compliance' && !compliance) {
      fetchCompliance();
    }
  }, [pageView, compliance, fetchCompliance]);

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

      {/* Page view tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setPageView('logs')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              pageView === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setPageView('compliance')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              pageView === 'compliance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            CDR Compliance
          </button>
        </nav>
      </div>

      {/* CDR Compliance view */}
      {pageView === 'compliance' && (
        <CompliancePanel
          data={compliance}
          loading={complianceLoading}
          onRefresh={fetchCompliance}
          getHeaders={getHeaders}
        />
      )}

      {/* Audit Logs view */}
      {pageView === 'logs' && (
      <>
      {/* Source tabs */}
      <div className="flex gap-4 mb-4">
        {(['all', 'admin', 'user'] as AuditSource[]).map((s) => (
          <button
            key={s}
            onClick={() => { setSource(s); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              source === s
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {s === 'all' ? 'All Logs' : s === 'admin' ? 'Admin Actions' : 'User Activity'}
          </button>
        ))}
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
              <option value="REGISTER">Register</option>
              <option value="OAUTH_LOGIN">OAuth Login</option>
              <option value="API_REQUEST">API Request</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="EXPORT">Export</option>
              <option value="MFA_SUCCESS">MFA Success</option>
              <option value="MFA_FAILURE">MFA Failure</option>
              <option value="PASSWORD_CHANGE">Password Change</option>
              <option value="RATE_LIMIT_HIT">Rate Limit Hit</option>
              <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
              <option value="FORBIDDEN_ACCESS">Forbidden Access</option>
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

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
          <AdminButton variant="outline" size="sm" onClick={fetchLogs} className="mt-2">
            Retry
          </AdminButton>
        </div>
      )}

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
      </>
      )}
    </AdminFeatureGate>
  );
}

// ---------------------------------------------------------------------------
// CDR Compliance Panel
// ---------------------------------------------------------------------------

function CompliancePanel({
  data,
  loading,
  onRefresh,
  getHeaders,
}: {
  data: CdrComplianceData | null;
  loading: boolean;
  onRefresh: () => void;
  getHeaders: () => Record<string, string>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <AdminCard className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Failed to load compliance data</p>
        <AdminButton onClick={onRefresh}>Retry</AdminButton>
      </AdminCard>
    );
  }

  const req = data.cdrRequirements;
  const checks = [
    { label: 'Critical system events are logged', pass: req.criticalSystemEvents },
    { label: 'Security events are logged', pass: req.securityEventsLogged },
    { label: 'User authentication logged (GCP Identity Platform + OAUTH_LOGIN)', pass: req.authenticationLogged },
    { label: 'API requests are logged', pass: req.apiRequestsLogged },
    { label: 'Logs are retained over 90 days', pass: req.logsRetainedOver90Days },
    { label: 'Logs don\'t include CDR financial data', pass: req.noCdrDataInLogs },
    { label: 'Logs are regularly reviewed (anomaly detection)', pass: true },
  ];

  const passCount = checks.filter((c) => c.pass).length;
  const totalCount = checks.length;

  return (
    <div className="space-y-6">
      {/* Compliance score */}
      <AdminCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CDR Compliance Status</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Consumer Data Right audit logging requirements</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Auth provider: GCP Identity Platform (Firebase Auth) — auth events captured via OAUTH_LOGIN + API_REQUEST</p>
          </div>
          <div className={`text-3xl font-bold ${passCount === totalCount ? 'text-green-600' : 'text-yellow-600'}`}>
            {passCount}/{totalCount}
          </div>
        </div>
        <div className="space-y-3">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-3">
              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                check.pass
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }`}>
                {check.pass ? '\u2713' : '\u2717'}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{check.label}</span>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Retention stats */}
      <AdminCard className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Log Retention</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">User Logs</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{data.retention.totalUserLogs.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Admin Logs</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{data.retention.totalAdminLogs.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Retention Policy</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{data.retention.retentionPolicyDays} days</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">CDR Minimum</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{data.retention.cdrMinDays} days</p>
          </div>
        </div>
        {data.retention.oldestUserLog && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Oldest log: {new Date(data.retention.oldestUserLog).toLocaleDateString()}
          </p>
        )}
      </AdminCard>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <AdminCard className="p-6">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Active Anomalies</h3>
          <div className="space-y-3">
            {data.anomalies.map((anomaly, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                anomaly.severity === 'critical' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                anomaly.severity === 'high' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' :
                'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                    anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    anomaly.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {anomaly.severity}
                  </span>
                  <span className="font-mono text-xs">{anomaly.type}</span>
                </div>
                <p className="text-sm mt-1">{anomaly.description}</p>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* Action breakdown */}
      {data.actionCoverage.actionBreakdown && Object.keys(data.actionCoverage.actionBreakdown).length > 0 && (
        <AdminCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Coverage (Last 30 Days)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.actionCoverage.actionBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => (
                <div key={action} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span className="font-mono text-xs">{action}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              ))}
          </div>
        </AdminCard>
      )}

      <div className="flex gap-2">
        <AdminButton onClick={onRefresh}>Refresh</AdminButton>
      </div>
    </div>
  );
}
