/**
 * Phase 42 PR6 — Daily Pulse API.
 *
 * GET /api/bookkeeping/engagement/pulse
 *
 * Returns the Daily Pulse data the Home card consumes — completion %,
 * streak, adaptive CTA, optional anomaly narrative, celebration-state
 * marker. Per CLAUDE.md §0 architect lens — thin route handler; all
 * shaping in `lib/bookkeeping/engagement/dailyPulse.ts`.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { buildDailyPulse } from '@/lib/bookkeeping/engagement/dailyPulse';

export const GET = withPermission('bookkeeping.read', async (_request, auth) => {
  const pulse = await buildDailyPulse(auth.userId);
  return NextResponse.json({ success: true, data: pulse });
});
