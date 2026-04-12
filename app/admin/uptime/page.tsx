'use client';

/**
 * Phase M.2.4: Uptime & Monitoring Admin Page
 * Displays Cloud Monitoring uptime checks and alert policies.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard, EmptyState } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface UptimeCheck {
  name: string;
  displayName: string;
  hostname: string;
  path: string;
  checkFrequencySeconds: number;
  timeoutSeconds: number;
  regions: string[];
}

interface AlertPolicy {
  name: string;
  displayName: string;
  enabled: boolean;
  severity: string;
  conditions: number;
  notificationChannels: number;
}

interface UptimeData {
  uptimeChecks: UptimeCheck[];
  alertPolicies: AlertPolicy[];
  summary: { totalChecks: number; activeChecks: number; lastHourSuccessRate: number | null };
  available: boolean;
  consoleUrl: string;
}

export default function UptimePage() {
  const [data, setData] = useState<UptimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/gcp/uptime');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch uptime data');
      }
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Uptime & Monitoring"
        description="Cloud Monitoring uptime checks and alert policies"
        action={
          <div className="flex gap-2">
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
        <div className="text-center py-12 text-gray-500 text-sm">Loading uptime data...</div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatsCard title="Total Checks" value={data.summary.totalChecks} accentColor="blue" />
            <StatsCard title="Active Checks" value={data.summary.activeChecks} accentColor="green" />
            <StatsCard title="Alert Policies" value={data.alertPolicies.length} accentColor="purple" />
          </div>

          <AdminCard className="mb-6">
            <AdminCardHeader
              title="Uptime Checks"
              description={`${data.uptimeChecks.length} checks configured in Cloud Monitoring`}
            />
            {data.uptimeChecks.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'displayName',
                    header: 'Check Name',
                    render: (c: UptimeCheck) => (
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{c.displayName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.hostname}{c.path}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'frequency',
                    header: 'Frequency',
                    render: (c: UptimeCheck) => (
                      <span className="text-sm">Every {Math.round(c.checkFrequencySeconds / 60)}m</span>
                    ),
                  },
                  {
                    key: 'timeout',
                    header: 'Timeout',
                    render: (c: UptimeCheck) => <span className="text-sm">{c.timeoutSeconds}s</span>,
                  },
                  {
                    key: 'regions',
                    header: 'Regions',
                    render: (c: UptimeCheck) => (
                      <span className="text-sm text-gray-500">{c.regions.length || 'Default'}</span>
                    ),
                  },
                ]}
                data={data.uptimeChecks}
                keyExtractor={(c) => c.name}
              />
            ) : (
              <EmptyState
                title="No uptime checks"
                description="Create an uptime check in GCP Console to monitor your API health."
                action={
                  data.consoleUrl && (
                    <a href={data.consoleUrl} target="_blank" rel="noopener noreferrer">
                      <AdminButton>Create in GCP Console</AdminButton>
                    </a>
                  )
                }
              />
            )}
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Alert Policies"
              description={`${data.alertPolicies.length} alert policies configured`}
            />
            {data.alertPolicies.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'displayName',
                    header: 'Policy',
                    render: (p: AlertPolicy) => <span className="font-medium">{p.displayName}</span>,
                  },
                  {
                    key: 'enabled',
                    header: 'Status',
                    render: (p: AlertPolicy) => (
                      <AdminBadge variant={p.enabled ? 'success' : 'neutral'} size="sm" dot>
                        {p.enabled ? 'Enabled' : 'Disabled'}
                      </AdminBadge>
                    ),
                  },
                  {
                    key: 'severity',
                    header: 'Severity',
                    render: (p: AlertPolicy) => (
                      <AdminBadge
                        variant={p.severity === 'CRITICAL' ? 'error' : p.severity === 'WARNING' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {p.severity}
                      </AdminBadge>
                    ),
                  },
                  { key: 'conditions', header: 'Conditions' },
                  { key: 'notificationChannels', header: 'Notifications' },
                ]}
                data={data.alertPolicies}
                keyExtractor={(p) => p.name}
              />
            ) : (
              <EmptyState title="No alert policies" description="Set up alerts in GCP Console." />
            )}
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
