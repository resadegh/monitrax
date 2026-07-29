/**
 * MON-131 Tranche −1b — Matrix Relay: ratchet-state endpoint.
 *
 * GET /api/admin/matrix/census
 *   Returns the committed producer-census seed and the source-lock exception
 *   debt at the DEPLOYED SHA, so the Matrix can read the ratchet state without
 *   a checkout. Static JSON imports (bundled at build time) — no DB, no
 *   filesystem reads from process.cwd() (Next file tracing).
 *
 * Per HR-3: this is an admin-side surface only. No user-facing
 * variant exists (and reviewers reject any PR that adds one).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { deployedSha } from '@/lib/matrix/goldenBaseline';
import producerCensus from '@/.audit/producer-census.json';
import sourceLockExceptions from '@/.audit/source-lock-exceptions.json';

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: authResult.error }, { status: 401 });
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

  const censusTotal = Object.values(producerCensus.counts as Record<string, number>)
    .reduce((s, n) => s + n, 0);
  const sourceLockTotal = (sourceLockExceptions.entries as Array<{ count: number }>)
    .reduce((s, e) => s + e.count, 0);

  return NextResponse.json({
    success: true,
    data: {
      sha: deployedSha(),
      producerCensus: {
        ...producerCensus,
        total: censusTotal,
      },
      sourceLockExceptions: {
        ...sourceLockExceptions,
        total: sourceLockTotal,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
