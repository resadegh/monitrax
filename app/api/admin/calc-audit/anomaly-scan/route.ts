/**
 * Phase 41i.5 — L2 anomaly-scan trigger endpoint.
 *
 * POST /api/admin/calc-audit/anomaly-scan
 *
 * Two auth paths (whichever proves up first wins):
 *   1. **Admin session** (`audit:read` permission via the admin
 *      portal pipeline) — for manual triggers from the admin UI.
 *   2. **Cloud Scheduler** OIDC token via the
 *      `CALC_AUDIT_SCHEDULER_SHARED_SECRET` env-var match in the
 *      `Authorization: Bearer <secret>` header — for scheduled
 *      runs. See `docs/operational/calc-audit/cloud-scheduler-setup.md`.
 *
 * Body (optional): `{ lookbackDays?, highFrequencyThreshold?,
 *   stablePeriodDays?, regressionGapDays? }`.
 *
 * Returns the `AnomalyScanReport`. Per HR-3 — admin-side only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  scanForAnomalies,
  type AnomalyScanInput,
} from '@/lib/calc-audit/anomalyDetection';

interface ScanBody {
  lookbackDays?: number;
  highFrequencyThreshold?: number;
  stablePeriodDays?: number;
  regressionGapDays?: number;
}

/**
 * Cloud Scheduler auth path — checks for a shared secret in the
 * Authorization header. Returns `true` if authorised via scheduler.
 *
 * The scheduler pattern is preferred over service-account OIDC for
 * v1 because it's simpler to wire (single env var vs JWT verification
 * boilerplate); a future hardening pass can swap to OIDC.
 */
function isAuthorisedScheduler(request: NextRequest): boolean {
  const expected = process.env.CALC_AUDIT_SCHEDULER_SHARED_SECRET;
  if (!expected || expected.length < 32) return false;
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice('Bearer '.length).trim();
  // Constant-time-ish comparison via length + char-by-char.
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

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

  // Auth path 1: Cloud Scheduler shared secret.
  const isScheduler = isAuthorisedScheduler(request);

  // Auth path 2: admin session.
  let authedAdminEmail: string | null = null;
  if (!isScheduler) {
    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json(
        { error: authResult.error ?? { code: 'UNAUTHORIZED', message: 'Authorization required' } },
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
    authedAdminEmail = authResult.context.email;
  }

  let body: ScanBody = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as ScanBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST_BODY', message: 'Body must be valid JSON.' } },
      { status: 400 },
    );
  }

  const input: AnomalyScanInput = {
    lookbackDays: clamp(body.lookbackDays, 1, 365),
    highFrequencyThreshold: clamp(body.highFrequencyThreshold, 1, 1_000),
    stablePeriodDays: clamp(body.stablePeriodDays, 1, 365),
    regressionGapDays: clamp(body.regressionGapDays, 1, 365),
  };

  const report = await scanForAnomalies(input);

  return NextResponse.json({
    success: true,
    data: report,
    meta: {
      timestamp: new Date().toISOString(),
      triggeredBy: isScheduler ? 'cloud-scheduler' : authedAdminEmail,
    },
  });
}

function clamp(
  v: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(min, Math.min(max, Math.round(v)));
}
