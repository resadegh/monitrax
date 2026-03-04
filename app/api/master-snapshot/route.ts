/**
 * Master Financial Snapshot API
 * GET /api/master-snapshot
 *
 * ============================================================================
 * SINGLE SOURCE OF TRUTH FOR ALL FINANCIAL DATA
 * ============================================================================
 *
 * This endpoint returns the complete Master Financial Snapshot which includes:
 *
 * - Net Worth (assets, liabilities, breakdown)
 * - Expenses (all, recurring, essential, discretionary, tax-deductible, by category)
 * - Income (all, primary, secondary, passive)
 * - Cashflow (monthly/annual income, expenses, loan repayments, net cashflow)
 * - Debt (summary, metrics, debt-to-income, debt service ratio)
 * - Properties (individual metrics, portfolio value, equity)
 * - Investments (value, cost base, unrealised gains, allocation)
 * - Tax (estimated taxable income, tax payable, deductions, PAYG)
 * - Emergency Fund (liquid cash, months covered, gap)
 * - Health Score (0-100 score, grade, component breakdown)
 * - Quick Metrics (commonly used values for fast access)
 *
 * ALL API endpoints should use getMasterFinancialSnapshot() internally
 * to ensure consistent calculations across the application.
 *
 * @see lib/services/masterFinancialService.ts
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      const snapshot = await getMasterFinancialSnapshot(userId);

      return NextResponse.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      console.error('[API] Get master financial snapshot error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to calculate financial snapshot',
        },
        { status: 500 }
      );
    }
});
