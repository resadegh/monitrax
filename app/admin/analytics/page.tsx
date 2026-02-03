'use client';

/**
 * Phase 33: Analytics Dashboard Page
 *
 * Growth charts, feature usage, and user metrics.
 */

import React, { useState } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// Mock data
const mockActiveUsers = {
  dau: 2345,
  dauTrend: 5.2,
  wau: 8567,
  wauTrend: 3.8,
  mau: 12458,
  mauTrend: 8.1,
};

const mockFeatureUsage = [
  { feature: 'Dashboard', users: 11245, percent: 90, trend: 'up' },
  { feature: 'Property Tracking', users: 8234, percent: 66, trend: 'up' },
  { feature: 'Loan Management', users: 7456, percent: 60, trend: 'stable' },
  { feature: 'Document Upload', users: 6123, percent: 49, trend: 'up' },
  { feature: 'Tax Planning', users: 4567, percent: 37, trend: 'up' },
  { feature: 'Investment Tracking', users: 3456, percent: 28, trend: 'down' },
  { feature: 'AI Insights', users: 2345, percent: 19, trend: 'up' },
];

const mockGrowthData = [
  { period: 'Jan', users: 10234, orgs: 298 },
  { period: 'Feb', users: 10567, orgs: 312 },
  { period: 'Mar', users: 11023, orgs: 325 },
  { period: 'Apr', users: 11456, orgs: 338 },
  { period: 'May', users: 11892, orgs: 350 },
  { period: 'Jun', users: 12458, orgs: 367 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');

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

      {/* Active Users */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatsCard
          title="Daily Active Users"
          value={mockActiveUsers.dau.toLocaleString()}
          change={mockActiveUsers.dauTrend}
          changeLabel="vs yesterday"
          trend="up"
        />
        <StatsCard
          title="Weekly Active Users"
          value={mockActiveUsers.wau.toLocaleString()}
          change={mockActiveUsers.wauTrend}
          changeLabel="vs last week"
          trend="up"
        />
        <StatsCard
          title="Monthly Active Users"
          value={mockActiveUsers.mau.toLocaleString()}
          change={mockActiveUsers.mauTrend}
          changeLabel="vs last month"
          trend="up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Growth Chart Placeholder */}
        <AdminCard>
          <AdminCardHeader
            title="User Growth"
            description="New user registrations over time"
          />
          <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              <p>Chart visualization would go here</p>
              <p className="text-sm">Showing growth from {mockGrowthData[0].users.toLocaleString()} to {mockGrowthData[mockGrowthData.length - 1].users.toLocaleString()} users</p>
            </div>
          </div>
        </AdminCard>

        {/* Organization Growth Placeholder */}
        <AdminCard>
          <AdminCardHeader
            title="Organization Growth"
            description="New organizations over time"
          />
          <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p>Chart visualization would go here</p>
              <p className="text-sm">Showing growth from {mockGrowthData[0].orgs} to {mockGrowthData[mockGrowthData.length - 1].orgs} organizations</p>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Feature Usage */}
      <AdminCard>
        <AdminCardHeader
          title="Feature Usage"
          description="Most used features across all users"
        />
        <AdminTable
          columns={[
            { key: 'feature', header: 'Feature', sortable: true },
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
          data={mockFeatureUsage}
          keyExtractor={(f) => f.feature}
        />
      </AdminCard>
    </AdminFeatureGate>
  );
}
