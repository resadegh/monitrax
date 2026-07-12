/**
 * NEOAUDIT SELF-AUDIT — GET /api/verify/invariants (R3-self node)
 *
 * Runs the NeoAudit Ring-3 accounting invariants SERVER-SIDE on the logged-in
 * user's OWN real data and returns PASS/FAIL with exact deltas. The "one click
 * on real data" instrument from the NeoAudit blueprint (NEOAUDIT.md §1.2
 * R3-self, §6 Release Scorecard) — it replaces most of the manual
 * Claude-in-Chrome Part-E relay.
 *
 * Thin wrapper (§12.3): fetch the caller's canonical snapshot, run the ONE
 * shared invariant computation (`computeSelfAuditReport`), return it. The admin
 * variant (GET /api/admin/neoaudit?userId=…) runs the same function on a
 * selected user's snapshot — so self-audit and admin-audit can never diverge.
 *
 * CDR (§13): user-scoped via withPermission('report.read'); returns the user's
 * own figures to the user (same posture as every dashboard endpoint); nothing
 * logged, nothing third-party.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computeSelfAuditReport } from '@/lib/verification/selfAuditInvariants';

export const GET = withPermission('report.read', async (_request, auth) => {
  try {
    const snapshot = await getMasterFinancialSnapshot(auth.userId);
    return NextResponse.json({
      success: true,
      data: computeSelfAuditReport(snapshot, auth.email),
    });
  } catch (error) {
    console.error('NeoAudit self-audit error:', error);
    return NextResponse.json(
      { success: false, error: 'Self-audit failed to run' },
      { status: 500 },
    );
  }
});
