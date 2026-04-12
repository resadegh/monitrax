'use client';

/**
 * Phase M.3.1: Security Findings Admin Page
 * Displays findings from GCP Security Command Center.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard, EmptyState } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { safeAdminFetch } from '@/lib/admin/safeFetch';

interface SCCFinding {
  name: string;
  category: string;
  resourceName: string;
  state: string;
  severity: string;
  eventTime: string;
  createTime: string;
  description: string;
}

interface SCCData {
  findings: SCCFinding[];
  summary: {
    total: number;
    active: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    lastUpdated: string | null;
  };
  available: boolean;
  consoleUrl: string;
  note: string | null;
}

export default function SecurityFindingsPage() {
  const [data, setData] = useState<SCCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAdminFetch<SCCData>('/api/admin/gcp/security-findings');
    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to fetch security findings');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const severityVariant = (sev: string): 'error' | 'warning' | 'info' | 'neutral' => {
    if (sev === 'CRITICAL') return 'error';
    if (sev === 'HIGH') return 'warning';
    if (sev === 'MEDIUM') return 'info';
    return 'neutral';
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Security Findings"
        description="Active vulnerabilities and security findings from Security Command Center"
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

      {data?.note && (
        <AdminCard className="mb-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
          <p className="text-[13px] text-amber-800 dark:text-amber-300">{data.note}</p>
        </AdminCard>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading security findings...</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Critical"
              value={data.summary.bySeverity.critical}
              accentColor="red"
            />
            <StatsCard
              title="High"
              value={data.summary.bySeverity.high}
              accentColor="amber"
            />
            <StatsCard
              title="Medium"
              value={data.summary.bySeverity.medium}
              accentColor="blue"
            />
            <StatsCard
              title="Low"
              value={data.summary.bySeverity.low}
              accentColor="gray"
            />
          </div>

          <AdminCard>
            <AdminCardHeader
              title="Active Findings"
              description={`${data.summary.active} active findings from Security Command Center`}
            />
            {data.findings.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'category',
                    header: 'Category',
                    render: (f: SCCFinding) => (
                      <span className="font-medium text-gray-900 dark:text-white">{f.category}</span>
                    ),
                  },
                  {
                    key: 'severity',
                    header: 'Severity',
                    render: (f: SCCFinding) => (
                      <AdminBadge variant={severityVariant(f.severity)} size="sm">
                        {f.severity}
                      </AdminBadge>
                    ),
                  },
                  {
                    key: 'resourceName',
                    header: 'Resource',
                    render: (f: SCCFinding) => (
                      <span className="font-mono text-xs text-gray-500 truncate max-w-xs inline-block">
                        {f.resourceName.split('/').slice(-2).join('/')}
                      </span>
                    ),
                  },
                  {
                    key: 'eventTime',
                    header: 'Detected',
                    render: (f: SCCFinding) => (
                      <span className="text-xs text-gray-500">
                        {f.eventTime ? new Date(f.eventTime).toLocaleString('en-AU') : '—'}
                      </span>
                    ),
                  },
                ]}
                data={data.findings}
                keyExtractor={(f) => f.name}
              />
            ) : (
              <EmptyState
                title={data.available ? "No active findings" : "SCC not fully accessible"}
                description={
                  data.available
                    ? "Security Command Center reports no active security findings for this project."
                    : "Security findings require organization-level IAM access. View findings directly in GCP Console."
                }
                action={
                  data.consoleUrl && (
                    <a href={data.consoleUrl} target="_blank" rel="noopener noreferrer">
                      <AdminButton variant="outline">Open GCP Console</AdminButton>
                    </a>
                  )
                }
              />
            )}
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
