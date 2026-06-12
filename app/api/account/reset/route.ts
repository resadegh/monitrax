/**
 * Account data reset — "Start fresh" (Settings → Privacy → Danger Zone).
 *
 * POST — immediately and irreversibly wipes ALL financial data for the
 * requesting user while keeping the account itself: login, MFA/passkeys,
 * legal consent records, billing, integrations and support history all
 * survive. The user lands back in the onboarding wizard as a day-one
 * user. Executor + model classification: `lib/services/accountReset.ts`.
 *
 * Unlike account deletion (`/api/account/delete-request`, 30-day grace)
 * the reset executes IMMEDIATELY — the account survives, so the blast
 * radius is "rebuild your data", not "lose your identity". The UI pairs
 * this with an export-first nudge (`/api/account/export`) and a
 * type-RESET confirmation, which this route re-validates server-side.
 *
 * Guards:
 *   1. `withPermission('account.delete')` — same permission tier as
 *      account deletion; auth.userId from the verified bearer token.
 *   2. Body must carry `{ confirm: "RESET" }` — the client cannot fire
 *      this accidentally from a stray fetch.
 *   3. Active adviser link blocks the reset (409): a client whose data
 *      an adviser is actively servicing must disconnect first — the
 *      adviser relationship is consent-scoped to the data being wiped.
 *
 * CLAUDE.md §12.11 destructive-write checklist: answered in full in the
 * service header (`lib/services/accountReset.ts`) — every deleteMany is
 * `{ userId }`-scoped, the User update only resets onboarding flags, and
 * the classification drift test keeps the wipe list honest.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { resetUserData } from '@/lib/services/accountReset';

// The wipe transaction may take tens of seconds on data-heavy accounts;
// don't let the platform's default function timeout kill it mid-flight.
export const maxDuration = 120;

export const POST = withPermission('account.delete', async (request, auth) => {
  let confirm = '';
  try {
    const body = await request.json();
    confirm = typeof body?.confirm === 'string' ? body.confirm : '';
  } catch {
    // fall through — missing body fails the check below
  }

  if (confirm !== 'RESET') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Type RESET to confirm you want to erase all your data.',
        },
      },
      { status: 400 },
    );
  }

  // Active adviser link → block. ARCHIVED links don't count.
  const adviserLink = await prisma.organizationClient.findFirst({
    where: { userId: auth.userId, status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED'] } },
    select: { id: true },
  });
  if (adviserLink) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ADVISER_LINK_ACTIVE',
          message:
            'Your account is connected to a professional adviser. Disconnect from your adviser before starting fresh.',
        },
      },
      { status: 409 },
    );
  }

  const result = await resetUserData(auth.userId);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RESET_FAILED',
          message: 'Could not complete the reset. Nothing was changed — please try again.',
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { deletedRows: result.deletedRows, cdrPurged: result.cdrPurged },
  });
});
