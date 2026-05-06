/**
 * POST /api/admin/run-seed
 *
 * SUPER_ADMIN-only endpoint that runs idempotent Prisma seeds against the
 * live database via the existing Vercel runtime auth (WIF + Cloud SQL
 * Connector). Avoids needing a Cloud SQL Proxy on the operator's machine.
 *
 * Body: { action: 'lighthouse' | 'portal-access', reset?: boolean,
 *         extraEmails?: string[] }
 *
 * Returns: { success, output, error? }
 *
 * Why this endpoint exists:
 *   The lighthouse demo data and portal access grant for
 *   admin@monitrax.com.au need to land in production. The local CLI path
 *   (`npm run seed:lighthouse`) requires a Cloud SQL Proxy + IAM
 *   credentials on the operator's machine. This route piggybacks on the
 *   already-authenticated Vercel runtime to do the same work in a click,
 *   gated behind a SUPER_ADMIN admin auth check.
 */

import { NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { runLighthouseSeed } from '@/prisma/seed-lighthouse';
import { runPortalAccessSeed } from '@/prisma/seed-portal-test-access';

// Vercel function timeout — seeds touch ~hundreds of rows; lighthouse with
// --reset can take 60-120s. 300s is the Vercel Pro hard cap.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RunSeedBody {
  action?: 'lighthouse' | 'portal-access';
  reset?: boolean;
  extraEmails?: string[];
}

export async function POST(request: Request) {
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status:
          authResult.error?.code === ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED
            ? 503
            : 401,
      },
    );
  }

  if (authResult.context.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Only SUPER_ADMIN can run database seeds.',
        },
      },
      { status: 403 },
    );
  }

  let body: RunSeedBody;
  try {
    body = (await request.json()) as RunSeedBody;
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Body must be JSON.' } },
      { status: 400 },
    );
  }

  const action = body.action;
  if (action !== 'lighthouse' && action !== 'portal-access') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ACTION',
          message: "action must be 'lighthouse' or 'portal-access'.",
        },
      },
      { status: 400 },
    );
  }

  // Capture seed console output so the operator gets feedback in the UI.
  const lines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const append = (prefix: string) => (...args: unknown[]) => {
    const text = args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
    lines.push(prefix + text);
  };
  console.log = append('');
  console.error = append('[err] ');

  try {
    if (action === 'lighthouse') {
      await runLighthouseSeed({ reset: !!body.reset });
    } else {
      await runPortalAccessSeed(body.extraEmails ?? []);
    }
    return NextResponse.json({
      success: true,
      action,
      output: lines.join('\n'),
      runBy: authResult.context.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        action,
        output: lines.join('\n'),
        error: { code: 'SEED_FAILED', message },
      },
      { status: 500 },
    );
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}
