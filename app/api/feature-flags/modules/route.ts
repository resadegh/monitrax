/**
 * GET /api/feature-flags/modules
 *
 * Module flag map in one call — the client-side counterpart of the
 * server gate (the Basiq public-endpoint pattern,
 * PROD_SIMPLIFICATION_PLAN.md §4.3; R0 makes it EFFECTIVE-per-user).
 *
 * Auth is OPTIONAL:
 *   - No Authorization header → the GLOBAL map (unauthenticated
 *     surfaces see exactly what the flags say — booleans as public as
 *     the nav they drive).
 *   - Bearer token present → the session user's EFFECTIVE map:
 *     global ∥ active per-user override (R0). This is what lets an
 *     override holder see a hidden module while everyone else stays
 *     hidden. An invalid/expired token 401s; the client context treats
 *     that as all-hidden (fail closed).
 *
 * Only registry module keys are exposed — never the whole flag table.
 * Any error or missing row reads as `false` (fail closed = hidden).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { isModuleEnabled, isModuleEnabledForUser } from '@/lib/featureFlags/moduleGate';
import { MODULE_KEYS, type ModuleKey } from '@/lib/featureFlags/moduleRegistry';

export const dynamic = 'force-dynamic';

async function buildMap(userId?: string): Promise<Record<ModuleKey, boolean>> {
  const entries = await Promise.all(
    MODULE_KEYS.map(
      async (key) =>
        [key, userId ? await isModuleEnabledForUser(key, userId) : await isModuleEnabled(key)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<ModuleKey, boolean>;
}

export async function GET(request: NextRequest) {
  if (!request.headers.get('authorization')) {
    return NextResponse.json({ modules: await buildMap() });
  }
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    return NextResponse.json({ modules: await buildMap(authReq.user!.userId) });
  });
}
