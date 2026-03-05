'use client';

/**
 * Phase 33: Analytics Dashboard Page
 *
 * Growth charts, feature usage, and user metrics.
 * Uses real data from /api/admin/analytics/* endpoints.
 *
 * GCP Note: Analytics data currently comes from database queries.
 * When GCP Cloud Logging/BigQuery is enabled, these will be migrated
 * for better retention and real-time analytics.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface ActiveUsers {
  dau: number;
  dauTrend: number;
  wau: number;
  wauTrend: number;
  mau: number;
  mauTrend: number;
}

interface FeatureUsage {
  feature: string;
  name: string;
  users: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
}

interface GrowthData {
  period: string;
  users: number;
  orgs: number;
  cumulativeUsers: number;
  cumulativeOrgs: number;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');
  const [activeUsers, setActiveUsers] = useState<ActiveUsers | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all analytics data in parallel
      const [activeUsersRes, featureUsageRes, growthRes] = await Promise.all([
        fetch('/api/admin/analytics/active-users', { credentials: 'include' }),
        fetch('/api/admin/analytics/feature-usage', { credentials: 'include' }),
        fetch(`/api/admin/analytics/growth?period=${period}`, { credentials: 'include' }),
      ]);

      if (!activeUsersRes.ok || !featureUsageRes.ok || !growthRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const [activeUsersData, featureUsageData, growthDataRes] = await Promise.all([
        activeUsersRes.json(),
        featureUsageRes.json(),
        growthRes.json(),
      ]);

      setActiveUsers(activeUsersData.data.current);
      setFeatureUsage(featureUsageData.data.features);
      setGrowthData(growthDataRes.data.growthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Analytics"
        description="User growth, engagement, and feature usage metrics"
        action={
          <Select
            options={[
              { value: 'week', label: 'Last 7 days' },
              { value: 'month', label: 'Last 30 days' },
              { value: 'quarter', label: 'Last 90 days' },
              { value: 'year', label: 'Last 12 months' },
            ]}
            value={period}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)}
            className="w-40"
          />
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
            <AdminButton variant="outline" size="sm" onClick={fetchAnalyticsData}>
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
            <span>Loading analytics data...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Active Users */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatsCard
              title="Daily Active Users"
              value={(activeUsers?.dau || 0).toLocaleString()}
              change={activeUsers?.dauTrend || 0}
              changeLabel="vs yesterday"
              trend={activeUsers?.dauTrend && activeUsers.dauTrend > 0 ? 'up' : 'down'}
            />
            <StatsCard
              title="Weekly Active Users"
              value={(activeUsers?.wau || 0).toLocaleString()}
              change={activeUsers?.wauTrend || 0}
              changeLabel="vs last week"
              trend={activeUsers?.wauTrend && activeUsers.wauTrend > 0 ? 'up' : 'down'}
            />
            <StatsCard
              title="Monthly Active Users"
              value={(activeUsers?.mau || 0).toLocaleString()}
              change={activeUsers?.mauTrend || 0}
              changeLabel="vs last month"
              trend={activeUsers?.mauTrend && activeUsers.mauTrend > 0 ? 'up' : 'down'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Growth Chart - Shows actual data */}
            <AdminCard>
              <AdminCardHeader
                title="User Growth"
                description="New user registrations over time"
              />
              <div className="h-64 flex flex-col justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                {growthData.length > 0 ? (
                  <div className="space-y-2">
                    {growthData.map((d) => (
                      <div key={d.period} className="flex items-center gap-2">
                        <span className="w-16 text-sm text-gray-600 dark:text-gray-400">{d.period}</span>
                        <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{
                              width: `${(d.cumulativeUsers / (growthData[growthData.length - 1]?.cumulativeUsers || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 text-sm text-right">{d.cumulativeUsers.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No growth data available</div>
                )}
              </div>
            </AdminCard>

            {/* Organization Growth - Shows actual data */}
            <AdminCard>
              <AdminCardHeader
                title="Organization Growth"
                description="New organizations over time"
              />
              <div className="h-64 flex flex-col justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                {growthData.length > 0 ? (
                  <div className="space-y-2">
                    {growthData.map((d) => (
                      <div key={d.period} className="flex items-center gap-2">
                        <span className="w-16 text-sm text-gray-600 dark:text-gray-400">{d.period}</span>
                        <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 rounded-full"
                            style={{
                              width: `${(d.cumulativeOrgs / (growthData[growthData.length - 1]?.cumulativeOrgs || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 text-sm text-right">{d.cumulativeOrgs.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No growth data available</div>
                )}
              </div>
            </AdminCard>
          </div>

          {/* Feature Usage */}
          <AdminCard>
            <AdminCardHeader
              title="Feature Usage"
              description="Most used features across all users (based on activity logs)"
            />
            <AdminTable
              columns={[
                {
                  key: 'name',
                  header: 'Feature',
                  sortable: true,
                },
                {
                  key: 'users',
                  header: 'Active Users',
                  render: (f) => f.users.toLocaleString(),
                  sortable: true,
                },
                {
                  key: 'percent',
                  header: 'Usage Rate',
                  render: (f) => (
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${f.percent}%` }}
                        />
                      </div>
                      <span className="text-sm">{f.percent}%</span>
                    </div>
                  ),
                  sortable: true,
                },
                {
                  key: 'trend',
                  header: 'Trend',
                  render: (f) => (
                    <AdminBadge
                      variant={f.trend === 'up' ? 'success' : f.trend === 'down' ? 'error' : 'neutral'}
                      size="sm"
                    >
                      {f.trend === 'up' ? 'Increasing' : f.trend === 'down' ? 'Decreasing' : 'Stable'}
                    </AdminBadge>
                  ),
                },
              ]}
              data={featureUsage}
              keyExtractor={(f) => f.feature}
              emptyMessage="No feature usage data available"
            />
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
