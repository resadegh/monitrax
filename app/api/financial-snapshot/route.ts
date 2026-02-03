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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { getFinancialSnapshot } from '@/lib/services/financialSnapshot';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

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
}
