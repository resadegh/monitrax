/**
 * @deprecated 2026-05-01 — Soft-deleted. REMOVE AFTER 2026-05-15 if no incidents.
 *
 * This route was the legacy local-password registration path. It
 * has been superseded by GCP Identity Platform (Firebase Auth),
 * which the frontend calls directly via the Firebase SDK. New users
 * are auto-synced to the local DB via `syncGCPUser()` which logs
 * `REGISTER` audit events at the GCP boundary.
 *
 * Per the dead-code audit on 2026-05-01, this route has zero callers
 * across the entire codebase. It has been replaced with a 410 Gone
 * stub so that any forgotten caller (frontend code, external
 * integration, automation) fails loudly rather than silently
 * creating a non-Firebase user record.
 *
 * **Trigger to delete the file entirely:** ≥ 2026-05-15 if Vercel
 * production logs show ZERO requests to `/api/auth/register`. If any
 * request is observed, investigate the caller before deleting.
 *
 * Tracked in: `docs/IMPLEMENTATION_PLAN.md` tech-debt #2.
 * See: `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md`.
 */

import { NextRequest, NextResponse } from 'next/server';

const DEPRECATION_PAYLOAD = {
  error: 'Endpoint removed',
  message:
    'POST /api/auth/register was deprecated in Feb 2026 (GCP Identity Platform cutover) and disabled on 2026-05-01. Use the Firebase Auth SDK client-side instead.',
  deprecatedSince: '2026-02-01',
  disabledOn: '2026-05-01',
  removalEarliest: '2026-05-15',
  migration: 'See docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md',
} as const;

function logUnexpectedHit(request: NextRequest, method: string) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const ua = request.headers.get('user-agent') ?? 'unknown';
  console.warn(
    `[deprecated-route] ${method} /api/auth/register hit after soft-delete. ip=${ip} ua="${ua}"`,
  );
}

export async function POST(request: NextRequest) {
  logUnexpectedHit(request, 'POST');
  return NextResponse.json(DEPRECATION_PAYLOAD, { status: 410 });
}

export async function GET(request: NextRequest) {
  logUnexpectedHit(request, 'GET');
  return NextResponse.json(DEPRECATION_PAYLOAD, { status: 410 });
}
