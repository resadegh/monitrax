'use client';

/**
 * Neobrain AI-usage metrics page (Phase 54 — instrumentation).
 *
 * The measurable baseline for the model-tiering cost/quality decision:
 * where does AI spend actually go, by surface and by model, over a window.
 * Reads /api/admin/ai-usage (AiUsageEvent aggregation). Admin design system
 * (NOT Stitch — §18.2.1 admin exemption); clones the Analytics page pattern.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { ADMIN_API_ROUTES } from '@/lib/admin/constants';

interface BreakdownRow {
  key: string;
  calls: number;
  totalTokens: number;
  estimatedCostUsd: number;
  costSharePct: number;
}

interface AiUsageMetrics {
  windowDays: number;
  totals: {
    calls: number;
    totalTokens: number;
    estimatedCostUsd: number;
    failedCalls: number;
    successRatePct: number;
  };
  bySurface: BreakdownRow[];
  byModel: BreakdownRow[];
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);

export default function AiUsagePage() {
  const [days, setDays] = useState('30');
  const [metrics, setMetrics] = useState<AiUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ADMIN_API_ROUTES.AI_USAGE}?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch AI usage metrics');
      const json = await res.json();
      setMetrics(json.data as AiUsageMetrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI usage');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const renderBreakdown = (title: string, description: string, rows: BreakdownRow[], emptyMsg: string) => (
    <AdminCard>
      <AdminCardHeader title={title} description={description} />
      <AdminTable
        columns={[
          { key: 'key', header: title.includes('Surface') ? 'Surface' : 'Model', sortable: true },
          { key: 'calls', header: 'Calls', render: (r: BreakdownRow) => r.calls.toLocaleString(), sortable: true },
          {
            key: 'totalTokens',
            header: 'Tokens',
            render: (r: BreakdownRow) => r.totalTokens.toLocaleString(),
            sortable: true,
          },
          {
            key: 'estimatedCostUsd',
            header: 'Est. cost',
            render: (r: BreakdownRow) => usd(r.estimatedCostUsd),
            sortable: true,
          },
          {
            key: 'costSharePct',
            header: 'Cost share',
            render: (r: BreakdownRow) => (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, r.costSharePct)}%` }} />
                </div>
                <span className="text-sm">{r.costSharePct.toFixed(1)}%</span>
              </div>
            ),
            sortable: true,
          },
        ]}
        data={rows}
        keyExtractor={(r: BreakdownRow) => r.key}
        emptyMessage={emptyMsg}
      />
    </AdminCard>
  );

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="AI Usage & Cost"
        description="Neobrain AI spend by surface and model — the baseline for model-tiering decisions"
        action={
          <Select
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '365', label: 'Last 12 months' },
            ]}
            value={days}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDays(e.target.value)}
            className="w-40"
          />
        }
      />

      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <span>{error}</span>
            <AdminButton variant="outline" size="sm" onClick={fetchUsage}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading AI usage…</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Estimated cost" value={usd(metrics?.totals.estimatedCostUsd ?? 0)} />
            <StatsCard title="Total calls" value={(metrics?.totals.calls ?? 0).toLocaleString()} />
            <StatsCard title="Total tokens" value={(metrics?.totals.totalTokens ?? 0).toLocaleString()} />
            <StatsCard title="Success rate" value={`${(metrics?.totals.successRatePct ?? 100).toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {renderBreakdown(
              'Cost by Surface',
              'Where AI spend goes per feature. The highest-volume surface (categorisation) is the main cost lever as usage grows.',
              metrics?.bySurface ?? [],
              'No AI usage recorded in this window yet.',
            )}
            {renderBreakdown(
              'Cost by Model',
              'Spend per Gemini model — the input to the 2.5 vs 3.5 tiering decision.',
              metrics?.byModel ?? [],
              'No AI usage recorded in this window yet.',
            )}
          </div>

          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
            Cost is estimated from token counts × Gemini list pricing (<code>lib/ai/google/modelConfig.ts</code>), not a billed
            figure. Calls from surfaces not yet labelled appear under <code>unknown</code>. No prompt or response content is
            stored — counts and cost only.
          </p>
        </>
      )}
    </AdminFeatureGate>
  );
}
