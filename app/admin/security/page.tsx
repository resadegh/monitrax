'use client';

/**
 * Phase 33: Security Monitoring Panel
 *
 * Monitor security events, failed auth attempts, rate limiting,
 * and active sessions.
 *
 * GCP Note: When Cloud Logging is enabled, Firebase Auth events
 * will be pulled from Cloud Logging for real-time monitoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface AuthEvents {
  loginSuccess24h: number;
  loginFailure24h: number;
  loginSuccess7d: number;
  loginFailure7d: number;
  mfaChallenges: number;
  authSuccessRate: number;
  lockedAccounts: number;
  recentLockouts: Array<{
    id: string;
    name: string;
    email: string;
    lockedUntil: string | null;
    failedAttempts: number;
    isCurrentlyLocked: boolean;
  }>;
}

interface RateLimiting {
  hits24h: number;
  hits7d: number;
  topIps: Array<{ ip: string; count: number }>;
}

interface AccessViolations {
  unauthorized: number;
  forbidden: number;
  total: number;
  topRoutes: Array<{ route: string; count: number }>;
}

interface AdminSession {
  id: string;
  adminName: string;
  adminEmail: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  lastActivity: string;
  expiresAt: string;
}

interface RecentActivity {
  id: string;
  adminName: string;
  action: string;
  category: string;
  description: string;
  timestamp: string;
  ipAddress: string;
}

interface SecurityData {
  authEvents: AuthEvents;
  rateLimiting: RateLimiting;
  accessViolations: AccessViolations;
  activeSessions: {
    adminCount: number;
    adminSessions: AdminSession[];
  };
  recentActivity: RecentActivity[];
  lastUpdated: string;
}

export default function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/security', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch security data');
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
    // Auto-refresh every 30 seconds for real-time monitoring
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Security Monitoring"
        description="Authentication events, rate limiting, and active sessions"
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
      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading security data...</span>
          </div>
        </div>
      ) : data && (
        <>
          {/* Auth Events Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <StatsCard
              title="Auth Success Rate"
              value={`${data.authEvents.authSuccessRate}%`}
              change={0}
              changeLabel="last 7 days"
              trend={data.authEvents.authSuccessRate >= 95 ? 'up' : 'down'}
            />
            <StatsCard
              title="Logins (24h)"
              value={data.authEvents.loginSuccess24h.toLocaleString()}
              change={data.authEvents.loginFailure24h}
              changeLabel="failed"
              trend="up"
            />
            <StatsCard
              title="Rate Limit Hits"
              value={data.rateLimiting.hits24h.toLocaleString()}
              change={0}
              changeLabel="last 24h"
              trend={data.rateLimiting.hits24h > 100 ? 'down' : 'up'}
            />
            <StatsCard
              title="Access Violations"
              value={data.accessViolations.total.toLocaleString()}
              change={0}
              changeLabel="last 7 days"
              trend={data.accessViolations.total > 10 ? 'down' : 'up'}
            />
            <StatsCard
              title="Locked Accounts"
              value={data.authEvents.lockedAccounts.toString()}
              change={0}
              changeLabel="currently locked"
              trend={data.authEvents.lockedAccounts > 0 ? 'down' : 'up'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Active Admin Sessions */}
            <AdminCard>
              <AdminCardHeader
                title="Active Admin Sessions"
                description={`${data.activeSessions.adminCount} active sessions`}
              />
              {data.activeSessions.adminSessions.length > 0 ? (
                <AdminTable
                  columns={[
                    {
                      key: 'adminName',
                      header: 'Admin',
                      render: (s) => (
                        <div>
                          <p className="font-medium">{s.adminName}</p>
                          <p className="text-xs text-gray-500">{s.adminEmail}</p>
                        </div>
                      ),
                    },
                    {
                      key: 'role',
                      header: 'Role',
                      render: (s) => (
                        <AdminBadge variant="info" size="sm">
                          {s.role}
                        </AdminBadge>
                      ),
                    },
                    {
                      key: 'ipAddress',
                      header: 'IP',
                      render: (s) => (
                        <span className="font-mono text-xs">{s.ipAddress}</span>
                      ),
                    },
                    {
                      key: 'lastActivity',
                      header: 'Last Activity',
                      render: (s) => new Date(s.lastActivity).toLocaleTimeString('en-AU'),
                    },
                  ]}
                  data={data.activeSessions.adminSessions}
                  keyExtractor={(s) => s.id}
                />
              ) : (
                <p className="text-gray-500 text-center py-4">No active sessions</p>
              )}
            </AdminCard>

            {/* Rate Limiting - Top IPs */}
            <AdminCard>
              <AdminCardHeader
                title="Rate Limit Hits by IP"
                description={`${data.rateLimiting.hits7d} hits in last 7 days`}
              />
              {data.rateLimiting.topIps.length > 0 ? (
                <AdminTable
                  columns={[
                    {
                      key: 'ip',
                      header: 'IP Address',
                      render: (r) => (
                        <span className="font-mono text-sm">{r.ip}</span>
                      ),
                    },
                    {
                      key: 'count',
                      header: 'Hits',
                      render: (r) => (
                        <AdminBadge
                          variant={r.count > 50 ? 'error' : r.count > 20 ? 'warning' : 'neutral'}
                          size="sm"
                        >
                          {r.count}
                        </AdminBadge>
                      ),
                    },
                  ]}
                  data={data.rateLimiting.topIps}
                  keyExtractor={(r) => r.ip}
                />
              ) : (
                <p className="text-gray-500 text-center py-4">No rate limit events</p>
              )}
            </AdminCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Account Lockouts */}
            <AdminCard>
              <AdminCardHeader
                title="Recent Account Lockouts"
                description="Accounts locked due to failed login attempts"
              />
              {data.authEvents.recentLockouts.length > 0 ? (
                <AdminTable
                  columns={[
                    {
                      key: 'name',
                      header: 'Account',
                      render: (l) => (
                        <div>
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-gray-500">{l.email}</p>
                        </div>
                      ),
                    },
                    {
                      key: 'failedAttempts',
                      header: 'Failed Attempts',
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (l) => (
                        <AdminBadge
                          variant={l.isCurrentlyLocked ? 'error' : 'success'}
                          size="sm"
                        >
                          {l.isCurrentlyLocked ? 'Locked' : 'Unlocked'}
                        </AdminBadge>
                      ),
                    },
                    {
                      key: 'lockedUntil',
                      header: 'Locked Until',
                      render: (l) =>
                        l.lockedUntil
                          ? new Date(l.lockedUntil).toLocaleString('en-AU')
                          : '-',
                    },
                  ]}
                  data={data.authEvents.recentLockouts}
                  keyExtractor={(l) => l.id}
                />
              ) : (
                <p className="text-gray-500 text-center py-4">No recent lockouts</p>
              )}
            </AdminCard>

            {/* Access Violations */}
            <AdminCard>
              <AdminCardHeader
                title="Access Violations by Route"
                description={`${data.accessViolations.total} violations in last 7 days`}
              />
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                  <p className="text-xl font-bold text-yellow-600">
                    {data.accessViolations.unauthorized}
                  </p>
                  <p className="text-xs text-gray-500">Unauthorized (401)</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-600">
                    {data.accessViolations.forbidden}
                  </p>
                  <p className="text-xs text-gray-500">Forbidden (403)</p>
                </div>
              </div>
              {data.accessViolations.topRoutes.length > 0 ? (
                <AdminTable
                  columns={[
                    { key: 'route', header: 'Route/Entity' },
                    {
                      key: 'count',
                      header: 'Violations',
                      render: (r) => (
                        <AdminBadge variant="error" size="sm">
                          {r.count}
                        </AdminBadge>
                      ),
                    },
                  ]}
                  data={data.accessViolations.topRoutes}
                  keyExtractor={(r) => r.route}
                />
              ) : (
                <p className="text-gray-500 text-center py-4">No access violations</p>
              )}
            </AdminCard>
          </div>

          {/* Recent Admin Activity */}
          <AdminCard>
            <AdminCardHeader
              title="Recent Admin Activity"
              description="Last 24 hours of admin actions"
            />
            {data.recentActivity.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'timestamp',
                    header: 'Time',
                    render: (a) => new Date(a.timestamp).toLocaleString('en-AU'),
                  },
                  { key: 'adminName', header: 'Admin' },
                  {
                    key: 'action',
                    header: 'Action',
                    render: (a) => (
                      <AdminBadge variant="neutral" size="sm">
                        {a.action}
                      </AdminBadge>
                    ),
                  },
                  { key: 'description', header: 'Description' },
                  {
                    key: 'ipAddress',
                    header: 'IP',
                    render: (a) => (
                      <span className="font-mono text-xs">{a.ipAddress}</span>
                    ),
                  },
                ]}
                data={data.recentActivity}
                keyExtractor={(a) => a.id}
              />
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </AdminCard>

          {/* Last Updated */}
          <div className="mt-4 text-center text-sm text-gray-500">
            Last updated: {new Date(data.lastUpdated).toLocaleString('en-AU')}
            <span className="ml-2 text-xs">(auto-refreshes every 30s)</span>
          </div>
        </>
      )}
    </AdminFeatureGate>
  );
}
