'use client';

/**
 * Phase 33: Feature Flags Page
 *
 * Manage global feature flags and overrides.
 */

import React, { useState } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton, IconButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Input, Select } from '@/components/admin/ui/AdminForm';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// Mock data
const mockFlags = [
  { key: 'DARK_MODE', name: 'Dark Mode', enabled: true, percent: 100, tiers: [], overrides: 5 },
  { key: 'AI_INSIGHTS', name: 'AI Insights', enabled: true, percent: 100, tiers: ['PRO', 'PREMIUM'], overrides: 12 },
  { key: 'NEW_DASHBOARD', name: 'New Dashboard', enabled: false, percent: 25, tiers: [], overrides: 3 },
  { key: 'MULTI_CURRENCY', name: 'Multi-Currency', enabled: false, percent: 0, tiers: ['PREMIUM'], overrides: 0 },
  { key: 'ADVANCED_REPORTS', name: 'Advanced Reports', enabled: true, percent: 100, tiers: ['PRO', 'PREMIUM'], overrides: 8 },
  { key: 'BETA_FEATURES', name: 'Beta Features', enabled: false, percent: 10, tiers: [], overrides: 45 },
];

export default function FeatureFlagsPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filteredFlags = mockFlags.filter((flag) =>
    flag.name.toLowerCase().includes(search.toLowerCase()) ||
    flag.key.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (flagKey: string) => {
    console.log('Toggle flag:', flagKey);
  };

  return (
    <AdminFeatureGate feature="featureFlagsManagement">
      <AdminHeader
        title="Feature Flags"
        description="Control feature rollout and A/B testing"
        searchPlaceholder="Search flags..."
        searchValue={search}
        onSearch={setSearch}
        action={
          <AdminButton
            onClick={() => setShowModal(true)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create Flag
          </AdminButton>
        }
      />

      {/* Flags Table */}
      <AdminCard padding="none">
        <AdminTable
          columns={[
            {
              key: 'name',
              header: 'Feature',
              render: (flag) => (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{flag.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{flag.key}</p>
                </div>
              ),
            },
            {
              key: 'enabled',
              header: 'Status',
              render: (flag) => (
                <button
                  onClick={() => handleToggle(flag.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    flag.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              ),
            },
            {
              key: 'percent',
              header: 'Rollout',
              render: (flag) => (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${flag.percent}%` }}
                    />
                  </div>
                  <span className="text-sm">{flag.percent}%</span>
                </div>
              ),
            },
            {
              key: 'tiers',
              header: 'Tiers',
              render: (flag) =>
                flag.tiers.length > 0 ? (
                  <div className="flex gap-1">
                    {flag.tiers.map((tier) => (
                      <AdminBadge key={tier} variant="info" size="sm">
                        {tier}
                      </AdminBadge>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">All tiers</span>
                ),
            },
            {
              key: 'overrides',
              header: 'Overrides',
              render: (flag) =>
                flag.overrides > 0 ? (
                  <AdminBadge variant="warning" size="sm">
                    {flag.overrides}
                  </AdminBadge>
                ) : (
                  <span className="text-gray-400">None</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              render: (flag) => (
                <div className="flex gap-1">
                  <IconButton
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    }
                    label="Edit"
                    size="sm"
                  />
                  <IconButton
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    }
                    label="Overrides"
                    size="sm"
                  />
                </div>
              ),
            },
          ]}
          data={filteredFlags}
          keyExtractor={(flag) => flag.key}
        />
      </AdminCard>

      {/* Quick Override Section */}
      <AdminCard className="mt-6">
        <AdminCardHeader
          title="Quick Override"
          description="Apply a flag override for a specific user or organization"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Flag"
            options={mockFlags.map((f) => ({ value: f.key, label: f.name }))}
            placeholder="Select flag"
          />
          <Select
            label="Target Type"
            options={[
              { value: 'USER', label: 'User' },
              { value: 'ORGANIZATION', label: 'Organization' },
            ]}
            placeholder="Select type"
          />
          <Input label="Target ID" placeholder="Enter user or org ID" />
          <div className="flex items-end">
            <AdminButton className="w-full">Create Override</AdminButton>
          </div>
        </div>
      </AdminCard>
    </AdminFeatureGate>
  );
}
