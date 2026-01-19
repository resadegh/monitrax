'use client';

/**
 * Phase 33: Admin Dashboard Page
 *
 * Main dashboard with overview metrics and recent activity.
 */

import React from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, StatsCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// Mock data for demonstration
const mockStats = {
  totalUsers: 12458,
  activeUsers: 8234,
  totalOrganizations: 342,
  activeOrganizations: 298,
  mrr: 48750,
  mrrGrowth: 12.5,
  churnRate: 2.3,
  newUsersToday: 45,
};

const mockRecentUsers = [
  { id: '1', name: 'John Smith', email: 'john@example.com', tier: 'PRO', createdAt: '2026-01-19' },
  { id: '2', name: 'Sarah Connor', email: 'sarah@example.com', tier: 'BASIC', createdAt: '2026-01-19' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', tier: 'FREE', createdAt: '2026-01-18' },
  { id: '4', name: 'Emily Davis', email: 'emily@example.com', tier: 'PREMIUM', createdAt: '2026-01-18' },
  { id: '5', name: 'Alex Brown', email: 'alex@example.com', tier: 'PRO', createdAt: '2026-01-18' },
];

const mockRecentActivity = [
  { id: '1', action: 'User suspended', admin: 'Admin User', target: 'john@test.com', time: '5 min ago' },
  { id: '2', action: 'License upgraded', admin: 'Admin User', target: 'Acme Corp', time: '15 min ago' },
  { id: '3', action: 'Feature flag toggled', admin: 'Admin User', target: 'DARK_MODE', time: '1 hour ago' },
  { id: '4', action: 'Refund processed', admin: 'Billing Admin', target: '$49.99', time: '2 hours ago' },
];

export default function AdminDashboardPage() {
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
          value={mockStats.totalUsers.toLocaleString()}
          change={8.2}
          changeLabel="vs last month"
          trend="up"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Organizations"
          value={mockStats.totalOrganizations.toLocaleString()}
          change={15.3}
          changeLabel="vs last month"
          trend="up"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />

        <StatsCard
          title="Monthly Revenue"
          value={`$${mockStats.mrr.toLocaleString()}`}
          change={mockStats.mrrGrowth}
          changeLabel="MRR growth"
          trend="up"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Churn Rate"
          value={`${mockStats.churnRate}%`}
          change={-0.5}
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
            data={mockRecentUsers}
            keyExtractor={(user) => user.id}
            onRowClick={(user) => (window.location.href = `/admin/users/${user.id}`)}
          />
        </AdminCard>

        {/* Recent Activity */}
        <AdminCard>
          <AdminCardHeader
            title="Recent Activity"
            description="Admin actions and events"
          />
          <div className="space-y-4">
            {mockRecentActivity.map((activity) => (
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
        </AdminCard>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockStats.newUsersToday}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">New users today</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockStats.activeUsers.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active users (30d)</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockStats.activeOrganizations}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active organizations</p>
        </AdminCard>

        <AdminCard className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${(mockStats.mrr * 12).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Projected ARR</p>
        </AdminCard>
      </div>
    </AdminFeatureGate>
  );
}
