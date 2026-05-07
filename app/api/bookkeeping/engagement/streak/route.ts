/**
 * Phase 42 PR6 — Streak touch + celebration trigger API.
 *
 * GET  /api/bookkeeping/engagement/streak              — read state
 * POST /api/bookkeeping/engagement/streak/touch         — record activity
 * POST /api/bookkeeping/engagement/streak/celebrate     — try to fire celebration
 *
 * The POST routes are cheap idempotent triggers — safe to call from
 * any UI moment that wants to record activity.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  getOrCreateEngagementState,
  touchStreak,
  tryFireCelebration,
} from '@/lib/bookkeeping/engagement/streak';

export const GET = withPermission('bookkeeping.read', async (_request, auth) => {
  const state = await getOrCreateEngagementState(auth.userId);
  return NextResponse.json({ success: true, data: state });
});

export const POST = withPermission('bookkeeping.write', async (request, auth) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? 'touch';
  if (action === 'touch') {
    const state = await touchStreak(auth.userId);
    return NextResponse.json({ success: true, data: state });
  }
  if (action === 'celebrate') {
    const fired = await tryFireCelebration(auth.userId);
    return NextResponse.json({ success: true, data: { fired } });
  }
  return NextResponse.json(
    {
      success: false,
      error: { code: 'INVALID_ACTION', message: `unknown action '${action}'` },
    },
    { status: 400 }
  );
});
