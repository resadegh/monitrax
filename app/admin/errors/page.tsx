'use client';

/**
 * Phase M.2.5: Error Tracking Admin Page
 * Displays grouped errors from GCP Error Reporting.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard, EmptyState } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { safeAdminFetch } from '@/lib/admin/safeFetch';

interface ErrorGroup {
  groupId: string;
  message: string;
  count: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
  status: string;
}

interface ErrorData {
  errorGroups: ErrorGroup[];
  summary: { totalGroups: number; totalErrors: number; affectedUsers: number; period: string };
  available: boolean;
  consoleUrl: string;
}

const PERIODS = [
  { value: 'PERIOD_1_HOUR', label: 'Last Hour' },
  { value: 'PERIOD_6_HOURS', label: 'Last 6 Hours' },
  { value: 'PERIOD_1_DAY', label: 'Last 24 Hours' },
  { value: 'PERIOD_1_WEEK', label: 'Last 7 Days' },
  { value: 'PERIOD_30_DAYS', label: 'Last 30 Days' },
];

export default function ErrorsPage() {
  const [data, setData] = useState<ErrorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('PERIOD_1_DAY');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAdminFetch<ErrorData>(`/api/admin/gcp/errors?period=${period}`);
    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to fetch error data');
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Error Tracking"
        description="Application errors from GCP Error Reporting, auto-grouped by signature"
        action={
          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 text-[13px] font-medium rounded-lg border border-gray-300 dark:border-white/[0.1] bg-white dark:bg-[#0F1624] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {data?.consoleUrl && (
              <a href={data.consoleUrl} target="_blank" rel="noopener noreferrer">
                <AdminButton variant="outline">Open in GCP Console</AdminButton>
              </a>
            )}
            <AdminButton onClick={fetchData} variant="outline">Refresh</AdminButton>
          </div>
        }
      />

      {error && (
        <AdminCard className="mb-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </AdminCard>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading error data...</div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatsCard
              title="Error Groups"
              value={data.summary.totalGroups}
              accentColor={data.summary.totalGroups > 0 ? 'red' : 'green'}
            />
            <StatsCard
              title="Total Errors"
              value={data.summary.totalErrors}
              accentColor={data.summary.totalErrors > 0 ? 'amber' : 'green'}
            />
            <StatsCard
              title="Affected Users"
              value={data.summary.affectedUsers}
              accentColor="purple"
            />
          </div>

          <AdminCard>
            <AdminCardHeader
              title="Error Groups"
              description="Auto-grouped by stack trace similarity — click to view details in GCP Console"
            />
            {data.errorGroups.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'message',
                    header: 'Error Message',
                    render: (g: ErrorGroup) => (
                      <div className="max-w-md">
                        <p className="font-mono text-xs text-gray-900 dark:text-white truncate">{g.message}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'count',
                    header: 'Occurrences',
                    render: (g: ErrorGroup) => (
                      <AdminBadge variant={g.count > 100 ? 'error' : g.count > 10 ? 'warning' : 'neutral'} size="sm">
                        {g.count}
                      </AdminBadge>
                    ),
                  },
                  { key: 'affectedUsers', header: 'Users Affected' },
                  {
                    key: 'lastSeen',
                    header: 'Last Seen',
                    render: (g: ErrorGroup) => (
                      <span className="text-xs text-gray-500">
                        {g.lastSeen ? new Date(g.lastSeen).toLocaleString('en-AU') : '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (g: ErrorGroup) => (
                      <AdminBadge variant={g.status === 'RESOLVED' ? 'success' : 'warning'} size="sm" dot>
                        {g.status}
                      </AdminBadge>
                    ),
                  },
                ]}
                data={data.errorGroups}
                keyExtractor={(g) => g.groupId}
              />
            ) : (
              <EmptyState
                title="No errors detected"
                description={`Your application is running cleanly in ${PERIODS.find(p => p.value === period)?.label.toLowerCase() || 'this period'}.`}
              />
            )}
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
