/**
 * Phase 17: Personal CFO API
 * GET /api/cfo - Get CFO dashboard data
 *
 * Phase N.2: Migrated from verifyToken to withPermission (RBAC + audit logging).
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getCFODashboardData, getCFOScore, getRisks, getActions } from '@/lib/cfo';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO', auth.userId);
    if (gateBlocked) return gateBlocked;
  try {
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'score': {
        const score = await getCFOScore(userId);
        return NextResponse.json(score);
      }
      case 'risks': {
        const risks = await getRisks(userId);
        return NextResponse.json(risks);
      }
      case 'actions': {
        const actions = await getActions(userId);
        return NextResponse.json(actions);
      }
      default: {
        const dashboardData = await getCFODashboardData(userId);
        return NextResponse.json(dashboardData);
      }
    }
  } catch (error) {
    console.error('CFO API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CFO data' },
      { status: 500 }
    );
  }
});
