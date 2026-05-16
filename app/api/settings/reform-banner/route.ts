import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * Phase 41E.3 — Reform-banner dismissal state.
 *
 * GET  /api/settings/reform-banner — returns `{ dismissed: boolean }`.
 * POST /api/settings/reform-banner — sets `dismissedReformBanner = true`.
 *
 * Calm-framing one-time card per Reza confirmation 2026-05-16. The
 * banner is dismissable, accessible later via CFO Guide. This endpoint
 * is the single canonical home for the dismissal state — reads/writes
 * `UserPreference.dismissedReformBanner` (column added in migration
 * `20260516200000_phase_41e_3_reform_banner_dismissal`).
 *
 * POST is idempotent — re-dismissing is a no-op.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const pref = await prisma.userPreference.findUnique({
      where: { userId: auth.userId },
      select: { dismissedReformBanner: true },
    });

    return NextResponse.json({
      dismissed: pref?.dismissedReformBanner ?? false,
    });
  } catch (error) {
    console.error('Get reform-banner state error:', error);
    return NextResponse.json(
      { error: 'Failed to get reform-banner state' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // §12.11 destructive-write checklist:
    //   • Operation: upsert on `user_preferences`.
    //   • Where clause: { userId: auth.userId } — uniquely identifies the
    //     authenticated user's own preference row.
    //   • Columns overwritten on update branch: `dismissedReformBanner`
    //     only. No other field touched. Safe — the column is owned by
    //     this endpoint, no other code writes it.
    //   • Guard: the where clause + the auth context ensure we only
    //     touch rows belonging to the authenticated user. The update
    //     branch only flips the dismissal flag forward (true); never
    //     resets to false through this endpoint.
    //   → §12.11 safe; no user confirmation required.
    await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        dismissedReformBanner: true,
      },
      update: {
        dismissedReformBanner: true,
      },
    });

    return NextResponse.json({ dismissed: true });
  } catch (error) {
    console.error('Dismiss reform-banner error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss reform banner' },
      { status: 500 },
    );
  }
}
