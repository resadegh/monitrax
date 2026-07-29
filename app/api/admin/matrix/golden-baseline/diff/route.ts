/**
 * MON-131 Tranche −1b — Matrix Relay: golden-baseline diff endpoint.
 *
 * POST /api/admin/matrix/golden-baseline/diff
 *   Body: { baseline: <a previously captured tree>, userId?, expectedMoves?:
 *   [{pathPrefix, why, arithmetic}] }. Captures FRESH at the deployed SHA and
 *   runs the ONE three-outcome diff (lib/matrix/goldenBaseline.ts — shared
 *   verbatim with the CLI's --diff): unchanged · EXPECTED · MOVED-UNDECLARED.
 *   A STOP verdict is a 200 with that body, NOT an HTTP error — the Matrix
 *   records the verdict.
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
  diffBaselines,
  resolveSoleUserId,
  deployedSha,
  type BaselineTree,
  type ExpectedMove,
} from '@/lib/matrix/goldenBaseline';

export async function POST(request: NextRequest) {
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

  let body: { baseline?: BaselineTree; userId?: string; expectedMoves?: ExpectedMove[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.baseline || typeof body.baseline !== 'object') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'MISSING_BASELINE', message: 'Body must carry { baseline: <captured tree> }' },
      },
      { status: 400 },
    );
  }

  let userId = body.userId;
  if (!userId) {
    const r = await resolveSoleUserId();
    if ('candidates' in r) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MULTIPLE_USERS',
            message: 'More than one user exists — pass userId in the body',
            details: r.candidates,
          },
        },
        { status: 400 },
      );
    }
    userId = r.userId;
  }

  const fresh = await captureGoldenBaseline(userId);
  const diff = diffBaselines(body.baseline, fresh, body.expectedMoves ?? []);

  // verdict mapping (brief §2.2): STOP is a 200 — the Matrix records it.
  return NextResponse.json({
    success: true,
    data: {
      sha: deployedSha(),
      userId,
      verdict: diff.verdict,
      moves: {
        unchanged: diff.unchanged,
        declared: diff.declared,
        unexpected: diff.unexpected,
        added: diff.added,
        removed: diff.removed,
      },
      freshTree: fresh,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
