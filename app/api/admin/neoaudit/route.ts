/**
 * NEOAUDIT ADMIN-TARGETED AUDIT — GET /api/admin/neoaudit?userId=… (R3-self, admin variant)
 *
 * Runs the SAME NeoAudit Ring-3 accounting invariants as /api/verify/invariants,
 * but on a SELECTED user's data instead of the caller's own — so the operator
 * can verify Ring-3 on real customer accounts, not just the admin's own
 * (the gap Reza hit 2026-07-12: the panel could only ever audit the empty admin
 * test account). Both endpoints call the ONE shared `computeSelfAuditReport`
 * (§12.2.1 / §12.3) — self-audit and admin-audit can never diverge.
 *
 * CDR (§13): admin-gated exactly like /api/admin/users (isAdminPortalAccessible
 * + verifyAdminGCPAuth + hasPermission('users:read')) — the same posture that
 * already lets an admin view a user's financials. Returns aggregates + accounting
 * identities only (net worth, totals, per-property equity), never raw
 * transactions/BSBs. Every run is written to the admin audit log (§13.2 —
 * audit everything). No third-party egress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computeSelfAuditReport } from '@/lib/verification/selfAuditInvariants';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  try {
    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Same gate as viewing a user's financials in the admin portal.
    if (!hasPermission(authResult.context.role, 'users:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'MISSING_USER_ID', message: 'userId query parameter is required' } },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.USER_NOT_FOUND, message: 'User not found' } },
        { status: 404 },
      );
    }

    const snapshot = await getMasterFinancialSnapshot(userId);
    const report = computeSelfAuditReport(snapshot, user.email);

    // §13.2 — audit the cross-user access. Metadata carries only the PASS/FAIL
    // shape, never a financial figure (CDR sanitisation §13.3).
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: authResult.context.adminId,
        action: 'NEOAUDIT_RUN',
        category: 'USER_MANAGEMENT',
        targetType: 'User',
        targetId: userId,
        description: `Ran NeoAudit self-audit on ${user.email}`,
        ipAddress: authResult.context.ipAddress,
        metadata: {
          pass: report.pass,
          failureCount: report.failureCount,
          advisoryCount: report.advisories.length,
        },
      },
    }).catch(() => {}); // fire-and-forget — never block the audit result on logging

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('NeoAudit admin-targeted audit error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Self-audit failed to run' } },
      { status: 500 },
    );
  }
}
