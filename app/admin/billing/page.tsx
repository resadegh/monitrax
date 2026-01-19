'use client';

/**
 * Phase 33: Billing Dashboard Page
 *
 * Revenue metrics and billing management.
 */

import React, { useState } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, StatsCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Select } from '@/components/admin/ui/AdminForm';
import { AdminBadge, TierBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

// Mock data
const mockMetrics = {
  mrr: 48750,
  mrrGrowth: 12.5,
  arr: 585000,
  churn: 2.3,
  arpu: 18.50,
  ltv: 156,
  totalCustomers: 2635,
  paidCustomers: 1847,
};

const mockTierBreakdown = [
  { tier: 'FREE', users: 788, revenue: 0, percent: 30 },
  { tier: 'BASIC', users: 612, revenue: 6114, percent: 23 },
  { tier: 'PRO', users: 856, revenue: 17111, percent: 33 },
  { tier: 'PREMIUM', users: 379, revenue: 15156, percent: 14 },
];

const mockTransactions = [
  { id: '1', date: '2026-01-19', customer: 'john@example.com', type: 'Subscription', amount: 19.99, status: 'succeeded' },
  { id: '2', date: '2026-01-19', customer: 'Acme Corp', type: 'Subscription', amount: 149, status: 'succeeded' },
  { id: '3', date: '2026-01-18', customer: 'sarah@example.com', type: 'Upgrade', amount: 10, status: 'succeeded' },
  { id: '4', date: '2026-01-18', customer: 'mike@example.com', type: 'Subscription', amount: 9.99, status: 'failed' },
  { id: '5', date: '2026-01-17', customer: 'emily@example.com', type: 'Refund', amount: -39.99, status: 'succeeded' },
];

export default function BillingPage() {
  const [period, setPeriod] = useState('month');
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <AdminFeatureGate feature="billingDashboard">
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

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Monthly Revenue"
          value={`$${mockMetrics.mrr.toLocaleString()}`}
          change={mockMetrics.mrrGrowth}
          changeLabel="vs last month"
          trend="up"
        />
        <StatsCard
          title="Annual Revenue"
          value={`$${mockMetrics.arr.toLocaleString()}`}
          change={15.2}
          changeLabel="projected"
          trend="up"
        />
        <StatsCard
          title="Churn Rate"
          value={`${mockMetrics.churn}%`}
          change={-0.5}
          changeLabel="vs last month"
          trend="down"
        />
        <StatsCard
          title="ARPU"
          value={`$${mockMetrics.arpu}`}
          change={3.2}
          changeLabel="vs last month"
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
            {mockTierBreakdown.map((tier) => (
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
                {mockMetrics.totalCustomers.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
            </div>
          </AdminCard>
          <AdminCard>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {mockMetrics.paidCustomers.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Paid Customers</p>
            </div>
          </AdminCard>
          <AdminCard>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                ${mockMetrics.ltv}
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
            { key: 'date', header: 'Date', sortable: true },
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
                  variant={t.status === 'succeeded' ? 'success' : 'error'}
                  size="sm"
                >
                  {t.status}
                </AdminBadge>
              ),
            },
          ]}
          data={mockTransactions}
          keyExtractor={(t) => t.id}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={5}
          onPageChange={setCurrentPage}
          totalItems={50}
          itemsPerPage={10}
        />
      </AdminCard>
    </AdminFeatureGate>
  );
}
