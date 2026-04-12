'use client';

/**
 * Phase 33: Feature Flags Page
 *
 * Manage global feature flags and overrides.
 * Uses real data from /api/admin/feature-flags endpoint.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton, IconButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Input, Select } from '@/components/admin/ui/AdminForm';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  enabledForPercent: number;
  enabledForTiers: string[];
  enabledForPlans: string[];
  overridesCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlagsPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/feature-flags', {
        
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch feature flags');
      }

      const data = await response.json();
      setFlags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const filteredFlags = flags.filter((flag) =>
    flag.name.toLowerCase().includes(search.toLowerCase()) ||
    flag.key.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (flagKey: string, currentEnabled: boolean) => {
    setToggling(flagKey);
    try {
      const response = await fetch(`/api/admin/feature-flags/${flagKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle flag');
      }

      // Refresh the list
      await fetchFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle flag');
    } finally {
      setToggling(null);
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
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

      {/* Error State */}
      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchFlags}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Flags Table */}
      <AdminCard padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading feature flags...</span>
            </div>
          </div>
        ) : (
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
                    onClick={() => handleToggle(flag.key, flag.enabled)}
                    disabled={toggling === flag.key}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      toggling === flag.key ? 'opacity-50' : ''
                    } ${flag.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
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
                key: 'enabledForPercent',
                header: 'Rollout',
                render: (flag) => (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${flag.enabledForPercent}%` }}
                      />
                    </div>
                    <span className="text-sm">{flag.enabledForPercent}%</span>
                  </div>
                ),
              },
              {
                key: 'enabledForTiers',
                header: 'Tiers',
                render: (flag) =>
                  flag.enabledForTiers.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {flag.enabledForTiers.map((tier) => (
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
                key: 'overridesCount',
                header: 'Overrides',
                render: (flag) =>
                  flag.overridesCount > 0 ? (
                    <AdminBadge variant="warning" size="sm">
                      {flag.overridesCount}
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
            emptyMessage="No feature flags found"
          />
        )}
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
            options={flags.map((f) => ({ value: f.key, label: f.name }))}
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
