'use client';

/**
 * Phase 33: User Detail Page
 *
 * View and manage a single user — real data from /api/admin/users/:userId.
 * Suspend/reactivate is enforced at the IAM authority (GCP Identity Platform
 * disable/enable) by the subscription PATCH route; the UserSubscription row
 * is the UI mirror. See docs/operational/security/01_AUTHENTICATION.md
 * § User Suspension.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select, Textarea } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES, ADMIN_API_ROUTES, USER_TIER_LIMITS } from '@/lib/admin/constants';

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  recentActivity: Array<{
    id: string;
    action: string;
    status: string;
    entityType: string | null;
    ipAddress: string | null;
    createdAt: string;
  }>;
  stats: {
    accountsCount: number;
    propertiesCount: number;
    loansCount: number;
    documentsCount: number;
  };
  subscription: {
    tier: string;
    status: string;
    stripeCustomerId?: string | null;
    suspendedAt?: string | null;
    suspendedReason?: string | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    isActive: boolean;
  }>;
}

const TIER_OPTIONS = (Object.keys(USER_TIER_LIMITS) as Array<keyof typeof USER_TIER_LIMITS>).map(
  (tier) => ({
    value: tier as string,
    label: `${tier.charAt(0)}${tier.slice(1).toLowerCase()} ($${USER_TIER_LIMITS[tier].monthlyPrice}/mo)`,
  })
);

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTier, setSelectedTier] = useState('');
  const [tierReason, setTierReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(ADMIN_API_ROUTES.USER(userId));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch user');
      }

      setUser(data);
      setSelectedTier(data.subscription?.tier || 'FREE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const patchSubscription = async (
    body: Record<string, string>,
    successText: string
  ) => {
    setSaving(true);
    setActionMessage(null);

    try {
      const response = await fetch(ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Update failed');
      }

      setActionMessage({ kind: 'success', text: successText });
      setTierReason('');
      setSuspendReason('');
      await fetchUser();
    } catch (err) {
      setActionMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Update failed',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTier = () => {
    if (!user || selectedTier === user.subscription.tier) return;
    patchSubscription(
      { tier: selectedTier, ...(tierReason ? { reason: tierReason } : {}) },
      `Subscription updated to ${selectedTier}`
    );
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) {
      setActionMessage({ kind: 'error', text: 'A reason is required to suspend a user (audit trail).' });
      return;
    }
    if (!window.confirm(`Suspend ${user?.email}? Their sign-in will be disabled in GCP Identity Platform.`)) {
      return;
    }
    patchSubscription(
      { status: 'suspended', reason: suspendReason.trim() },
      'User suspended — sign-in disabled. Existing sessions expire within 1 hour.'
    );
  };

  const handleReactivate = () => {
    patchSubscription({ status: 'active' }, 'User reactivated — sign-in re-enabled.');
  };

  if (loading) {
    return (
      <AdminFeatureGate feature="adminPortalEnabled">
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading user...</span>
          </div>
        </div>
      </AdminFeatureGate>
    );
  }

  if (error || !user) {
    return (
      <AdminFeatureGate feature="adminPortalEnabled">
        <PageHeader
          title="User not found"
          backHref={ADMIN_ROUTES.USERS}
          breadcrumbs={[{ label: 'Users', href: ADMIN_ROUTES.USERS }, { label: 'Not found' }]}
        />
        <AdminCard>
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error || 'User not found'}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchUser}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      </AdminFeatureGate>
    );
  }

  const displayName = user.name || user.email;
  const isSuspended = user.subscription.status === 'suspended';
  const mrr = USER_TIER_LIMITS[user.subscription.tier as keyof typeof USER_TIER_LIMITS]?.monthlyPrice ?? 0;

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <PageHeader
        title={displayName}
        backHref={ADMIN_ROUTES.USERS}
        breadcrumbs={[
          { label: 'Users', href: ADMIN_ROUTES.USERS },
          { label: displayName },
        ]}
        action={
          isSuspended ? (
            <AdminButton onClick={handleReactivate} disabled={saving}>
              Reactivate
            </AdminButton>
          ) : undefined
        }
      />

      {/* Action feedback */}
      {actionMessage && (
        <AdminCard className="mb-4">
          <div
            className={
              actionMessage.kind === 'success'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {actionMessage.text}
          </div>
        </AdminCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Accounts" value={user.stats.accountsCount} />
        <StatsCard title="Properties" value={user.stats.propertiesCount} />
        <StatsCard title="Loans" value={user.stats.loansCount} />
        <StatsCard title="Documents" value={user.stats.documentsCount} />
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
                <p className="font-medium text-gray-900 dark:text-white">{user.name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <StatusBadge status={user.subscription.status as 'active' | 'suspended'} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(user.createdAt).toLocaleDateString('en-AU')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('en-AU')
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
                <p className="font-medium font-mono text-xs text-gray-900 dark:text-white">{user.id}</p>
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
                  <TierBadge tier={user.subscription.tier} />
                </div>
                <Select
                  label="Change To"
                  options={TIER_OPTIONS}
                  value={selectedTier}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTier(e.target.value)}
                />
              </div>
              <Textarea
                label="Reason for Change"
                value={tierReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTierReason(e.target.value)}
                placeholder="Enter reason for subscription change..."
                rows={2}
              />
              <AdminButton
                onClick={handleUpdateTier}
                disabled={saving || selectedTier === user.subscription.tier}
              >
                {saving ? 'Saving...' : 'Update Subscription'}
              </AdminButton>
            </div>
          </AdminCard>

          {/* Account Status */}
          <AdminCard>
            <AdminCardHeader
              title="Account Status"
              description={
                isSuspended
                  ? 'This account is suspended — sign-in is disabled in GCP Identity Platform.'
                  : 'Suspending disables sign-in at GCP Identity Platform. Existing sessions expire within 1 hour.'
              }
            />
            {isSuspended ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Suspended At</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user.subscription.suspendedAt
                        ? new Date(user.subscription.suspendedAt).toLocaleString('en-AU')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user.subscription.suspendedReason || '—'}
                    </p>
                  </div>
                </div>
                <AdminButton onClick={handleReactivate} disabled={saving}>
                  {saving ? 'Saving...' : 'Reactivate Account'}
                </AdminButton>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  label="Reason for Suspension (required)"
                  value={suspendReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSuspendReason(e.target.value)}
                  placeholder="Required for the audit trail..."
                  rows={2}
                />
                <AdminButton variant="danger" onClick={handleSuspend} disabled={saving}>
                  {saving ? 'Saving...' : 'Suspend Account'}
                </AdminButton>
              </div>
            )}
          </AdminCard>
          {/* Recent Activity (real audit-log events; metadata never exposed — CDR §13.3) */}
          <AdminCard>
            <AdminCardHeader
              title="Recent Activity"
              description="Latest audit-log events for this user"
            />
            {user.recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {user.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {activity.action.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                        {activity.status !== 'SUCCESS' && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                            {activity.status.toLowerCase()}
                          </span>
                        )}
                      </p>
                      {activity.entityType && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{activity.entityType}</p>
                      )}
                      {activity.ipAddress && (
                        <p className="text-xs text-gray-400 font-mono">{activity.ipAddress}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(activity.createdAt).toLocaleString('en-AU')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Subscription */}
          <AdminCard>
            <AdminCardHeader title="Subscription" />
            <div className="text-center py-4">
              <TierBadge tier={user.subscription.tier} size="lg" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                ${mrr}/mo
              </p>
            </div>
          </AdminCard>

          {/* Billing Info */}
          {user.subscription.stripeCustomerId && (
            <AdminCard>
              <AdminCardHeader title="Billing" />
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Stripe Customer</p>
                  <p className="font-medium font-mono text-gray-900 dark:text-white">
                    {user.subscription.stripeCustomerId}
                  </p>
                </div>
              </div>
            </AdminCard>
          )}

          {/* Organization Memberships */}
          <AdminCard>
            <AdminCardHeader title="Organizations" />
            {user.organizations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Not a member of any organization.
              </p>
            ) : (
              <div className="space-y-3">
                {user.organizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {org.role}
                        {!org.isActive && ' · inactive'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminFeatureGate>
  );
}
