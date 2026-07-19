/**
 * MON-076 Part A — "who earns this?" (household income attribution).
 *
 * GET /api/income/earners — the income-earning household members with the
 * LegalEntity each one's income attributes to (`Income.ownerEntityId`).
 * SELF → the user's PERSONAL_NAME entity (the default); other earners → an
 * INDIVIDUAL entity linked via `householdMemberId`, created idempotently on
 * first read. Thin wrapper (§12.3) over `listIncomeEarnerEntities`.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listIncomeEarnerEntities } from '@/lib/services/legalEntityService';

export const GET = withPermission('income.read', async (_request, auth) => {
  try {
    const earners = await listIncomeEarnerEntities(auth.userId);
    return NextResponse.json({ success: true, data: { earners } });
  } catch (error) {
    console.error('[income/earners] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list income earners' },
      { status: 500 },
    );
  }
});
