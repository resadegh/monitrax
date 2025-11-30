/**
 * Phase 17: Personal CFO API
 * GET /api/cfo - Get CFO dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getCFODashboardData, getCFOScore, getRisks, getActions } from '@/lib/cfo';

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Check for specific data type query
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'score':
        const score = await getCFOScore(userId);
        return NextResponse.json(score);

      case 'risks':
        const risks = await getRisks(userId);
        return NextResponse.json(risks);

      case 'actions':
        const actions = await getActions(userId);
        return NextResponse.json(actions);

      default:
        // Return full dashboard data
        const dashboardData = await getCFODashboardData(userId);
        return NextResponse.json(dashboardData);
    }
  } catch (error) {
    console.error('CFO API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CFO data' },
      { status: 500 }
    );
  }
}
