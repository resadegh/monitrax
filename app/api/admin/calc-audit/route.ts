/**
 * Phase 41i — Calculation Audit admin API.
 *
 * GET /api/admin/calc-audit
 *   Runs the L1 differential against every registered calc engine
 *   and returns the report. Admin-only (audit:read permission).
 *
 * Per HR-3: this is an admin-side surface only. No user-facing
 * variant exists (and reviewers reject any PR that adds one).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { runDifferential, calcEngineRegistry } from '@/lib/calc-audit';

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

  const report = await runDifferential();

  // Engine catalogue for the admin portal — what's registered, by category.
  const catalogue = calcEngineRegistry.list().map((e) => ({
    name: e.name,
    description: e.description,
    category: e.category,
    sourcePath: e.sourcePath,
    fixtureCount: e.fixtures.length,
    fixtures: e.fixtures.map((f) => ({
      name: f.name,
      description: f.description,
      assertionCount: f.assertions.length,
      authoritySource: f.authoritySource,
    })),
  }));

  return NextResponse.json({
    success: true,
    data: {
      report,
      catalogue,
      engineCount: calcEngineRegistry.size(),
      fixtureCount: calcEngineRegistry.totalFixtures(),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
