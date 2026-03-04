'use client';

/**
 * Phase 33: Billing Dashboard Page
 *
 * Revenue metrics and billing management.
 * Uses real data from /api/admin/billing/* endpoints.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { PAGINATION_DEFAULTS } from '@/lib/admin/constants';

interface BillingMetrics {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  churn: number;
  churnChange: number;
  arpu: number;
  ltv: number;
  totalCustomers: number;
  paidCustomers: number;
}

interface TierBreakdown {
  tier: string;
  users: number;
  revenue: number;
  percent: number;
}

interface Transaction {
  id: string;
  date: string;
  customer: string;
  customerName: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
}

interface OverviewResponse {
  success: boolean;
  data: {
    metrics: BillingMetrics;
    tierBreakdown: TierBreakdown[];
    period: string;
  };
  error?: { code: string; message: string };
}

interface TransactionsResponse {
  success: boolean;
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: { code: string; message: string };
}

export default function BillingPage() {
  const [period, setPeriod] = useState('month');
  const [currentPage, setCurrentPage] = useState(1);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both overview and transactions in parallel
      const [overviewRes, transactionsRes] = await Promise.all([
        fetch(`/api/admin/billing/overview?period=${period}`, {
          credentials: 'include',
        }),
        fetch(`/api/admin/billing/transactions?page=${currentPage}&limit=${PAGINATION_DEFAULTS.LIMIT}`, {
          credentials: 'include',
        }),
      ]);

      if (!overviewRes.ok) {
        const errorData = await overviewRes.json();
        throw new Error(errorData.error?.message || 'Failed to fetch billing overview');
      }

      if (!transactionsRes.ok) {
        const errorData = await transactionsRes.json();
        throw new Error(errorData.error?.message || 'Failed to fetch transactions');
      }

      const overviewData: OverviewResponse = await overviewRes.json();
      const transactionsData: TransactionsResponse = await transactionsRes.json();

      setMetrics(overviewData.data.metrics);
      setTierBreakdown(overviewData.data.tierBreakdown);
      setTransactions(transactionsData.data);
      setTotalTransactions(transactionsData.pagination.total);
      setTotalPages(transactionsData.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period, currentPage]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Reset to page 1 when period changes
  useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Billing"
        description="Revenue metrics and transaction management"
        action={
          <Select
            options={[
              { value: 'week', label: 'Last 7 days' },
              { value: 'month', label: 'Last 30 days' },
              { value: 'quarter', label: 'Last 90 days' },
              { value: 'year', label: 'Last 12 months' },
            ]}
            value={period}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)}
            className="w-40"
          />
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
            <AdminButton variant="outline" size="sm" onClick={fetchBillingData}>
              Retry
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading billing data...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Revenue Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Monthly Revenue"
              value={`$${(metrics?.mrr || 0).toLocaleString()}`}
              change={metrics?.mrrGrowth || 0}
              changeLabel="vs last period"
              trend={metrics?.mrrGrowth && metrics.mrrGrowth > 0 ? 'up' : 'down'}
            />
            <StatsCard
              title="Annual Revenue"
              value={`$${(metrics?.arr || 0).toLocaleString()}`}
              change={metrics?.mrrGrowth || 0}
              changeLabel="projected"
              trend={metrics?.mrrGrowth && metrics.mrrGrowth > 0 ? 'up' : 'down'}
            />
            <StatsCard
              title="Churn Rate"
              value={`${metrics?.churn || 0}%`}
              change={metrics?.churnChange || 0}
              changeLabel="vs last period"
              trend={metrics?.churnChange && metrics.churnChange < 0 ? 'down' : 'up'}
            />
            <StatsCard
              title="ARPU"
              value={`$${(metrics?.arpu || 0).toFixed(2)}`}
              change={0}
              changeLabel="avg per user"
              trend="up"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Tier Breakdown */}
            <AdminCard className="lg:col-span-2">
              <AdminCardHeader
                title="Subscription Breakdown"
                description="Revenue by tier"
              />
              <div className="space-y-4">
                {tierBreakdown.map((tier) => (
                  <div key={tier.tier} className="flex items-center gap-4">
                    <div className="w-24">
                      <TierBadge tier={tier.tier} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          {tier.users} users
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ${tier.revenue.toLocaleString()}/mo
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${tier.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>

            {/* Quick Stats */}
            <div className="space-y-4">
              <AdminCard>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {(metrics?.totalCustomers || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
                </div>
              </AdminCard>
              <AdminCard>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {(metrics?.paidCustomers || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Paid Customers</p>
                </div>
              </AdminCard>
              <AdminCard>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${metrics?.ltv || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average LTV</p>
                </div>
              </AdminCard>
            </div>
          </div>

          {/* Recent Transactions */}
          <AdminCard padding="none">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <SectionHeader
                title="Recent Transactions"
                action={
                  <AdminButton variant="outline" size="sm">
                    Export
                  </AdminButton>
                }
              />
            </div>
            <AdminTable
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  sortable: true,
                  render: (t) => new Date(t.date).toLocaleDateString('en-AU'),
                },
                { key: 'customer', header: 'Customer' },
                { key: 'type', header: 'Type' },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (t) => (
                    <span className={t.amount < 0 ? 'text-red-600' : ''}>
                      {t.amount < 0 ? '-' : ''}${Math.abs(t.amount).toFixed(2)}
                    </span>
                  ),
                  sortable: true,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (t) => (
                    <AdminBadge
                      variant={t.status === 'succeeded' ? 'success' : t.status === 'pending' ? 'warning' : 'error'}
                      size="sm"
                    >
                      {t.status}
                    </AdminBadge>
                  ),
                },
              ]}
              data={transactions}
              keyExtractor={(t) => t.id}
              emptyMessage="No transactions found"
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalTransactions}
              itemsPerPage={PAGINATION_DEFAULTS.LIMIT}
            />
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
