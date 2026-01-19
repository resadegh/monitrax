'use client';

/**
 * Phase 33: Admin Dashboard Page
 *
 * Main dashboard with real-time platform metrics.
 */

import React, { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, StatsCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  usersLast30Days: number;
  orgsLast30Days: number;
  newUsersToday: number;
  mrr: number;
  mrrGrowth: number;
  churnRate: number;
  userGrowth: number;
  orgGrowth: number;
}

interface RecentUser {
  id: string;
  name: string;
  email: string;
  tier: string;
  createdAt: string;
}

interface RecentActivity {
  id: string;
  action: string;
  admin: string;
  target: string;
  time: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/admin/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const data = await response.json();
        setStats(data.stats);
        setRecentUsers(data.recentUsers || []);
        setRecentActivity(data.recentActivity || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Dashboard"
        description="Overview of Monitrax platform metrics"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || '0'}
          change={stats?.userGrowth || 0}
          changeLabel="vs last month"
          trend={stats?.userGrowth && stats.userGrowth > 0 ? 'up' : 'down'}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Organizations"
          value={stats?.totalOrganizations?.toLocaleString() || '0'}
          change={stats?.orgGrowth || 0}
          changeLabel="vs last month"
          trend={stats?.orgGrowth && stats.orgGrowth > 0 ? 'up' : 'down'}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />

        <StatsCard
          title="Monthly Revenue"
          value={\`$\${stats?.mrr?.toLocaleString() || '0'}\`}
          change={stats?.mrrGrowth || 0}
          changeLabel="MRR growth"
          trend={stats?.mrrGrowth && stats.mrrGrowth > 0 ? 'up' : 'down'}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Churn Rate"
          value={\`\${stats?.churnRate || 0}%\`}
          change={0}
          changeLabel="vs last month"
          trend="down"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <AdminCard>
          <AdminCardHeader
            title="Recent Users"
            description="Newly registered users"
            action={
              <a href="/admin/users" className="text-sm text-blue-600 hover:text-blue-700">
                View all
              </a>
            }
          />
          {recentUsers.length > 0 ? (
            <AdminTable
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                {
                  key: 'tier',
                  header: 'Tier',
                  render: (user) => <TierBadge tier={user.tier} size="sm" />,
                },
                { key: 'createdAt', header: 'Joined' },
              ]}
              data={recentUsers}
              keyExtractor={(user) => user.id}
              onRowClick={(user) => (window.location.href = \`/admin/users/\${user.id}\`)}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No users yet</p>
          )}
        </AdminCard>

        {/* Recent Activity */}
        <AdminCard>
          <AdminCardHeader
            title="Recent Activity"
            description="Admin actions and events"
          />
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
                >
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.action}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activity.admin} - {activity.target}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{activity.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity yet</p>
          )}
        </AdminCard>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.newUsersToday || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">New users today</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.usersLast30Days?.toLocaleString() || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Users (30d)</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.orgsLast30Days || 0}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Orgs (30d)</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            \${((stats?.mrr || 0) * 12).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Projected ARR</p>
        </AdminCard>
      </div>
    </AdminFeatureGate>
  );
}
