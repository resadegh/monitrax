'use client';

/**
 * Phase 33: Organization Detail Page
 *
 * View and manage a single organization — real data from
 * /api/admin/organizations/:orgId. License changes + suspend/reactivate go
 * through PATCH /api/admin/organizations/:orgId/license. Suspension is a
 * billing/compliance state on the FIRM (portal access to client data is
 * blocked via lib/portal/licenseGuard.ts) — members keep their personal
 * Monitrax accounts; contrast with user suspension which disables the GCP
 * identity (docs/operational/security/01_AUTHENTICATION.md § User Suspension).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select, Input, Textarea } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import {
  ADMIN_ROUTES,
  ADMIN_API_ROUTES,
  ORGANIZATION_PLAN_LIMITS,
} from '@/lib/admin/constants';

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  clientCount: number;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    isActive: boolean;
    user: { id: string; email: string; name: string | null };
  }>;
  license: {
    id: string;
    tier: string;
    status: string;
    clientLimit: number;
    staffLimit: number;
    stripeCustomerId: string | null;
    currentPeriodEnd: string | null;
    suspendedAt: string | null;
    suspendedReason: string | null;
    notes: string | null;
  } | null;
  portalSettings: {
    organizationType: string | null;
    portalEnabled: boolean;
    businessEmail: string | null;
    abn: string | null;
  } | null;
}

const PLAN_OPTIONS = (
  Object.keys(ORGANIZATION_PLAN_LIMITS) as Array<keyof typeof ORGANIZATION_PLAN_LIMITS>
).map((plan) => ({
  value: plan as string,
  label:
    ORGANIZATION_PLAN_LIMITS[plan].monthlyPrice > 0
      ? `${plan.charAt(0)}${plan.slice(1).toLowerCase()} ($${ORGANIZATION_PLAN_LIMITS[plan].monthlyPrice}/mo)`
      : `${plan.charAt(0)}${plan.slice(1).toLowerCase()} (Custom)`,
}));

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState('');
  const [clientLimit, setClientLimit] = useState('');
  const [staffLimit, setStaffLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(ADMIN_API_ROUTES.ORGANIZATION(orgId));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch organization');
      }

      setOrg(data);
      setSelectedPlan(data.license?.tier || 'STARTER');
      setClientLimit(String(data.license?.clientLimit ?? 10));
      setStaffLimit(String(data.license?.staffLimit ?? 3));
      setNotes(data.license?.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const patchLicense = async (
    body: Record<string, unknown>,
    successText: string
  ) => {
    setSaving(true);
    setActionMessage(null);

    try {
      const response = await fetch(ADMIN_API_ROUTES.ORGANIZATION_LICENSE(orgId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Update failed');
      }

      setActionMessage({ kind: 'success', text: successText });
      setSuspendReason('');
      await fetchOrg();
    } catch (err) {
      setActionMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Update failed',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLicense = () => {
    patchLicense(
      {
        tier: selectedPlan,
        clientLimit: parseInt(clientLimit, 10) || 10,
        staffLimit: parseInt(staffLimit, 10) || 3,
        notes,
      },
      'License updated'
    );
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) {
      setActionMessage({ kind: 'error', text: 'A reason is required to suspend an organization (audit trail).' });
      return;
    }
    if (
      !window.confirm(
        `Suspend ${org?.name}? The firm loses portal access to client data. Members keep their personal Monitrax accounts.`
      )
    ) {
      return;
    }
    patchLicense(
      { status: 'suspended', reason: suspendReason.trim() },
      'Organization suspended — portal access to client data is now blocked.'
    );
  };

  const handleReactivate = () => {
    patchLicense({ status: 'active' }, 'Organization reactivated — portal access restored.');
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
            <span>Loading organization...</span>
          </div>
        </div>
      </AdminFeatureGate>
    );
  }

  if (error || !org) {
    return (
      <AdminFeatureGate feature="adminPortalEnabled">
        <PageHeader
          title="Organization not found"
          backHref={ADMIN_ROUTES.ORGANIZATIONS}
          breadcrumbs={[
            { label: 'Organizations', href: ADMIN_ROUTES.ORGANIZATIONS },
            { label: 'Not found' },
          ]}
        />
        <AdminCard>
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error || 'Organization not found'}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchOrg}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      </AdminFeatureGate>
    );
  }

  const licenseStatus = org.license?.status || 'active';
  const isSuspended = licenseStatus === 'suspended';
  const tier = org.license?.tier || 'STARTER';
  const mrr =
    ORGANIZATION_PLAN_LIMITS[tier as keyof typeof ORGANIZATION_PLAN_LIMITS]?.monthlyPrice ?? 0;

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <PageHeader
        title={org.name}
        backHref={ADMIN_ROUTES.ORGANIZATIONS}
        breadcrumbs={[
          { label: 'Organizations', href: ADMIN_ROUTES.ORGANIZATIONS },
          { label: org.name },
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
        <StatsCard title="Current Clients" value={org.clientCount} />
        <StatsCard title="Client Limit" value={org.license?.clientLimit ?? '—'} />
        <StatsCard title="Team Members" value={org.memberCount} />
        <StatsCard title="Monthly Revenue" value={mrr > 0 ? `$${mrr}` : 'Custom'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <AdminCard>
            <AdminCardHeader title="Organization Details" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Slug</p>
                <p className="font-medium text-gray-900 dark:text-white">/{org.slug}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <StatusBadge status={licenseStatus as 'active' | 'suspended'} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(org.createdAt).toLocaleDateString('en-AU')}
                </p>
              </div>
              {org.portalSettings?.abn && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ABN</p>
                  <p className="font-medium font-mono text-gray-900 dark:text-white">
                    {org.portalSettings.abn}
                  </p>
                </div>
              )}
              {org.portalSettings && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Portal</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {org.portalSettings.portalEnabled ? 'Enabled' : 'Disabled'}
                    {org.portalSettings.organizationType
                      ? ` · ${org.portalSettings.organizationType}`
                      : ''}
                  </p>
                </div>
              )}
              {org.description && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                  <p className="font-medium text-gray-900 dark:text-white">{org.description}</p>
                </div>
              )}
            </div>
          </AdminCard>

          {/* License Management */}
          <AdminCard>
            <AdminCardHeader
              title="License Management"
              description="Update organization tier and limits"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Select
                  label="Plan"
                  options={PLAN_OPTIONS}
                  value={selectedPlan}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPlan(e.target.value)}
                />
                <Input
                  label="Client Limit"
                  type="number"
                  value={clientLimit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientLimit(e.target.value)}
                />
                <Input
                  label="Staff Limit"
                  type="number"
                  value={staffLimit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStaffLimit(e.target.value)}
                />
              </div>
              <Textarea
                label="Internal Notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Add notes about this license change..."
                rows={3}
              />
              <AdminButton onClick={handleUpdateLicense} disabled={saving}>
                {saving ? 'Saving...' : 'Update License'}
              </AdminButton>
            </div>
          </AdminCard>

          {/* Account Status */}
          <AdminCard>
            <AdminCardHeader
              title="Organization Status"
              description={
                isSuspended
                  ? 'This organization is suspended — portal access to client data is blocked. Members keep their personal Monitrax accounts.'
                  : 'Suspending blocks the firm’s portal access to client data. Members keep their personal Monitrax accounts.'
              }
            />
            {isSuspended ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Suspended At</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {org.license?.suspendedAt
                        ? new Date(org.license.suspendedAt).toLocaleString('en-AU')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {org.license?.suspendedReason || '—'}
                    </p>
                  </div>
                </div>
                <AdminButton onClick={handleReactivate} disabled={saving}>
                  {saving ? 'Saving...' : 'Reactivate Organization'}
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
                  {saving ? 'Saving...' : 'Suspend Organization'}
                </AdminButton>
              </div>
            )}
          </AdminCard>

          {/* Team Members */}
          <AdminCard>
            <AdminCardHeader title="Team Members" description={`${org.memberCount} members`} />
            {org.members.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No members yet.</p>
            ) : (
              <AdminTable
                columns={[
                  {
                    key: 'name',
                    header: 'Name',
                    render: (m) => m.user.name || '—',
                  },
                  {
                    key: 'email',
                    header: 'Email',
                    render: (m) => m.user.email,
                  },
                  { key: 'role', header: 'Role' },
                  {
                    key: 'isActive',
                    header: 'Status',
                    render: (m) => (
                      <StatusBadge status={m.isActive ? 'active' : 'suspended'} size="sm" />
                    ),
                  },
                ]}
                data={org.members}
                keyExtractor={(m) => m.id}
              />
            )}
          </AdminCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Plan */}
          <AdminCard>
            <AdminCardHeader title="Current Plan" />
            <div className="text-center py-4">
              <TierBadge tier={tier} size="lg" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {mrr > 0 ? `$${mrr}/mo` : 'Custom'}
              </p>
              {org.license?.currentPeriodEnd && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Period ends {new Date(org.license.currentPeriodEnd).toLocaleDateString('en-AU')}
                </p>
              )}
            </div>
          </AdminCard>

          {/* Billing Info */}
          {(org.portalSettings?.businessEmail || org.license?.stripeCustomerId) && (
            <AdminCard>
              <AdminCardHeader title="Billing" />
              <div className="space-y-3 text-sm">
                {org.portalSettings?.businessEmail && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Business Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {org.portalSettings.businessEmail}
                    </p>
                  </div>
                )}
                {org.license?.stripeCustomerId && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Stripe Customer</p>
                    <p className="font-medium font-mono text-gray-900 dark:text-white">
                      {org.license.stripeCustomerId}
                    </p>
                  </div>
                )}
              </div>
            </AdminCard>
          )}
        </div>
      </div>
    </AdminFeatureGate>
  );
}
