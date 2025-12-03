/**
 * GET /api/linkage/health
 * Phase 8 Task 10.7 - Linkage Health API Endpoint
 *
 * Returns global relational integrity state derived from Snapshot 2.0.
 * Powers dashboard insights, health indicators, and fix-it workflows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { calculateLinkageHealth } from '@/lib/intelligence/linkageHealthService';

// Import snapshot fetcher - we'll fetch internally
async function fetchSnapshot(request: NextRequest, userId: string): Promise<Response> {
  const baseUrl = request.nextUrl.origin;
  const cookie = request.headers.get('cookie') || '';
  const authorization = request.headers.get('authorization') || '';

  return fetch(`${baseUrl}/api/portfolio/snapshot`, {
    headers: {
      'Cookie': cookie,
      'Authorization': authorization,
    },
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const startTime = Date.now();
      const userId = authReq.user!.userId;

      // Fetch Snapshot 2.0 data (single source of truth)
      const snapshotResponse = await fetchSnapshot(request, userId);

      if (!snapshotResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch portfolio snapshot' },
          { status: 500 }
        );
      }

      const snapshot = await snapshotResponse.json();

      // Calculate linkage health from snapshot (no direct DB access)
      const health = calculateLinkageHealth(snapshot);

      // Add performance timing
      const processingTime = Date.now() - startTime;

      return NextResponse.json({
        ...health,
        _meta: {
          processingTimeMs: processingTime,
          snapshotVersion: snapshot.version || '2.0',
        },
      });
    } catch (error) {
      console.error('Linkage health error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
