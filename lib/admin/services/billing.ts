/**
 * Phase 33: Admin Billing Service
 *
 * Service for billing operations from the admin portal.
 */

import { adminApi, ADMIN_API_ROUTES } from './api-client';
import type {
  RevenueMetrics,
  SubscriptionBreakdown,
  BillingTransaction,
  TransactionFilters,
  PaginatedResponse,
  AdminApiResponse,
} from '../types';

// =============================================================================
// BILLING SERVICE
// =============================================================================

export const billingService = {
  /**
   * Get revenue overview metrics
   */
  getOverview(params?: {
    period?: 'day' | 'week' | 'month' | 'year';
  }): Promise<AdminApiResponse<RevenueMetrics>> {
    return adminApi.get(ADMIN_API_ROUTES.BILLING_OVERVIEW, params);
  },

  /**
   * Get subscription breakdown by tier/plan
   */
  getSubscriptionBreakdown(): Promise<AdminApiResponse<SubscriptionBreakdown>> {
    return adminApi.get(ADMIN_API_ROUTES.BILLING_SUBSCRIPTIONS);
  },

  /**
   * List billing transactions
   */
  getTransactions(
    params?: TransactionFilters & { page?: number; limit?: number }
  ): Promise<AdminApiResponse<PaginatedResponse<BillingTransaction>>> {
    return adminApi.get(ADMIN_API_ROUTES.BILLING_TRANSACTIONS, {
      ...params,
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
    } as Record<string, string | number | boolean | undefined>);
  },

  /**
   * Get failed payments
   */
  getFailedPayments(params?: {
    page?: number;
    limit?: number;
  }): Promise<
    AdminApiResponse<
      PaginatedResponse<
        BillingTransaction & {
          retryCount: number;
          lastRetryAt: string | null;
        }
      >
    >
  > {
    return adminApi.get(ADMIN_API_ROUTES.BILLING_FAILED_PAYMENTS, params);
  },

  /**
   * Retry a failed payment
   */
  retryPayment(transactionId: string): Promise<
    AdminApiResponse<{
      success: boolean;
      newTransactionId?: string;
      error?: string;
    }>
  > {
    return adminApi.post(`${ADMIN_API_ROUTES.BILLING_TRANSACTIONS}/${transactionId}/retry`);
  },

  /**
   * Process a refund
   */
  processRefund(
    transactionId: string,
    data: { amount?: number; reason: string }
  ): Promise<
    AdminApiResponse<{
      success: boolean;
      refundId: string;
      amount: number;
    }>
  > {
    return adminApi.post(`${ADMIN_API_ROUTES.BILLING_TRANSACTIONS}/${transactionId}/refund`, data);
  },

  /**
   * Get revenue trends over time
   */
  getRevenueTrends(params: {
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
  }): Promise<
    AdminApiResponse<{
      data: Array<{
        date: string;
        mrr: number;
        newMrr: number;
        churnedMrr: number;
        netMrr: number;
      }>;
    }>
  > {
    return adminApi.get(`${ADMIN_API_ROUTES.BILLING_OVERVIEW}/trends`, {
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      granularity: params.granularity,
    });
  },

  /**
   * Export billing data
   */
  exportData(params: {
    format: 'csv' | 'json';
    startDate: Date;
    endDate: Date;
    includeTransactions?: boolean;
    includeSubscriptions?: boolean;
  }): Promise<AdminApiResponse<{ downloadUrl: string }>> {
    return adminApi.post(`${ADMIN_API_ROUTES.BILLING_TRANSACTIONS}/export`, {
      ...params,
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
    });
  },
};
