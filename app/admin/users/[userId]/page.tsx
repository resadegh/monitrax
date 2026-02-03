'use client';

/**
 * Phase 33: User Detail Page
 *
 * View and manage a single user.
 */

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select, Textarea } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

// Mock user data
const mockUser = {
  id: '1',
  name: 'John Smith',
  email: 'john@example.com',
  tier: 'PRO',
  status: 'active',
  mrr: 19.99,
  createdAt: '2025-03-15',
  lastLoginAt: '2026-01-19 14:32',
  accountsCount: 5,
  propertiesCount: 2,
  loansCount: 3,
  documentsCount: 24,
  netWorth: 425000,
  stripeCustomerId: 'cus_xyz789',
};

const mockActivity = [
  { id: '1', action: 'Login', ip: '192.168.1.1', time: '2026-01-19 14:32' },
  { id: '2', action: 'Property added', detail: '123 Main St', time: '2026-01-18 10:15' },
  { id: '3', action: 'Document uploaded', detail: 'Tax Return 2025', time: '2026-01-17 16:45' },
  { id: '4', action: 'Account linked', detail: 'ANZ Savings', time: '2026-01-15 09:20' },
];

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [selectedTier, setSelectedTier] = useState(mockUser.tier);
  const [reason, setReason] = useState('');

  const handleUpdateSubscription = () => {
    console.log('Updating subscription:', { selectedTier, reason });
  };

  const handleSuspend = () => {
    console.log('Suspending user');
  };

  const handleImpersonate = () => {
    console.log('Starting impersonation session');
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <PageHeader
        title={mockUser.name}
        backHref={ADMIN_ROUTES.USERS}
        breadcrumbs={[
          { label: 'Users', href: ADMIN_ROUTES.USERS },
          { label: mockUser.name },
        ]}
        action={
          <div className="flex gap-2">
            <AdminButton variant="outline" onClick={handleImpersonate}>
              Impersonate
            </AdminButton>
            <AdminButton variant="danger" onClick={handleSuspend}>
              Suspend
            </AdminButton>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Accounts" value={mockUser.accountsCount} />
        <StatsCard title="Properties" value={mockUser.propertiesCount} />
        <StatsCard title="Loans" value={mockUser.loansCount} />
        <StatsCard title="Net Worth" value={`$${mockUser.netWorth.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <AdminCard>
            <AdminCardHeader title="User Profile" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockUser.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <StatusBadge status={mockUser.status as 'active'} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockUser.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockUser.lastLoginAt}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Documents</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockUser.documentsCount}</p>
              </div>
            </div>
          </AdminCard>

          {/* Subscription Management */}
          <AdminCard>
            <AdminCardHeader
              title="Subscription Management"
              description="Update user's subscription tier"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Tier</p>
                  <TierBadge tier={mockUser.tier} />
                </div>
                <Select
                  label="Change To"
                  options={[
                    { value: 'FREE', label: 'Free ($0/mo)' },
                    { value: 'BASIC', label: 'Basic ($9.99/mo)' },
                    { value: 'PRO', label: 'Pro ($19.99/mo)' },
                    { value: 'PREMIUM', label: 'Premium ($39.99/mo)' },
                  ]}
                  value={selectedTier}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTier(e.target.value)}
                />
              </div>
              <Textarea
                label="Reason for Change"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Enter reason for subscription change..."
                rows={2}
              />
              <AdminButton onClick={handleUpdateSubscription}>Update Subscription</AdminButton>
            </div>
          </AdminCard>

          {/* Activity Log */}
          <AdminCard>
            <AdminCardHeader title="Recent Activity" />
            <div className="space-y-4">
              {mockActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                    {activity.detail && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{activity.detail}</p>
                    )}
                    {activity.ip && (
                      <p className="text-xs text-gray-400 font-mono">{activity.ip}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Subscription */}
          <AdminCard>
            <AdminCardHeader title="Subscription" />
            <div className="text-center py-4">
              <TierBadge tier={mockUser.tier} size="lg" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                ${mockUser.mrr}/mo
              </p>
            </div>
          </AdminCard>

          {/* Billing Info */}
          <AdminCard>
            <AdminCardHeader title="Billing" />
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Stripe Customer</p>
                <p className="font-medium font-mono text-gray-900 dark:text-white">
                  {mockUser.stripeCustomerId}
                </p>
              </div>
              <AdminButton variant="outline" size="sm" className="w-full">
                View in Stripe
              </AdminButton>
            </div>
          </AdminCard>

          {/* Quick Actions */}
          <AdminCard>
            <AdminCardHeader title="Quick Actions" />
            <div className="space-y-2">
              <AdminButton variant="outline" size="sm" className="w-full">
                Send Password Reset
              </AdminButton>
              <AdminButton variant="outline" size="sm" className="w-full">
                Export User Data
              </AdminButton>
              <AdminButton variant="outline" size="sm" className="w-full">
                View Audit Log
              </AdminButton>
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminFeatureGate>
  );
}
