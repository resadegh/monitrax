/**
 * Financial Snapshot API
 * GET /api/financial-snapshot - Get unified financial calculations
 *
 * This endpoint is the SINGLE SOURCE OF TRUTH for all financial data.
 * All pages should use this to ensure consistent numbers across:
 * - Dashboard
 * - Budget Analysis
 * - Expenses Page
 * - Cash Flow Analysis
 *
 * Response includes:
 * - Expense breakdowns (all, recurring, non-recurring, essential, discretionary)
 * - Income breakdowns (all, primary, secondary)
 * - Account balances
 * - Loan summaries
 * - Cashflow analysis
 * - Emergency fund metrics
 * - Financial health score
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getFinancialSnapshot } from '@/lib/services/financialSnapshot';

export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      const snapshot = await getFinancialSnapshot(userId);

      return NextResponse.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      console.error('[API] Get financial snapshot error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to calculate financial snapshot',
        },
        { status: 500 }
      );
    }
});
