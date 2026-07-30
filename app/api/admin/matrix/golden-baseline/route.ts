/**
 * MON-131 Tranche −1b — Matrix Relay: golden-baseline capture endpoint.
 *
 * GET /api/admin/matrix/golden-baseline[?userId=<id>]
 *   Runs the ONE golden-baseline capture (lib/matrix/goldenBaseline.ts —
 *   shared verbatim with scripts/matrix/golden-baseline.mjs) server-side,
 *   where the database is reachable, and returns the tree. Removes Reza's
 *   terminal from the MON-131 capture→migrate→diff→verify loop.
 *
 * Per HR-3: this is an admin-side surface only. No user-facing
 * variant exists (and reviewers reject any PR that adds one).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  captureGoldenBaseline,
  resolveSoleUserId,
  deployedSha,
  hashBaseline,
  RENDERED_PART_C,
} from '@/lib/matrix/goldenBaseline';

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

  let userId = request.nextUrl.searchParams.get('userId') || undefined;
  if (!userId) {
    const r = await resolveSoleUserId();
    if ('candidates' in r) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MULTIPLE_USERS',
            message: 'More than one user exists — pass ?userId=<id>',
            details: r.candidates,
          },
        },
        { status: 400 },
      );
    }
    userId = r.userId;
  }

  const tree = await captureGoldenBaseline(userId);

  // T1 start-gate brief §1.2 / VR-042 §2.3: `?format=hash` returns the
  // ~400-byte committable summary instead of the 282 KB tree — the canonical
  // hash (lib/matrix/goldenBaseline.ts hashBaseline, THE one construction) is
  // sufficient for the CLEAN/STOP gate: a matching treeHash proves nothing
  // moved anywhere. Localising a mismatch still needs the full tree.
  // `captureErrors` is the partial-capture tripwire: non-empty = NOT a valid
  // baseline (a failed tree serialises as a 0-numeric-leaf stub — drift D8).
  if (request.nextUrl.searchParams.get('format') === 'hash') {
    const summary = hashBaseline(tree);
    return NextResponse.json({
      success: true,
      data: {
        sha: deployedSha(),
        capturedAt: new Date().toISOString(),
        userId,
        trees: Object.keys(tree).length,
        ...summary,
        renderedPartC: RENDERED_PART_C,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      sha: deployedSha(),
      capturedAt: new Date().toISOString(),
      userId,
      renderedPartC: RENDERED_PART_C,
      tree,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
