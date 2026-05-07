/**
 * Phase 42 PR6.5b — Pending-actions popup API.
 *
 * GET  /api/bookkeeping/engagement/pending-actions
 *      → { actions, totalCount, alreadyShownToday, optedOut }
 *
 * POST /api/bookkeeping/engagement/pending-actions?action=shown
 *      → marks `lastPromptShownAt = now` (gate the popup once-per-day)
 *
 * POST /api/bookkeeping/engagement/pending-actions?action=dismiss
 *      → marks `lastPromptDismissedAt = now` ("Not today")
 *
 * POST /api/bookkeeping/engagement/pending-actions?action=opt-out
 *      → sets `promptOptedOut = true` (global off-switch)
 *
 * Per CLAUDE.md §12.3 — thin route handler; all shaping in
 * `lib/bookkeeping/engagement/pendingActions.ts`.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  buildPendingActions,
  markPromptShown,
  dismissPromptForToday,
  optOutOfPrompt,
} from '@/lib/bookkeeping/engagement/pendingActions';

export const GET = withPermission('bookkeeping.read', async (_request, auth) => {
  const result = await buildPendingActions(auth.userId);
  return NextResponse.json({ success: true, data: result });
});

export const POST = withPermission('bookkeeping.write', async (request, auth) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (action === 'shown') {
    await markPromptShown(auth.userId);
    return NextResponse.json({ success: true });
  }
  if (action === 'dismiss') {
    await dismissPromptForToday(auth.userId);
    return NextResponse.json({ success: true });
  }
  if (action === 'opt-out') {
    await optOutOfPrompt(auth.userId);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json(
    {
      success: false,
      error: { code: 'INVALID_ACTION', message: `unknown action '${action}'` },
    },
    { status: 400 }
  );
});
