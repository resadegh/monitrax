/**
 * @deprecated 2026-05-01 — Soft-deleted. REMOVE AFTER 2026-05-15 if no incidents.
 *
 * This route was the legacy local-password login path. It has been
 * superseded by GCP Identity Platform (Firebase Auth), which the
 * frontend calls directly via the Firebase SDK. Auth events are now
 * captured at the GCP boundary in `syncGCPUser()`
 * (`lib/auth/gcpIdentity.ts`) as `OAUTH_LOGIN` audit events.
 *
 * Per the dead-code audit on 2026-05-01, this route has zero callers
 * across the entire codebase. It has been replaced with a 410 Gone
 * stub so that any forgotten caller (frontend code, external
 * integration, automation) fails loudly rather than silently
 * succeeding against a stale auth path.
 *
 * **Trigger to delete the file entirely:** ≥ 2026-05-15 if Vercel
 * production logs show ZERO requests to `/api/auth/login`. If any
 * request is observed, investigate the caller before deleting.
 *
 * Tracked in: `docs/IMPLEMENTATION_PLAN.md` tech-debt #2.
 * See: `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md`.
 */

import { NextRequest, NextResponse } from 'next/server';

const DEPRECATION_PAYLOAD = {
  error: 'Endpoint removed',
  message:
    'POST /api/auth/login was deprecated in Feb 2026 (GCP Identity Platform cutover) and disabled on 2026-05-01. Use the Firebase Auth SDK client-side instead.',
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
  // Loud warning so soft-delete period surfaces unexpected callers in
  // Vercel logs. If this fires during the 2-week soft-delete window,
  // do NOT proceed with the hard delete — investigate the caller.
  console.warn(
    `[deprecated-route] ${method} /api/auth/login hit after soft-delete. ip=${ip} ua="${ua}"`,
  );
}

export async function POST(request: NextRequest) {
  logUnexpectedHit(request, 'POST');
  return NextResponse.json(DEPRECATION_PAYLOAD, { status: 410 });
}

// GET stub catches the common "browser typed the URL" case so the
// 410 response shows a useful message in DevTools instead of a 405.
export async function GET(request: NextRequest) {
  logUnexpectedHit(request, 'GET');
  return NextResponse.json(DEPRECATION_PAYLOAD, { status: 410 });
}
