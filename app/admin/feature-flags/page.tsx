'use client';

/**
 * Phase 33: Feature Flags Page
 * PROD Simplification P1.8 (2026-08-04): "Modules" panel added — one row
 * per `MODULE_REGISTRY` key (label, HIDDEN/LIVE, return stage, last flip
 * + actor, the working toggle). Unhiding is an R-stage gate decision
 * (PROD_SIMPLIFICATION_PLAN.md §5), not a casual toggle — the panel says
 * so. Per plan §4.5 the dead override surfaces (Edit / Overrides buttons,
 * "Create Override" card, Rollout / Tiers / Overrides columns) were
 * REMOVED: `FeatureFlagOverride` / `enabledForPercent` / `enabledForTiers`
 * have zero evaluation readers — UI only, schema untouched. Override
 * WIRING is deliberately deferred to R0 (enable-for-Reza-only in PROD).
 *
 * Uses real data from /api/admin/feature-flags.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { CreateFlagModal } from '@/components/admin/feature-flags/CreateFlagModal';
import { MODULE_REGISTRY, isModuleKey } from '@/lib/featureFlags/moduleRegistry';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** Registry row joined with its (optional) DB flag row. */
interface ModuleRow {
  key: string;
  label: string;
  returnStage: number;
  flag: FeatureFlag | undefined;
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
      const response = await fetch('/api/admin/feature-flags', {});

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

  const moduleRows: ModuleRow[] = MODULE_REGISTRY.map((m) => ({
    key: m.key,
    label: m.label,
    returnStage: m.returnStage,
    flag: flags.find((f) => f.key === m.key),
  }));

  // The generic table below shows only NON-module flags (e.g. Basiq) —
  // module keys live in the Modules panel above, never in both.
  const otherFlags = flags.filter(
    (flag) =>
      !isModuleKey(flag.key) &&
      (flag.name.toLowerCase().includes(search.toLowerCase()) ||
        flag.key.toLowerCase().includes(search.toLowerCase())),
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

  const renderToggle = (key: string, enabled: boolean) => (
    <button
      onClick={() => handleToggle(key, enabled)}
      disabled={toggling === key}
      aria-label={`Toggle ${key}`}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        toggling === key ? 'opacity-50' : ''
      } ${enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const formatFlip = (flag: FeatureFlag | undefined) => {
    if (!flag) return <span className="text-gray-400">not seeded</span>;
    const when = new Date(flag.updatedAt).toLocaleString();
    return (
      <div>
        <p className="text-sm text-gray-900 dark:text-white">{when}</p>
        {flag.updatedBy && (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[160px]">
            by {flag.updatedBy}
          </p>
        )}
      </div>
    );
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Feature Flags"
        description="Module visibility and platform switches"
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

      {/* Modules panel — PROD Simplification (plan §4.4) */}
      <AdminCard padding="none" className="mb-6">
        <div className="px-6 pt-5 pb-1">
          <AdminCardHeader
            title="Modules"
            description="What is hidden and what is live. Hidden modules keep their code and data — flipping a switch brings the module back within ~30 seconds. Unhiding is an R-stage gate decision (see PROD_SIMPLIFICATION_PLAN.md §5 R-stages), not a casual toggle: producers converged, Ring-3 PASS on live data, then the switch. The scope freeze applies while hidden — no work, no fixes, issues HELD."
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-500">Loading modules…</span>
          </div>
        ) : (
          <AdminTable
            columns={[
              {
                key: 'label',
                header: 'Module',
                render: (row) => (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{row.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.key}</p>
                  </div>
                ),
              },
              {
                key: 'state',
                header: 'State',
                render: (row) =>
                  row.flag?.enabled ? (
                    <AdminBadge variant="success" size="sm">LIVE</AdminBadge>
                  ) : (
                    <AdminBadge variant="default" size="sm">HIDDEN</AdminBadge>
                  ),
              },
              {
                key: 'returnStage',
                header: 'Returns at',
                render: (row) => <span className="text-sm">R{row.returnStage}</span>,
              },
              {
                key: 'lastFlipped',
                header: 'Last flipped',
                render: (row) => formatFlip(row.flag),
              },
              {
                key: 'toggle',
                header: '',
                render: (row) =>
                  row.flag ? (
                    renderToggle(row.key, row.flag.enabled)
                  ) : (
                    <span className="text-xs text-gray-400">seed pending</span>
                  ),
              },
            ]}
            data={moduleRows}
            keyExtractor={(row) => row.key}
            emptyMessage="No modules registered"
          />
        )}
      </AdminCard>

      {/* Platform flags (non-module) */}
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
                render: (flag) => renderToggle(flag.key, flag.enabled),
              },
              {
                key: 'lastFlipped',
                header: 'Last flipped',
                render: (flag) => formatFlip(flag),
              },
            ]}
            data={otherFlags}
            keyExtractor={(flag) => flag.key}
            emptyMessage="No feature flags found"
          />
        )}
      </AdminCard>

      {/*
       * Tech Debt #19 — modal that the `+Create Flag` button has been
       * toggling (`showModal` state) since Phase 33 shipped. Filled in
       * 2026-05-17. Canonical path for new flags remains the seed
       * (`prisma/seed-feature-flags.ts` auto-runs on every `vercel-build`);
       * this modal is the escape hatch for ad-hoc one-offs.
       */}
      <CreateFlagModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={fetchFlags}
      />
    </AdminFeatureGate>
  );
}
