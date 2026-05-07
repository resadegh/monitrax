/**
 * Phase 41i.6c — POST /api/admin/calc-audit/full-scan
 *
 * Runs `runSurfaceAuditFullScan` and streams progress to the admin UI
 * as NDJSON (one JSON object per line). The admin page consumes the
 * stream via the Fetch API and renders a live progress counter +
 * outcome list per user.
 *
 * Two auth paths (mirrors 41i.5 anomaly-scan endpoint):
 *   1. Admin session (`audit:read` permission)
 *   2. Cloud Scheduler shared secret via `CALC_AUDIT_SCHEDULER_SHARED_SECRET`
 *      (deferred to PROD per D-41i.6-4; manual `[Full scan]` is the v1 path)
 *
 * Body (optional): `{ userLimit?: number, descriptorIds?: string[] }`.
 *
 * Per spec doc PHASE_41I_6_SURFACE_AUDIT.md §10 — admin sees a per-
 * user counter + ETA + cancel affordance (cancel ships in v2).
 *
 * Per HR-3 — admin-side only. Reviewers reject any user-facing route
 * that exposes calc-correctness warnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  runSurfaceAuditFullScan,
  type FullScanProgress,
  type RunFullScanOptions,
} from '@/lib/calc-audit/surfaceAudit';
import '@/lib/calc-audit/surfaces'; // Ensure registry bootstrapped

interface ScanBody {
  userLimit?: number;
  descriptorIds?: string[];
}

const MAX_USER_LIMIT = 10_000;

/**
 * Cloud Scheduler auth path — same constant-time pattern as 41i.5.
 */
function isAuthorisedScheduler(request: NextRequest): boolean {
  const expected = process.env.CALC_AUDIT_SCHEDULER_SHARED_SECRET;
  if (!expected || expected.length < 32) return false;
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice('Bearer '.length).trim();
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
  if (!isScheduler) {
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
  }

  // Parse body (optional).
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

  const options: RunFullScanOptions = {};
  if (typeof body.userLimit === 'number' && Number.isFinite(body.userLimit)) {
    options.userLimit = Math.max(1, Math.min(MAX_USER_LIMIT, Math.floor(body.userLimit)));
  }
  if (Array.isArray(body.descriptorIds)) {
    options.descriptorIds = body.descriptorIds.filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
  }

  // Stream NDJSON. One JSON object per line.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: FullScanProgress) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };
      try {
        for await (const event of runSurfaceAuditFullScan(options)) {
          emit(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        emit({ type: 'ERROR', message });
        console.error('Full Scan harness error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no', // Disable Vercel/proxy buffering for live streaming
    },
  });
}
