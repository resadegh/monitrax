/**
 * Phase 41i.3b — POST /api/admin/calc-audit/audit-user/[userId]
 *
 * Admin-triggered "Audit this user" — runs every registered
 * `UserAuditAdapter` for the target user, validates output via
 * sanity invariants, and persists `CalcAuditFinding` rows
 * (source `L3_ON_DEMAND`) for any failures.
 *
 * Auth: admin session via `verifyAdminGCPAuth` + `audit:read`
 * permission. (No Cloud Scheduler path — the scheduler-friendly
 * Full Scan endpoint lives at `/full-scan` and iterates all users;
 * this endpoint is the manual per-user button.)
 *
 * Per HR-3 (CLAUDE.md / Phase 41 §1 invariant 11) — admin-only
 * surface; never user-facing. Findings flow into the existing
 * `CalcAuditFinding` queue + 41i.4 alerting (Slack/email when
 * severity ≥ HIGH).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { runUserAudit } from '@/lib/calc-audit/userAudit';
import '@/lib/calc-audit/userAudit'; // Ensure adapter registry bootstrapped
import '@/lib/calc-audit'; // Ensure calc-engine registry bootstrapped
import prisma from '@/lib/db';

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
          message: 'Admin portal is not enabled',
        },
      },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json(
      {
        error:
          authResult.error ?? { code: 'UNAUTHORIZED', message: 'Authorization required' },
      },
      { status: 401 },
    );
  }
  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Insufficient permissions',
        },
      },
      { status: 403 },
    );
  }

  const { userId } = await context.params;
  if (!userId || typeof userId !== 'string' || userId.length === 0) {
    return NextResponse.json(
      { error: { code: 'INVALID_USER_ID', message: 'userId is required' } },
      { status: 400 },
    );
  }

  // Confirm user exists. Audit on a non-existent userId would still
  // succeed (no data → all adapters return null → all SKIPPED) but
  // surface a friendlier 404 for typos.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: { code: 'USER_NOT_FOUND', message: 'No user with that id' } },
      { status: 404 },
    );
  }

  let report;
  try {
    report = await runUserAudit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Per-user audit harness error:', err);
    return NextResponse.json(
      {
        error: {
          code: 'AUDIT_HARNESS_ERROR',
          message: `Per-user audit harness threw: ${message.slice(0, 200)}`,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { report, userEmail: user.email } });
}
