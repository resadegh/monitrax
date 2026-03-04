'use client';

/**
 * Phase 33: CDR Compliance Dashboard
 *
 * Central dashboard for monitoring CDR (Consumer Data Right) compliance status.
 * Per CLAUDE.md §13: CDR data is NEVER displayed raw - only aggregated statistics.
 *
 * GCP Note: When GCP integration is enabled, GCP service health status
 * will be pulled from Cloud Monitoring API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface ConsentOverview {
  active: number;
  expiringIn30Days: number;
  revokedLast90Days: number;
  expiredLast90Days: number;
  total: number;
  activePercent: number;
}

interface AuditEvent {
  action: string;
  count: number;
}

interface AuditTrail {
  recentEvents: AuditEvent[];
  deletionEvents: number;
  failedAccessAttempts: number;
  period: string;
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'warning' | 'fail' | 'unknown';
  details: string;
}

interface GcpService {
  name: string;
  description: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  required: boolean;
}

interface ComplianceData {
  consentOverview: ConsentOverview;
  auditTrail: AuditTrail;
  complianceChecklist: ComplianceCheck[];
  complianceScore: number;
  gcpServices: GcpService[];
  lastUpdated: string;
}

export default function CdrCompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/cdr/compliance', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch compliance data');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return 'success';
      case 'warning':
      case 'degraded':
        return 'warning';
      case 'fail':
      case 'down':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
      case 'degraded':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'fail':
      case 'down':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="CDR Compliance"
        description="Consumer Data Right compliance monitoring and status"
        action={
          <AdminButton onClick={fetchData} variant="outline">
            Refresh
          </AdminButton>
        }
      />

      {/* Error State */}
      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchData}>
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
            <span>Loading compliance data...</span>
          </div>
        </div>
      ) : data && (
        <>
          {/* Compliance Score */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <AdminCard className="md:col-span-1">
              <div className="text-center">
                <div className={`text-4xl font-bold ${
                  data.complianceScore >= 80 ? 'text-green-600' :
                  data.complianceScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {data.complianceScore}%
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Compliance Score</p>
              </div>
            </AdminCard>

            {/* Consent Overview Stats */}
            <StatsCard
              title="Active Consents"
              value={data.consentOverview.active.toLocaleString()}
              change={data.consentOverview.activePercent}
              changeLabel="of total"
              trend="up"
            />
            <StatsCard
              title="Expiring (30 days)"
              value={data.consentOverview.expiringIn30Days.toLocaleString()}
              change={0}
              changeLabel="require action"
              trend={data.consentOverview.expiringIn30Days > 0 ? 'down' : 'up'}
            />
            <StatsCard
              title="Revoked (90 days)"
              value={data.consentOverview.revokedLast90Days.toLocaleString()}
              change={0}
              changeLabel="data deleted"
              trend="down"
            />
            <StatsCard
              title="Failed Access"
              value={data.auditTrail.failedAccessAttempts.toLocaleString()}
              change={0}
              changeLabel="last 90 days"
              trend={data.auditTrail.failedAccessAttempts > 0 ? 'down' : 'up'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Compliance Checklist */}
            <AdminCard>
              <AdminCardHeader
                title="Compliance Checklist"
                description="Basiq CDR accreditation requirements"
              />
              <div className="space-y-3">
                {data.complianceChecklist.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    {getStatusIcon(check.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {check.name}
                        </p>
                        <AdminBadge variant={getStatusColor(check.status)} size="sm">
                          {check.status.toUpperCase()}
                        </AdminBadge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {check.description}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {check.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>

            {/* GCP Service Health */}
            <AdminCard>
              <AdminCardHeader
                title="GCP Service Health"
                description="Required infrastructure services for CDR compliance"
              />
              <div className="space-y-3">
                {data.gcpServices.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {service.name}
                          {service.required && (
                            <span className="ml-2 text-xs text-red-500">Required</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <AdminBadge variant={getStatusColor(service.status)} size="sm">
                      {service.status === 'unknown' ? 'Not Configured' : service.status.toUpperCase()}
                    </AdminBadge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  GCP service health monitoring requires Cloud Monitoring API integration.
                  See Step 10 in ADMIN_PORTAL_COMPLETION_PLAN.md.
                </p>
              </div>
            </AdminCard>
          </div>

          {/* CDR Audit Trail */}
          <AdminCard>
            <AdminCardHeader
              title="CDR Data Audit Trail"
              description={`Activity in the last ${data.auditTrail.period}`}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.auditTrail.recentEvents.reduce((sum, e) => sum + e.count, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total CDR Events</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {data.auditTrail.deletionEvents.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Data Deletion Events</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">
                  {data.auditTrail.failedAccessAttempts.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Failed Access Attempts</p>
              </div>
            </div>

            {data.auditTrail.recentEvents.length > 0 && (
              <AdminTable
                columns={[
                  { key: 'action', header: 'Event Type' },
                  {
                    key: 'count',
                    header: 'Count',
                    render: (e) => e.count.toLocaleString(),
                  },
                ]}
                data={data.auditTrail.recentEvents}
                keyExtractor={(e) => e.action}
                emptyMessage="No CDR events recorded"
              />
            )}
          </AdminCard>

          {/* Last Updated */}
          <div className="mt-4 text-center text-sm text-gray-500">
            Last updated: {new Date(data.lastUpdated).toLocaleString('en-AU')}
          </div>
        </>
      )}
    </AdminFeatureGate>
  );
}
