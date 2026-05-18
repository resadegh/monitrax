import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db';

/**
 * Phase 12 PR 3c.2b — Balance-upgrade-nudge dismissal state.
 *
 * GET  /api/settings/balance-upgrade-nudge — returns `{ dismissed: boolean }`.
 * POST /api/settings/balance-upgrade-nudge — sets `dismissedBalanceUpgradeNudge = true`.
 *
 * First-visit modal per `PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A.1 #5.
 * Shown once to existing users with ≥1 MANUAL account; once dismissed
 * (any of three choices: Connect via Basiq / Upload statement / Keep
 * manual), this endpoint flips the flag forward and the modal never
 * auto-shows again. Always reachable via Settings > Data Health (PR J).
 *
 * Single canonical home for the dismissal state — reads/writes
 * `UserPreference.dismissedBalanceUpgradeNudge` (column added in
 * migration `20260518100000_phase_12_pr_3c_2b_balance_upgrade_nudge`).
 *
 * Mirrors the `reform-banner` pattern verbatim (CLAUDE.md §12.2 SSOT
 * — same shape so reviewers + future PRs can copy-paste).
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
      select: { dismissedBalanceUpgradeNudge: true },
    });

    return NextResponse.json({
      dismissed: pref?.dismissedBalanceUpgradeNudge ?? false,
    });
  } catch (error) {
    console.error('Get balance-upgrade-nudge state error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance-upgrade-nudge state' },
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
    //   • Where clause: { userId: auth.userId } — uniquely identifies
    //     the authenticated user's own preference row.
    //   • Columns overwritten on update branch:
    //     `dismissedBalanceUpgradeNudge` only. No other field touched.
    //     Safe — the column is owned by this endpoint, no other code
    //     writes it.
    //   • Guard: the where clause + auth context ensure we only touch
    //     rows belonging to the authenticated user. Update branch only
    //     flips the dismissal flag forward (true); never resets to
    //     false through this endpoint.
    //   → §12.11 safe; no user confirmation required.
    await prisma.userPreference.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        dismissedBalanceUpgradeNudge: true,
      },
      update: {
        dismissedBalanceUpgradeNudge: true,
      },
    });

    return NextResponse.json({ dismissed: true });
  } catch (error) {
    console.error('Dismiss balance-upgrade-nudge error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss balance upgrade nudge' },
      { status: 500 },
    );
  }
}
