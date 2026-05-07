/**
 * Phase 42 PR1 — Bookkeeping period API.
 *
 * GET    /api/bookkeeping/periods/[month]  — fetch (or create) period state
 * POST   /api/bookkeeping/periods/[month]  — transition: REVIEWED / LOCKED / UNLOCK
 *
 * `[month]` segment is "YYYY-MM" (validated against a strict regex).
 * Per CLAUDE.md §0 architect lens, the route handler is THIN — all
 * business logic lives in `lib/bookkeeping/period.ts` (the canonical
 * state-machine module). This route is a wrapper.
 *
 * 3-status state machine: OPEN → REVIEWED → LOCKED.
 * LOCKED is opt-in; only the user can re-open. NOT a statutory close
 * — Xero owns that. Per `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md`
 * §1 + §3 D-42-3.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  toPeriodMonthKey,
  formatPeriodMonth,
  getOrCreatePeriod,
  markPeriodReviewed,
  lockPeriod,
  unlockPeriod,
} from '@/lib/bookkeeping/period';

type RouteContext = { params: Promise<{ month: string }> };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonthOrError(raw: string): { ok: true; date: Date } | { ok: false; response: Response } {
  if (!MONTH_RE.test(raw)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_MONTH', message: 'Expected YYYY-MM (e.g. 2026-10)' },
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, date: toPeriodMonthKey(raw) };
}

// =============================================================================
// GET — fetch (or create) period state
// =============================================================================

export const GET = withPermission<RouteContext>('bookkeeping.read', async (_request, auth, context) => {
  const { month } = await context!.params;
  const parsed = parseMonthOrError(month);
  if (!parsed.ok) return parsed.response;

  const period = await getOrCreatePeriod(auth.userId, parsed.date);

  return NextResponse.json({
    success: true,
    data: {
      ...period,
      periodMonth: formatPeriodMonth(period.periodMonth),
    },
  });
});

// =============================================================================
// POST — transition: REVIEWED / LOCKED / UNLOCK
// =============================================================================

interface PostBody {
  action?: 'mark_reviewed' | 'lock' | 'unlock';
}

export const POST = withPermission<RouteContext>('bookkeeping.write', async (request, auth, context) => {
  const { month } = await context!.params;
  const parsed = parseMonthOrError(month);
  if (!parsed.ok) return parsed.response;

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // empty body is OK — defaults to mark_reviewed below
  }

  const action = body.action ?? 'mark_reviewed';

  let result;
  switch (action) {
    case 'mark_reviewed':
      result = await markPeriodReviewed(auth.userId, parsed.date);
      break;
    case 'lock':
      result = await lockPeriod(auth.userId, parsed.date);
      break;
    case 'unlock':
      result = await unlockPeriod(auth.userId, parsed.date);
      break;
    default:
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: `Unknown action '${action}'. Use 'mark_reviewed' | 'lock' | 'unlock'.`,
          },
        },
        { status: 400 }
      );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...result.period,
      periodMonth: formatPeriodMonth(result.period.periodMonth),
      transitioned: result.transitioned,
    },
  });
});
