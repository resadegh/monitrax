'use client';

/**
 * Phase 33: Organization Detail Page
 *
 * View and manage a single organization.
 */

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select, Input, Textarea } from '@/components/admin/ui/AdminForm';
import { StatusBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

// Mock organization data
const mockOrg = {
  id: '1',
  name: 'Acme Accounting',
  slug: 'acme',
  description: 'Full-service accounting firm serving small to medium businesses.',
  plan: 'PROFESSIONAL',
  status: 'active',
  clientLimit: 50,
  staffLimit: 10,
  currentClients: 45,
  currentStaff: 8,
  mrr: 149,
  createdAt: '2025-06-15',
  billingEmail: 'billing@acme-accounting.com',
  stripeCustomerId: 'cus_abc123',
};

const mockMembers = [
  { id: '1', name: 'Jane Owner', email: 'jane@acme.com', role: 'PORTAL_OWNER', status: 'active' },
  { id: '2', name: 'Bob Admin', email: 'bob@acme.com', role: 'PORTAL_ADMIN', status: 'active' },
  { id: '3', name: 'Alice Advisor', email: 'alice@acme.com', role: 'PORTAL_ADVISOR', status: 'active' },
];

const mockActivity = [
  { id: '1', action: 'Client invited', user: 'Jane Owner', target: 'john@client.com', time: '2 hours ago' },
  { id: '2', action: 'Document uploaded', user: 'Bob Admin', target: 'Tax Return 2025', time: '5 hours ago' },
  { id: '3', action: 'Settings updated', user: 'Jane Owner', target: 'Branding', time: '1 day ago' },
];

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [selectedPlan, setSelectedPlan] = useState(mockOrg.plan);
  const [clientLimit, setClientLimit] = useState(mockOrg.clientLimit.toString());
  const [staffLimit, setStaffLimit] = useState(mockOrg.staffLimit.toString());
  const [notes, setNotes] = useState('');

  const handleUpdateLicense = () => {
    // In production, call API to update license
    console.log('Updating license:', { selectedPlan, clientLimit, staffLimit, notes });
  };

  const handleSuspend = () => {
    // In production, call API to suspend
    console.log('Suspending organization');
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <PageHeader
        title={mockOrg.name}
        backHref={ADMIN_ROUTES.ORGANIZATIONS}
        breadcrumbs={[
          { label: 'Organizations', href: ADMIN_ROUTES.ORGANIZATIONS },
          { label: mockOrg.name },
        ]}
        action={
          <div className="flex gap-2">
            <AdminButton variant="outline" onClick={handleSuspend}>
              Suspend
            </AdminButton>
            <AdminButton>Save Changes</AdminButton>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Current Clients" value={mockOrg.currentClients} />
        <StatsCard title="Client Limit" value={mockOrg.clientLimit} />
        <StatsCard title="Current Staff" value={mockOrg.currentStaff} />
        <StatsCard title="Monthly Revenue" value={`$${mockOrg.mrr}`} />
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
                <p className="font-medium text-gray-900 dark:text-white">{mockOrg.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Slug</p>
                <p className="font-medium text-gray-900 dark:text-white">/{mockOrg.slug}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <StatusBadge status={mockOrg.status as 'active'} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockOrg.createdAt}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockOrg.description}</p>
              </div>
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
                  options={[
                    { value: 'STARTER', label: 'Starter ($49/mo)' },
                    { value: 'PROFESSIONAL', label: 'Professional ($149/mo)' },
                    { value: 'BUSINESS', label: 'Business ($349/mo)' },
                    { value: 'ENTERPRISE', label: 'Enterprise (Custom)' },
                  ]}
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
              <AdminButton onClick={handleUpdateLicense}>Update License</AdminButton>
            </div>
          </AdminCard>

          {/* Team Members */}
          <AdminCard>
            <AdminCardHeader title="Team Members" description={`${mockMembers.length} members`} />
            <AdminTable
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (m) => <StatusBadge status={m.status as 'active'} size="sm" />,
                },
              ]}
              data={mockMembers}
              keyExtractor={(m) => m.id}
            />
          </AdminCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Plan */}
          <AdminCard>
            <AdminCardHeader title="Current Plan" />
            <div className="text-center py-4">
              <TierBadge tier={mockOrg.plan} size="lg" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                ${mockOrg.mrr}/mo
              </p>
            </div>
          </AdminCard>

          {/* Billing Info */}
          <AdminCard>
            <AdminCardHeader title="Billing" />
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Billing Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{mockOrg.billingEmail}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Stripe Customer</p>
                <p className="font-medium font-mono text-gray-900 dark:text-white">
                  {mockOrg.stripeCustomerId}
                </p>
              </div>
            </div>
          </AdminCard>

          {/* Recent Activity */}
          <AdminCard>
            <AdminCardHeader title="Recent Activity" />
            <div className="space-y-3">
              {mockActivity.map((activity) => (
                <div key={activity.id} className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {activity.user} - {activity.time}
                  </p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminFeatureGate>
  );
}
